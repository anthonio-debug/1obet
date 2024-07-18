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
    const { matchId, allUsers, lock, matchOdds, fancy,
      bookmaker, tiedMatch, sessionBetting, overUnder, userIds } = req.body;
    const userId = Number(req.decoded.userId);
    const event = await Events.findById(matchId);

    if (!event) {
      return res.status(404).send({ message: 'Event Id is Invalid' });
    }

    const eventId = event.Id;
    const marketId = event.sportsId;
    let subMarketIds = [];

    async function getSubMarketId(subMarketName) {
      const subMarket = await SubMarket.findOne({ name: subMarketName, marketId }, { Id: 1 });
      console.log(subMarket);
      return subMarket
    }

    if (matchOdds) {
      const matchOddsId = await getSubMarketId('Match Odds');
      if (matchOddsId) {
        subMarketIds.push({ eventId, subMarketId: matchOddsId });
      }
    }

    if (bookmaker) {
      const bookmakerId = await getSubMarketId('Bookmaker');
      if (bookmakerId) {
        subMarketIds.push({ eventId, subMarketId: bookmakerId });
      }
    }

    if (fancy) {
      const fancyId = await getSubMarketId('Fancy');
      if (fancyId) {
        subMarketIds.push({ eventId, subMarketId: fancyId });
      }
    }

    if (tiedMatch) {
      const tiedMatchId = await getSubMarketId('Tied Match');
      if (tiedMatchId) {
        subMarketIds.push({ eventId, subMarketId: tiedMatchId });
      }
    }

    if (sessionBetting) {
      const sessionBettingMarkets = ["Even Odd", "Figure", "Chotta Bara"];
      for (const sessionBettingMarket of sessionBettingMarkets) {
        const sessionBettingId = await getSubMarketId(sessionBettingMarket);
        if (sessionBettingId) {
          subMarketIds.push({ eventId, subMarketId: sessionBettingId });
        }
      }
    }

    if (overUnder) {
      const overUnderId = await getSubMarketId('Over/Under Goals');
      if (overUnderId) {
        subMarketIds.push({ eventId, subMarketId: overUnderId });
      }
    }
    subMarketIds = [...new Map(subMarketIds.map(item => [JSON.stringify(item), item])).values()];

    if (allUsers && lock) {
      await User.updateMany(
        { createdBy: userId },
        { $set: { blockedSubMarketsByParent: subMarketIds, blockStatus: true } }
      );
    } else if (allUsers && !lock) {
      await User.updateMany(
        { createdBy: userId },
        { $set: { blockedSubMarketsByParent: [], blockStatus: false } }
      );
    } else if (!allUsers) {
      const usersToUnlock = await User.find({ createdBy: userId, userId: { $nin: userIds } });

      for (const user of usersToUnlock) {
        await User.updateOne(
          { userId: user.userId },
          { $set: { blockedSubMarketsByParent: [], blockStatus: false } }
        );
      }

      const usersToLock = await User.find({ userId: { $in: userIds } });

      for (const user of usersToLock) {
        await User.updateOne(
          { userId: user.userId },
          { $set: { blockedSubMarketsByParent: subMarketIds, blockStatus: true } }
        );
      }
    }

    return res.send({
      success: true,
      message: 'Betlock created successfully',
      results: null,
    });
  } catch (err) {
    console.error('Error creating betlock:', err);
    res.status(500).send({ message: 'Error creating betlock' });
  }
}

async function gettingBlockUsers(req, res) {
  try {
    const userID = req.decoded.userId;
    const blockUsers = [];
    const unblockUsers = [];

    const userIdArray = Array.isArray(userID) ? userID : [userID];
    const allUserIDs = await getAllUserIDs(userIdArray);

    for (const user of allUserIDs) {
      try {
        const getUser = await User.findOne({ userId: user });

        if (getUser) {
          const userInfo = { userName: getUser.userName, userId: getUser.userId, role: getUser.role, blockStatus: getUser.blockStatus, blockedSubMarketsByParent: getUser.blockedSubMarketsByParent };
          const blockparent = getUser.blockedSubMarketsByParent.length
          blockparent ? User.updateOne({ userId: getUser.userId }) : User.updateOne({ userId: getUser.userId })

          if (getUser.createdBy === userID) {
            blockparent ? blockUsers.push(userInfo) : unblockUsers.push(userInfo)
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
