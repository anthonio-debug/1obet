const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const CashDeposit = require('../models/deposits');
const User = require('../models/user');

const reportValidator = require('../validators/reports');
const Deposits = require('../models/deposits');
const MarketType = require('../models/marketTypes');
const Bets = require('../models/bets');
const loginRouter = express.Router();
const cricketMatch = require('../models/cricketMatches');

const getDailyPLReport = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  const userId = 0;
  // parseInt(req.decoded.userId)
  const childUsers = await User.distinct("userId", { createdBy: userId });
  const users = [userId, ...childUsers]

  const response = await CashDeposit.aggregate([
    {
      $match: {
        userId: {
          $in: users
        },
        cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
        $and: [
          {
            createdAt: { $gte: req.query.startDate }
          },
          {
            createdAt: { $lte: req.query.endDate }
          }
        ]
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: 'userId',
        as: 'userInfo'
      }
    },
    {
      $group: {
        _id: "$userId",
        amount: { $sum: "$amount" },
        name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } },
      }
    }
  ]);

  return res.send({
    success: true,
    message: 'Commission reports',
    results: response,
  });
}

const dailyPlMarketsReports = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  // const userId = parseInt(req.decoded.userId)
  const Id = parseInt(req.query.userId)
  console.log(" Id ========== ", Id);

  const response = await CashDeposit.aggregate([
    {
      $match: {
        userId: Id,
        cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
        $and: [
          {
            createdAt: { $gte: req.query.startDate }
          },
          {
            createdAt: { $lte: req.query.endDate }
          }
        ]
      }
    },
    {
      $lookup: {
        from: 'markettypes',
        localField: 'marketId',
        foreignField: 'Id',
        as: 'marketInfo'
      }
    },
    {
      $group: {
        _id: "$marketId",
        amount: { $sum: "$amount" },
        userId: { $first: "$userId" },
        name: { $first: { $arrayElemAt: ["$marketInfo.name", 0] } }
      }
    }
  ]);

  return res.send({
    success: true,
    message: 'Market wise Reports !',
    results: response,
  });
}

const dailyPLSportsWiseReport = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const userId = req.decoded.userId
  console.log(" userId ====== ", userId);
  const Id = parseInt(req.query.userId)

  const response = await CashDeposit.aggregate([
    {
      $match: {
        userId: Id,
        cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
        $and: [
          {
            createdAt: { $gte: req.query.startDate }
          },
          {
            createdAt: { $lte: req.query.endDate }
          }
        ]
      }
    },
    {
      $addFields: {
        'betIdEvent': { $toObjectId: "$betId" }
      }
    },
    {
      $lookup: {
        from: 'bets',
        localField: 'betIdEvent',
        foreignField: '_id',
        as: 'bets'
      }
    },
    {
      $group: {
        _id: "$bets.sportsId",
        amount: { $sum: "$amount" },
        userId: { $first: "$userId" },
        bets: { $push: "$bets" }
      }
    }
  ]);
  return res.send({
    success: true,
    message: 'Sport wise Reports !',
    results: response,
  });


}


loginRouter.get('/getDailyPLReport', reportValidator.validate('getDailyPLReport'), getDailyPLReport);
loginRouter.get('/dailyPLSportsWiseReport', reportValidator.validate('dailyPLSportsWiseReport'), dailyPLSportsWiseReport);
loginRouter.post('/dailyPLSportsWiseReport', reportValidator.validate('dailyPLSportsWiseReport'), dailyPLSportsWiseReport);
loginRouter.get('/dailyPlMarketsReports', reportValidator.validate('dailyPlMarketsReports'), dailyPlMarketsReports);

module.exports = { loginRouter };
