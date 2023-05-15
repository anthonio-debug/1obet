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

async function placeBet(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const { sportsId, selectedTeam, betAmount, betRate, matchId, subMarketId } =
    req.body;
  const userId = req.decoded.userId;
  if (
    req.decoded.login.role == '0' ||
    req.decoded.login.role == '1' ||
    req.decoded.login.role == '2' ||
    req.decoded.login.role == '3' ||
    req.decoded.login.role == '4'
  ) {
    return res.status(404).send({ message: 'only bettor can do betting' });
  }

  try {
    const user = await User.findOne({ userId }).exec();
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }
    if (user.bettingAllowed === false) {
      return res
        .status(404)
        .send({ message: 'Bet is not allowed for your account' });
    }

    const filterForMain = {
      $or: [
        { userId: req.decoded.superAdminId },
        { userId: req.decoded.adminId },
        { userId: req.decoded.parentId },
        { userId: req.decoded.masterId },
        { userId: 0 },
      ],
      isDeleted: false,
    };
    // seeing from markettypes
    let parentUser = await User.find(filterForMain);
    if (
      parentUser[0].blockedMarketPlaces.includes(sportsId) ||
      parentUser[0].blockedSubMarkets.includes(subMarketId)
    ) {
      return res
        .status(404)
        .send({ message: 'Betting disabled by your dealer' });
    }
    // Check if the user is allowed to place a bet in the specified market and submarket
    if (user.betLockStatus === true || user.matchOddsStatus === true) {
      return res
        .status(400)
        .send({ message: 'Bet not allowed for your account' });
    }
    if (user.blockedSubMarkets.includes(subMarketId)) {
      return res
        .status(404)
        .send({ message: 'Betting not allowed in this market' });
    }
    const match = await CricketMatch.findOne({
      sportsId: sportsId,
      id: matchId,
    }).exec();
    console.log('match.teams', match);
    if (!match) {
      console.log(`Match not found for sports ID ${sportsId}`);
      return res
        .status(404)
        .send({ message: `Match not found for sports ID ${sportsId}` });
    }

    // Check if the match has ended
    if (match.matdchEnded) {
      console.log(`Match has already ended for sports ID ${sportsId}`);
      return res
        .status(404)
        .send({ message: `Match has already ended for sports ID ${sportsId}` });
    }

    const teams = [match.teams[0], match.teams[1]];
    // Calculate the return amount
    const returnAmount = betAmount * betRate;
    const winningAmount = betAmount * betRate;
    const loosingAmount = req.body.betAmount;

    // Create the bet object
    const bet = new Bets({
      sportsId,
      userId,
      team: selectedTeam,
      betAmount,
      betRate,
      returnAmount,
      matchId: matchId,
      status: match.status,
      loosingAmount: loosingAmount,
      winningAmount: winningAmount,
      subMarketId: subMarketId,
    });

    // Save the bet object to the database
    console.log(
      `Bet placed for user ID ${userId}, sports ID ${sportsId}, and team ${selectedTeam}`
    );
    bet.save((err, result) => {
      if (err) {
        console.log('err', err);
        return res.status(404).send({ message: 'Error placing bet' });
      }
      return res.send({
        success: true,
        message: 'Bet placed successfully',
        results: result,
      });
    });
  } catch (error) {
    console.error('error', error);
    return res.status(404).send({ message: 'Server error' });
  }
}

const BetRateList = {
  //to do on sportsId and on matchId ratelist
  getBetRateList: (sportsId, teams, selectedTeam) => {
    let betRateList = [];
    console.log('teams', teams);
    console.log('selectedteams', selectedTeam);

    switch (sportsId) {
      case 1: // if sportsId is 1 (e.g. cricket)
        if (selectedTeam === teams[0]) {
          betRateList = [1.5, 2.0, 2.5, 3.0];
        } else if (selectedTeam === teams[1]) {
          betRateList = [2.0, 2.5, 3.0, 3.5];
        } else {
          throw new Error('Invalid team');
        }
        break;
      case 2: // if sportsId is 2 (e.g. basketball)
        if (selectedTeam === teams[0]) {
          betRateList = [1.2, 1.5, 2.0, 2.5];
        } else if (selectedTeam === teams[1]) {
          betRateList = [1.5, 2.0, 2.5, 3.0];
        } else {
          throw new Error('Invalid team');
        }
        break;
      // add more cases for other sports
      default: // if sportsId is not recognized
        throw new Error('Invalid sportsId');
    }

    return betRateList;
  },
};

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
    if (req.decoded.role === '5') {
      results = {
        balance: user.balance,
        exposure: user.exposure,
        credit: user.credit,
        available: user.availableBalance,
      };
    } else {
      results = {
        balance: 0,
        exposure: user.exposure,
        credit: 0,
        available: 0,
      };
    }

    return res.send({ message: 'Funds Record Found', results: results });
  });
}

loginRouter.post('/placeBet', betValidator.validate('placeBet'), placeBet);
loginRouter.post('/getUserBets', getUserBets);
loginRouter.get('/betFunds', betFunds);

module.exports = { loginRouter };
