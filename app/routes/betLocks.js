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

    const { matchId, allUsers, lock, matchOdds, fancy, bookmaker,
      tiedMatch, sessionBetting, overUnder, userIds } = req.body;
    const userId = Number(req.decoded.userId);
    const event = await Events.findById(matchId);
    if (!event) {
      return res.status(404).send({ message: 'Event Id is Invalid' });
    }

    const eventId = event.Id
    const marketId = event.sportsId;
    let subMarketIds = [];

    if (matchOdds) {
      const matchOddsId = await SubMarket.distinct('Id', {
        name: 'Match Odds',
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(matchOddsId);
      // console.log(subMarketIds);
    }

    if (bookmaker) {
      const bookmakerId = await SubMarket.distinct('Id', {
        name: 'Bookmaker',
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(bookmakerId);
    }

    if (fancy) {
      const fancyId = await SubMarket.distinct('Id', {
        name: 'Fancy',
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(fancyId);
    }
    if (tiedMatch) {
      const tiedMatchid = await SubMarket.distinct('Id', {
        name: 'Tied Match',
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(tiedMatchid);
    }
    if (sessionBetting) {
      const sessionBettingmarkets = ["Even Odds", "Figure", "Small Big"];
      let sessionBettingIds = [];
      for (const sessionBettingmarket of sessionBettingmarkets) {
        const ids = await SubMarket.distinct('Id', {
          name: sessionBettingmarket,
          marketId: marketId
        });
        sessionBettingIds = sessionBettingIds.concat(ids);
      }
      subMarketIds = subMarketIds.concat(sessionBettingIds);
      console.log(subMarketIds);
    }

    if (overUnder) {
      const overUnderids = await SubMarket.distinct('Id', {
        name: "Over/Under Goals",
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(overUnderids);
    }

    // Remove duplicates if any
    subMarketIds = [...new Map(subMarketIds1.map(item => [JSON.stringify(item), item])).values()]

    if (allUsers && lock) {
      const users = await User.find({ createdBy: userId });
      for (const user of users) {
        let blockedSubMarkets = user.blockedSubMarketsByParent;
        let allSubMarkets = blockedSubMarkets.concat(subMarketIds);
        const finalSubMarkets = [...new Map(subMarketIds1.map(item => [JSON.stringify(item), item])).values()];
        user.blockedSubMarketsByParent = finalSubMarkets;
        await user.save();
      }
    } else if (allUsers && !lock) {
      const users = await User.find({ createdBy: userId });
      for (const user of users) {
        let blockedSubMarkets = user.blockedSubMarketsByParent;
        const finalSubMarkets = blockedSubMarkets.filter(item => !subMarketIds.includes(item));
        user.blockedSubMarketsByParent = finalSubMarkets;
        await user.save();
      }
    } else if (!allUsers) {
      const usersToUnlock = await User.find({ createdBy: userId, userId: { $nin: userIds } });
      for (const user of usersToUnlock) {
        let blockedSubMarkets = user.blockedSubMarketsByParent;
        const finalSubMarkets = blockedSubMarkets.filter(item => !subMarketIds.includes(item));
        user.blockedSubMarketsByParent = finalSubMarkets;
        await user.save();
      }

      const usersToLock = await User.find({ userId: { $in: userIds } });
      for (const user of usersToLock) {
        let blockedSubMarkets = user.blockedSubMarketsByParent;
        let allSubMarkets = blockedSubMarkets.concat(subMarketIds);
        const finalSubMarkets = [...new Map(subMarketIds1.map(item => [JSON.stringify(item), item])).values()];
        user.blockedSubMarketsByParent = finalSubMarkets;
        await user.save();
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

        if (getUser && getUser.blockedSubMarketsByParent.length) {
          blockUsers.push(getUser);
        } else {
          unblockUsers.push(getUser)
        }
      } catch (error) {
        console.error(`Error fetching user with ID ${user}:`, error);
      }
    }

    return res.status(200).send({
      success: true,
      blockUsers: blockUsers,
      unblockUsers: unblockUsers
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
