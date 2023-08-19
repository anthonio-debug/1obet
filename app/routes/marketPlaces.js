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
    if (err && err.code == 11000) {
      if (err.keyPattern.name == 1)
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
      if (err && err.code == 11000) {
        if (err.keyPattern.name == 1)
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

async function getAllMarketTypes(req, res) {
  User.findOne({ userId: req.decoded.userId }, async (err, user) => {
    if (err || !user) {
      return res.status(404).send({ message: 'Something went wrong' });
    }
    const blockedMarkets = user.blockedMarketPlaces;
    const blockedSubMarkets = user.blockedSubMarkets;

    const data = await MarketType.aggregate([
      { 
        $lookup: {
          from: 'submarkettypes',
          localField: 'Id',
          foreignField: 'marketId',
          as: 'subMarkets',
        }
      },
      {
        $project: {
          Id: '$Id',
          marketName: '$name',
          status: {
            $cond: {
              if: { $in: ["$Id", blockedMarkets] },
              then: 0,
              else: 1
            }
          },
          subMarkets: {
            $map: {
              input: '$subMarkets',
              as: 'subMarket',
              in: {
                Id: '$$subMarket.Id',
                name: '$$subMarket.name',
                marketId: '$$subMarket.marketId',
                status: {
                  $cond: {
                    if: { $in: ["$$subMarket.Id", blockedSubMarkets] },
                    then: 0,
                    else: 1
                  }
                }
              }
            }
          }
        }
      }
    ]);

    return res.send({
      success: true,
      message: 'MARKET_TYPES_FETCHED_SUCCESSFULLY',
      results: {
        markets: data,
        blockedMarkets,
        blockedSubMarkets
      },
    });
  });
}

async function addAllowedMarketTypes(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    const userId = req.decoded.userId;
    const {markets, subMarkets } = req.body.blocked;

    await User.findOneAndUpdate({userId: userId}, {$set:{
      blockedMarketPlaces: markets,
      blockedSubMarkets: subMarkets
    }})
    return res.send({
      success: true,
      message: 'Markets updated successfully',
    });
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
