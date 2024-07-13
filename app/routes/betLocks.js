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

    const marketId = event.sportsId;
    let subMarketIds = [];

    if (matchOdds) {
      const matchOddsIds = await SubMarket.distinct('Id', {
        name: 'Match Odds',
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(matchOddsIds);
    }

    if (bookmaker) {
      const bookmakerIds = await SubMarket.distinct('Id', {
        name: 'Bookmaker',
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(bookmakerIds);
    }

    if (fancy) {
      const fancyIds = await SubMarket.distinct('Id', {
        name: 'Fancy',
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(fancyIds);
    }
    if (tiedMatch) {
      const tiedMatchids = await SubMarket.distinct('Id', {
        name: 'Tied Match',
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(tiedMatchids);
    }
    if (sessionBetting) {
      const oddevent = await SubMarket.distinct('Id', {
        name: "Even Odds",
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(oddevent);
      const figure = await SubMarket.distinct('Id', {
        name: "Figure",
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(figure);
      const smallbig = await SubMarket.distinct('Id', {
        name: "Small Big",
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(smallbig);
    }
    if (overUnder) {
      const overUnderids = await SubMarket.distinct('Id', {
        name: "Over/Under Goals",
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(overUnderids);
    }

    // Remove duplicates if any
    subMarketIds = [...new Set(subMarketIds)]

    if (allUsers && lock) {
      const users = await User.find({ createdBy: userId });
      for (const user of users) {
        let blockedSubMarkets = user.blockedSubMarketsByParent;
        let allSubMarkets = blockedSubMarkets.concat(subMarketIds);
        const finalSubMarkets = [...new Set(allSubMarkets)];
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
        const finalSubMarkets = [...new Set(allSubMarkets)];
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

loginRouter.post(
  '/addBetLock',
  betLockValidator.validate('addBetLock'),
  addBetLock
);

module.exports = { loginRouter };
