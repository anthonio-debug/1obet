const express = require('express');
const CashDeposit = require('../models/deposits');
const User = require('../models/user');
const loginRouter = express.Router();
const Events = require('../models/events');
const Deposits = require('../models/deposits');

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

const bookDetailReport = async (req, res) => {
  try {
    const userId = req.decoded.userId
    const currentUser = await User.findOne({ userId });
    if (!currentUser) {
      console.warn(`User not found for userId: ${userId}`);
      return res.status(404).json({ success: false, message: "Current user not found." });
    }

    const { userId: currentUserId, createdBy: parentUserId } = currentUser;
    const childUserFilter = { createdBy: currentUserId };

    const [childUserDealer, childUserTrader] = await Promise.all([
      User.distinct("userId", { ...childUserFilter, role: { $ne: "5" } }),
      User.distinct("userId", { ...childUserFilter, role: { $eq: "5" } })
    ]);
    const betIdArray = await getBetIds(userId);
    console.log(betIdArray)
    const fetchMarketPosition = async (userIds, isDealer = false) => {
      try {
        return await Deposits.aggregate([
          {
            $match: {
              betId: { $in: betIdArray },
              userId: { $in: userIds },
              cashOrCredit: { $in: ["Bet", "Casino Bet"] },
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
              upLineAmount: { $sum: "$upLineAmount" },
              shareNUpline: { $sum: "$shareNUpline" },
            }
          },
          { $sort: { "role": -1 } }
        ]);
      } catch (error) {
        console.error("Error in fetchMarketPosition aggregation:", error);
        return [];
      }
    };

    const childUserTraderRecord = await Deposits.aggregate([
      {
        $match: {
          userId: { $in: childUserTrader },
          cashOrCredit: { $in: ["Bet", "Casino Bet"] },
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
      parentUserRecord[0].amount = (parentUserRecord[0]?.shareNUpline || 0)
    }

    const response = [...childUserDealerRecord, ...childUserTraderRecord, ...currentUserResponse, ...parentUserRecord];

    return res.status(200).json({
      success: true,
      message: "Market Positions Reports!",
      results: response,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const bookDetailSportsWiseReport = async (req, res) => {
  try {

    const queryUserId = parseInt(req.query.userId);

    if (!queryUserId) {
      return res.status(400).send({
        success: false,
        message: "Request Invalid! userId is missing or invalid.",
      });
    }

    const userId = parseInt(req.decoded.userId);

    const { userId: currentUserId, createdBy: parentUserId } = await User.findOne({ userId });
    const queryUser = await User.findOne({ userId: queryUserId });

    if (!currentUserId) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!queryUser) {
      return res.status(404).json({ success: false, message: "Query user not found" });
    }

    const betIdArray = await getBetIds(userId, req.query.startDate, req.query.endDate);

    const dateRange = { createdAt: { $gte: req.query.startDate, $lte: req.query.endDate } };

    const matchRespose = {
      userId: queryUserId,
      cashOrCredit: { $in: ["Bet", "Casino Bet"] },
      betId: { $in: betIdArray },
      ...dateRange,
    };

    let amountField = queryUserId === userId ? "$amount" : queryUserId === parentUserId ? "$shareNUpline" : "$upLineAmount";

    if (queryUser.role === "5") {
      amountField = "$amount";
    }

    const cashPipeline = [
      { $match: matchRespose },
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
    console.error('Error occurred:', error);

    return res.status(500).send({
      success: false,
      message: "Something went wrong",
    });
  }
};

const bookDetailMatchWiseReports = async (req, res) => {
  const queryUserId = parseInt(req.query.userId);
  const queryUser = await User.findOne({ userId: queryUserId });
  const userId = req.decoded.userId;
  const { userId: currentUserId, createdBy: parentUserId } = await User.findOne({ userId });
  if (!currentUserId) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  let amountField = queryUserId === userId ? "$amount" : queryUserId === parentUserId ? "$shareNUpline" : "$upLineAmount";

  if (queryUser.role === "5") {
    amountField = "$amount";
  }

  const betIdArray = await getBetIds(userId, req.query.startDate, req.query.endDate);

  const dateRangeMatch = {
    createdAt: { $gte: req.query.startDate, $lte: req.query.endDate },
  };

  try {
    const isCasinoSport = req.query.sportsId == 6;
    const baseMatch = {
      userId: queryUserId,
      sportsId: req.query.sportsId,
      betId: { $in: betIdArray },
      cashOrCredit: { $in: ["Bet", "Casino Bet"] },
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
};

const bookDetailMatchWiseDetailedReports = async (req, res) => {
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
      const response = await traderDetailRecords([currentUserId])
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
}

loginRouter.get('/bookDetailReport', bookDetailReport);
loginRouter.get('/bookDetailSportsWiseReport', bookDetailSportsWiseReport);
loginRouter.get('/bookDetailMatchWiseReports', bookDetailMatchWiseReports);
loginRouter.get('/bookDetailMatchWiseDetailedReports', bookDetailMatchWiseDetailedReports);

module.exports = { loginRouter };
