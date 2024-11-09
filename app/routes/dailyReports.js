const express = require('express');
const { validationResult } = require('express-validator');
const CashDeposit = require('../models/deposits');
const User = require('../models/user');
const Events = require('../models/events');
const loginRouter = express.Router();

async function getBetIds(userId, startDate, endDate) {
  try {
    const betIds = await CashDeposit.aggregate([
      {
        $match: {
          userId,
          cashOrCredit: { $in: ["Bet", "Casino Bet"] },
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          }
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
    const queryUserId = parseInt(req.query.userId);
    const userId = req.decoded.userId;

    const currentUser = await User.findOne({ userId });
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

    const amountField = queryUserId === userId ? "$amount" : queryUserId === parentUserId ? "$shareNUpline" : "$upLineAmount";
    const betIdArray = await getBetIds(queryUserId, req.query.startDate, req.query.endDate);

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
  const amountField = queryUserId === userId ? "$amount" : queryUserId === parentUserId ? "$shareNUpline" : "$upLineAmount";

  const dateRangeMatch = {
    createdAt: { $gte: req.query.startDate, $lte: req.query.endDate },
  };

  try {
    const betIdArray = await getBetIds(currentUserId, req.query.startDate, req.query.endDate);

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
    const userId = parseInt(req.query.userId);
    const matchId = req.query.matchId;
    const currentUser = await User.findOne({ userId });
    const parentUser = await User.findOne({ userId: currentUser.createdBy });
    const getMatchReportDetails = async (userId, matchId) => {
      const match = matchId.length > 10 ? await Events.findById(matchId) : null;

      const matchFilter = {
        $match: {
          ...(match ? { matchId } : { marketId: matchId }),
          $or: [
            {
              $and: [
                { userId },
                { cashOrCredit: { $in: ["Bet"] } }
              ]
            },
            { cashOrCredit: { $in: ["Casino Bet"] } }
          ]
        }
      };

      const groupMatchDetails = {
        $group: {
          _id: "$_id",
          pl: { $sum: "$amount" },
          settledAt: { $first: "$date" },
          sportsId: { $first: { $arrayElemAt: ["$betsDetails.sportsId", 0] } },
          price: { $first: { $arrayElemAt: ["$betsDetails.betAmount", 0] } },
          name: { $first: { $arrayElemAt: ["$betsDetails.runnerName", 0] } },
          createdAt: { $first: { $arrayElemAt: ["$betsDetails.createdAt", 0] } },
          size: { $first: { $arrayElemAt: ["$betsDetails.betRate", 0] } },
          type: { $first: { $arrayElemAt: ["$betsDetails.type", 0] } },
          fancyData: { $first: { $arrayElemAt: ["$betsDetails.fancyData", 0] } },
          isfancyOrbookmaker: { $first: { $arrayElemAt: ["$betsDetails.isfancyOrbookmaker", 0] } }
        }
      };

      const lookupBetsDetails = {
        $lookup: {
          from: 'bets',
          localField: 'betsId',
          foreignField: '_id',
          as: 'betsDetails'
        }
      };

      const convertBetIdToObjectId = {
        $addFields: { 'betsId': { $toObjectId: "$betId" } }
      };

      let reportData;

      if (match) {
        reportData = await CashDeposit.aggregate([matchFilter, convertBetIdToObjectId, lookupBetsDetails, groupMatchDetails]);
      } else {
        const fallbackGroupDetails = {
          $group: {
            _id: "$betId",
            pl: { $sum: "$amount" },
            settledAt: { $first: "$date" },
            sportsId: { $first: "$sportsId" },
            event: { $first: "$event" },
            price: { $first: "$casinoBetAmount" },
            type: { $first: "$type" },
            size: { $first: "$size" },
            createdAt: { $first: "$betTime" }
          }
        };

        reportData = await CashDeposit.aggregate([matchFilter, { $addFields: { type: 0, size: 1 } }, fallbackGroupDetails]);
      }

      return reportData;
    };

    const getChildUserMarketPositions = async (userIds, matchFilter, isDealer = false) => {
      try {
        return await CashDeposit.aggregate([
          { $match: { userId: { $in: userIds }, ...matchFilter } },
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
        console.error("Error in getChildUserMarketPositions:", error);
        return [];
      }
    };

    if (currentUser.role === '5') {
      const matchReport = await getMatchReportDetails(userId, matchId);
      return res.send({
        success: true,
        message: 'Detailed reports',
        results: matchReport,
        isDetailed: true,
        dealer: parentUser.userName,
        currentUser: currentUser.userName,
        Winner: matchReport?.length > 0 ? matchReport[0]?.winner : null
      });
    } else {
      const { userId: currentUserId, createdBy: parentUserId } = currentUser;
      const childUserFilter = { createdBy: currentUserId };

      const [childUsersDealers, childUsersTraders] = await Promise.all([
        User.distinct("userId", { ...childUserFilter, role: { $ne: "5" } }),
        User.distinct("userId", { ...childUserFilter, role: { $eq: "5" } })
      ]);

      const matchFilter = {
        cashOrCredit: { $in: ["Bet", "Casino Bet"] },
        matchId,
        ...(req.query.sportsId === "6" && { roundId: req.query.roundId })
      };

      const [currentUserMarketPositions, parentUserMarketPosition, childUserDealerPositions] = await Promise.all([
        getChildUserMarketPositions([currentUserId], matchFilter),
        parentUserId ? getChildUserMarketPositions([parentUserId], matchFilter) : [],
        childUsersDealers.length > 0 ? getChildUserMarketPositions(childUsersDealers, matchFilter, true) : []
      ]);

      if (parentUserMarketPosition.length > 0) {
        parentUserMarketPosition[0].amount = -(currentUserMarketPositions[0]?.upLineAmount || 0);
      }

      const response = [...childUserDealerPositions, ...childUsersTraders, ...currentUserMarketPositions, ...parentUserMarketPosition];

      return res.status(200).json({
        success: true,
        message: "Market Positions Reports!",
        results: response,
      });
    }
  } catch (error) {
    console.error("Error fetching market positions:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
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
