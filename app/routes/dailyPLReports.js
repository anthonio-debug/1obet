const express = require('express');
const { validationResult } = require('express-validator');
const CashDeposit = require('../models/deposits');
const User = require('../models/user');

const Events = require('../models/events');
const loginRouter = express.Router();

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
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.array() });
  }

  const userId = Number(req.query.userId);
  const matchId = String(req.query.matchId);
  const sportsId = String(req.query.sportsId || "");
  const roundId = req.query.roundId || "";

  try {
    const currentUser = await User.findOne({ userId });
    if (!currentUser) {
      console.warn(`User not found for userId: ${userId}`);
      return res.status(404).json({ success: false, message: "Current user not found." });
    }

    const { userId: currentUserId, createdBy: parentUserId, role: currentUserRole } = currentUser;
    const childUserFilter = { createdBy: currentUserId };

    const [childUserDealer, childUserTrader] = await Promise.all([
      User.distinct("userId", { ...childUserFilter, role: { $ne: "5" } }),
      User.distinct("userId", { ...childUserFilter, role: "5" })
    ]);

    if (currentUserRole === '5') {
      let match = matchId.length > 10 ? await Events.findOne({ _id: matchId }) : null;
      const parent = await User.findOne({ userId: currentUser.createdBy });

      if (match) {
        // Detailed report for specific match
        const response = await CashDeposit.aggregate([
          {
            $match: {
              matchId,
              $or: [
                { userId, cashOrCredit: { $in: ["Bet"] } },
                { cashOrCredit: { $in: ["Commission"] } }
              ]
            }
          },
          { $addFields: { betsId: { $toObjectId: "$betId" } } },
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
              isFancyOrBookmaker: { $first: { $arrayElemAt: ["$betsDetails.isfancyOrbookmaker", 0] } }
            }
          }
        ]);

        return res.status(200).json({
          success: true,
          message: "Matchwise Detailed Report!",
          results: response,
        });
      } else {
        const matchPipeline = {
          cashOrCredit: { $in: ["Bet", "Casino Bet"] },
          matchId,
          ...(sportsId === "6" && { roundId })
        };

        const fetchMarketPosition = async (userIds, isDealer = false) => {
          return await Deposits.aggregate([
            { $match: { userId: { $in: userIds }, ...matchPipeline } },
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
            { $sort: { role: -1 } }
          ]);
        };

        const [currentUserResponse, parentUserRecord, childUserDealerRecord] = await Promise.all([
          fetchMarketPosition([currentUserId]),
          parentUserId ? fetchMarketPosition([parentUserId]) : [],
          childUserDealer.length > 0 ? fetchMarketPosition(childUserDealer, true) : [],
        ]);

        if (parentUserRecord.length > 0) {
          parentUserRecord[0].amount = -(currentUserResponse[0]?.upLineAmount || 0);
        }

        const response = [...childUserDealerRecord, ...currentUserResponse, ...parentUserRecord];
        return res.status(200).json({
          success: true,
          message: "Market Positions Report!",
          results: response,
        });
      }
    }
  } catch (error) {
    console.error("Error in dailyPLMatchWiseDetailedReport:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

loginRouter.get('/getDailyPLReport', getDailyPLReport);
loginRouter.get('/dailyPlSportWiseReports', dailyPlSportWiseReports);
loginRouter.get('/dailyPLMatchWiseReport', dailyPLMatchWiseReport);
loginRouter.get('/dailyPLMatchWiseDetailedReport', dailyPLMatchWiseDetailedReport);

module.exports = { loginRouter };