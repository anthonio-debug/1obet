const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const betLockValidator = require('../validators/betLocks');
const User = require('../models/user');
const Market = require('../models/marketTypes');
const Events = require('../models/events');
const SubMarket = require('../models/subMarketTypes');
const { getAllUserIDs } = require("./bets.js");
const { eventsBySupportJobs } = require('./sportsTestAPI.js');
const loginRouter = express.Router();

async function addBetLock(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ errors: errors.errors });
    }

    const {
      matchId,
      allUsers,
      lock,
      matchOdds,
      fancy,
      bookmaker,
      tiedMatch,
      sessionBetting,
      overUnder,
      userIds
    } = req.body;
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
      return subMarket ? subMarket.Id : null;
    }

    if (matchOdds) {
      const matchOddsId = await getSubMarketId('Match Odds');
      if (matchOddsId) {
        subMarketIds.push({ eventId, status: true, subMarketId: matchOddsId });
      }
    }

    if (bookmaker) {
      const bookmakerId = await getSubMarketId('Bookmaker');
      if (bookmakerId) {
        subMarketIds.push({ eventId, status: true, subMarketId: bookmakerId });
      }
    }

    if (fancy) {
      const fancyId = await getSubMarketId('Fancy');
      if (fancyId) {
        subMarketIds.push({ eventId, status: true, subMarketId: fancyId });
      }
    }

    if (tiedMatch) {
      const tiedMatchId = await getSubMarketId('Tied Match');
      if (tiedMatchId) {
        subMarketIds.push({ eventId, status: true, subMarketId: tiedMatchId });
      }
    }

    if (sessionBetting) {
      const sessionBettingMarkets = ["Even Odd", "Figure", "Chotta Bara"];
      const sessionMarketIds = [];
      for (const market of sessionBettingMarkets) {
        const id = await getSubMarketId(market);
        sessionMarketIds.push(id);
      }
      console.log(sessionMarketIds);
      subMarketIds.push({ eventId, status: true, subMarketId: sessionMarketIds });
    }

    if (overUnder) {
      const overUnderId = await getSubMarketId('Over/Under Goals');
      if (overUnderId) {
        subMarketIds.push({ eventId, status: true, subMarketId: overUnderId });
      }
    }

    // Ensure unique subMarketIds
    subMarketIds = [...new Map(subMarketIds.map(item => [JSON.stringify(item), item])).values()];

    console.log("userIds array:", userIds);

    if (allUsers && lock) {
      const users = await User.find({ createdBy: userId });
      for (const user of users) {
        console.log(`Before update (lock all users): User ID ${user.userId}`, user.blockedSubMarketsByParent);

        const updatedSubMarketIds = [
          ...user.blockedSubMarketsByParent,
          ...subMarketIds
        ];
        const uniqueSubMarketIds = [...new Map(updatedSubMarketIds.map(item => [JSON.stringify(item), item])).values()];

        await User.updateOne(
          { userId: user.userId },
          { $set: { blockedSubMarketsByParent: uniqueSubMarketIds } }
        );

        console.log(`After update (lock all users): User ID ${user.userId}`, uniqueSubMarketIds);
      }
    } else if (allUsers && !lock) {
      await User.updateMany(
        { createdBy: userId },
        { $set: { blockedSubMarketsByParent: [], blockStatus: false } }
      );
    }
    else if (!allUsers) {

      for (const id of userIds) {
        const user = await User.findOne({ userId: id });
        if (user) {
          console.log(`Before update (lock specific users): User ID ${user.userId}`, user.blockedSubMarketsByParent);

          const updatedSubMarketIds = [
            ...user.blockedSubMarketsByParent,
            ...subMarketIds
          ];
          const uniqueSubMarketIds = [...new Map(updatedSubMarketIds.map(item => [JSON.stringify(item), item])).values()];

          await User.updateOne(
            { userId: user.userId },
            { $set: { blockedSubMarketsByParent: uniqueSubMarketIds } }
          );

          console.log(`After update (lock specific users): User ID ${user.userId}`, uniqueSubMarketIds);
        } else {
          console.log(`User ID ${id} not found.`);
        }
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
          const userInfo = { userName: getUser.userName, userId: getUser.userId, role: getUser.role, blockStatus: getUser.blockStatus, blockedMarkets: getUser.blockedSubMarketsByParent };
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

async function updateBlockUsers(req, res) {
  try {
    const { userMarkets, eventId } = req.body;
    const event = await Events.findOne({ Id: eventId });

    if (!event) {
      console.error("Event doesn't exist");
      return res.status(404).send({ message: "Event doesn't exist" });
    }

    async function getSubMarketId(subMarketName) {
      const subMarket = await SubMarket.findOne({ name: subMarketName }, { Id: 1 });
      console.log(`SubMarket (${subMarketName}):`, subMarket);
      return subMarket.Id
    }

    if (userMarkets) {
      for (const user of userMarkets) {
        console.log('Processing user:', user.userId);
        console.log(userMarkets);
        const userSubMarketIds = [];
        // console.log("user fancy", user.fancy);
        if (user.fancy) {
          const fancyId = await getSubMarketId('Fancy');
          const status = !!fancyId;
          console.log(`FancyId: ${fancyId}, Status: ${status}`);
          if (fancyId) userSubMarketIds.push({ eventId, status, subMarketId: fancyId });
        }

        if (user.bookmaker) {
          const bookmakerId = await getSubMarketId('Bookmaker');
          console.log("user bookmaker", bookmakerId);
          const status = !!bookmakerId;
          console.log(`BookmakerId: ${bookmakerId}, Status: ${status}`);
          if (bookmakerId) userSubMarketIds.push({ eventId, status, subMarketId: bookmakerId });
        }

        if (user.sessionBetting) {
          const sessionBettingMarkets = ["Even Odd", "Figure", "Chotta Bara"];
          const sessionMarketIds = [];
          for (const market of sessionBettingMarkets) {
            const id = await getSubMarketId(market);
            sessionMarketIds.push(id);
          }
          console.log(sessionMarketIds);
          userSubMarketIds.push({ eventId, status: true, subMarketId: sessionMarketIds });
        }

        if (user.tiedMatch) {
          const tiedMatchId = await getSubMarketId('Tied Match');
          const status = !!tiedMatchId;
          console.log(`TiedMatchId: ${tiedMatchId}, Status: ${status}`);
          if (tiedMatchId) userSubMarketIds.push({ eventId, status, subMarketId: tiedMatchId });
        }

        const uniqueSubMarketIds = [...new Map(userSubMarketIds.map(item => [JSON.stringify(item), item])).values()];
        console.log('Unique SubMarketIds:', uniqueSubMarketIds);

        const updateResult = await User.updateOne(
          { userId: user.userId },
          { $set: { blockedSubMarketsByParent: uniqueSubMarketIds } }
        );
        console.log(`Update result for user ${user.userId}:`, updateResult);
      }
    }

    res.send({
      success: true,
      message: 'Users updated successfully',
    });
  } catch (err) {
    console.error('Error updating users:', err);
    res.status(500).send({ message: 'Error updating users' });
  }
}

loginRouter.get("/getblockusers", gettingBlockUsers)
loginRouter.post("/updateblockusers", updateBlockUsers)
loginRouter.get("/eventsBySupportJobs", eventsBySupportJobs)
loginRouter.post(
  '/addBetLock',
  betLockValidator.validate('addBetLock'),
  addBetLock
);

module.exports = { loginRouter };