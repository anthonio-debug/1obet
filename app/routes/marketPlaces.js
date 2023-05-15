const express = require('express');
var jwt = require('jsonwebtoken');
const userValidation = require('../validators/user');
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
let config = require('config');
const MarketType = require('../models/marketTypes');
const SubMarketType = require('../models/subMarketTypes');
const User = require('../models/user');
const { v4: uuidv4 } = require('uuid');
const marketPlaceVlidator = require('../validators/marketPlaces');

const router = express.Router();
const loginRouter = express.Router();

function addMarketType(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const marketType = new MarketType(req.body);
  marketType.marketId = uuidv4();
  marketType.save((err, marketType) => {
    if (err && err.code === 11000) {
      if (err.keyPattern.name === 1)
        return res.status(404).send({ message: 'market type already present' });
    }
    if (err || !marketType) {
      return res.status(404).send({ message: 'market type not added', err });
    }
    return res.send({
      success: true,
      message: 'Market type added successfully',
      results: marketType,
    });
  });
}

function addSubMarketTypes(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  MarketType.findOne({ marketId: req.body.marketId }, (err, data) => {
    if (err)
      return res.status(404).send({ message: 'market type not found', err });
    const subMarketType = new SubMarketType(req.body);
    subMarketType.marketId = data.marketId;
    subMarketType.subMarketId = uuidv4(); // Generate a unique UUID
    subMarketType.save((err, marketType) => {
      if (err && err.code === 11000) {
        if (err.keyPattern.name === 1)
          return res
            .status(404)
            .send({ message: 'sub market type already present' });
      }
      if (err || !marketType) {
        return res
          .status(404)
          .send({ message: 'sub market type not added', err });
      }
      return res.send({
        success: true,
        message: 'Sub Market type added successfully',
        results: marketType,
      });
    });
  });
}

function getAllMarketTypes(req, res) {
  console.log('in here');
  User.findOne({ userId: req.decoded.userId }, (err, user) => {
    if (err || !user) {
      return res.status(404).send({ message: 'USER_NOT_FOUND' });
    }
    const blockedMarkets = user.blockedMarketPlaces;
    const blockedSubMarkets = user.blockedSubMarkets;
    console.log('blockedMarkets', blockedMarkets);
    console.log('blockedSubMarkets', blockedSubMarkets);

    // Build the dynamic query based on the blocked markets and submarkets
    const query = [
      {
        $lookup: {
          from: 'submarkettypes',
          localField: 'marketId',
          foreignField: 'marketId',
          as: 'subMarketTypes',
        },
      },
    ];

    MarketType.aggregate(query, (err, results) => {
      if (err) {
        return res
          .status(404)
          .send({ message: 'MARKET_TYPES_PAGINATION_FAILED' });
      }

      // set the status to 0 for blocked markets and submarkets, 1 otherwise
      const marketTypes = results.map((result) => {
        const {
          _id,
          marketId,
          marketName,
          name,
          lightIcon,
          darkIcon,
          createdAt,
          __v,
          updatedAt,
          link,
          subMarketTypes,
        } = result;
        let status = 1; // default status is 1

        // Check if the market type is blocked
        if (blockedMarkets.includes(marketId)) {
          status = 0;
        }

        const subMarketStatuses = subMarketTypes.map((subMarketType) => {
          const isBlockedSubMarket = blockedSubMarkets.includes(
            subMarketType.subMarketId
          );
          return {
            _id: subMarketType._id,
            subMarketId: subMarketType.subMarketId,
            name: subMarketType.name,
            marketId: subMarketType.marketId,
            status: isBlockedSubMarket ? 0 : 1,
            createdAt: subMarketType.createdAt,
          };
        });

        return {
          _id,
          marketId,
          status,
          marketName,
          name,
          lightIcon,
          darkIcon,
          createdAt,
          __v,
          updatedAt,
          link,
          subMarketTypes: subMarketStatuses,
        };
      });

      return res.send({
        success: true,
        message: 'MARKET_TYPES_FETCHED_SUCCESSFULLY',
        results: marketTypes,
      });
    });
  });
}

// //old code
// function getAllMarketTypes(req, res) {
//   //to do if company is added two markets for its all users then
//   // when that user login they can see only list of two markets

//   MarketType.aggregate(
//     [
//       {
//         $lookup: {
//           from: 'submarkettypes',
//           localField: 'marketId',
//           foreignField: 'marketId',
//           as: 'subMarketTypes',
//         },
//       },
//     ],
//     (err, results) => {
//       if (err)
//         return res
//           .status(404)
//           .send({ message: 'MARKET_TYPES_PAGINATION_FAILED' });
//       return res.send({
//         success: true,
//         message: 'MARKET_TYPES_RECORD_FOUND',
//         results: results,
//       });
//     }
//   );
// }
//old code
// async function addAllowedMarketTypes(req, res) {
//   const errors = validationResult(req);
//   if (errors.errors.length !== 0) {
//     return res.status(400).send({ errors: errors.errors });
//   }
//   console.log('request.body', req.body);
//   console.log('req.body.subMarketTypes', req.body.subMarketTypes);
//   try {
//     // Find all market types that are specified in the request body
//     const userId = req.decoded.userId;
//     const marketIds = req.body.marketId;
//     const marketTypes = await MarketType.find({
//       marketId: { $in: marketIds },
//     });

//     // Check if all requested market types exist in the database
//     const existingMarketIds = marketTypes.map(
//       (marketType) => marketType.marketId
//     );
//     const missingMarketIds = marketIds.filter(
//       (marketId) => !existingMarketIds.includes(marketId)
//     );
//     if (missingMarketIds.length > 0) {
//       return res.status(404).send({
//         message: `Market types not found: ${missingMarketIds.join(', ')}`,
//       });
//     }

//     // Loop through each market type and find its related submarket types
//     const blockedMarketPlaces = [];
//     const blockedSubMarkets = [];

//     for (const marketType of marketTypes) {
//       const marketIdString = marketType.marketId.toString();

//       // Update the status of the market type
//       marketType.status = req.body.status[marketIdString];
//       await marketType.save();

//       // If specific submarkets are specified in the request body, update their status
//       const subMarketTypePayload =
//         req.body.subMarketTypes && req.body.subMarketTypes[marketIdString];

//       if (subMarketTypePayload) {
//         const subMarketTypes = await SubMarketType.find({
//           marketId: marketType.marketId,
//           subMarketId: {
//             $in: subMarketTypePayload.map((subMarket) => subMarket.subMarketId),
//           },
//         });

//         // Check if all requested submarket types exist in the database
//         const existingSubMarketIds = subMarketTypes.map(
//           (subMarketType) => subMarketType.subMarketId
//         );
//         const missingSubMarketIds = subMarketTypePayload
//           .filter(
//             (subMarket) => !existingSubMarketIds.includes(subMarket.subMarketId)
//           )
//           .map((subMarket) => subMarket.subMarketId);
//         if (missingSubMarketIds.length > 0) {
//           return res.status(404).send({
//             message: `Submarket types not found for market type '${
//               marketType.name
//             }': ${missingSubMarketIds.join(', ')}`,
//           });
//         }

//         // Update the status of the found submarket types
//         await SubMarketType.updateMany(
//           {
//             marketId: marketType.marketId,
//             subMarketId: {
//               $in: subMarketTypePayload.map(
//                 (subMarket) => subMarket.subMarketId
//               ),
//             },
//           },
//           { $set: { status: subMarketTypePayload[0].status } }
//         );

//         // Add blocked submarketIds to blockedSubMarkets array
//         const blockedSubMarketIds = subMarketTypePayload
//           .filter((subMarket) => subMarket.status === 0)
//           .map((subMarket) => subMarket.subMarketId);
//         blockedSubMarkets.push(...blockedSubMarketIds);
//       }

//       // Otherwise, update the status of all submarket types related to this market type
//       else {
//         await SubMarketType.updateMany(
//           { marketId: marketType.marketId },
//           { $set: { status: req.body.status[marketIdString] } }
//         );
//       }

//       // Add blocked market places to blockedMarketPlaces array
//       if (req.body.status[marketIdString] === 0) {
//         blockedMarketPlaces.push(marketType.marketId);
//       }
//     }

//     // Update blockedMarketPlaces and blockedSubMarkets arrays in user collection
//     const user = await User.findOneAndUpdate(
//       { userId: userId },

//       {
//         blockedSubMarkets: blockedSubMarkets,
//         blockedMarketPlaces: blockedMarketPlaces,
//       },
//       { new: true, upsert: false }
//     );
//     // console.log('reuslttt',marketTypes);
//     await user.save();
//     return res.send({
//       success: true,
//       message: 'Allowed market types updated successfully',
//       results: marketTypes,
//     });
// } catch (error) {
//   console.error(error);
//   return res.status(404).send({
//     success: false,
//     message: 'Failed to update allowed market types',
//   });
// }
// }

async function addAllowedMarketTypes(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    // Find all market types that are specified in the request body
    const userId = req.decoded.userId;
    const marketIds = req.body.marketId;

    if (
      req.body.marketId.length === 0 &&
      Object.keys(req.body.status).length === 0
    ) {
      // code to execute if both marketId and status are empty

      const user = await User.findOneAndUpdate(
        { userId: userId },
        {
          blockedSubMarkets: [],
          blockedMarketPlaces: [],
        },
        { new: true, upsert: false }
      );
      await user.save();
      return res.send({
        success: true,
        message: 'Allowed market types updated successfully',
        results: null,
      });
    } else {
      const marketTypes = await MarketType.find({
        marketId: { $in: marketIds },
      });

      // Check if all requested market types exist in the database
      const existingMarketIds = marketTypes.map(
        (marketType) => marketType.marketId
      );
      const missingMarketIds = marketIds.filter(
        (marketId) => !existingMarketIds.includes(marketId)
      );
      if (missingMarketIds.length > 0) {
        return res.status(404).send({
          message: `Market types not found: ${missingMarketIds.join(', ')}`,
        });
      }

      // Loop through each market type and find its related submarket types
      const blockedMarketPlaces = [];
      const blockedSubMarkets = [];

      for (const marketType of marketTypes) {
        const marketIdString = marketType.marketId.toString();

        // If specific submarkets are specified in the request body, update their status
        const subMarketTypePayload =
          req.body.subMarketTypes && req.body.subMarketTypes[marketIdString];

        if (subMarketTypePayload) {
          const subMarketTypes = await SubMarketType.find({
            marketId: marketType.marketId,
            subMarketId: {
              $in: subMarketTypePayload.map(
                (subMarket) => subMarket.subMarketId
              ),
            },
          });

          // Check if all requested submarket types exist in the database
          const existingSubMarketIds = subMarketTypes.map(
            (subMarketType) => subMarketType.subMarketId
          );
          const missingSubMarketIds = subMarketTypePayload
            .filter(
              (subMarket) =>
                !existingSubMarketIds.includes(subMarket.subMarketId)
            )
            .map((subMarket) => subMarket.subMarketId);
          if (missingSubMarketIds.length > 0) {
            return res.status(404).send({
              message: `Submarket types not found for market type '${
                marketType.name
              }': ${missingSubMarketIds.join(', ')}`,
            });
          }

          // Add blocked submarketIds to blockedSubMarkets array
          const blockedSubMarketIds = subMarketTypePayload
            .filter((subMarket) => subMarket.status === 0)
            .map((subMarket) => subMarket.subMarketId);
          blockedSubMarkets.push(...blockedSubMarketIds);
        }

        // Add blocked market places to blockedMarketPlaces array
        if (req.body.status[marketIdString] === 0) {
          blockedMarketPlaces.push(marketType.marketId);
        }

        // Update blockedMarketPlaces and blockedSubMarkets arrays in user collection
        const user = await User.findOneAndUpdate(
          { userId: userId },
          {
            blockedSubMarkets: blockedSubMarkets,
            blockedMarketPlaces: blockedMarketPlaces,
          },
          { new: true, upsert: false }
        );
        await user.save();
      }

      return res.send({
        success: true,
        message: 'Allowed market types updated successfully',
        results: marketTypes,
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(404).send({
      success: false,
      message: 'Failed to update allowed market types',
    });
  }
}

loginRouter.get('/getAllMarketTypes', getAllMarketTypes);
loginRouter.post('/addMarketType', addMarketType);
loginRouter.post('/addSubMarketTypes', addSubMarketTypes);
loginRouter.post(
  '/addAllowedMarketTypes',
  marketPlaceVlidator.validate('addAllowedMarketTypes'),
  addAllowedMarketTypes
);
// loginRouter.post('/editAllowedMarketTypes', editAllowedMarketTypes);
module.exports = { router, loginRouter };
