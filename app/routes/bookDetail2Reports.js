const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');


const reportValidator = require('../validators/reports');
const Deposits = require('../models/deposits');
const loginRouter = express.Router();

const bookDetail2Report = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const userId = parseInt(req.decoded.userId)
  const Id = parseInt(req.query.userId)

  const response = await Deposits.aggregate([
    {
      $match: {
        userId: userId,
        cashOrCredit: { $in: ["Bet", "Commission", "loosing", "Casino Bet"] },
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
        name: { $first: { $arrayElemAt: ["$marketInfo.name", 0] } }
      }
    }
  ]);

  return res.send({
    success: true,
    message: 'Market wise Commission records !',
    results: response,
  });
}

const bookDetail2ReportUser = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  try {
    const { sportsId } = req.query;

    const deposit = await Deposits.findOne({ matchId });
    if (!deposit) {
      console.warn(`No deposit found for betId: ${betId}`);
      return res.status(404).json({ success: false, message: "No deposit found for BetId." });
    }

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
              sportsId: sportsId,
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
          sportsId: sportsId,
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
}

const bookDetail2MatchWiseReports = async (req, res) => {
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

loginRouter.get('/bookDetail2Report', reportValidator.validate('bookDetail2Report'), bookDetail2Report);
loginRouter.get('/book-detail-2-users', bookDetail2ReportUser);
loginRouter.get('/book-detail-2-matchwise', bookDetail2MatchWiseReports);

module.exports = { loginRouter };
