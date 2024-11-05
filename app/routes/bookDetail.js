const express = require('express');
const CashDeposit = require('../models/deposits');
const User = require('../models/user');
const loginRouter = express.Router();
const Events = require('../models/events');
const Deposits = require('../models/deposits');

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

    const fetchMarketPosition = async (userIds, isDealer = false) => {
      try {
        return await Deposits.aggregate([
          {
            $match: {
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
      parentUserRecord[0].amount = -(currentUserResponse[0]?.upLineAmount || 0)
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

    const cashPipeline = [
      {
        $match: {
          userId: queryUserId,
          cashOrCredit: { $in: ["Bet", "Commission", "loosing", "Casino Bet"] },
          ...dateRange,
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
};

const bookDetailMatchWiseReports = async (req, res) => {
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
    const isCasinoSport = req.query.sportsId == 6;
    const baseMatch = {
      userId: queryUserId,
      sportsId: req.query.sportsId,
      cashOrCredit: { $in: ["Bet", "Commission", "loosing", "Casino Bet"] },
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
    const userId = parseInt(req.query.userId);

    const matchId = req.query.matchId;
    const currentUser = await User.findOne({ userId: userId });
    if (!currentUser) {
      return res.send({ success: false, message: "user not found " });
    }
    const parent = await User.findOne({ userId: currentUser.createdBy });
    if (!parent && currentUser.role != 0) {
      return res.send({ success: false, message: "parent missing !" });
    }
    if (currentUser.role == '5') {
      const match = await Events.findById(matchId)
      const response = await CashDeposit.aggregate([
        {
          $match: {
            matchId: matchId,
            $or: [
              {
                $and: [{
                  userId: userId,
                },
                {
                  cashOrCredit: { $in: ["Bet"] }
                }
                ]
              },
              {
                cashOrCredit: { $in: ["Commission"] }
              },
              {
                cashOrCredit: { $in: ["Casino Bet"] }
              }
            ]
          }
        },
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
            _id: "$betId",
            pl: { $sum: "$amount" },
            sattledAt: { $first: "$date" },
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
      return res.send({
        success: true,
        message: 'Detailed reports',
        results: response,
        isDetailed: true,
        dealer: parent.userName,
        currentUser: currentUser.userName,
        Winner: match?.winner
      });

    } else {
      const userId = parseInt(req.decoded.userId);

      const currentUser = await User.findOne({ userId });

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
    }
  } catch (error) {
    //console.log("Error ============", error);
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
