const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const User = require('../models/user');

const reportValidator = require('../validators/reports');
const Bets = require('../models/bets');
const loginRouter = express.Router();

const getMarketPositions = async (req, res) => {
  // console.log('req:', req);
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const Id = parseInt(req.query.userId);
  console.log(' Id ========== ', Id);

  const response = await Bets.aggregate([
    {
      $match: {
        userId: Id,
        $and: [
          {
            createdAt: { $gte: req.query.startDate },
          },
          {
            createdAt: { $lte: req.query.endDate },
          },
        ],
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: 'userId',
        as: 'user_info',
      },
    },
    {
      $group: {
        _id: '$marketId',
        userId: { $first: '$userId' },
        runnerName: { $first: '$runnerName' },
        positions: { $sum: '$position' },
        availableBalance: {
          $first: { $arrayElemAt: ['$user_info.availableBalance', 0] },
        },
        createdAt: { $first: '$createdAt' },
      },
    },
  ]);
  return res.send({
    success: true,
    message: 'Market Positions Reports !',
    results: response,
  });
};

loginRouter.get('/marketPositions', getMarketPositions);

module.exports = { loginRouter };
