const express = require('express');
const { validationResult } = require('express-validator');
const CashDeposit = require('../models/deposits');
const User = require('../models/user');
const Events = require('../models/events');
const loginRouter = express.Router();

async function getBetIds(userId, startDate, endDate) {
  try {
    const matchQuery = {
      userId,
      cashOrCredit: { $in: ["Bet", "Casino Bet"] },
    };

    if (startDate && endDate) {
      matchQuery.createdAt = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    const betIds = await CashDeposit.aggregate([
      {
        $match: matchQuery,
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

const getDailyReport = async (req, res) => {

  const userId = parseInt(req.decoded.userId);
  const { userId: currentUserId, createdBy: parentUserId } = await User.findOne({ userId });

  let users = [];
  let parents = [currentUserId];
  let childUsers = [];

  do {
    childUsers = await User.distinct("userId", {
      createdBy: { $in: parents }
    });
    if (childUsers.length) users.push(...childUsers);
    parents = childUsers;
  } while (childUsers.length > 0);

  const betIdArray = await getBetIds(currentUserId, req.query.startDate, req.query.endDate);

  const userActivity = async (userIds) => {
    return await CashDeposit.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          betId: { $in: betIdArray },
          cashOrCredit: { $in: ["Bet", "Casino Bet"] },
          createdAt: { $gte: req.query.startDate, $lte: req.query.endDate },
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
          upLineAmount: { $sum: "$upLineAmount" },
          name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } }
        }
      }
    ]);
  }

  const [childUserActivity, currentUserActivity, parentCommissions] = await Promise.all([
    userActivity(users),
    userActivity([currentUserId]),
    userActivity([parentUserId]),
  ])

  if (parentCommissions.length > 0) {
    parentCommissions[0].amount = -(currentUserActivity[0]?.upLineAmount || 0)
  }

  const totalDailyReport = [...childUserActivity, ...currentUserActivity, ...parentCommissions]

  return res.send({
    success: true,
    message: 'Daily reports',
    results: totalDailyReport,
  });
}

const dailySportsWiseReport = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    const userId = req.decoded.userId;

    const currentUser = await User.findOne({ userId });
    const queryUserId = parseInt(req.query.userId);

    if (!currentUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const { createdBy: parentUserId } = currentUser;

    if (!queryUserId) {
      return res.status(400).send({
        success: false,
        message: "Request Invalid!",
      });
    }

    const dateRange = {
      createdAt: {
        $gte: req.query.startDate,
        $lte: req.query.endDate,
      },
    };

    const amountField = queryUserId === parentUserId ? "$shareNUpline" : "$amount";
    console.log(amountField)
    const betIdArray = await getBetIds(userId, req.query.startDate, req.query.endDate);
    console.log(betIdArray)
    const cashPipeline = [
      {
        $match: {
          userId: queryUserId,
          cashOrCredit: { $in: ["Bet", "Casino Bet"] },
          ...dateRange,
          betId: { $in: betIdArray }
        },
      },
      {
        $lookup: {
          from: 'markettypes',
          localField: 'sportsId',
          foreignField: 'Id',
          as: 'marketInfo',
        },
      },
      {
        $group: {
          _id: "$sportsId",
          amount: { $sum: amountField },
          userId: { $first: "$userId" },
          name: { $first: { $arrayElemAt: ["$marketInfo.name", 0] } },
        },
      },
    ];

    const response = await CashDeposit.aggregate(cashPipeline);
    return res.send({
      success: true,
      message: 'Market-wise Reports!',
      results: response,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).send({
      success: false,
      message: "Something went wrong",
    });
  }
}

const dailyMatchWiseReports = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  const queryUserId = parseInt(req.query.userId);
  const userId = req.decoded.userId;

  const currentUser = await User.findOne({ userId });
  if (!currentUser) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const { createdBy: parentUserId } = currentUser;
  const amountField = queryUserId === parentUserId ? "$shareNUpline" : "$amount";

  const dateRangeMatch = {
    createdAt: { $gte: req.query.startDate, $lte: req.query.endDate },
  };

  try {
    const betIdArray = await getBetIds(userId, req.query.startDate, req.query.endDate);

    const isCasinoSport = req.query.sportsId == 6;
    const baseMatch = {
      userId: queryUserId,
      sportsId: req.query.sportsId,
      cashOrCredit: { $in: ["Bet", "Casino Bet"] },
      betId: { $in: betIdArray },
      ...dateRangeMatch,
    };

    const pipeline = [
      { $match: baseMatch },
      ...(isCasinoSport ? [] : [
        { $addFields: { betIdEvent: { $toObjectId: "$betId" } } },
        {
          $lookup: {
            from: 'bets',
            localField: 'betIdEvent',
            foreignField: '_id',
            as: 'bets',
          },
        },
      ]),
      {
        $group: {
          _id: { $arrayElemAt: ["$bets.matchId", 0] },
          amount: { $sum: amountField },
          userId: { $first: "$userId" },
          date: { $first: "$date" },
          name: { $first: isCasinoSport ? "$event" : { $arrayElemAt: ["$bets.event", 0] } },
        },
      },
    ];

    const response = await CashDeposit.aggregate(pipeline);
    return res.send({
      success: true,
      message: 'Sport wise Reports!',
      results: response,
    });
  } catch (error) {
    console.error("Error in fetching match-wise reports:", error);
    return res.status(500).send({
      success: false,
      message: "Something went wrong",
    });
  }
}

const dailyMatchWiseDetailedReports = async (req, res) => {
  try {
    if (!req.query.userId || !req.query.matchId) {
      return res.send({
        success: false,
        message: "Request Invalid !",
      });
    }
    const userIdLogin = parseInt(req.decoded.userId);
    const userId = parseInt(req.query.userId);
    const matchId = req.query.matchId;
    const betIdArray = await getBetIds(userIdLogin);
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

    const traderDetailRecords = async (traderIds) => {
      return await CashDeposit.aggregate([
        {
          $match: {
            userId: { $in: traderIds },
            cashOrCredit: { $in: ["Bet", "Casino Bet"] },
            betId: { $in: betIdArray },
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
          $addFields: {
            'betsId': { $toObjectId: "$betId" }
          }
        },
        {
          $lookup: {
            from: 'bets',
            localField: 'betsId',
            foreignField: '_id',
            as: 'betsDetails'
          }
        },
        {
          $group: {
            _id: "$userId",
            role: { $first: "$userInfo.role" },
            name: { $first: "$userInfo.userName" },
            pl: { $sum: "$amount" },
            sattledAt: { $first: "$date" },
            matchId: { $first: "$matchId" },
            marketId: { $first: "$marketId" },
            betSession: { $first: "$betSession" },
            roundId: { $first: "$roundId" },
            sportsId: { $first: "$sportsId" },
            depositId: { $first: "$_id" },
            price: { $first: { $arrayElemAt: ["$betsDetails.betAmount", 0] } },
            name: { $first: { $arrayElemAt: ["$betsDetails.runnerName", 0] } },
            createdAt: { $first: { $arrayElemAt: ["$betsDetails.createdAt", 0] } },
            size: { $first: { $arrayElemAt: ["$betsDetails.betRate", 0] } },
            type: { $first: { $arrayElemAt: ["$betsDetails.type", 0] } },
            fancyData: { $first: { $arrayElemAt: ["$betsDetails.fancyData", 0] } },
            isfancyOrbookmaker: { $first: { $arrayElemAt: ["$betsDetails.isfancyOrbookmaker", 0] } }
          }
        }
      ]);
    }

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

    if (currentUser.role === "5") {
      const response = traderDetailRecords([currentUserId])
      return res.status(200).json({
        success: true,
        message: "Market Positions Reports!",
        results: response,
      })
    } else {
      const childUserTraderRecord = await traderDetailRecords(childUserTrader)
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
    }
  } catch (error) {
    return res.send({
      success: false,
      message: "Something went wrong !",
    });
  }
};

const tesTingsheet = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  const userId = req.decoded.userId;
  const resp = [];
  const users = await User.distinct("userId", { createdBy: userId });
  const currentUser = await User.findOne({ userId: userId })
  if (currentUser.role == 0) {
    resp.push(
      {
        _id: currentUser.userId,
        name: "cash",
        amount: currentUser.cash
      },
      {
        _id: currentUser.userId,
        name: currentUser.userName,
        amount: currentUser.balance
      }
    )
  }
  else {
    const parentUser = await User.findOne({ userId: currentUser.createdBy });
    //console.log(" ================== parentUser ================  ", parentUser);
    resp.push(
      {
        _id: currentUser.userId,
        name: "cash",
        amount: currentUser.cash
      },
      {
        _id: currentUser.userId,
        name: currentUser.userName,
        amount: currentUser.balance
      },
      {
        _id: parentUser.userId,
        name: parentUser.userName,
        amount: currentUser.clientPL * (-1)
      }
    )
  }

  //console.log(" ================== currentUser ================  ", currentUser);

  const response = await User.aggregate([
    {
      $match: {
        userId: {
          $in: users
        }
      }
    },
    {
      $group: {
        _id: "$userId",
        name: { $first: "$userName" },
        amount: { $sum: "$clientPL" }
      }
    }
  ]);

  return res.send({
    success: true,
    message: 'Final Sheet Reports',
    results: resp.concat(response)
  });

}

loginRouter.get('/getDailyReport', getDailyReport);
loginRouter.get('/dailySportsWiseReport', dailySportsWiseReport);
loginRouter.get('/dailyMatchWiseReports', dailyMatchWiseReports);
loginRouter.get('/dailyMatchWiseDetailedReports', dailyMatchWiseDetailedReports);
loginRouter.get('/tesTingsheet', tesTingsheet);
module.exports = { loginRouter };
