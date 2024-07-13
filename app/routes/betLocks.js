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
    let subMarketIds = [];

    // Define submarket types and their corresponding names
    const subMarketTypes = [
      { name: 'Match Odds', flag: matchOdds },
      { name: 'Bookmaker', flag: bookmaker },
      { name: 'Fancy', flag: fancy },
      { name: 'Tied Match', flag: tiedMatch },
      { name: 'Even Odds', flag: sessionBetting },
      { name: 'Figure', flag: sessionBetting },
      { name: 'Small Big', flag: sessionBetting },
      { name: 'Over/Under Goals', flag: overUnder }
    ];

    // Fetch submarket IDs based on the flags
    for (const type of subMarketTypes) {
      const ids = await SubMarket.find({ name: type.name, marketId: marketId }, 'Id');
      const idList = ids.map(doc => doc.Id);

      if (type.flag) {
        subMarketIds = subMarketIds.concat(idList);
      } else {
        subMarketIds = subMarketIds.filter(id => !idList.includes(id));
      }
    }

    // Remove duplicates if any
    subMarketIds = [...new Set(subMarketIds)];

    const updateUserBlockedSubMarkets = async (user, add) => {
      let blockedSubMarkets = user.blockedSubMarketsByParent;
      console.log(`Before update: ${blockedSubMarkets}`);

      if (add) {
        let allSubMarkets = blockedSubMarkets.concat(subMarketIds);
        const finalSubMarkets = [...new Set(allSubMarkets)];
        user.blockedSubMarketsByParent = finalSubMarkets;
      } else {
        const finalSubMarkets = blockedSubMarkets.filter(item => !subMarketIds.includes(item));
        user.blockedSubMarketsByParent = finalSubMarkets;
      }

      console.log(`After update: ${user.blockedSubMarketsByParent}`);
      await user.save();
    };

    if (allUsers) {
      const users = await User.find({ createdBy: userId });
      for (const user of users) {
        await updateUserBlockedSubMarkets(user, lock);
      }
    } else {
      const usersToUnlock = await User.find({ createdBy: userId, userId: { $nin: userIds } });
      for (const user of usersToUnlock) {
        await updateUserBlockedSubMarkets(user, false);
      }

      const usersToLock = await User.find({ userId: { $in: userIds } });
      for (const user of usersToLock) {
        await updateUserBlockedSubMarkets(user, true);
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

loginRouter.post(
  '/addBetLock',
  betLockValidator.validate('addBetLock'),
  addBetLock
);

module.exports = { loginRouter };
