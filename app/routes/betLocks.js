const express = require('express');
const { validationResult } = require('express-validator');
const config = require('config');
const betLockValidator = require('../validators/betLocks');
const User = require('../models/user');
const Market = require('../models/marketTypes');
const Events = require('../models/events');
const SubMarket = require('../models/subMarketTypes');
const loginRouter = express.Router();

async function getSubMarketIds(marketId, subMarketNames) {
  console.log(`Fetching submarket IDs for marketId: ${marketId} and names: ${subMarketNames}`);
  const subMarketIds = await SubMarket.distinct('Id', {
    name: { $in: subMarketNames },
    marketId: marketId,
  });
  console.log(`Fetched submarket IDs: ${subMarketIds}`);
  return subMarketIds;
}

async function updateUsersSubMarkets(userIds, subMarketIds, lock) {
  console.log(`Updating users: ${userIds} with submarket IDs: ${subMarketIds} and lock: ${lock}`);
  const users = await User.find({ userId: { $in: userIds } });
  await Promise.all(users.map(async (user) => {
    let blockedSubMarkets = user.blockedSubMarketsByParent;
    if (lock) {
      blockedSubMarkets = [...new Set([...blockedSubMarkets, ...subMarketIds])];
    } else {
      blockedSubMarkets = blockedSubMarkets.filter(id => !subMarketIds.includes(id));
    }
    user.blockedSubMarketsByParent = blockedSubMarkets;
    await user.save();
  }));
  console.log(`Updated users: ${userIds}`);
}

async function addBetLock(req, res) {
  try {
    console.log('Received request to add bet lock');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.errors);
      return res.status(400).send({ errors: errors.errors });
    }

    const { matchId, allUsers, lock, matchOdds, fancy, bookmaker,
      tiedMatch, sessionBetting, overUnder, userIds } = req.body;
    const userId = Number(req.decoded.userId);
    const event = await Events.findById(matchId);

    if (!event) {
      console.log('Event does not exist:', matchId);
      return res.status(404).send({ message: 'Event does not exist' });
    }

    const marketId = event.sportsId;
    const subMarketNames = [];
    if (matchOdds) subMarketNames.push('Match Odds');
    if (bookmaker) subMarketNames.push('Bookmaker');
    if (fancy) subMarketNames.push('Fancy');
    if (tiedMatch) subMarketNames.push('Tied Match');
    if (sessionBetting) subMarketNames.push(...["Even Odds", "Figure", "Small Big"]);
    if (overUnder) subMarketNames.push('Over/Under Goals');

    let subMarketIds = await getSubMarketIds(marketId, subMarketNames);

    if (allUsers) {
      const users = await User.find({ createdBy: userId });
      const userIds = users.map(user => user.userId);
      await updateUsersSubMarkets(userIds, subMarketIds, lock);
    } else {
      const usersToUnlockIds = (await User.find({ createdBy: userId, userId: { $nin: userIds } })).map(user => user.userId);
      const usersToLockIds = (await User.find({ userId: { $in: userIds } })).map(user => user.userId);
      await updateUsersSubMarkets(usersToUnlockIds, subMarketIds, false);
      await updateUsersSubMarkets(usersToLockIds, subMarketIds, true);
    }

    console.log('Betlock created successfully');
    return res.send({
      success: true,
      message: 'Betlock created successfully',
      results: null,
    });
  } catch (err) {
    console.error('Error creating betlock:', err);
    res.status(500).send({ message: 'Betlock not saved', error: err.message });
  }
}

loginRouter.post(
  '/addBetLock',
  betLockValidator.validate('addBetLock'),
  addBetLock
);

module.exports = { loginRouter };
