const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const CashDeposit = require('../models/deposits');
const User = require('../models/user');
const cricketMatch = require('../models/cricketMatches');

const reportValidator = require('../validators/reports');
const Deposits = require('../models/deposits');
const MarketType = require('../models/marketTypes');
const Bets = require('../models/bets');
const loginRouter = express.Router();


/*
async function findAllChildren(userId) {
  let allUsers = [userId];
  let queue = [userId];
  let processed = new Set(); // İşlenmiş kullanıcıları tutmak için bir Set

  while(queue.length > 0) {
    const currentUserId = queue.shift();
    
    // Eğer bu userId zaten işlenmişse, döngüyü atla
    if(processed.has(currentUserId)) {
      continue;
    }

    const childUsers = await User.distinct("userId", { createdBy: currentUserId });

    // Şu anda işlenen userId'yi işlenmiş olarak işaretle
    processed.add(currentUserId);

    allUsers = [...allUsers, ...childUsers];
    queue = [...queue, ...childUsers];
  }

  return allUsers;
}
const getDailyReport = async(req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  


  //change this value for real time
  const userId = 0;
  // parseInt(req.decoded.userId)
  const users = await findAllChildren(0);

  const response = await CashDeposit.aggregate([
    {
      $match: {
        userId: {
          $in: users
        },
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
      }
    }
  ]);


  return res.send({
    success: true,
    message: 'Commission reports',
    results: response,
  });

}

const dailySportsWiseReport = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

    const Id        =  parseInt(req.query.userId)
    console.log(" Id ========== ", Id);
    const response = await CashDeposit.aggregate([
      {  
        $match: {
          userId: Id,
          cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
          $and: [
            {
              createdAt: {$gte: req.query.startDate}
            },
            {
              createdAt: {$lte: req.query.endDate}
            }
          ]
        }
      },
      {
        $lookup: {
          from: 'markettypes',
          localField: 'marketId',
          foreignField: 'Id',
          as: 'marketInfo'
        }
      }, 
      {
        $group:{
          _id: "$marketId",
          amount: { $sum: "$amount"},
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

const dailyMarketsReports = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  
  const userId = req.decoded.userId
  console.log(" userId ====== ", userId);
  const Id =  parseInt(req.query.userId)

  const response = await CashDeposit.aggregate([
    {  
      $match: {
        userId: Id,
        marketId: req.query.marketId,
        cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
        $and: [
          {
            createdAt: {$gte: req.query.startDate}
          },
          {
            createdAt: {$lte: req.query.endDate}
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
      $group:{
        _id: {$arrayElemAt: ["$bets.matchId", 0]},
        amount: { $sum: "$amount"},
        userId: { $first: "$userId" },
        name: { $first: { $arrayElemAt: ["$bets.event", 0] } }
      }
    }
  ]);
  return res.send({
    success: true,
    message: 'Sport wise Reports !',
    results: response,
  });
}
*/ 


async function getAllChildrens(createdByIDs) {
  const userIDs = [];
  const queriedUserIDs = new Set(); // Keep track of queried user IDs

  if (createdByIDs.length === 0) {
    return userIDs;
  }

  const uniqueIDs = Array.from(new Set(createdByIDs)); // Remove duplicate IDs

  const users = await User.find(
    { createdBy: { $in: uniqueIDs } },
    { userId: 1, userName: 1, createdBy: 1 }
  ).lean();

  for (const user of users) {
    if (!queriedUserIDs.has(user.userId)) {
      userIDs.push(user.userId);
      queriedUserIDs.add(user.userId);
    }
  }

  const subUserIDs = await getAllChildrens(userIDs);
  userIDs.push(...subUserIDs);
  return Array.from(new Set(userIDs)); // Ensure unique user IDs in the final array
}

const getDailyReport = async(req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  const userId      = parseInt(req.decoded.userId)
  const currentUser = await User.findOne({ userId: userId});
  const users       = [currentUser.createdBy, userId];
  let parents       = [userId]
  do{
    childUsers      = await User.distinct("userId", {
      createdBy: {
        $in: parents
      }
    });
    console.log(" childUsers ======= ", childUsers);
    if(childUsers.length)
      users.push(...childUsers)
    parents = childUsers
  }while (childUsers.length > 0)

  const response = await CashDeposit.aggregate([
    {  
      $match: {
        userId: {
          $in: users
        },
        cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
        $and: [
          {
            createdAt: {$gte: req.query.startDate}
          },
          {
            createdAt: {$lte: req.query.endDate}
          }
        ]
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
      $group:{
        _id: "$userId",
        amount: { $sum: "$amount"},
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

const dailySportsWiseReport = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

    const Id        =  parseInt(req.query.userId)
    console.log(" Id ========== ", Id);
    const response = await CashDeposit.aggregate([
      {  
        $match: {
          userId: Id,
          cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
          $and: [
            {
              createdAt: {$gte: req.query.startDate}
            },
            {
              createdAt: {$lte: req.query.endDate}
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
        $group:{
          _id: "$sportsId",
          amount: { $sum: "$amount"},
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

const dailyMatchWiseReports = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  
  const userId = req.decoded.userId
  console.log(" userId ====== ", userId);
  const Id =  parseInt(req.query.userId)

  const response = await CashDeposit.aggregate([
    {  
      $match: {
        userId: Id,
        sportsId: req.query.sportsId,
        cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
        $and: [
          {
            createdAt: {$gte: req.query.startDate}
          },
          {
            createdAt: {$lte: req.query.endDate}
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
      $group:{
        _id: {$arrayElemAt: ["$bets.matchId", 0]},
        amount: { $sum: "$amount"},
        userId: { $first: "$userId" },
        date: { $first: "$createdAt" },
        name: { $first: { $arrayElemAt: ["$bets.event", 0] } },
      }
    }
  ]);
  return res.send({
    success: true,
    message: 'Sport wise Reports !',
    results: response,
  });
}



loginRouter.get('/getDailyReport', getDailyReport);
loginRouter.get('/dailySportsWiseReport', dailySportsWiseReport);
loginRouter.get('/dailyMatchWiseReports',  dailyMatchWiseReports);

module.exports = { loginRouter };
