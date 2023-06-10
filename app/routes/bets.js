const express = require('express');
var jwt = require('jsonwebtoken');
const userValidation = require('../validators/user');
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
let config = require('config');
const Bets = require('../models/bets');
const User = require('../models/user');
const CricketMatch = require('../models/cricketMatches');
const Markets = require('../models/marketTypes');
const SubMarketType = require('../models/subMarketTypes');
const loginRouter = express.Router();
const betValidator = require('../validators/bets');
const maxAllowedBetSizes = require('../models/betLimits');
const userBetSizes = require('../models/userBetSizes');
const betRates = require('../models/betRate');

async function getParents(userId) {
  const parentUserIds = [];
  let currentUserId = userId;
  console.log('parentUser',parentUserIds);
  while (currentUserId) {
    const parentUser = await User.findOne({ userId: currentUserId }).exec();
    if (!parentUser || !parentUser.createdBy || parentUser.createdBy == currentUserId) {
      break;
    }
    parentUserIds.push(parentUser.createdBy);
    currentUserId = parentUser.createdBy;
  }

  return parentUserIds;
}

const updateParentUserBalance = async (parentUsers, remainingAmount) => {
  let prev = 0;
  parentUsers.forEach(user => {
    let current = user.downLineShare;
    user["commission"] = current - prev;
    prev = current;
  });

  for (const user of parentUsers) {
    user.exposure -= (user.commission / 100) * remainingAmount;
    user.availableBalance -= (user.commission / 100) * remainingAmount;
    await user.save();
  }
};

async function placeBet(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const { marketId, selectedTeam, betAmount, betRate, matchId, subMarketId } = req.body;

  const userId = req.decoded.userId;
  if (req.decoded.login.role !== '5') {
    return res.status(404).send({ message: 'You are not allowed to bet' });
  }

  try {
    const user = await User.findOne({ userId }).exec();
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    if (user.availableBalance < betAmount) {
      return res.status(404).send({ message: 'Insufficient balance' });
    }
    if (user.bettingAllowed == false) {
      return res.status(404).send({ message: 'Betting is not allowed for your account' });
    }
    // default maxbetsize should be of that set by company but if the user set his own betsize then his
    // and we cannot place a bet of the amount that is greater than this maxbetsize

    // need review check 
    // const UserMaxBetSize = await userBetSizes.findOne({ marketId: marketId }).exec();
    // console.log('UserMaxBetSize',UserMaxBetSize)
    // const MaxBetSize = await maxAllowedBetSizes.findOne({ marketId: marketId }).exec();
    // console.log('MaxBetSize',MaxBetSize)

    // let errorMessage;
    // if (UserMaxBetSize && UserMaxBetSize.amount < MaxBetSize.maxAmount) {
    //   errorMessage = `Max Size is: ${UserMaxBetSize.amount}`;
    // } else {
    //   errorMessage = `Max Size is: ${MaxBetSize.maxAmount}`;
    // }


    // if (betAmount > (UserMaxBetSize?.amount || MaxBetSize?.maxAmount)) {
    //   return res.status(404).send({ message: errorMessage });
    // }
    // need review check  end

    const parentUserIds = await getParents(user.userId);
    console.log('parentUserIds', parentUserIds);

    const parentUser = await User.find({
      userId: { $in: [...parentUserIds] },
      isDeleted: false
    }).sort({role: -1});
    // console.log('parentUser', parentUser);

    const blockedMarketPlaces = [];
    const blockedSubMarkets = [];
    const blockedSubMarketsByParent = [];

    parentUser.forEach(obj => {
      blockedMarketPlaces.push(...obj.blockedMarketPlaces);
      blockedSubMarkets.push(...obj.blockedSubMarkets);
      blockedSubMarketsByParent.push(...obj.blockedSubMarketsByParent);      
    });
    const uniqueBlockedMarketPlaces = [...new Set(blockedMarketPlaces)];
    const uniqueBlockedSubMarkets = [...new Set(blockedSubMarkets)];
    const uniqueBlockedSubMarketsByParent = [...new Set(blockedSubMarketsByParent)];

    console.log('uniqueBlockedMarketPlaces', uniqueBlockedMarketPlaces);
    console.log('uniqueBlockedSubMarkets', uniqueBlockedSubMarkets);

    if (uniqueBlockedMarketPlaces.includes(marketId) || uniqueBlockedSubMarkets.includes(subMarketId) 
          || uniqueBlockedSubMarketsByParent.includes(subMarketId) ){
      return res.status(404).send({ message: 'Betting disabled by your dealer' });
    }
    // Check if the user is allowed to place a bet in the specified market and submarket
    if (user.betLockStatus == true || user.blockedSubMarketsByParent.includes(subMarketId)) {
      return res.status(400).send({ message: 'Bet not allowed for your account' });
    }

    const match = await CricketMatch.findOne({
      sportsId: marketId,
      id: matchId,
    });
    

    if (!match) {
      console.log(`Match not found for sports ID ${marketId}`);
      return res.status(404).send({ message: `Match not found for sports ID ${marketId}` });
    }
   // Check if the match has ended

    // need review 
    if (true == false &&  match.matchEnded) {
      console.log(`Match has already ended for sports ID ${marketId}`);
      return res.status(404).send({ message: `Match has already ended for sports ID ${marketId}` });
    }
    let  returnAmount = 0;
    let  winningAmount = 0;
    let  loosingAmount = 0;
    let  remainingAmount = 0;
    if (req.body.type == 0){
      // for Back Will change these Ammounts
      returnAmount = betAmount * betRate - betAmount;
      winningAmount = betAmount * betRate - betAmount;
      console.log('returnAmount',returnAmount);

      loosingAmount = req.body.betAmount;
      remainingAmount = (req.body.betAmount * req.body.betRate) - req.body.betAmount;
      console.log('remainingAmount',remainingAmount);

    } else {
      // for lay Will change these Ammounts
      returnAmount  = betAmount;
      winningAmount = betAmount;
      loosingAmount = (req.body.betAmount * betRate) - req.body.betAmount;
      remainingAmount = betAmount;
    }

    // Create the bet object
    const bet = new Bets({
      marketId,
      userId,
      team: selectedTeam,
      betAmount,
      betRate,
      returnAmount,
      matchId: matchId,
      matchStatus: match.status,
      loosingAmount: loosingAmount,
      winningAmount: winningAmount,
      subMarketId: subMarketId,
      runner: selectedTeam,
      event: match.name,
      type:  req.body.type
    });

    // Save the bet object to the database
    console.log( `Bet placed for user ID ${userId}, sports ID ${marketId}, and team ${selectedTeam}`);
    bet.save(async (err, result) => {
      if (err) {
        console.log('err', err);
        return res.status(404).send({ message: 'Error placing bet' });
      }
      try {
        const updatedUser = await User.findOneAndUpdate(
          { userId: userId },
          {
            $inc: {
              availableBalance: -loosingAmount,
              exposure: -loosingAmount
            },
          },
          { new: true }
        );
        await updateParentUserBalance(parentUser, remainingAmount);
    
        return res.send({
          success: true,
          message: 'Bet placed successfully',
          results: result,
        });
      }
      catch (error) {
        console.error('error', error);
        return res.status(404).send({ message: 'Error updating user balance' });
      }
    });
  } catch (error) {
    console.error('error', error);
    return res.status(404).send({ message: 'Error placing bet' });
  }
}

function getUserBets(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  // Initialize variables with default values
  let query = {};
  let page = 1;
  let sort = -1;
  let sortValue = 'createdAt';
  var limit = config.pageSize;
  if (req.body.numRecords) {
    if (isNaN(req.body.numRecords))
      return res.status(404).send({ message: 'NUMBER_RECORDS_IS_NOT_PROPER' });
    if (req.body.numRecords < 0)
      return res.status(404).send({ message: 'NUMBER_RECORDS_IS_NOT_PROPER' });
    if (req.body.numRecords > 100)
      return res.status(404).send({
        message: 'NUMBER_RECORDS_NEED_TO_LESS_THAN_100',
      });
    limit = Number(req.body.numRecords);
  }
  if (req.body.sortValue) sortValue = req.body.sortValue;
  if (req.body.sort) {
    sort = Number(req.body.sort);
  }
  if (req.query.page) {
    page = Number(req.body.page);
  }
  if (req.body.endDate && req.body.startDate) {
    query.createdAt = {
      $gte: req.body.startDate,
      $lte: req.body.endDate,
    };
  }
  if (req.body.userId) {
    query.userId = req.body.userId;
  }
  if (req.body.status) {
    query.status = req.body.status;
  }
  if (req.body.marketId) {
    query.marketId = req.body.marketId;
  }
  if (req.body.searchValue) {
    const searchRegex = new RegExp(req.body.searchValue, 'i');
    query.$or = [
      { name: { $regex: searchRegex } },
      {
        $expr: {
          $regexMatch: { input: { $toString: '$betRate' }, regex: searchRegex },
        },
      },
      {
        $expr: {
          $regexMatch: {
            input: { $toString: '$betAmount' },
            regex: searchRegex,
          },
        },
      },
    ];
  }
  Bets.paginate(
    query,
    { page: page, sort: { [sortValue]: sort }, limit: limit },
    (err, result) => {
      if (err || !result)
        return res.status(404).send({ message: 'bets not found' });
      return res.send({
        success: true,
        message: 'bets record found',
        results: result,
      });
    }
  );
}

function betFunds(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  User.findOne({ userId: req.decoded.userId }, (err, user) => {
    if (err || !user) {
      return res.send({ message: 'User Not Found' });
    }

    let results;
    if (req.decoded.role == '5') {
      results = {
        balance: user.balance,
        liable: user.exposure,
        credit: user.credit,
        available: user.availableBalance,
        activeBets: 3,
      };
    } else {
      results = {
        balance: 0,
        liable: user.exposure,
        credit: 0,
        available: 0,
        activeBets: 3,
      };
    }

    return res.send({ message: 'Funds Record Found', results: results });
  });
}

function createBetRates(req, res) {
  const recordsToCreate = 2000;
  const dummyData = [];
  let betRate = 1;

  for (let i = 0; i < recordsToCreate; i++) {
    const roundedBetRate = Number(betRate.toFixed(1));
    let createdAt = new Date().getTime() / 1000
    dummyData.push({ betRate: roundedBetRate, createdAt });
    betRate += 0.1;
  }

  betRates.insertMany(dummyData)
    .then(() => {
      res.status(200).json({ message: 'Dummy data created successfully.' });
    })
    .catch((error) => {
      res.status(500).json({ error: 'Error creating dummy data.' });
    });
}

function getBetRates(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  betRates.find(
    {},
    (err, result) => {
      if (err || !result)
        return res.status(404).send({ message: 'bets rate not found' });
      return res.send({
        success: true,
        message: 'bets rate record found',
        results: result,
      });
    }
  );
}
loginRouter.post('/placeBet', betValidator.validate('placeBet'), placeBet);
loginRouter.post('/getUserBets', getUserBets);
loginRouter.get('/betFunds', betFunds);
loginRouter.post('/createBetRates', createBetRates);
loginRouter.get('/getBetRates', getBetRates);

module.exports = { loginRouter, getParents };
