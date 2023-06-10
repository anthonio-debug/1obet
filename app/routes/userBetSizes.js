const express = require('express');
var jwt = require('jsonwebtoken');
const userValidation = require('../validators/user');
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
let config = require('config');
const User = require('../models/user');
const MarketType = require('../models/marketTypes');
const betSizeValidator = require('../validators/userBetSizes');
const betLimits = require('../models/betLimits');
const UserBetSizes = require('../models/userBetSizes');
const loginRouter = express.Router();

function updateBetSizes(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  const betSizes = req.body.betSizes;

  const updatedBetSizes = betSizes.map((betSize) => ({
    updateOne: {
      filter: { _id: betSize._id, userId: req.body.userId },
      update: { $set: { amount: betSize.amount, marketId: betSize.marketId, userId:req.body.userId } },
      upsert: false,
    },
  }));

  UserBetSizes.bulkWrite(updatedBetSizes, { ordered: false }, (err, result) => {
    if (err) {
      return res.status(404).send({ message: 'Error updating bet sizes' });
    }

    return res.send({
      success: true,
      message: 'Bet sizes updated successfully',
    });
  });
}

function betsNews(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  if (req.decoded.role == '5') {
    const marketId = req.query.marketId;
    const query = { userId: Number(req.decoded.userId) };
    if (marketId) {
      MarketType.findOne({ marketId }, (err, market) => {
        if (err || !market) {
          // check if market is not found
          return res.status(404).send({ message: 'Market not found' });
        }
        const marketName = market.name.toLowerCase();
        query[marketName] = { $exists: true };
        UserBetSizes.findOne(
          { userId: req.decoded.userId, name: marketName },
          (err, data) => {
            if (err || !data) {
              // check if bet size data is not found
              return res.status(404).send({ message: 'News not found' });
            }
            const results = {
              betSizes: {
                userId: data.userId,
                [marketName]: data.amount,
              },
              text: 'Welcome to 1obet.com.-Announcement :- All casino Profit Loss will be 1 to 10 Ratio from now On.Her casino may Jeet Har 1 ka 10 ho ge. -Welcome . -Welcome . -Welcome to 1obet.com',
            };
            return res.send({
              success: true,
              message: 'News Data found',
              results,
            });
          }
        );
      });
    } else if (!req.query.marketId) {
      const results = {
        betSizes: null,
        text: 'Welcome to 1obet.com.-Announcement :- All casino Profit Loss will be 1 to 10 Ratio from now On.Her casino may Jeet Har 1 ka 10 ho ge. -Welcome . -Welcome . -Welcome to 1obet.com',
      };
      return res.send({
        success: true,
        message: 'News Data found',
        results,
      });
    }
  } else {
    const results = {
      betSizes: null,
      text: 'Welcome to 1obet.com',
    };
    return res.send({
      success: true,
      message: 'News Data found',
      results,
    });
  }
}

function getAllBetSizes(req, res) {
  const userId = Number(req.query.userId);

  // if (!userId) {
  //   return res.status(400).send({ message: 'USER_ID_MISSING' });
  // }

  User.findOne({ userId: userId }, (err, user) => {
    if (err || !user) {
      return res.status(404).send({ message: 'USER_NOT_FOUND' });
    }

    const query = [
      {
        $lookup: {
          from: 'userbetsizes',
          let: { betLimitId: { $toString: '$_id' } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$betLimitId', '$$betLimitId'] },
                    { $eq: ['$userId', userId] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 1,
                amount: 1,
              },
            },
          ],
          as: 'userBetSizes',
        },
      },
      {
        $project: {
          _id: 0,
          maxAmount: 1,
          name: 1,
          'userBetSizes._id': 1,
          'userBetSizes.amount': 1,
        },
      },
      {
        $addFields: {
          userBetSizes: {
            $arrayElemAt: ['$userBetSizes', 0],
          },
        },
      },
    ];

    betLimits.aggregate(query, (err, results) => {
      if (err) {
        return res.status(404).send({ message: 'Bet Sizes Not Found' });
      }
      const modifiedResults = results.map((result) => ({
        _id: result.userBetSizes._id,
        name: result.name,
        maxAmount: result.maxAmount,
        amount: result.userBetSizes.amount,
      }));
      return res.send({
        success: true,
        message: 'BET_SIZES_FETCHED_SUCCESSFULLY',
        results: modifiedResults,
      });
    });
  });
}

// function getAllBetSizes(req, res) {
//   const userId = Number(req.query.userId);

//   if (!userId) {
//     return res.status(400).send({ message: 'USER_ID_MISSING' });
//   }

//   User.findOne({ userId: userId }, (err, user) => {
//     if (err || !user) {
//       return res.status(404).send({ message: 'USER_NOT_FOUND' });
//     }

//     const query = [
//       {
//         $lookup: {
//           from: 'userbetsizes',
//           let: { userId: '$userId' },
//           pipeline: [
//             {
//               $match: {
//                 $expr: {
//                   $eq: ['$userId', '$$userId'],
//                 },
//               },
//             },
//             {
//               $project: {
//                 _id: 1,
//                 maxAmount: 1, // Exclude maxAmount field
//                 name: 1, // Exclude name field
//                 'userBetSizes._id': 1, // Exclude _id field in userBetSizes array
//                 'userBetSizes.userId': 1, // Exclude maxAmount field in userBetSizes array
//                 'userBetSizes.betLimitId': 1, // Exclude name field in userBetSizes array
//                 'userBetSizes.amount': 1, // Exclude amount field in userBetSizes array
//               },
//             },
//           ],
//           as: 'userBetSizes',
//         },
//       },
//     ];

//     betLimits.aggregate(query, (err, results) => {
//       if (err) {
//         return res.status(404).send({ message: 'Bet Sizes Not Found' });
//       }
//       return res.send({
//         success: true,
//         message: 'BET_SIZES_FETCHED_SUCCESSFULLY',
//         results: results,
//       });
//     });
//   });
// }

loginRouter.post(
  '/updateBetSizes',
  betSizeValidator.validate('updateBetSizes'),
  updateBetSizes
);
loginRouter.get('/betsNews', betsNews);
loginRouter.get('/getAllBetSizes', getAllBetSizes);

module.exports = { loginRouter };
