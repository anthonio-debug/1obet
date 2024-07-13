const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const betLockValidator = require('../validators/betLocks');
const User = require('../models/user');
const Market = require('../models/marketTypes');
const Events = require('../models/events');
const SubMarket = require('../models/subMarketTypes');
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

    const eventId = event.Id;
    const marketId = event.sportsId;
    let subMarketIds = [];

    if (matchOdds) {
      const matchOddsId = await SubMarket.distinct('Id', {
        name: 'Match Odds',
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat({ subMarketId: matchOddsId, eventId: eventId });
      console.log("subMarketIds=============", subMarketIds);
    }

    if (bookmaker) {
      const bookmakerId = await SubMarket.distinct('Id', {
        name: 'Bookmaker',
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat({ subMarketId: bookmakerId, eventId: eventId });
      console.log("subMarketIds=============", subMarketIds);
    }

    if (fancy) {
      const fancyId = await SubMarket.distinct('Id', {
        name: 'Fancy',
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat({ subMarketId: fancyId, eventId: eventId });
      console.log("subMarketIds=============", subMarketIds);
    }

    if (tiedMatch) {
      const tiedMatchId = await SubMarket.distinct('Id', {
        name: 'Tied Match',
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat({ subMarketId: tiedMatchId, eventId: eventId });
      console.log("subMarketIds=============", subMarketIds);
    }

    if (sessionBetting) {
      const sessionBettingMarkets = ["Even Odd", "Figure", "Chotta Bara"];

      let sessionBettingIds = [];

      for (const sessionBettingMarket of sessionBettingMarkets) {
        const ids = await SubMarket.distinct('Id', {
          name: sessionBettingMarket,
          marketId: marketId
        });
        sessionBettingIds = sessionBettingIds.concat({ subMarketId: ids, eventId: eventId });
      }
      subMarketIds = subMarketIds.concat(sessionBettingIds);
      console.log("subMarketIds=============", subMarketIds);
    }

    if (overUnder) {
      const overUnderIds = await SubMarket.distinct('Id', {
        name: "Over/Under Goals",
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat({ subMarketId: overUnderIds, eventId: eventId });
      console.log("subMarketIds=============", subMarketIds);
    }

    // Remove duplicates if any
    subMarketIds = Array.from(new Set(subMarketIds.map(item => JSON.stringify(item)))).map(item => JSON.parse(item));
    console.log("subMarketIds=============", subMarketIds);

    const updateBlockedSubMarkets = async (user, subMarketIds, lock) => {
      let blockedSubMarkets = user.blockedSubMarketsByParent;
      if (lock) {
        let allSubMarkets = blockedSubMarkets.concat(subMarketIds);
        const finalSubMarkets = Array.from(new Set(allSubMarkets.map(item => JSON.stringify(item)))).map(item => JSON.parse(item));
        user.blockedSubMarketsByParent = finalSubMarkets;
      } else {
        const finalSubMarkets = blockedSubMarkets.filter(blockedItem => !subMarketIds.some(subMarketItem => JSON.stringify(blockedItem) === JSON.stringify(subMarketItem)));
        user.blockedSubMarketsByParent = finalSubMarkets;
      }
      await user.save();
    };

    if (allUsers) {
      const users = await User.find({ createdBy: userId });
      for (const user of users) {
        await updateBlockedSubMarkets(user, subMarketIds, lock);
      }
    } else {
      const usersToUnlock = await User.find({ createdBy: userId, userId: { $nin: userIds } });
      for (const user of usersToUnlock) {
        await updateBlockedSubMarkets(user, subMarketIds, false);
      }

      const usersToLock = await User.find({ userId: { $in: userIds } });
      for (const user of usersToLock) {
        await updateBlockedSubMarkets(user, subMarketIds, true);
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
