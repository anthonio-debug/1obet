const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const CashDeposit = require('../models/deposits');
const User = require('../models/user');

const reportValidator = require('../validators/reports');
const Deposits = require('../models/deposits');
const Events = require('../models/events');
const Bets = require('../models/bets');
const MarketIDS = require('../models/marketIds');
const loginRouter = express.Router();

const marketGainWithDuplicates = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const userId = Number(req.query.userId);

  const marketId = req.query.marketId;
  const currentUser = await User.findOne({ userId: userId });
  if (currentUser?.role == 5) {
    const marketData = await MarketIDS.findOne({
      marketId: marketId,
    });
    const parent = await User.findOne({ userId: currentUser.createdBy });
    const response = await CashDeposit.aggregate([
      {
        $match: {
          marketId: marketId,
          $or: [
            {
              $and: [
                {
                  userId: userId,
                },
                {
                  cashOrCredit: { $in: ['Bet'] },
                },
              ],
            },
            {
              cashOrCredit: { $in: ['Commission'] },
            },
          ],
        },
      },
      {
        $addFields: {
          betsId: { $toObjectId: '$betId' },
        },
      },
      {
        $lookup: {
          from: 'bets',
          localField: 'betsId',
          foreignField: '_id',
          as: 'betsDetails',
        },
      },
      {
        $group: {
          _id: '$betId',
          pl: { $sum: '$amount' },
          sattledAt: { $first: '$date' },
          price: { $first: { $arrayElemAt: ['$betsDetails.betAmount', 0] } },
          name: { $first: { $arrayElemAt: ['$betsDetails.runnerName', 0] } },
          createdAt: {
            $first: { $arrayElemAt: ['$betsDetails.createdAt', 0] },
          },
          size: { $first: { $arrayElemAt: ['$betsDetails.betRate', 0] } },
          type: { $first: { $arrayElemAt: ['$betsDetails.type', 0] } },
        },
      },
    ]);
    return res.send({
      success: true,
      message: 'Market Shares Reports by MarketId',
      results: response,
      isDetailed: true,
      dealer: parent.userName,
      currentUser: currentUser.userName,
      Winner: marketData?.winnerInfo,
    });
  } else {
    const childUsers = await User.distinct('userId', { createdBy: userId });
    const users = [userId, ...childUsers];
    console.log(' users ===================  ', users);

    const response = await CashDeposit.aggregate([
      {
        $match: {
          userId: {
            $in: users,
          },
          marketId: marketId,
          cashOrCredit: { $in: ['Bet', 'Commission', 'loosing'] },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: 'userId',
          as: 'userInfo',
        },
      },
      {
        $group: {
          _id: '$userId',
          amount: { $sum: '$amount' },
          name: { $first: { $arrayElemAt: ['$userInfo.userName', 0] } },
        },
      },
    ]);

    return res.send({
      success: true,
      message: 'Commission reports',
      results: response,
    });
  }
};

loginRouter.get('/marketShares', marketGainWithDuplicates);

module.exports = { loginRouter };
