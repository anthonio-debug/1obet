const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const User = require('../models/user');

const reportValidator = require('../validators/reports');
const Bets = require('../models/bets');
const loginRouter = express.Router();

const marketGainWithDuplicates = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const userId = Number(req.query.userId);

  const matchId = req.query.matchId;
  const currentUser = await User.findOne({ userId: userId });

  if (currentUser.role == 5) {
    const match = await Events.findById(matchId);
    const parent = await User.findOne({ userId: currentUser.createdBy });
    const response = await CashDeposit.aggregate([
      {
        $match: {
          matchId: matchId,
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
      message: 'Detailed reports',
      results: response,
      isDetailed: true,
      dealer: parent.userName,
      currentUser: currentUser.userName,
      Winner: match?.winner,
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
          matchId: matchId,
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
