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

  const userId = parseInt(req.decoded.userId);

  const users = new Set([userId]); // Ensure current user is included
  let firstChildUserId = null;

  // Fetch users created by the current user with roles other than 5
  const childUsers = await User.find({
    createdBy: userId,
    role: { $ne: "5" }
  });

  // Fetch users with role 5 created by the current user
  const role5ChildUsers = await User.find({
    createdBy: userId,
    role: "5"
  });

  if (childUsers.length > 0) {
    firstChildUserId = childUsers[0].userId;
    users.add(firstChildUserId);
  }

  role5ChildUsers.forEach(child => {
    users.add(child.userId);
  });

  let subChildUsers = [];
  if (firstChildUserId) {
    subChildUsers = await User.find({
      createdBy: firstChildUserId,
      role: { $ne: 5 }
    });
  }

  subChildUsers.forEach(user => {
    users.add(user.userId);
  });

  const userIdsArray = Array.from(users);

  // Fetch deposit data for current user and all relevant users
  const response = await CashDeposit.aggregate([
    {
      $match: {
        userId: { $in: userIdsArray },
        cashOrCredit: { $in: ["Bet", "Commission", "loosing", "Settlement"] },
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
      $unwind: "$userInfo"
    },
    {
      $group: {
        _id: "$userId",
        amount: { $sum: "$amount" },
        name: { $first: "$userInfo.userName" }
      }
    }
  ]);

  const subChildResponse = await CashDeposit.aggregate([
    {
      $match: {
        userId: { $in: subChildUsers.map(user => user.userId) },
        cashOrCredit: { $in: ["Bet", "Commission", "loosing", "Settlement"] },
        createdAt: { $gte: req.query.startDate, $lte: req.query.endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" }
      }
    }
  ]);

  // Adjust amount for the first child user if they exist
  const firstChildEntry = response.find(entry => entry._id === firstChildUserId);
  if (firstChildEntry) {
    firstChildEntry.amount += subChildResponse.length > 0 ? subChildResponse[0].totalAmount : 0;
  } else {
    const totalAmount = subChildResponse.length > 0 ? subChildResponse[0].totalAmount : 0;
    const firstChildUserInfo = await User.findOne({ userId: firstChildUserId });
    response.push({
      _id: firstChildUserId,
      amount: totalAmount,
      name: firstChildUserInfo?.userName
    });
  }

  // Handle role 5 users
  const role5Response = await CashDeposit.aggregate([
    {
      $match: {
        userId: { $in: role5ChildUsers.map(user => user.userId) },
        cashOrCredit: { $in: ["Bet", "Commission", "loosing", "Settlement"] },
        createdAt: { $gte: req.query.startDate, $lte: req.query.endDate }
      }
    },
    {
      $group: {
        _id: "$userId",
        totalAmount: { $sum: "$amount" }
      }
    }
  ]);

  role5Response.forEach(userDeposit => {
    const userInfo = role5ChildUsers.find(user => user.userId === userDeposit._id);
    if (userInfo) {
      response.push({
        _id: userInfo.userId,
        amount: userDeposit.totalAmount,
        name: userInfo.userName,
        role: userInfo.role
      });
    }
  });

  // Add current user to response if not already included
  if (!response.find(entry => entry._id === userId)) {
    const currentUserDeposits = await CashDeposit.aggregate([
      {
        $match: {
          userId: userId,
          cashOrCredit: { $in: ["Bet", "Commission", "loosing", "Settlement"] },
          createdAt: { $gte: req.query.startDate, $lte: req.query.endDate }
        }
      },
      {
        $group: {
          _id: "$userId",
          amount: { $sum: "$amount" }
        }
      }
    ]);

    const currentUserInfo = await User.findOne({ userId });

    response.push({
      _id: userId,
      amount: currentUserDeposits.length > 0 ? currentUserDeposits[0].amount : 0,
      name: currentUserInfo?.userName
    });
  }

  return res.send({
    success: true,
    message: 'Commission reports',
    results: response,
    total: response.length
  });
};


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
        cashOrCredit: { $in: ["Bet", "Commission", "loosing", ""] },
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
          cashOrCredit: { $in: ["Bet", "Commission", "loosing", ""] },
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
          cashOrCredit: { $in: ["Bet", "Commission", "loosing", ""] },
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
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const userId = Number(req.query.userId);

  const matchId = req.query.matchId;
  const currentUser = await User.findOne({ userId: userId });

  if (currentUser.role == 5) {
    //console.log(" =========================== -5- =========================== ");
    let match = null;
    matchId.length > 10 ? match = await Events.findOne(matchId) : '';
    const parent = await User.findOne({ userId: currentUser.createdBy });
    let response;
    if (match) {
      //console.log(" =============================== Includes Part  =========================== ");
      response = await CashDeposit.aggregate([
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
            _id: "$_id",
            pl: { $sum: "$amount" },
            sattledAt: { $first: "$date" },
            sportsId: { $first: { $arrayElemAt: ["$betsDetails.sportsId", 0] } },
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
    else {
      //console.log(" ================= matchId ================= ", matchId);
      response = await CashDeposit.aggregate([
        {
          $match: {
            marketId: matchId,
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
              }
            ]
          }
        },
        {
          $addFields: {
            type: 0,
            size: 1
          }
        },
        {
          $group: {
            _id: "$betId",
            pl: { $sum: "$amount" },
            sattledAt: { $first: "$date" },
            sportsId: { $first: "$sportsId" },
            event: { $first: "$event" },
            price: { $first: "$casinoBetAmount" },
            type: { $first: "$type" }, // Use an accumulator here
            size: { $first: "$size" },
            createdAt: { $first: "$betTime" }
          }
        }
      ]);
      //console.log(" ================= response ================= ", response);
    }
    return res.send({
      success: true,
      message: 'Detailed reports',
      results: response,
      isDetailed: true,
      dealer: parent.userName,
      currentUser: currentUser.userName,
      Winner: match?.winner
    });
  }
  else {
    //console.log(" =============================== 5 =========================== ");
    const childUsers = await User.distinct("userId", { createdBy: userId });
    const users = [userId, ...childUsers];
    //console.log(" users ===================  ", users);

    const response = await CashDeposit.aggregate([
      {
        $match: {
          userId: {
            $in: users
          },
          matchId: matchId,
          cashOrCredit: { $in: ["Bet", "Commission", "loosing", ""] }
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

    return res.send({
      success: true,
      message: 'Commission reports',
      results: response,
    });
  }
}

loginRouter.get('/getDailyPLReport', getDailyPLReport);
loginRouter.get('/dailyPlSportWiseReports', dailyPlSportWiseReports);
loginRouter.get('/dailyPLMatchWiseReport', dailyPLMatchWiseReport);
loginRouter.get('/dailyPLMatchWiseDetailedReport', dailyPLMatchWiseDetailedReport);

module.exports = { loginRouter };