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
  const currentUser = await User.findOne({ userId: userId });
  const users = new Set([userId]);  // Use a Set to avoid duplicates
  let parents = [userId];
  let childUsers = [];
  let sportsIdQuery = { $ne: null };

  do {
    // Fetch child users with distinct userId and filter by createdBy and role
    childUsers = await User.distinct("userId", {
      $or: [
        { createdBy: { $in: parents }, role: { $ne: 5 } },
        { role: 5, createdBy: userId }
      ]
    });

    // Remove child users that are already in the users Set to avoid duplicates
    const newChildUsers = childUsers.filter(user => !users.has(user));

    // If there are new child users, add them to the users Set and parents array
    if (newChildUsers.length) {
      newChildUsers.forEach(user => users.add(user));
      parents = newChildUsers;  // Update parents with new child users
    } else {
      // Exit the loop if there are no new users to process
      break;
    }

  } while (childUsers.length > 0);

  const response = await CashDeposit.aggregate([
    {
      $match: {
        userId: { $in: Array.from(users) },  // Convert Set to Array
        sportsId: sportsIdQuery,
        cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
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
      $match: {
        $or: [
          { "userInfo.role": { $ne: 5 } },
          { "userInfo.createdBy": userId }
        ]
      }
    },
    {
      $group: {
        _id: "$userId",  // Group by userId
        totalAmount: { $sum: "$amount" },  // Sum amounts for each user
        name: { $first: "$userInfo.userName" },
        role: { $first: "$userInfo.role" }  // Get the role of the user
      }
    },
    {
      $group: {
        _id: null,  // Combine all entries
        results: {
          $push: {
            userId: "$_id",
            name: "$name",
            totalAmount: {
              $cond: {
                if: { $eq: "$role", 1 },  // If super admin
                then: "$totalAmount",      // Show their actual amount
                else: "$totalAmount"       // For others (including admins), add amounts of their children in the final result
              }
            }
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        results: {
          $reduce: {
            input: "$results",
            initialValue: [],
            in: {
              $concatArrays: [
                "$$value",
                {
                  $cond: [
                    { $eq: { $arrayElemAt: ["$$this.role", 0] }, 2 },  // Check if role is admin
                    [{ userId: "$$this.userId", name: "$$this.name", totalAmount: { $sum: [{ $ifNull: ["$$this.totalAmount", 0] }, { $ifNull: ["$$this.totalAmount", 0] }] } }],  // Sum up for admins
                    [{ userId: "$$this.userId", name: "$$this.name", totalAmount: "$$this.totalAmount" }] // For super admin, keep actual amount
                  ]
                }
              ]
            }
          }
        }
      }
    },
  ]);

  return res.send({
    success: true,
    message: 'Commission reports',
    results: response[0]?.results || [],
    total: response[0]?.results?.length || 0
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
        cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
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
          cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
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
          cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
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
          cashOrCredit: { $in: ["Bet", "Commission", "loosing"] }
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
