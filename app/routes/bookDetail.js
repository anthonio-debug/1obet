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

/*
  function bookDetailReport(req, res) {
    const errors = validationResult(req);
    if (errors.errors.length !== 0) {
      return res.status(400).send({ errors: errors.errors });
    }
    let depositsQuery = {};

    if (req.query.endDate && req.query.startDate) {
      depositsQuery.createdAt = {
        $gte: req.query.startDate,
        $lte: req.query.endDate,
      };
    }

    User.find({ userId: req.decoded.userId })
      .then((users) => {
        if (!users || users.length === 0) {
          return res.status(404).send({ message: 'No users found' });
        }
        const userIds = users.map((user) => user.userId);

        Deposits.find({ userId: { $in: userIds }, ...depositsQuery })
          .exec()
          .then((deposits) => {
            if (!deposits || deposits.length === 0) {
              return res.status(404).send({ message: 'No records found' });
            }

            const marketIds = deposits.map((deposit) => deposit.marketId);

            MarketType.find({ marketId: { $in: marketIds } }, 'marketId name')
              .then((markets) => {
                const marketMap = {};
                markets.forEach((market) => {
                  marketMap[market.marketId] = market.name;
                });

                const results = deposits.reduce((acc, deposit) => {
                  const existingMarket = acc.find(
                    (item) => item.name === marketMap[deposit.marketId]
                  );
                  if (existingMarket) {
                    existingMarket.amount += deposit.amount;
                  } else {
                    acc.push({
                      name: marketMap[deposit.marketId],
                      amount: deposit.amount,
                    });
                  }
                  return acc;
                }, []);

                return res.send({
                  success: true,
                  message: 'daily sportswise pl records found',
                  results: results,
                });
              })
              .catch((err) => {
                return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
              });
          })
          .catch((err) => {
            return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
          });
      })
      .catch((err) => {
        return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
      });
  }
*/

const bookDetailReport = async(req, res) => {

  const userId         = parseInt(req.decoded.userId);
  const directChild    = User.distinct("userId", { createdBy: userId });
  const grandchiltren  = User.distinct("userId", { createdBy: { $in: directChild }, role: '5' });
  const users          = [userId, ...directChild, ...grandchiltren];
  console.log(" users list  ======== ", users);

  const response = await CashDeposit.aggregate([
    {
      $match: {
        userId: { $in: users },
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

  // const parentResponse = await CashDeposit.aggregate([
  //   {  
  //     $match: {
  //       userId: currentUser.createdBy ,
  //       commissionFrom: currentUser.userId,
  //       cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
  //       $and: [
  //         {
  //           createdAt: {$gte: req.query.startDate}
  //         },
  //         {
  //           createdAt: {$lte: req.query.endDate}
  //         }
  //       ]
  //     }
  //   },
  //   {
  //     $lookup: {
  //       from: 'users',
  //       localField: 'userId',
  //       foreignField: 'userId',
  //       as: 'userInfo'
  //     }
  //   }, 
  //   {
  //     $group:{
  //       _id: "$userId",
  //       // parent: true,
  //       amount: { $sum: "$upLineAmount"},
  //       name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } }
  //     }
  //   }
  // ]);

  return res.send({
    success: true,
    message: 'Daily reports',
    results: response,
    // results: response?.concat(parentResponse),
  });

}

const bookDetailSportsWiseReport = async (req, res) => {
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

const bookDetailMatchWiseReports = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  
  // const userId = req.decoded.userId
  // console.log(" userId ====== ", userId);
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
        date: { $first: "$date" },
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

const bookDetailMatchWiseDetailedReports = async(req, res) => {

  const userId      = parseInt(req.query.userId)
  const matchId     = req.query.matchId;
  const currentUser = await User.findOne({ userId: userId});
  const parent      = await User.findOne({ userId: currentUser.createdBy});
  if(currentUser.role == '5'){
    const match       = await Events.findById(matchId)
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
        $group:{
          _id: "$betId",
          pl: { $sum: "$amount"},
          sattledAt: { $first: "$date" },
          price: { $first: { $arrayElemAt: ["$betsDetails.betAmount", 0] } },
          name: { $first: { $arrayElemAt: ["$betsDetails.runnerName", 0] } },
          createdAt: { $first: { $arrayElemAt: ["$betsDetails.createdAt", 0] } },
          size: { $first: { $arrayElemAt: ["$betsDetails.betRate", 0] } },
          type: { $first: { $arrayElemAt: ["$betsDetails.type", 0] } }

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

  }else {
    const userId      = parseInt(req.decoded.userId);
    const directChild = User.distinct("userId", { createdBy: userId });
    const grandchiltren = User.distinct("userId", { createdBy: { $in: directChild }, role: '5' });
    const users       = [userId,currentUser.createdBy, ...directChild, ...grandchiltren];
    console.log(" users list  ======== ", users);
    // let parents       = [userId];
    let childUsers;
    // do{
    //   childUsers     = await User.distinct("userId", {
    //     createdBy: {
    //       $in: parents
    //     }
    //   });
    //   console.log(" child users ======= ", childUsers);
    //   if(childUsers.length) users.push(...childUsers)
    //   parents = childUsers
    // }while (childUsers.length > 0)
  
    console.log(" users list  ======== ", users);
  
    const response = await CashDeposit.aggregate([
      {
        $match: {
          userId: { $in: users },
          matchId: matchId,
          cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
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
  
    const parentResponse = await CashDeposit.aggregate([
      {  
        $match: {
          userId: currentUser.createdBy ,
          cashOrCredit: { $in: ["Bet", "Commission", "loosing"] },
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
          // parent: true,
          amount: { $sum: "$upLineAmount"},
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

}

loginRouter.get('/bookDetailReport', bookDetailReport );
loginRouter.get('/bookDetailSportsWiseReport', bookDetailSportsWiseReport );
loginRouter.get('/bookDetailMatchWiseReports', bookDetailMatchWiseReports );
loginRouter.get('/bookDetailMatchWiseDetailedReports', bookDetailMatchWiseDetailedReports );

module.exports = { loginRouter };
