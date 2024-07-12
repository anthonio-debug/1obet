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
      return res.status(404).send({ message: 'Event does not exist' });
    }

    const marketId = event.sportsId;
    let subMarketIds = [];

    const subMarketMapping = {
      matchOdds: 'Match Odds',
      bookmaker: 'Bookmaker',
      fancy: 'Fancy',
      tiedMatch: 'Tied Match',
      sessionBetting: { $in: ["Even Odds", "Figure", "Small Big"] },
      overUnder: 'Over/Under Goals'
    };

    const addOrRemoveSubMarketIds = async (key, add) => {
      if (req.body[key]) {
        const subMarketKeyIds = await SubMarket.distinct('Id', {
          name: subMarketMapping[key],
          marketId
        });
        subMarketIds = add
          ? subMarketIds.concat(subMarketKeyIds)
          : subMarketIds.filter(id => !subMarketKeyIds.includes(id));
        console.log(subMarketIds);
      }
    };

    await Promise.all([
      addOrRemoveSubMarketIds('matchOdds', matchOdds),
      addOrRemoveSubMarketIds('bookmaker', bookmaker),
      addOrRemoveSubMarketIds('fancy', fancy),
      addOrRemoveSubMarketIds('tiedMatch', tiedMatch),
      addOrRemoveSubMarketIds('sessionBetting', sessionBetting),
      addOrRemoveSubMarketIds('overUnder', overUnder)
    ]);

    // Remove duplicates
    subMarketIds = [...new Set(subMarketIds)];

    const updateUserSubmarkets = async (users, add) => {
      for (const user of users) {
        let blockedSubMarkets = user.blockedSubMarketsByParent;
        let allSubMarkets = add
          ? blockedSubMarkets.concat(subMarketIds)
          : blockedSubMarkets.filter(item => !subMarketIds.includes(item));
        user.blockedSubMarketsByParent = [...new Set(allSubMarkets)];
        await user.save();
      }
    };

    if (allUsers) {
      const users = await User.find({ createdBy: userId });
      await updateUserSubmarkets(users, lock);
    } else {
      const usersToUnlock = await User.find({ createdBy: userId, userId: { $nin: userIds } });
      await updateUserSubmarkets(usersToUnlock, false);

      const usersToLock = await User.find({ userId: { $in: userIds } });
      await updateUserSubmarkets(usersToLock, true);
    }

    return res.send({
      success: true,
      message: 'Betlock created successfully',
      results: null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Betlock not saved' });
  }
}


loginRouter.post(
  '/addBetLock',
  betLockValidator.validate('addBetLock'),
  addBetLock
);

module.exports = { loginRouter };
