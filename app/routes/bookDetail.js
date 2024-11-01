const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const CashDeposit = require('../models/deposits');
const User = require('../models/user');
const reportValidator = require('../validators/reports');
const Deposits = require('../models/deposits');
const MarketType = require('../models/marketTypes');
const Bets = require('../models/bets');
const loginRouter = express.Router();
const Events = require('../models/events');

const bookDetailReport = async (req, res) => {
  try {
    const userId = parseInt(req.decoded.userId);
    const currentUser = await User.findOne({ userId });

    if (!currentUser) {
      console.warn(`User not found for userId: ${userId}`);
      return res.status(404).json({ success: false, message: "Current user not found." });
    }

    const { userId: currentUserId, createdBy: parentUserId } = currentUser;

    const dateRange = {
      createdAt: {
        $gte: req.query.startDate,
        $lte: req.query.endDate
      }
    };

    const childUserIds = await User.distinct("userId", { createdBy: currentUserId });

    const fetchRecords = async (userIds, isCurrentUser = false) => {
      const matchAggregation = {
        userId: { $in: userIds },
        cashOrCredit: { $in: ["Bet", "Commission", "loosing", "Casino Bet"] },
        ...dateRange
      };

      const aggregation = [
        { $match: matchAggregation },
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
            amount: { $sum: isCurrentUser ? "$amount" : "$upLineAmount" },
            upLineAmount: { $sum: "$upLineAmount" },
            name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } },
          }
        }
      ];

      return await CashDeposit.aggregate(aggregation);
    };

    const [childsRecords, currentUserRecord, parentUserRecord] = await Promise.all([
      fetchRecords(childUserIds),
      fetchRecords([currentUserId], true),
      parentUserId ? fetchRecords([parentUserId]) : []
    ]);

    if (parentUserRecord.length > 0 && currentUserRecord.length > 0) {
      parentUserRecord[0].amount = -(currentUserRecord[0].upLineAmount || 0);
    }

    const totalResponse = [...childsRecords, ...currentUserRecord, ...parentUserRecord];
    return res.send({
      success: true,
      message: 'Book Details Record fetched Successfully!',
      results: totalResponse
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
    if (!req.query.userId) {
      return res.send({
        success: false,
        message: "Request Invalid !",
      });
    }
    const Id = parseInt(req.query.userId)
    //console.log(" Id ========== ", Id);
    const response = await CashDeposit.aggregate([
      {
        $match: {
          userId: Id,
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
          amount: { $sum: "$upLineAmount" },
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
  } catch (error) {
    return res.send({
      success: false,
      message: "Something went wrong",
    });
  }
}

const bookDetailMatchWiseReports = async (req, res) => {
  try {
    const Id = parseInt(req.query.userId)
    let response = [];
    if (req.query.sportsId == 6) {
      response = await CashDeposit.aggregate([
        {
          $match: {
            userId: Id,
            sportsId: req.query.sportsId,
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
          $group: {
            _id: { $arrayElemAt: ["$bets.matchId", 0] },
            amount: { $sum: "$upLineAmount" },
            userId: { $first: "$userId" },
            date: { $first: "$date" },
            name: { $first: "$event" },
          }
        }
      ]);
    } else {
      response = await CashDeposit.aggregate([
        {
          $match: {
            userId: Id,
            sportsId: req.query.sportsId,
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
            amount: { $sum: "$upLineAmount" },
            userId: { $first: "$userId" },
            date: { $first: "$date" },
            name: { $first: { $arrayElemAt: ["$bets.event", 0] } },
          }
        }
      ]);
    }


    return res.send({
      success: true,
      message: 'Sport wise Reports !',
      results: response,
    });
  } catch (error) {
    return res.send({
      success: false,
      message: "Something went wrong",
    });
  }
}

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
      const directChild = await User.distinct("userId", { createdBy: userId });
      const grandchiltren = await User.distinct("userId", { createdBy: { $in: directChild }, role: '5' });
      const users = [userId, ...directChild, ...grandchiltren];

      //console.log(" users list  ======== ", users);

      const response = await CashDeposit.aggregate([
        {
          $match: {
            userId: { $in: users },
            matchId: matchId,
            cashOrCredit: { $in: ["Bet", "Commission", "loosing", "Casino Bet"] },
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
            name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } }
          }
        }
      ]);

      const parentResponse = await CashDeposit.aggregate([
        {
          $match: {
            userId: currentUser.createdBy,
            commissionFrom: currentUser.userId,
            cashOrCredit: { $in: ["Bet", "Commission", "loosing", "Casino Bet"] },
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
            // parent: true,
            amount: { $sum: "$upLineAmount" },
            name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } }
          }
        }
      ]);

      return res.send({
        success: true,
        message: 'Daily reports',
        results: response?.concat(parentResponse),
        isDetailed: false
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