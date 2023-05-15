const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const BetLock = require('../models/betLocks');
const betLockValidator = require('../validators/betLocks');
const User = require('../models/user');
const MarketType = require('../models/marketTypes');
const CricketMatch = require('../models/cricketMatches');
const SubMarketType = require('../models/subMarketTypes');

const loginRouter = express.Router();

async function addBetLock(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ errors: errors.errors });
    }
    console.log('req.body', req.body);
    const { selectedUsers, allUsers, marketId, subMarketId, betLockStatus } =
      req.body;
    const query = { isDeleted: false };
    if (req.decoded.login.role === '1') {
      query.superAdminId = req.decoded.userId;
    } else if (req.decoded.login.role === '2') {
      query.parentId = req.decoded.userId;
    } else if (req.decoded.login.role === '3') {
      query.adminId = req.decoded.userId;
    } else if (req.decoded.login.role === '4') {
      query.masterId = req.decoded.userId;
    }

    let loginUser = await User.findOne({ userId: req.decoded.userId });
    if (
      loginUser.betLockStatus === true ||
      loginUser.matchOddsStatus === true
    ) {
      return res.status(404).send({ message: 'Market Locked by the dealer' });
    }

    let foundUsers = [];
    if (allUsers) {
      foundUsers = await User.find(query).select(
        '_id userId userName bettingAllowed blockedSubMarkets blockedMarketPlaces'
      );
      const updateQuery = {};
      for (const user of foundUsers) {
        if (betLockStatus === true) {
          const matchOddsSubMarket = subMarketId.find(
            (subMarket) => subMarket.name === 'Match Odds'
          );
          if (matchOddsSubMarket) {
            updateQuery.$set = { matchOddsStatus: true };
          } else {
            updateQuery.$set = { betLockStatus: true };
          }
          // if (matchOddsSubMarket && betLockStatus === true) {
          //   updateQuery.$set = { betLockStatus: true, matchOddsStatus: true };
          // }
          updateQuery.$addToSet = {
            blockedSubMarketsByParent: {
              $each: subMarketId?.map(({ subMarketId }) => subMarketId) || [],
            },
          };
        } else if (betLockStatus === false) {
          const matchOddsSubMarket = subMarketId.find(
            (subMarket) => subMarket.name === 'Match Odds'
          );
          if (matchOddsSubMarket) {
            updateQuery.$set = { matchOddsStatus: false };
          } else {
            updateQuery.$set = { betLockStatus: false };
          }
          updateQuery.$pull = {
            blockedSubMarketsByParent: {
              $in: subMarketId?.map(({ subMarketId }) => subMarketId) || [],
            },
          };
        }

        await User.updateOne({ userId: user.userId, ...query }, updateQuery);
      }
    } else if (selectedUsers && selectedUsers.length > 0) {
      foundUsers = await User.find({
        userId: { $in: selectedUsers.map(({ userId }) => userId) },
        ...query,
      }).select(
        '_id userId userName bettingAllowed blockedSubMarkets blockedMarketPlaces'
      );
      if (foundUsers.length !== selectedUsers.length) {
        return res.status(404).send({ message: 'One or more users not found' });
      }

      const bulkUpdateOperations = selectedUsers.map(
        ({ userId, betLockStatus }) => {
          const updateQuery = {};
          if (betLockStatus === true) {
            const matchOddsSubMarket = subMarketId.find(
              (subMarket) => subMarket.name === 'Match Odds'
            );
            if (matchOddsSubMarket) {
              updateQuery.$set = { matchOddsStatus: true };
            } else {
              updateQuery.$set = { betLockStatus: true };
            }

            // (updateQuery.$set = { betLockStatus: true }),
            updateQuery.$addToSet = {
              blockedSubMarketsByParent: {
                $each: subMarketId?.map(({ subMarketId }) => subMarketId) || [],
              },
            };
          } else if (betLockStatus === false) {
            const matchOddsSubMarket = subMarketId.find(
              (subMarket) => subMarket.name === 'Match Odds'
            );
            if (matchOddsSubMarket) {
              updateQuery.$set = { matchOddsStatus: false };
            } else {
              updateQuery.$set = { betLockStatus: false };
            }

            // (updateQuery.$set = { betLockStatus: false }),
            updateQuery.$pull = {
              blockedSubMarketsByParent: {
                $in: subMarketId?.map(({ subMarketId }) => subMarketId) || [],
              },
            };
          }

          return {
            updateOne: {
              filter: {
                userId,
                ...query,
              },
              update: updateQuery,
            },
          };
        }
      );

      await User.bulkWrite(bulkUpdateOperations, { ordered: false });
    }

    return res.send({
      success: true,
      message: 'Betlock created successfully',
      results: null,
    });
  } catch (err) {
    console.error(err);
    res.status(404).send({ message: 'betlock not saved' });
  }
}

loginRouter.post(
  '/addBetLock',
  betLockValidator.validate('addBetLock'),
  addBetLock
);

module.exports = { loginRouter };
