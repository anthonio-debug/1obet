const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const betLockValidator = require('../validators/betLocks');
const User = require('../models/user');
const MarketType = require('../models/marketTypes');
const Events = require('../models/events');
const SubMarketType = require('../models/subMarketTypes');

const loginRouter = express.Router();

async function addBetLock(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ errors: errors.errors });
    }
    const { selectedUsers, allUsers, subMarketNames, betLockStatus, matchId, otherMarkets } = req.body;
    const query = { isDeleted: false, userId: { $ne: req.decoded.userId } };
    query.createdBy = Number(req.decoded.userId);

    let loginUser = await User.findOne({ userId: req.decoded.userId });
    console.log('loginUser', loginUser);
    if (loginUser.betLockStatus == true) {
      return res.status(404).send({ message: 'Market Locked by the dealer' });
    }
    let event = await Events.findOne({ _id: matchId })
   let marketId = event.sportsId
   console.log('event',event);
   let subMarketIds
   if( subMarketName == 'Match Odds' && otherMarkets === false ){
    console.log('in Match Odds submarkets');

    let foundSubMarkets = await SubMarketType.find({ name: subMarketNames,marketId: marketId }).select('subMarketId');
    subMarketIds = foundSubMarkets.map((subMarket) => subMarket.subMarketId);
   }
   else if( otherMarkets === true) {
    console.log('in other markets');
    let foundSubMarkets = await SubMarketType.find({ name: {$nin: "Match Odds" }, marketId: marketId }).select('subMarketId');
     console.log('foundSubMarkets',foundSubMarkets)
    subMarketIds = foundSubMarkets?.filter((item)=>item?.name!=='Match Odds').map((subMarket) => subMarket.subMarketId);
}
    let foundUsers = [];
    if (allUsers) {
      foundUsers = await User.find(query).select(
        '_id userId userName bettingAllowed blockedSubMarkets blockedMarketPlaces'
      );
      const updateQuery = {};
      for (const user of foundUsers) {
        if (betLockStatus == true) {
          // const matchOddsSubMarket = 'Match Odds'
          if (subMarketNames == 'Match Odds') {
            updateQuery.$set = { matchOddsStatus: true };
          } else if (subMarketNames == ''){
            updateQuery.$set = { betLockStatus: true };
          }
          updateQuery.$addToSet = {
            blockedSubMarketsByParent: {
              $each: subMarketIds || [],
            },
          };
        } else if (betLockStatus == false) {
          // const matchOddsSubMarket = 'Match Odds'
          if (subMarketNames == 'Match Odds') {
            updateQuery.$set = { matchOddsStatus: false };
          } else if( subMarketNames == '') {
            updateQuery.$set = { betLockStatus: false };
          }
          updateQuery.$pull = {
            blockedSubMarketsByParent: {
              $in: subMarketIds || [],
            },
          };
        }

        await User.updateMany(
          { createdBy: req.decoded.userId, userId: { $ne: req.decoded.userId } },
          updateQuery
        );
      }
    }
    if (selectedUsers && selectedUsers.length > 0) {
      const userIds = selectedUsers.map(({ userId }) => userId);
    
      const updateOperations = selectedUsers.map(({ userId, betLockStatus }) => {
        const updateQuery = {};
        const matchOddsSubMarket = 'Match Odds'
        
        if (betLockStatus === true) {
          if (subMarketNames == 'Match Odds') {
            updateQuery.$set = { matchOddsStatus: true };
          } else if( subMarketNames == '') {
            updateQuery.$set = { betLockStatus: true };
          }
          // updateQuery.$set = matchOddsSubMarket
          //   ? { matchOddsStatus: true }
          //   : { betLockStatus: true };
    
          updateQuery.$addToSet = {
            blockedSubMarketsByParent: {
              $each: subMarketIds,
            },
          };
        } else if (betLockStatus == false) {
          if (subMarketNames == 'Match Odds') {
            updateQuery.$set = { matchOddsStatus: false };
          } else if( subMarketNames == '') {
            updateQuery.$set = { betLockStatus: false };
          }
          // updateQuery.$set = matchOddsSubMarket
          //   ? { matchOddsStatus: false }
          //   : { betLockStatus: false };
    
          updateQuery.$pull = {
            blockedSubMarketsByParent: {
              $in: subMarketIds,
            },
          };
        }
        
        return {
          updateMany: {
            filter: {
              createdBy: req.decoded.userId,
              userId: { $in: [userId] },
            },
            update: updateQuery,
          },
        };
      });
        
      try {
        const updateResults = await User.bulkWrite(updateOperations, { ordered: false });
      } catch (error) {
        console.error('Error updating users:', error);
        res.status(404).send({ message: 'betlock not saved' });
      }
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
