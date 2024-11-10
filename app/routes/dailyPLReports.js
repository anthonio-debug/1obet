const express = require('express');
const { validationResult } = require('express-validator');
const CashDeposit = require('../models/deposits');
const User = require('../models/user');

const Events = require('../models/events');
const inPlayEvents = require('../models/events');
const loginRouter = express.Router();

async function getBetIds(userId) {
  try {
    const betIds = await CashDeposit.aggregate([
      {
        $match: {
          userId,
          cashOrCredit: { $in: ["Bet", "Casino Bet"] }
        },
      },
      {
        $group: {
          _id: null,
          betIds: { $push: "$betId" },
        },
      },
      {
        $project: {
          _id: 0,
          betIds: 1,
        },
      },
    ]);
    return betIds.length > 0 ? betIds[0].betIds : [];
  } catch (err) {
    console.error("Error retrieving betIds:", err);
    return [];
  }
}

const getDailyPLReport = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  const userId = parseInt(req.decoded.userId)
  const userIds = await User.find({ createdBy: userId }, { userId: 1, _id: 0 })
  const users = userIds.map(user => { return user.userId });
  users.push(userId)

  const response = await CashDeposit.aggregate([
    {
      $match: {
        userId: { $in: users },
        cashOrCredit: { $in: ["Bet", "Casino Bet"] },
        createdAt: { $gte: req.query.startDate, $lte: req.query.endDate }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: 'userId',
        as: 'userInfo'
      }
    },
    {
      $group: {
        _id: "$userId",
        amount: { $sum: "$amount" },
        name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } },
        role: { $first: { $arrayElemAt: ["$userInfo.role", 0] } }
      }
    },
    {
      $sort: {
        role: -1
      }
    }
  ]);

  return res.send({
    success: true,
    message: 'Commission reports',
    results: response,
    total: response.length
  });
}

const dailyPlSportWiseReports = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const Id = parseInt(req.query.userId)
  //console.log(" Id ========== ", Id);

  const response = await CashDeposit.aggregate([
    {
      $match: {
        userId: Id,
        cashOrCredit: { $in: ["Bet", "Casino Bet"] },
        $and: [
          {
            createdAt: { $gte: req.query.startDate }
          },
          {
            createdAt: { $lte: req.query.endDate }
          }
        ]
      }
    },
    {
      $lookup: {
        from: 'markettypes',
        localField: 'sportsId',
        foreignField: 'Id',
        as: 'marketInfo'
      }
    },
    {
      $group: {
        _id: "$sportsId",
        amount: { $sum: "$amount" },
        userId: { $first: "$userId" },
        name: { $first: { $arrayElemAt: ["$marketInfo.name", 0] } }
      }
    }
  ]);
  return res.send({
    success: true,
    message: 'Market wise Reports !',
    results: response,
  });
}

const dailyPLMatchWiseReport = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const userId = req.decoded.userId
  //console.log(" userId ====== ", userId);
  const Id = parseInt(req.query.userId)
  let response = [];
  if (req.query.sportsId == 6) {
    response = await CashDeposit.aggregate([
      {
        $match: {
          userId: Id,
          sportsId: req.query.sportsId,
          cashOrCredit: { $in: ["Bet", "Casino Bet"] },
          $and: [
            {
              createdAt: { $gte: req.query.startDate }
            },
            {
              createdAt: { $lte: req.query.endDate }
            }
          ]
        }
      },
      {
        $group: {
          _id: "$marketId",
          amount: { $sum: "$amount" },
          userId: { $first: "$userId" },
          date: { $first: "$date" },
          name: { $first: "$event" }
        }
      }
    ]);
  } else {
    response = await CashDeposit.aggregate([
      {
        $match: {
          userId: Id,
          sportsId: req.query.sportsId,
          cashOrCredit: { $in: ["Bet", "Casino Bet"] },
          $and: [
            {
              createdAt: { $gte: req.query.startDate }
            },
            {
              createdAt: { $lte: req.query.endDate }
            }
          ]
        }
      },
      {
        $addFields: {
          'betIdEvent': { $toObjectId: "$betId" }
        }
      },
      {
        $lookup: {
          from: 'bets',
          localField: 'betIdEvent',
          foreignField: '_id',
          as: 'bets'
        }
      },
      {
        $group: {
          _id: { $arrayElemAt: ["$bets.matchId", 0] },
          amount: { $sum: "$amount" },
          userId: { $first: "$userId" },
          date: { $first: "$date" },
          name: { $first: { $arrayElemAt: ["$bets.event", 0] } }
        }
      }
    ]);
  }
  return res.send({
    success: true,
    message: 'Sport wise Reports !',
    results: response,
  });
}

const dailyPLMatchWiseDetailedReport = async (req, res) => {
  try {
    if (!req.query.userId || !req.query.matchId) {
      return res.send({
        success: false,
        message: "Request Invalid !",
      });
    }
    const userId = parseInt(req.query.userId);
    const matchId = req.query.matchId;
    const betIdArray = await getBetIds(userId);
    const currentUser = await User.findOne({ userId: userId });
    if (!currentUser) {
      return res.send({ success: false, message: "user not found " });
    }
    
    const { userId: currentUserId, createdBy: parentUserId } = currentUser;
    const childUserFilter = { createdBy: currentUserId };

    const [childUserDealer, childUserTrader] = await Promise.all([
      User.distinct("userId", { ...childUserFilter, role: { $ne: "5" } }),
      User.distinct("userId", { ...childUserFilter, role: { $eq: "5" } })
    ]);

    const fetchMarketPosition = async (userIds, isDealer = false) => {
      try {
        return await CashDeposit.aggregate([
          {
            $match: {
              userId: { $in: userIds },
              betId: { $in: betIdArray },
              cashOrCredit: { $in: ["Bet", "Casino Bet"] },
              matchId,
            }
          },
          {
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "userId",
              as: "userInfo"
            }
          },
          { $unwind: "$userInfo" },
          {
            $group: {
              _id: "$userId",
              role: { $first: "$userInfo.role" },
              name: { $first: "$userInfo.userName" },
              amount: { $sum: isDealer ? "$upLineAmount" : "$amount" },
              upLineAmount: { $sum: "$upLineAmount" }
            }
          },
          { $sort: { "role": -1 } }
        ]);
      } catch (error) {
        console.error("Error in fetchMarketPosition aggregation:", error);
        return [];
      }
    };

    const childUserTraderRecord = await CashDeposit.aggregate([
      {
        $match: {
          userId: { $in: childUserTrader },
          cashOrCredit: { $in: ["Bet", "Casino Bet"] },
          matchId,
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "userId",
          as: "userInfo"
        }
      },
      { $unwind: "$userInfo" },
      {
        $group: {
          _id: "$userId",
          role: { $first: "$userInfo.role" },
          name: { $first: "$userInfo.userName" },
          amount: { $sum: "$amount" },
          matchId: { $first: "$matchId" },
          marketId: { $first: "$marketId" },
          betSession: { $first: "$betSession" },
          roundId: { $first: "$roundId" },
          sportsId: { $first: "$sportsId" },
          depositId: { $first: "$_id" }
        }
      },
      { $sort: { "role": -1 } }
    ]);

    const [currentUserResponse, parentUserRecord, childUserDealerRecord] = await Promise.all([
      fetchMarketPosition([currentUserId]),
      parentUserId ? fetchMarketPosition([parentUserId]) : [],
      childUserDealer.length > 0 ? fetchMarketPosition(childUserDealer, true) : [],
    ]);

    if (parentUserRecord.length > 0) {
      parentUserRecord[0].amount = -(currentUserResponse[0]?.upLineAmount || 0)
    }

    const response = [...childUserDealerRecord, ...childUserTraderRecord, ...currentUserResponse, ...parentUserRecord];

    return res.status(200).json({
      success: true,
      message: "Market Positions Reports!",
      results: response,
    });
  } catch (error) {
    return res.send({
      success: false,
      message: "Something went wrong !",
    });
  }
};

loginRouter.get('/getDailyPLReport', getDailyPLReport);
loginRouter.get('/dailyPlSportWiseReports', dailyPlSportWiseReports);
loginRouter.get('/dailyPLMatchWiseReport', dailyPLMatchWiseReport);
loginRouter.get('/dailyPLMatchWiseDetailedReport', dailyPLMatchWiseDetailedReport);

module.exports = { loginRouter };