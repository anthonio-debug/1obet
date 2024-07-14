const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const betLockValidator = require('../validators/betLocks');
const User = require('../models/user');
const Market = require('../models/marketTypes');
const Events = require('../models/events');
const SubMarket = require('../models/subMarketTypes');
const { getAllUserIDs } = require("./bets.js")
const loginRouter = express.Router();

async function addBetLock(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ errors: errors.errors });
    }

    const { matchId, allUsers, lock, matchOdds, fancy, bookmaker, tiedMatch, sessionBetting, overUnder, userIds } = req.body;
    const userId = Number(req.decoded.userId);
    const event = await Events.findById(matchId);
    if (!event) {
      return res.status(404).send({ message: 'Event Id is Invalid' });
    }

    const eventId = event.Id;
    const marketId = event.sportsId;
    let subMarketIds = [];

    console.log(`Fetching sub-market IDs for eventId: ${eventId} and marketId: ${marketId}`);

    // Helper function to retrieve subMarketId
    async function getSubMarketId(subMarketName) {
      const subMarket = await SubMarket.findOne({ name: subMarketName, marketId }, { Id: 1 });
      return subMarket ? subMarket.Id : null;
    }

    // Collect subMarketIds based on boolean flags
    if (matchOdds) {
      const matchOddsId = await getSubMarketId('Match Odds');
      console.log(`Match Odds ID: ${matchOddsId}`);
      if (matchOddsId) {
        subMarketIds.push({ eventId, subMarketId: matchOddsId });
      }
    }

    if (bookmaker) {
      const bookmakerId = await getSubMarketId('Bookmaker');
      console.log(`Bookmaker ID: ${bookmakerId}`);
      if (bookmakerId) {
        subMarketIds.push({ eventId, subMarketId: bookmakerId });
      }
    }

    if (fancy) {
      const fancyId = await getSubMarketId('Fancy');
      console.log(`Fancy ID: ${fancyId}`);
      if (fancyId) {
        subMarketIds.push({ eventId, subMarketId: fancyId });
      }
    }

    if (tiedMatch) {
      const tiedMatchId = await getSubMarketId('Tied Match');
      console.log(`Tied Match ID: ${tiedMatchId}`);
      if (tiedMatchId) {
        subMarketIds.push({ eventId, subMarketId: tiedMatchId });
      }
    }

    if (sessionBetting) {
      const sessionBettingMarkets = ["Even Odd", "Figure", "Chotta Bara"];
      for (const sessionBettingMarket of sessionBettingMarkets) {
        const sessionBettingId = await getSubMarketId(sessionBettingMarket);
        console.log(`Session Betting Market "${sessionBettingMarket}" ID: ${sessionBettingId}`);
        if (sessionBettingId) {
          subMarketIds.push({ eventId, subMarketId: sessionBettingId });
        }
      }
    }

    if (overUnder) {
      const overUnderId = await getSubMarketId('Over/Under Goals');
      console.log(`Over/Under Goals ID: ${overUnderId}`);
      if (overUnderId) {
        subMarketIds.push({ eventId, subMarketId: overUnderId });
      }
    }

    // Log subMarketIds before removing duplicates
    console.log('SubMarket IDs before removing duplicates:', subMarketIds);

    // Remove duplicates
    subMarketIds = [...new Map(subMarketIds.map(item => [JSON.stringify(item), item])).values()];

    // Log subMarketIds after removing duplicates
    console.log('SubMarket IDs after removing duplicates:', subMarketIds);

    if (allUsers && lock) {
      // Set the blockedSubMarketsByParent field for all users created by the current user
      await User.updateMany(
        { createdBy: userId },  // Query to find the users
        { $set: { blockedSubMarketsByParent: subMarketIds } }  // Set the field to the new value
      );
      console.log('All users updated with new blockedSubMarketsByParent');
    } else if (allUsers && !lock) {
      // Clear the blockedSubMarketsByParent field for all users created by the current user
      await User.updateMany(
        { createdBy: userId },  // Query to find the users
        { $set: { blockedSubMarketsByParent: [] } }  // Clear the field
      );
      console.log('All users cleared of blockedSubMarketsByParent');
    } else if (!allUsers) {
      const usersToUnlock = await User.find({ createdBy: userId, userId: { $nin: userIds } });
      console.log('Users to unlock:', usersToUnlock);
      for (const user of usersToUnlock) {
        await User.updateOne(
          { userId: user.userId },
          { $set: { blockedSubMarketsByParent: [] } }
        );
        console.log(`User ${user.userId} cleared of blockedSubMarketsByParent`);
      }

      const usersToLock = await User.find({ userId: { $in: userIds } });
      console.log('Users to lock:', usersToLock);
      for (const user of usersToLock) {
        await User.updateOne(
          { userId: user.userId },
          { $set: { blockedSubMarketsByParent: subMarketIds } }
        );
        console.log(`User ${user.userId} updated with new blockedSubMarketsByParent`);
      }
    }

    return res.send({
      success: true,
      message: 'Betlock created successfully',
      results: null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Error creating betlock' });
  }
}



async function gettingBlockUsers(req, res) {
  try {
    const userId = req.decoded.userId;
    const blockUsers = [];
    const unblockUsers = [];

    const userIdArray = Array.isArray(userId) ? userId : [userId];
    const allUserIDs = await getAllUserIDs(userIdArray);

    for (const user of allUserIDs) {
      try {
        const getUser = await User.findOne({ userId: user });

        if (getUser) {
          const userInfo = { userName: getUser.userName, userId: getUser.userId, role: getUser.role };
          if (getUser.blockedSubMarketsByParent.length) {
            blockUsers.push(userInfo);
            console.log(userInfo);
          } else {
            unblockUsers.push(userInfo);
          }
        }
      } catch (error) {
        console.error(`Error fetching user with ID ${user}:`, error);
      }
    }

    return res.status(200).send({
      success: true,
      blockUsers,
      unblockUsers,
    });

  } catch (error) {
    console.error('Error in gettingBlockUsers:', error);
    return res.status(500).send({ message: 'Something went wrong' });
  }
}



loginRouter.get("/getblockusers", gettingBlockUsers)
loginRouter.post(
  '/addBetLock',
  betLockValidator.validate('addBetLock'),
  addBetLock
);

module.exports = { loginRouter };
