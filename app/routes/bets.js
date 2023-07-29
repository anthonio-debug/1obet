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
const MarketType = require('../models/marketTypes');
const Odds = require('../models/odds');
const Events = require('../models/events');
const FancyGames = require('../models/fancyGames');
const RaceOdds = require('../models/raceOdds');
const RaceMarkets = require('../models/raceMarkets');

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
    console.log('user.availableBalance',typeof user.availableBalance);
    await user.save();
  }
};

async function placeBet(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  try {
    let match;
    if (req.decoded.login.role !== '5') {
      return res.status(404).send({ message: 'You are not allowed to bet' });
    }
    const selectedTime = new Date(req.body.selectedTime).getTime()
console.log('selectedTime',selectedTime);

    const { selectionId, betAmount, betRate, matchId, subMarketName,raceMarketId, sportsId } = req.body;
    const marketplace = await SubMarketType.findOne({ name: subMarketName, marketId: sportsId }).exec();
      if (!marketplace) {
        return res.status(404).send({ message: 'marketplaces not found' });
     }
    const userId = req.decoded.userId;
    const user = await User.findOne({ userId }).exec();
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    if (user.availableBalance < betAmount) {
      return res.status(404).send({ message: 'Insufficient balance' });
    }
    if (user.availableBalance < 500 ) {
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
    //for cricket,teniss,soccer events
    if(sportsId !=='7' || sportsId !=='4339'){
      console.log('in cricket,soccer,tennis event');
      match = await Events.findOne({
        sportsId: sportsId,
        _id: matchId,
        inplay : true
      });
      
      if (!match) {
        console.log(`Match not found for sports ID ${sportsId}`);
        return res.status(404).send({ message: `Match not found for sports ID ${sportsId}` });
      }
    }
    console.log('match',match.name);
    
    //not fancy
    if (marketplace.subMarketId !== '104' && sportsId !== '7' && sportsId !== '4339') {
      console.log('in cricket,soccer,tennis odds');
    const matchOdds = await Odds.findOne({
      sportsId: sportsId,
      eventId: match.Id,
      // createdAt: selectedTime ,
      inplay : true,
    });
    if (!matchOdds) {
      console.log(`Match odds not found for sports ID ${sportsId}`);
      return res.status(404).send({ message: `Match odds not found for ${selectedTime}` });
    }
    // Extract the odds data for the selected team from the runners array
    const selectedTeamOdds = matchOdds.runners.find(runner => runner.SelectionId === req.body.selectionId);
    console.log('matchOdds.runners', matchOdds.runners);
    console.log('selectionId', req.body.selectionId);
    if (!selectedTeamOdds) {
      console.log(`Odds not available for the selected team ${req.body.selectionId}`);
      return res.status(404).send({ message: `Odds not available for the selected team ${req.body.selectionId}` });
    }

    let selectedOddsRate;

    if (req.body.type === 0) {
      // If type is 0 (available to back), find the first availableToBack price and match the amount
      const availableToBack = selectedTeamOdds.ExchangePrices.AvailableToBack;
      const matchedBack = availableToBack.find(back => back.price == req.body.betRate);
      console.log('matchedBack',matchedBack);
      if (!matchedBack) {
        console.log(`No availableToBack odds matched with the bet rate ${req.body.betRate}`);
        return res.status(404).send({ message: `No availableToBack odds matched with the bet rate ${req.body.betRate}` });
      }
     selectedOddsRate = matchedBack.price;
      console.log('selectedOddsRate',selectedOddsRate);
    } else if (req.body.type === 1) {
      // If type is 1 (available to lay), find the first availableToLay price and match the amount
      const availableToLay = selectedTeamOdds.ExchangePrices.AvailableToLay;
      const matchedLay = availableToLay.find(lay => lay.price == req.body.betRate);

      if (!matchedLay) {
        console.log(`No availableToLay odds matched with the bet rate ${req.body.betRate}`);
        return res.status(404).send({ message: `No availableToLay odds matched with the bet rate ${req.body.betRate}` });
      }
      selectedOddsRate = matchedLay.price;
    } else {
      console.log('Invalid type value. Type should be 0 or 1.');
      return res.status(400).send({ message: 'Invalid type value. Type should be 0 or 1.' });
    }
     console.log('in here')
    if (!selectedOddsRate) {
      //put the bet in fake bet 
      console.log('Selected odds not found for the bet');
      return res.status(404).send({ message: 'Selected odds not found for the bet',selectedOddsRate });
    }
    // Now you have the selectedOdds and selectedAmount based on the selected team and type
    console.log('Selected Odds:', selectedOddsRate);
    const userRate = betRate * betAmount - betAmount
    console.log('userRate Odds:', userRate);

    const companyRate = selectedOddsRate * betAmount - betAmount
console.log('companyRate',companyRate)
  }
    //for fancy
    if (marketplace.subMarketId == '104' && (sportsId == '7' || sportsId == '4339')) {
      const fancyOdds = await FancyGames.findOne({
        eventTypeId: sportsId,
        eventId: match.Id,
        createdAt: selectedTime,
      });
    console.log('fancyOdds',fancyOdds);
      if (fancyOdds) {
        // Extract the odds data for the selected team from the "t3" array
        const selectedTeamOdds = fancyOdds.t3.find(runner => runner.sid == req.body.selectionId);
    
        if (!selectedTeamOdds) {
          console.log(`Odds not available for the selected team ${req.body.selectionId}`);
          return res.status(404).send({ message: `Odds not available for the selected team ${req.body.selectionId}` });
        }
    
        let selectedOddsRate = null;
    
        if (req.body.type === 0) {
          // If type is 0 (available to back), try to find a match between the user-provided betRate and any of the available back odds (b1, b2, or b3)
          const backOdds = [selectedTeamOdds.b1, selectedTeamOdds.b2, selectedTeamOdds.b3];
          selectedOddsRate = backOdds.find(back => back == req.body.betRate);
        } else if (req.body.type === 1) {
          // If type is 1 (available to lay), use the "l1", "l2", or "l3" price for the lay odds
          const layOdds = [selectedTeamOdds.l1, selectedTeamOdds.l2, selectedTeamOdds.l3];
          selectedOddsRate = layOdds.find(lay => lay == req.body.betRate)}
        else {
          console.log('Invalid type value. Type should be 0 or 1.');
          return res.status(400).send({ message: 'Invalid type value. Type should be 0 or 1.' });
        }
    
        if (!selectedOddsRate || selectedOddsRate == '0.00') {
          // If odds are not available or suspended.
          console.log(`Selected odds for the bet are not available or suspended for the team ${req.body.selectionId}`);
          return res.status(404).send({ message: `Selected odds for the bet are not available or suspended for the team ${req.body.selectionId}` });
        }
        // Now you have the selectedOddsRate based on the selected team and type
        console.log('Selected Odds:', selectedOddsRate);
      }
    }

     if (sportsId == '7' || sportsId == '4339' ) {
      console.log('in horse race greyhound event');
      const match = await Events.findOne({
        sportsId: sportsId,
        _id: matchId,
      });

      if (!match) {
        console.log(` race Match not found for sports ID ${sportsId}`);
        return res.status(404).send({ message: ` race match not found for sports ID ${sportsId}` });
      }
      console.log('match',match);
       const HRGMarkets = await RaceMarkets.find({
       eventTypeId: sportsId,
       eventId: match.meetingId,
     });
    console.log('HRGMarkets',HRGMarkets);
     const HRGOdds = await RaceOdds.findOne({
       createdAt: selectedTime,
       marketId: raceMarketId,
    });
    console.log('HRGOdds',HRGOdds);

    // Find the runner in the HRGOdds object that matches the selectionId from the payload
    const selectedRunner = HRGOdds.runners.find(runner => runner.selectionId === req.body.selectionId);
    console.log('selectedRunner',selectedRunner);

    if (!selectedRunner) {
      console.log(`Runner not found for selectionId ${req.body.selectionId}`);
      return res.status(404).send({ message: 'Runner not found' });
    }
    
    // Get the corresponding available prices based on the type (0 for availableToBack, 1 for availableToLay)
    let availablePrices;
    if (req.body.type === 0) {
      availablePrices = selectedRunner.exchange.availableToBack;
    } else if (req.body.type === 1) {
      availablePrices = selectedRunner.exchange.availableToLay;
    } else {
      console.log('Invalid type value. Type should be 0 or 1.');
      return res.status(400).send({ message: 'Invalid type value. Type should be 0 or 1.' });
    }

    // Find the matched price in the available prices
    const matchedPrice = availablePrices.find(price => price.price === req.body.betRate);

    if (!matchedPrice) {
      console.log(`No odds matched with the bet rate ${req.body.betRate}`);
      return res.status(404).send({ message: `No odds matched with the bet rate ${req.body.betRate}` });
    }

    // Now you have the selectedOddsRate based on the selected team and type
    const selectedOddsRate = matchedPrice.price;
    // Now you have the selectedOddsRate based on the selected team and type
    console.log('Selected Odds:', selectedOddsRate);
    }
    const parentUserIds = await getParents(user.userId);
    console.log('parentUserIds', parentUserIds);

    const parentUser = await User.find({
      userId: { $in: [...parentUserIds] },
      isDeleted: false
    }).sort({role: -1});

    const blockedMarketPlaces = [];
    const blockedSubMarkets = [];
    const blockedSubMarketsByParent = [];

    parentUser.forEach(obj => {
      blockedMarketPlaces.push(...obj.blockedMarketPlaces);
      blockedSubMarkets.push(...obj.blockedSubMarkets);
      blockedSubMarketsByParent.push(...obj.blockedSubMarketsByParent);      
    });

    const uniqueBlockedMarketPlaces       = [...new Set(blockedMarketPlaces)];
    const uniqueBlockedSubMarkets         = [...new Set(blockedSubMarkets)];
    const uniqueBlockedSubMarketsByParent = [...new Set(blockedSubMarketsByParent)];

    console.log('uniqueBlockedMarketPlaces', uniqueBlockedMarketPlaces);
    console.log('uniqueBlockedSubMarkets', uniqueBlockedSubMarkets);

    if (uniqueBlockedMarketPlaces.includes(sportsId) || uniqueBlockedSubMarkets.includes(marketplace.subMarketId) 
          || uniqueBlockedSubMarketsByParent.includes(marketplace.subMarketId) ){
      return res.status(404).send({ message: 'Betting disabled by your dealer' });
    }
    // Check if the user is allowed to place a bet in the specified market and submarket
    if (user.betLockStatus == true || user.blockedSubMarketsByParent.includes(marketplace.subMarketId)) {
      return res.status(400).send({ message: 'Bet not allowed for your account' });
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
      sportsId,
      userId,
      team: selectionId,
      betAmount,
      betRate,
      returnAmount,
      matchId: matchId,
      // matchStatus: match.status,
      loosingAmount: loosingAmount,
      winningAmount: winningAmount,
      subMarketId: marketplace.subMarketId,
      runner: selectionId,
      event: [1, 2, 4].includes(sportsId) ? match.name : '',
      type:  req.body.type
    });

    // Save the bet object to the database
    console.log( `Bet placed for user ID ${userId}, sports ID ${sportsId}, and team ${selectionId}`);
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
  if (req.body.page) {
    page = Number(req.body.page);
  }
  if (req.body.startDate && req.body.endDate) {
    const startTimestamp = new Date(req.body.startDate).getTime() / 1000;
    const endTimestamp = new Date(req.body.endDate).getTime() / 1000;
    query.createdAt = {
      $gte: startTimestamp,
      $lte: endTimestamp,
    };
  }
   
  if (req.decoded.role !== '5') {
    query.userId = req.body.userId;
  } else if (req.decoded.role == '5') {
    query.userId = req.decoded.userId;
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

  User.findOne({ userId: query.userId }, (err, user) => {
    if (err || !user) {
      return res.status(404).send({ message: 'User not found' });
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
});
}

function betFunds(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.array() });
  }

  if (req.decoded.role !== '5') {
    User.find({ createdBy: req.decoded.userId, role: '5' }, (err, users) => {
      if (err ||!users) {
        return res.status(404).send({ message: 'Error occurred while querying users.' });
      }
      
      const userIds = users.map(user => user.userId);
      
      Bets.find({ userId: { $in: userIds } }, (err, bets) => {
        if (err ||!bets) {
          return res.status(404).send({ message: 'Error occurred in bets.' });
        }
        
        const activeBets = bets.filter(bet => bet.status === 1).length;
        
        User.findOne({ userId: req.decoded.userId }, (err, user) => {
          if (err || !user) {
            return res.status(404).send({ message: 'User Not Found' });
          }
          
          const results = {
            balance: user.balance,
            liable: user.exposure,
            credit: user.credit,
            available: user.availableBalance,
            activeBets: activeBets,
          };
          
          return res.send({ message: 'Funds Record Found', results: results });
        });
      });
    });
  } else {
    Bets.find({ userId: req.decoded.userId }, (err, bets) => {
      if (err) {
        return res.status(404).send({ message: 'Error occurred in bets.' });
      }
      
      User.findOne({ userId: req.decoded.userId }, (err, user) => {
        if (err || !user) {
          return res.send({ message: 'User Not Found' });
        }
        
        const activeBets = bets.filter(bet => bet.status === 1).length;
        
        const results = {
          balance: user.balance,
          liable: user.exposure,
          credit: user.credit,
          available: user.availableBalance,
          activeBets: activeBets,
        };
        
        return res.send({ message: 'Funds Record Found', results: results });
      });
    });
  }
}

function createBetRates(req, res) {
  const recordsToCreate = 15;
  const AllbetRates = [];
  let betRate = 1.5;
  for (let i = 0; i < recordsToCreate; i++) {
    const roundedBetRate = Number(betRate.toFixed(1));
    AllbetRates.push(roundedBetRate);
    betRate += 0.2;
  }
  const betRatesData = [
    {
      match: "PAK vs AUS",
      teams: [
        {
          name:"Pakistan",
          back: AllbetRates,
          lay: AllbetRates
        },
        {
          name:"AUS",
          back: AllbetRates,
          lay: AllbetRates
        },
        {
          name:"draw",
          back: AllbetRates,
          lay: AllbetRates
        },
      ]
    },
    {
      match: "PAK vs IND",
      teams: [
        {
          name:"Pakistan",
          back: AllbetRates,
          lay: AllbetRates
        },
        {
          name:"IND",
          back: AllbetRates,
          lay: AllbetRates
        },
        {
          name:"draw",
          back: AllbetRates,
          lay: AllbetRates
        },
      ]
    },
    {
      match: "IND vs AUS",
      teams: [
        {
          name:"IND",
          back: AllbetRates,
          lay: AllbetRates
        },
        {
          name:"AUS",
          back: AllbetRates,
          lay: AllbetRates
        },
        {
          name:"draw",
          back: AllbetRates,
          lay: AllbetRates
        },
      ]
    },
  ];
  betRates.insertMany(betRatesData)
    .then(() => {
      res.status(200).json({ message: 'Dummy data created successfully.' });
    })
    .catch((error) => {
      res.status(500).json({ error: 'Error creating dummy data.' });
    });
}

async function getBetRates(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  const matchId = req.params.id;
  const match = await betRates.findOne({ _id: matchId });
  if (!match) {
    return res.status(404).send({ message: 'bets rate not found' });
  }

  const randomRates = getRandomRates(match);
  
  return res.send({
    success: true,
    message: 'bets rate records',
    results: randomRates,
  });
}

function getRandomRates(match) {
  const randomRates = [];

  for (const team of match.teams) {
    const randomBackRates = getRandomSubset(team.back, 3);
    const randomLayRates = getRandomSubset(team.lay, 3);

    randomRates.push({
      name: team.name,
      back: randomBackRates,
      lay: randomLayRates,
    });
  }


  return {
    match : match.match,
    teams: randomRates
  }
}

function getRandomSubset(arr, size) {
  const shuffled = arr.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, size);
}

async function getAllUserIDs(createdByIDs, processedIDs = new Set()) {
  const userIDs = [];

  if (createdByIDs.length === 0) {
    return userIDs;
  }

  console.log('Created By:', createdByIDs);

  const uniqueIDs = createdByIDs.filter(id => !processedIDs.has(id));
  processedIDs = new Set([...processedIDs, ...uniqueIDs]);

  const users = await User.find({ createdBy: { $in: uniqueIDs } }, { userId: 1, userName: 1, createdBy: 1 }).lean();

  for (const user of users) {
    userIDs.push(user.userId);
  }

  console.log('Sub-users fetched for Created By:', createdByIDs);

  const subUserIDs = await getAllUserIDs(userIDs, processedIDs);
  userIDs.push(...subUserIDs);

  return userIDs;
}

async function getMatchedBets(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.array() });
  }

  try {
    const loginUser = await User.findOne({ userId: req.decoded.userId });
    if (!loginUser) {
      return res.status(404).send({ message: 'User not found' });
    }

    const bettorMaster = await User.findOne({ userId: loginUser.createdBy });
    console.log('bettorMaster', bettorMaster);
    const userOfLoginUser = await User.find({ createdBy: loginUser.userId });
    const createdByIDs = userOfLoginUser.map(user => user.userId);

    // Fetch all user IDs using optimized function
    const userIDs = await getAllUserIDs(createdByIDs);

    if (loginUser.role === '5') {
      userIDs.push(loginUser.userId);
    }

    // Use the $lookup aggregation pipeline to fetch matched bets along with user information and related events
    const matchedBets = await Bets.aggregate([
      { $match: { userId: { $in: [...createdByIDs, ...userIDs, loginUser.userId] }, status: 1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: 'userId',
          as: 'userDetails'
        }
      },
      { $unwind: '$userDetails' },
      {
        $lookup: {
          from: 'users',
          localField: 'userDetails.createdBy',
          foreignField: 'userId',
          as: 'masterDetails'
        }
      },
      {
        $lookup: {
          from: 'inplayevents',
          localField: 'sportsId',
          foreignField: 'sportsId',
          as: 'eventDetails'
        }
      },
      {
        $project: {
          _id: 0,
          price: '$betRate',
          size: '$betAmount',
          runner: '$runner',
          bettor: '$userDetails.userName',
          master: {
            $cond: [
              { $eq: [loginUser.role, '5'] },
              loginUser.userName,
              { $ifNull: [{ $arrayElemAt: ['$masterDetails.userName', 0] }, ''] }
            ]
          },
          event: {
            $cond: [
              { $eq: [loginUser.role, '5'] },
              {
                $map: {
                  input: { $slice: ['$eventDetails', 5] },
                  as: 'event',
                  in: {
                    name: '$$event.name',
                    openDate: '$$event.openDate'
                  }
                }
              },
              '$$REMOVE'
            ]
          },
        }
      }
    ]).exec();

    if (!matchedBets || matchedBets.length === 0) {
      return res.status(404).send({ message: 'Matched bets not found' });
    }

    return res.send({
      success: true,
      message: 'Matched bets record found',
      data: matchedBets
    });
  } catch (err) {
    console.error('Aggregation error:', err);
    return res.status(500).send({ message: 'Error retrieving matched bets', error: err });
  }
}


async function FakeBetsList(req, res) {
  try {
    Bets.find(
      {isFake: 1},
      (err, result) => {
        if (err || !result){
          return res.status(404).send({ message: 'bets rate not found' });
        }
        return res.send({
          success: true,
          message: 'Bets List',
          results: result,
        });
      }
    );
  }catch (error) {
    return res.send({
      success: false,
      message: 'Some thing went wrong',
      results: error,
    });
  }
}

async function updateFakeBet(req, res) {
  try {
    const betId = req.params.id;
    const updateBet = await Bets.findOneAndUpdate(
      { _id: betId },
      {
        $set: {
          isFake: 0,
        }
      }
    );

    if (!updateBet) {
      return res.status(404).json({ message: 'Bet not found' });
    }

    return res.status(200).send({ message: 'Bet successfully updated', success: true });

  } catch (error) {
    return res.send({
      success: false,
      message: 'Some thing went wrong',
      results: error,
    });
  }
}

async function deleteFakeBet(req, res) {
  try {
    const betId = req.params.id;
    const deletedBet = await Bets.findByIdAndDelete(betId);
    if (!deletedBet) {
      return res.status(404).json({ message: 'Bet not found' });
    }

    return res.status(200).send({ message: 'Bet deleted successfully', success: true });

  } catch (error) {
    return res.send({
      success: false,
      message: 'Some thing went wrong',
      results: error,
    });
  }
}

async function countFakeBet(req, res) {
  try {
    const fakeCount = await Bets.countDocuments(
      {isFake: 1}
    );

    return res.send({
      success: false,
      message: 'Some thing went wrong',
      results: {
        totalFakeBets : fakeCount
      },
    });
  }catch (error) {
    return res.send({
      success: false,
      message: 'Some thing went wrong',
      results: error,
    });
  }
}

async function approvedFakeBet(req, res) {
  if (req.decoded.role !== '0') {
    return res.status(403).send({ message: 'Only company can perform this operation' });
  }

  try {
    const betId = req.params.id;
    const fakeBet = await Bets.findOne({ _id: betId, isFake: 1 });

    if (!fakeBet) {
      return res.status(404).json({ message: 'Bet not found' });
    }
    const updatedUser = await User.findOneAndUpdate(
      { userId: fakeBet.userId },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).send({ message: 'user deactivated successfully', success: true });

  } catch (error) {
    console.error('Error updating bet:', error);
    return res.status(500).send({
      success: false,
      message: 'Something went wrong',
      error: error.message
    });
  }
}

async function reviewFakeBet(req, res) {
  if (req.decoded.role !== '0') {
    return res.status(403).send({ message: 'Only company can perform this operation' });
  }

  try {
    const betId = req.params.id;
    const sportsId = req.params.sportsId;

    const fakeBet = await Bets.findOne({ _id: betId, isFake: 1, sportsId: sportsId });

    if (!fakeBet) {
      return res.status(404).json({ message: 'Bet not found' });
    }

    // Find the odds before the bet's createdAt timestamp
    const oddsBeforeBet = await Odds.find({
      eventId: fakeBet.eventId,
      createdAt: { $lt: fakeBet.createdAt },
    }).sort({ createdAt: -1 }).limit(200).select('eventId updatetime runners');

    // Find the odds after the bet's createdAt timestamp
    const oddsAfterBet = await Odds.find({
      eventId: fakeBet.eventId,
      createdAt: { $gt: fakeBet.createdAt },
    }).sort({ createdAt: 1 }).limit(200).select('eventId updatetime runners');

    // Combine the runners into a single array for both oddsBeforeBet and oddsAfterBet
    const BeforeBetOdds = oddsBeforeBet.map((odds) => odds.runners).flat();
    const AfterBetOdds = oddsAfterBet.map((odds) => odds.runners).flat();

    return res.status(200).send({
      message: 'Odds successfully retrieved',
      success: true,
      eventId: fakeBet.eventId,
      updatetime: fakeBet.createdAt,
      BeforeBetOdds,
      AfterBetOdds,
    });

  } catch (error) {
    console.error('Error retrieving odds:', error);
    return res.status(500).send({
      success: false,
      message: 'Something went wrong',
      error: error.message,
    });
  }
}




loginRouter.post('/placeBet', betValidator.validate('placeBet'), placeBet);
loginRouter.post('/getUserBets', getUserBets);
loginRouter.get('/betFunds', betFunds);
loginRouter.post('/createBetRates', createBetRates);
loginRouter.get('/getBetRates/:id', getBetRates);
loginRouter.get('/getMatchedBets', getMatchedBets);
loginRouter.get('/FakeBetsList', FakeBetsList);
loginRouter.delete('/deleteFakeBet/:id', deleteFakeBet);
loginRouter.put('/updateFakeBet/:id', updateFakeBet);
loginRouter.get('/countFakeBets', countFakeBet);
loginRouter.post('/approvedFakeBet/:id', approvedFakeBet);
loginRouter.get('/reviewFakeBet/:id/:sportsId', reviewFakeBet);



module.exports = { loginRouter, getParents };
