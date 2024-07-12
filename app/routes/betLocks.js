const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const betLockValidator = require('../validators/betLocks');
const User = require('../models/user');
const Market = require('../models/marketTypes');
const Events = require('../models/events');
const SubMarket = require('../models/subMarketTypes');
const { getAllUsers } = require("./user.js")
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
      return res.status(404).send({ message: 'Event does not exist' });
    }

    const marketId = event.sportsId;
    console.log(event);
    let subMarketIds = [];

    if (matchOdds) {
      const matchOddsIds = await SubMarket.distinct('Id', {
        name: 'Match Odds',
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(matchOddsIds);
      console.log(subMarketIds)
    } else {
      const matchOddsIds = await SubMarket.distinct('Id', {
        name: 'Match Odds',
        marketId: marketId
      });
      subMarketIds = subMarketIds.filter(id => !matchOddsIds.includes(id));
      console.log(subMarketIds)
    }

    if (bookmaker) {
      const bookmakerIds = await SubMarket.distinct('Id', {
        name: 'Bookmaker',
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(bookmakerIds);
      console.log(subMarketIds)
    } else {
      const bookmakerIds = await SubMarket.distinct('Id', {
        name: 'Bookmaker',
        marketId: marketId
      });
      subMarketIds = subMarketIds.filter(id => !bookmakerIds.includes(id));
      console.log(subMarketIds)
    }

    if (fancy) {
      const fancyIds = await SubMarket.distinct('Id', {
        name: 'Fancy',
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(fancyIds);
      console.log(subMarketIds)
    } else {
      const fancyIds = await SubMarket.distinct('Id', {
        name: 'Fancy',
        marketId: marketId
      });
      subMarketIds = subMarketIds.filter(id => !fancyIds.includes(id));
      console.log(subMarketIds)
    }
    if (tiedMatch) {
      const tiedMatchIds = await SubMarket.distinct('Id', {
        name: 'Tied Match',
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(tiedMatchIds);
      console.log(subMarketIds)
    } else {
      const tiedMatchIds = await SubMarket.distinct('Id', {
        name: 'Tied Match',
        marketId: marketId
      });
      subMarketIds = subMarketIds.filter(id => !tiedMatchIds.includes(id));
      console.log(subMarketIds)
    }
    if (sessionBetting) {
      const sessionBettingIds = await SubMarket.distinct('Id', {
        name: { $in: ["Even Odds", "Figure", "Small Big"] },
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(sessionBettingIds);
      console.log(subMarketIds)
    } else {
      const sessionBettingIds = await SubMarket.distinct('Id', {
        name: { $in: ["Even Odds", "Figure", "Small Big"] },
        marketId: marketId
      });
      subMarketIds = subMarketIds.filter(id => !sessionBettingIds.includes(id));
      console.log(subMarketIds)
    }
    if (overUnder) {
      const overUnderIds = await SubMarket.distinct('Id', {
        name: "Over/Under Goals",
        marketId: marketId
      });
      subMarketIds = subMarketIds.concat(overUnderIds);
      console.log(subMarketIds)
    } else {
      const overUnderIds = await SubMarket.distinct('Id', {
        name: "Over/Under Goals",
        marketId: marketId
      });
      subMarketIds = subMarketIds.filter(id => !overUnderIds.includes(id));
      console.log(subMarketIds)
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
