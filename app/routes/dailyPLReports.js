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
const cricketMatch = require('../models/cricketMatches');

const getDailyPLReport = async(req, res) =>{
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  const userId = 2248
  parseInt(req.decoded.userId)
  console.log("usersId ====== ", userId);
  const response = await CashDeposit.aggregate([
    {  
      $match: {
        userId: userId,
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
        localField: 'commissionFrom',
        foreignField: 'userId',
        as: 'userInfo'
      }
    }, 
    {
      $group:{
        _id: "$commissionFrom",
        amount: { $sum: "$amount"},
        name: { $first: { $arrayElemAt: ["$userInfo.userName", 0] } }
      }
    }
  ]);

  return res.send({
    success: true,
    message: 'commition records',
    results: response,
  });

  // {
  //   let query = {};
  //   let depositsQuery = {};
  //   depositsQuery.cashOrCredit =  { $in: ["Bet", "Commission"] }
  //   // let userId = (req.decoded.userId);

  //   if (req.decoded.role !== '5') {
  //     query.createdBy = userId;
  //   }

  //   if (req.query.endDate && req.query.startDate) {
  //     depositsQuery.createdAt = {
  //       $gte: req.query.startDate,
  //       $lte: req.query.endDate,
  //     };
  //   }

  //   User.find(query, (err, users) => {
  //     if (err || !users) {
  //       return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
  //     }
  //     if (!users || users.length === 0) {
  //       return res.status(404).send({ message: 'No users found' });
  //     }

  //     let createdByIDs = users.map((user) => user.userId);
  //     createdByIDs.push(userId); // Include the logged-in user in the query

  //     Deposits.find({ userId: { $in: createdByIDs }, ...depositsQuery }).exec(
  //       (err, deposits) => {
  //         if (err) {
  //           return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
  //         }
  //         if (!deposits || deposits.length === 0) {
  //           return res.status(404).send({ message: 'No records found' });
  //         }

  //         // Retrieve user data for mapping
  //         const userIds = deposits.map((deposit) => deposit.userId);
  //         User.find(
  //           { userId: { $in: userIds } },
  //           'userId userName',
  //           (err, users) => {
  //             if (err) {
  //               return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
  //             }

  //             // Map user data to deposits
  //             const depositMap = {};
  //             users.forEach((user) => {
  //               depositMap[user.userId] = user.userName;
  //             });

  //             const results = deposits.reduce((acc, deposit) => {
  //               const existingUser = acc.find((user) => user.userId === deposit.userId);
  //               if (existingUser) {
  //                 existingUser.amount += deposit.amount;
  //               } else {
  //                 acc.push({
  //                   userId: deposit.userId,
  //                   userName: depositMap[deposit.userId],
  //                   amount: deposit.amount,
  //                 });
  //               }
  //               return acc;
  //             }, []);

  //             return res.send({
  //               success: true,
  //               message: 'daily pl records found',
  //               results: results,
  //             });
  //           }
  //         )
  //       });
  //   });
  // }
}

const dailyPlMarketsReports =  async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  const userId = parseInt(req.decoded.userId)
  const Id     =  parseInt(req.query.userId)
  console.log(" Id ========== ", Id);

  const response = await CashDeposit.aggregate([
    {  
      $match: {
        commissionFrom: Id,
        userId: userId,
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
        name: { $first: { $arrayElemAt: ["$marketInfo.name", 0] } }
      }
    }
  ]);

  return res.send({
    success: true,
    message: 'Market wise Commission records !',
    results: response,
  });




  let depositsQuery = {};
  depositsQuery.cashOrCredit =  { $in: ["Bet", "Commission"] }
  if (req.query.endDate && req.query.startDate) {
    depositsQuery.createdAt = {
      $gte: req.query.startDate,
      $lte: req.query.endDate,
    };
  }


  // const userId = req.query.userId;
  const marketId = req.query.marketId;
  Deposits.find({ userId: userId, marketId: marketId, ...depositsQuery }, { _id: 0, amount: 1, createdAt:1,betId:1 })
    .exec()
    .then((deposits) => {
      if (!deposits || deposits.length === 0) {
        return res.status(404).send({ message: 'No deposit records found' });
      }
          const betIds = deposits.map((deposit) => deposit.betId);
          Bets.find({ _id: { $in: betIds }, marketId: marketId }, { _id: 1, event: 1, createdAt: 1, matchId: 1 })
          .exec()
          .then((bets) => {
            if (!bets || bets.length === 0) {
              return res.status(404).send({ message: 'No bet records found' });
            }
            const matchIds = bets.map((bet) => bet.matchId);
            cricketMatch
              .find({ id: { $in: matchIds } }, { id: 1, name: 1 })
              .exec()
              .then((matches) => {
                if (!matches || matches.length === 0) {
                  return res.status(404).send({ message: 'No match records found' });
                }
                const matchAmounts = {};
                // Calculate total amount per match by grouping deposits
                deposits.forEach((deposit) => {
                  const bet = bets.find((bet) => bet._id == deposit.betId);
                  console.log('bet', bet);
                  if (bet) {
                    const match = matches.find(
                      (match) => match.id == bet.matchId
                    );
                    console.log('match', match);
                    if (match) {
                      if (!matchAmounts[match.id]) {
                        matchAmounts[match.id] = {
                          matchName: match.name,
                          amount: deposit.amount,
                        };
                      } else {
                        matchAmounts[match.id].amount += deposit.amount;
                      }
                    }
                  }
                });
  
                // Sum up the amounts for bets on the same match
                const results = Object.values(matchAmounts).map(
                  (matchAmount) => ({
                    Date: deposits[0].createdAt,
                    Event: matchAmount.matchName,
                    Amount: matchAmount.amount,
                  })
                );
                console.log('results', results);
                const response = {
                  success: true,
                  message: 'Daily Markets Reports found',
                  results: results,
                };
  
                return res.send(response);
              })
              .catch((err) => {
                console.log('Error retrieving match records:', err);
                return res.status(404).send({ message: 'Error retrieving match records' });
              });
          })
          .catch((err) => {
            console.log('Error retrieving bet records:', err);
            return res.status(404).send({ message: 'Error retrieving bet records' });
          });
      })
      .catch((err) => {
        console.log('Error retrieving deposit records:', err);
        return res.status(404).send({ message: 'Error retrieving deposit records' });
      });
}

const dailyPLSportsWiseReport = async (req, res) => {
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
        userId: userId,
        commissionFrom: Id,
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
    // {
    //   $addFields: {
    //     'betIdEvent': { $toObjectId: "$betId" }
    //   }
    // },
    // {
    //   $lookup: {
    //     from: 'bets',
    //     localField: 'betIdEvent',
    //     foreignField: '_id',
    //     as: 'bets'
    //   }
    // }, 
    // {
    //   $group:{
    //     // _id: {$arrayElemAt: ["$bets.matchId", 0]},
    //     _id: "$_id",
    //     amount: { $sum: "$amount"},
    //     name: { $first: { $arrayElemAt: ["$bets.event", 0] } }
    //   }
    // }
  ]);
  return res.send({
    success: true,
    message: 'Sport wise Commissions !',
    results: response,
  });

}


loginRouter.get('/getDailyPLReport',reportValidator.validate('getDailyPLReport'), getDailyPLReport);
loginRouter.get('/dailyPLSportsWiseReport',reportValidator.validate('dailyPLSportsWiseReport'), dailyPLSportsWiseReport);
loginRouter.get('/dailyPlMarketsReports',reportValidator.validate('dailyPlMarketsReports'), dailyPlMarketsReports);

module.exports = { loginRouter };
