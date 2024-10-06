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
  
  const role = currentUser.role;
  const users = new Set([userId]);
  let parents = [userId];
  let childUsers = [];
  let sportsIdQuery = { $ne: null };

  do {
    // Determine which roles to include based on the current user's role
    let roleQuery = {};
    switch (role) {
      case 1: // Super Admin
        roleQuery = { role: { $in: [3, 4] } }; // Admin and Super Master
        break;
      case 3: // Admin
        roleQuery = { role: { $in: [4, 5] } }; // Super Master and Master
        break;
      case 4: // Super Master
        roleQuery = { role: { $in: [5, 6] } }; // Master and Bettor
        break;
      case 5: // Master
        roleQuery = { role: 6 }; // Bettor only
        break;
      case 6: // Bettor
        // No child users for Bettor
        break;
      default:
        break;
    }

    // Fetch child users based on the role query
    if (Object.keys(roleQuery).length > 0) {
      childUsers = await User.distinct("userId", {
        $or: [
          { createdBy: { $in: parents }, ...roleQuery },
          { role: 5, createdBy: userId } // Include Master for the logged-in user
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
    } else {
      break; // No roles to query for, exit the loop
    }

  } while (childUsers.length > 0);

  const response = await CashDeposit.aggregate([
    {
      $match: {
        userId: { $in: Array.from(users) },
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
        _id: "$userId",
        amount: { $sum: "$amount" },
        name: { $first: "$userInfo.userName" }
      }
    }
  ]);

  // Adjust response for specific roles if necessary
  const formattedResponse = response.map(item => ({
    userId: item._id,
    name: item.name,
    amount: item.amount,
    role: currentUser.role // Include the current user's role in the response
  }));

  return res.send({
    success: true,
    message: 'Commission reports',
    results: formattedResponse,
    total: formattedResponse.length
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
