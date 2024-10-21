const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const Cash = require('../models/deposits');
const Bet = require('../models/bets')
const User = require('../models/user');
const Deposits = require('../models/deposits');
const cashValidator = require('../validators/deposits');
const loginRouter = express.Router();
const ExpRec = require('../models/ExpRec');

async function addCashDeposit(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { amount, userId, description = '(Cash)' } = req.body;

    if (amount < 1) {
      return res.status(400).json({ message: 'Invalid Amount!' });
    }

    const userToUpdate = await User.findOne({ userId, isDeleted: false });
    if (!userToUpdate) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUserParent = await User.findOne({ userId: userToUpdate.createdBy, isDeleted: false });
    if (!currentUserParent) {
      return res.status(404).json({ message: 'Parent user not found' });
    }

    if (currentUserParent.role !== '0' && amount > currentUserParent.cash + currentUserParent.creditRemaining) {
      const maxDeposit = Math.floor(currentUserParent.cash + currentUserParent.creditRemaining);
      return res.status(400).json({ message: `Max cash deposit is ${maxDeposit}` });
    }

    const lastUserCash = await Cash.findOne({ userId: userToUpdate.userId }).sort({ _id: -1 });
    const lastParentCash = await Cash.findOne({ userId: currentUserParent.userId }).sort({ _id: -1 });

    const createCashRecord = async (user, amount, lastCash, isNegative = false) => {
      const newCashRecord = new Cash({
        userId: user.userId,
        description,
        createdBy: req.decoded.userId,
        amount: isNegative ? -amount : amount,
        balance: lastCash ? lastCash.balance + (isNegative ? -amount : amount) : amount,
        availableBalance: lastCash ? lastCash.availableBalance + (isNegative ? -amount : amount) : amount,
        maxWithdraw: lastCash ? lastCash.maxWithdraw + (isNegative ? -amount : amount) : amount,
        cash: user.cash,
        credit: lastCash?.credit || 0,
        creditRemaining: lastCash?.creditRemaining || 0,
        cashOrCredit: 'Cash',
      });
      await newCashRecord.save();
    };

    const Dealers = ['1', '2', '3', '4'];

    if (currentUserParent.role === '0') {
      if (userToUpdate.role !== '5') {
        userToUpdate.clientPL += amount;
        userToUpdate.cash += amount;
      } else {
        userToUpdate.balance += amount;
        userToUpdate.availableBalance += amount;
        userToUpdate.clientPL += amount;
        userToUpdate.cash += amount;
      }

      await createCashRecord(userToUpdate, amount, lastUserCash);

    } else if (Dealers.includes(currentUserParent.role)) {
      userToUpdate.clientPL += amount;
      userToUpdate.cash += amount;
      currentUserParent.cash -= amount;

      await createCashRecord(userToUpdate, amount, lastUserCash);
      await createCashRecord(currentUserParent, amount, lastParentCash, true);

      if (userToUpdate.role === '5') {
        userToUpdate.balance += amount;
        userToUpdate.availableBalance += amount;
      }

    } else {
      return res.status(400).json({ message: 'Invalid Request' });
    }

    await userToUpdate.save();
    await currentUserParent.save();

    return res.json({ success: true, message: 'Cash deposit added successfully', results: null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
}


//to do need to add balance and availablebalance for cronjob winning bet
async function withDrawCashDeposit(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { amount, userId, description = '(Cash)' } = req.body;

    if (amount < 1) {
      return res.status(400).json({ message: 'Invalid Amount!' });
    }

    const userToUpdate = await User.findOne({ userId, isDeleted: false });
    if (!userToUpdate) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (userToUpdate.blockCashWithdraw) {
      return res.status(403).json({ message: 'Cash Withdraw Blocked' });
    }

    const currentUserParent = await User.findOne({ userId: userToUpdate.createdBy, isDeleted: false });
    if (!currentUserParent) {
      return res.status(404).json({ message: 'Parent user not found' });
    }

    const lastTransaction = await Deposits.findOne({ userId: userToUpdate.userId }).sort({ _id: -1 });

    if (!validateWithdrawal(userToUpdate, amount, lastTransaction)) {
      return res.status(400).json({ message: 'Invalid cash withdrawal amount.' });
    }

    const lastUserCash = await Cash.findOne({ userId: userToUpdate.userId }).sort({ _id: -1 });
    const lastParentCash = await Cash.findOne({ userId: currentUserParent.userId }).sort({ _id: -1 });

    const Dealers = ['1', '2', '3', '4'];

    // Handle withdrawal based on role
    if (currentUserParent.role === '0' && userToUpdate.role !== '5') {
      userToUpdate.clientPL -= amount;
      userToUpdate.cash -= amount;
      await processCashRecord(userToUpdate, -amount, lastUserCash, description);
    } else if (currentUserParent.role === '0' && userToUpdate.role === '5') {
      userToUpdate.balance -= amount;
      userToUpdate.availableBalance -= amount;
      userToUpdate.clientPL -= amount;
      userToUpdate.cash -= amount;
      await processCashRecord(userToUpdate, -amount, lastUserCash, description);
    } else if (Dealers.includes(currentUserParent.role) && Dealers.includes(userToUpdate.role)) {
      userToUpdate.clientPL -= amount;
      userToUpdate.cash -= amount;
      currentUserParent.cash += amount;

      await processCashRecord(userToUpdate, -amount, lastUserCash, description);
      await processCashRecord(currentUserParent, amount, lastParentCash, description);
    } else if (Dealers.includes(currentUserParent.role) && userToUpdate.role === '5') {
      userToUpdate.balance -= amount;
      userToUpdate.availableBalance -= amount;
      userToUpdate.clientPL -= amount;
      userToUpdate.cash -= amount;
      currentUserParent.cash += amount;

      await processCashRecord(userToUpdate, -amount, lastUserCash, description);
      await processCashRecord(currentUserParent, amount, lastParentCash, description);
    } else {
      return res.status(400).json({ message: 'Invalid Request' });
    }

    await userToUpdate.save();
    await currentUserParent.save();

    const updatedUser = await User.findOne({ userId, isDeleted: false });
    await logTransaction(updatedUser, userToUpdate, lastUserCash);

    return res.json({ success: true, message: 'Cash withdrawal added successfully' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }

  function validateWithdrawal(userToUpdate, amount, lastTransaction) {
    if (userToUpdate.role !== '5' && amount > userToUpdate.cash + userToUpdate.creditRemaining) {
      return false;
    } else if (userToUpdate.role === '5' && amount > userToUpdate.availableBalance) {
      return false;
    } else if (userToUpdate.role === '5' && (amount > lastTransaction.availableBalance || lastTransaction.availableBalance < 0)) {
      return false;
    }
    return true;
  }

  async function processCashRecord(user, amount, lastCash, description) {
    const cashRecord = new Cash({
      userId: user.userId,
      description,
      createdBy: req.decoded.userId,
      amount,
      balance: lastCash ? lastCash.balance + amount : amount,
      availableBalance: lastCash ? lastCash.availableBalance + amount : amount,
      maxWithdraw: lastCash ? lastCash.maxWithdraw + amount : amount,
      cash: lastCash ? lastCash.cash + amount : amount,
      credit: lastCash?.credit || 0,
      creditRemaining: lastCash?.creditRemaining || 0,
      cashOrCredit: 'Cash',
    });
    await cashRecord.save();
  }

  async function logTransaction(updatedUser, userToUpdate, lastUserCash) {
    const ExpTran = new ExpRec({
      userId: updatedUser.userId,
      trans_from: 'cashWithDraw',
      trans_from_id: lastUserCash._id,
      trans_bet_status: 0,
      user_prev_balance: userToUpdate.balance,
      user_prev_availableBalance: userToUpdate.availableBalance,
      user_prev_exposure: userToUpdate.exposure,
      user_new_balance: updatedUser.balance,
      user_new_availableBalance: updatedUser.availableBalance,
      user_new_exposure: updatedUser.exposure,
    });
    await ExpTran.save();
  }
}


function getLedgerDetails(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ errors: errors.errors });
    }

    const query = { userId: req.body.userId };
    let page = 1;
    let sort = -1;
    let sortValue = '_id';
    let limit = config.pageSize;
    //console.log('limit:', limit);
    if (req.body.numRecords && req.body.numRecords > 0 && !isNaN(req.body.numRecords)) limit = Number(req.body.numRecords);
    if (req.body.sortValue) sortValue = req.body.sortValue;
    if (req.body.sort) sort = Number(req.body.sort);
    if (req.body.page) page = Number(req.body.page);

    User.findOne(query, (err, user) => {
      if (err || !user) {
        return res.status(404).send({ message: 'User not found' });
      }
      let cashPipeline = [{
        $match: {
          userId: Number(req.body.userId),
          $and: [
            {
              createdAt: { $gte: req.body.startDate }
            },
            {
              createdAt: { $lte: req.body.endDate }
            }
          ]
        }
      }];

      const userRole = user.role;
      console.log("user role", user);

      if (userRole !== '5' && req.body.type) {
        cashPipeline.push({ $match: { cashOrCredit: req.body.type }, });
      }

      if (req.body.searchValue) {
        const searchRegex = new RegExp(req.body.searchValue, 'i');
        cashPipeline.push({
          $match: {
            $or: [
              { description: { $regex: searchRegex } },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$amount' },
                    regex: searchRegex,
                  },
                },
              },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$maxWithdraw' },
                    regex: searchRegex,
                  },
                },
              },
            ],
          },
        });
      }

      cashPipeline.push({
        $group: {
          // _id: "$_id",
          _id: {
            $cond: {
              if:
                { $in: ["$cashOrCredit", ['Cash', 'Credit']] },
              then: "$_id",
              else: {
                matchId: "$matchId",
                marketId: "$marketId",
                betSession: "$betSession",
                roundId: "$roundId"
              }
            }
          },
          originalId: { $first: "$_id" },
          description: { $first: "$description" },
          amount: { $sum: "$amount" },
          balance: { $last: "$balance" },
          availableBalance: { $last: "$availableBalance" },
          maxWithdraw: { $last: "$maxWithdraw" },
          betTime: { $first: "$betDateTime" },
          cashOrCredit: { $first: "$cashOrCredit" },
          date: { $first: "$date" },
          createdAt: { $first: "$createdAt" },
          sportsId: { $first: "$sportsId" },
          marketId: { $first: "$marketId" },
          roundId: { $first: "$roundId" },
          betId: { $first: "$betId" },
          userId: { $first: "$userId" },
          matchId: { $first: "$matchId" },
        },
      })

      cashPipeline.push(
        {
          $sort: { date: 1 },
        },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            results: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          },
        }
      );

      Cash.aggregate(cashPipeline, async (err, result) => {
        if (result[0].results && result[0].results.length > 0) {
          for (let i = 0; i < result[0].results.length; i++) {
            //console.log()
            if (result[0].results[i].betId) {
              try {
                const betInfo = await Bet.findOne({
                  _id: result[0].results[i].betId
                })
                result[0].results[i].betSession = betInfo?.betSession;
                result[0].results[i].matchType = betInfo?.matchType;
                result[0].results[i].matchId = betInfo?.matchId;
                result[0].results[i].SessionScore = betInfo?.SessionScore;
                result[0].results[i].winnerRunnerData = betInfo?.winnerRunnerData;
                result[0].results[i].fancyData = betInfo?.fancyData;
                result[0].results[i].isfancyOrbookmaker = betInfo?.isfancyOrbookmaker;
                result[0].results[i].roundId = betInfo?.roundId;
                result[0].results[i].subMarketId = betInfo?.subMarketId;
              } catch (err) {
                continue;
              }
            }
          }
        }

        if (
          err ||
          !result ||
          result.length === 0 ||
          result[0].results.length === 0
        ) {
          return res.status(200).send({ message: 'Deposit record not found' });
        }

        const responseData = {
          message: 'Deposit Records',

          results: {
            docs: result[0].results,
            total: result[0].metadata[0] ? result[0].metadata[0].total : 0,
            limit: limit ? limit : 0,
            page: page ? page : 0,
            pages:
              limit && result[0].metadata[0].total
                ? Number((result[0].metadata[0].total / limit).toFixed(0))
                : 0,
          },
        };

        return res.send(responseData);
      });


    });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Ledger Detail info" })
  }

}


function getLedgerDetails2(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ errors: errors.errors });
    }

    const query = { userId: req.body.userId };
    let page = 1;
    let sort = -1;
    let sortValue = '_id';
    let limit = config.pageSize;
    //console.log('limit:', limit);
    if (req.body.numRecords && req.body.numRecords > 0 && !isNaN(req.body.numRecords)) limit = Number(req.body.numRecords);
    if (req.body.sortValue) sortValue = req.body.sortValue;
    if (req.body.sort) sort = Number(req.body.sort);
    if (req.body.page) page = Number(req.body.page);

    User.findOne(query, (err, user) => {
      if (err || !user) {
        return res.status(404).send({ message: 'User not found' });
      }
      let cashPipeline = [{
        $match: {
          userId: Number(req.body.userId),
          $and: [
            {
              createdAt: { $gte: req.body.startDate }
            },
            {
              createdAt: { $lte: req.body.endDate }
            }
          ]
        }
      }];

      const userRole = user.role;

      if (userRole !== '5' && req.body.type) {
        cashPipeline.push({ $match: { cashOrCredit: req.body.type }, });
      }

      if (req.body.searchValue) {
        const searchRegex = new RegExp(req.body.searchValue, 'i');
        cashPipeline.push({
          $match: {
            $or: [
              { description: { $regex: searchRegex } },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$amount' },
                    regex: searchRegex,
                  },
                },
              },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$maxWithdraw' },
                    regex: searchRegex,
                  },
                },
              },
            ],
          },
        });
      }

      cashPipeline.push({
        $group: {
          _id: "$_id",
          // _id: {
          //   $cond: {
          //     if: 
          //     { $in: ["$cashOrCredit", ['Cash', 'Credit']] }, 
          //     then: "$_id", 
          //     else: {
          //       matchId: "$matchId",
          //       marketId: "$marketId",
          //       betSession: "$betSession",
          //       roundId: "$roundId"
          //     }
          //   }
          // },
          originalId: { $first: "$_id" },
          description: { $first: "$description" },
          amount: { $sum: "$amount" },
          balance: { $last: "$balance" },
          availableBalance: { $last: "$availableBalance" },
          maxWithdraw: { $last: "$maxWithdraw" },
          betTime: { $first: "$betDateTime" },
          date: { $first: "$date" },
          createdAt: { $first: "$createdAt" },
          cashOrCredit: { $first: "$cashOrCredit" },
          sportsId: { $first: "$sportsId" },
          marketId: { $first: "$marketId" },
          betId: { $first: "$betId" },
          userId: { $first: "$userId" },
        },
      })

      cashPipeline.push(
        {
          $sort: { date: 1 },
        },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            results: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          },
        }
      );

      //console.log('cashPipeline:', cashPipeline);

      Cash.aggregate(cashPipeline, async (err, result) => {

        if (result[0].results && result[0].results.length > 0) {
          for (let i = 0; i < result[0].results.length; i++) {
            if (result[0].results[i].betId) {
              try {
                const betInfo = await Bet.findOne({
                  _id: result[0].results[i].betId
                })

                result[0].results[i].betSession = betInfo?.betSession;
                result[0].results[i].matchType = betInfo?.matchType;
                result[0].results[i].SessionScore = betInfo?.SessionScore;
                result[0].results[i].winnerRunnerData = betInfo?.winnerRunnerData;
                result[0].results[i].fancyData = betInfo?.fancyData;
                result[0].results[i].isfancyOrbookmaker = betInfo?.isfancyOrbookmaker;
                result[0].results[i].roundId = betInfo?.roundId;
              } catch (err) {
                continue;
              }
            }
          }
        }
        if (
          err ||
          !result ||
          result.length === 0 ||
          result[0].results.length === 0
        ) {
          return res.status(200).send({ message: 'Deposit record not found' });
        }

        const responseData = {
          message: 'Deposit Records',

          results: {
            docs: result[0].results,
            total: result[0].metadata[0] ? result[0].metadata[0].total : 0,
            limit: limit ? limit : 0,
            page: page ? page : 0,
            pages:
              limit && result[0].metadata[0].total
                ? Number((result[0].metadata[0].total / limit).toFixed(0))
                : 0,
          },
        };

        return res.send(responseData);
      });


    });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Ledger Detail info" })
  }

}
// function getdeopsitDetailsCash(req, res) {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).send({ errors: errors.errors });
//     }

//     const query = { userId: req.decoded.userId };
//     let page = 1;
//     let sort = -1;
//     let sortValue = '_id';
//     let limit = config.pageSize;

//     if (req.body.numRecords && req.body.numRecords > 0 && !isNaN(req.body.numRecords)) 
//       limit = Number(req.body.numRecords);

//     if (req.body.sortValue) 
//       sortValue = req.body.sortValue;

//     if (req.body.sort) 
//       sort = Number(req.body.sort);

//     if (req.body.page) 
//       page = Number(req.body.page);

//     User.findOne(query, (err, user) => {
//       if (err || !user) {
//         return res.status(404).send({ message: 'User not found' });
//       }
//       console.log(req.decoded)

//       let depositPipeline = [

//         {
//           $match: {
//             userId: Number(req.decoded.userId),
//             credit: 0, // Match deposits where cash field is zero
//             cash: { $gt: 0 },
//             cashOrCredit: "Cash",
//             $and: [
//               {
//                 createdAt: { $gte: req.body.startDate }
//               },
//               {
//                 createdAt: { $lte: req.body.endDate }
//               }
//             ]
//           }
//         },

//       ];
//       if (req.body.searchValue) {
//         const searchRegex = new RegExp(req.body.searchValue, 'i');
//         depositPipeline.push({
//           $match: {
//             $or: [
//               { description: { $regex: searchRegex } },
//               {
//                 $expr: {
//                   $regexMatch: {
//                     input: { $toString: '$amount' },
//                     regex: searchRegex,
//                   },
//                 },
//               },
//               {
//                 $expr: {
//                   $regexMatch: {
//                     input: { $toString: '$maxWithdraw' },
//                     regex: searchRegex,
//                   },
//                 },
//               },
//             ],
//           },
//         });
//       }
//       depositPipeline.push(
//         {
//           $group: {
//             _id: "$_id",
//             originalId: { $first: "$_id" },
//             description: { $first: "$description" },
//             amount: { $sum: "$amount" },
//             balance: { $last: "$balance" },
//             availableBalance: { $last: "$availableBalance" },
//             maxWithdraw: { $last: "$maxWithdraw" },
//             betTime: { $first: "$betDateTime" },
//             date: { $first: "$date" },
//             createdAt: { $first: "$createdAt" },
//             cashOrCredit: { $first: "$cashOrCredit" },
//             sportsId: { $first: "$sportsId" },
//             marketId: { $first: "$marketId" },
//             betId: { $first: "$betId" },
//             userId: { $first: "$userId" },
//             deposits:{$last: "$cash"}
//           },
//         },
//         {
//           $sort: { date: -1 },
//         },
//           {
//             $facet: {
//               metadata: [{ $count: 'total' }],
//               results: [{ $skip: (page - 1) * limit }, { $limit: limit }],
//             },
//           }
//       )
//       Deposits.aggregate(depositPipeline, async (err, result) => {
//         console.log(result);
//         if (result[0].results && result[0].results.length > 0) {
//           for (let i = 0; i < result[0].results.length; i++) {
//             if (result[0].results[i].betId) {
//               try {
//                 const betInfo = await Bet.findOne({
//                   _id: result[0].results[i].betId
//                 })

//                 result[0].results[i].betSession = betInfo?.betSession;
//                 result[0].results[i].matchType = betInfo?.matchType;
//                 result[0].results[i].SessionScore = betInfo?.SessionScore;
//                 result[0].results[i].winnerRunnerData = betInfo?.winnerRunnerData;
//                 result[0].results[i].fancyData = betInfo?.fancyData;
//                 result[0].results[i].isfancyOrbookmaker = betInfo?.isfancyOrbookmaker;
//                 result[0].results[i].roundId = betInfo?.roundId;
//               } catch (err) {
//                 continue;
//               }
//             }
//           }
//         }
//         if (err || !result || result.length === 0 || result[0].results.length === 0) {
//           return res.status(200).send({ message: 'Deposit record not found' });
//         }

//         const responseData = {
//           message: 'Deposit Records',
//           results: {
//             docs: result[0].results,
//             total: result[0].metadata[0] ? result[0].metadata[0].total : 0,
//             limit: limit ? limit : 0,
//             page: page ? page : 0,
//             pages: limit && result[0].metadata[0].total ? Number((result[0].metadata[0].total / limit).toFixed(0)) : 0,
//           },
//         };

//         return res.send(responseData);
//       });

//     });
//   } catch (err) {
//     res.status(500).json({ success: false, msg: "Failed to get Ledger Detail info" });
//   }

// }

function getdeopsitDetailsCash(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ errors: errors.errors });
    }

    const query = { userId: req.decoded.userId };
    let page = 1;
    let sort = -1;
    let sortValue = '_id';
    let limit = config.pageSize;

    if (req.body.numRecords && req.body.numRecords > 0 && !isNaN(req.body.numRecords)) {
      limit = Number(req.body.numRecords);
    }
    if (req.body.sortValue) sortValue = req.body.sortValue;
    if (req.body.sort) sort = Number(req.body.sort);
    if (req.body.page) page = Number(req.body.page);

    User.findOne(query, (err, user) => {
      if (err || !user) {
        return res.status(404).send({ message: 'User not found' });
      }

      let cashPipeline = [{
        $match: {
          userId: Number(req.decoded.userId),
          cashOrCredit: "Cash",
          $and: [
            { createdAt: { $gte: req.body.startDate } },
            { createdAt: { $lte: req.body.endDate } }
          ]
        }
      }];

      const userRole = user.role;

      if (userRole !== '5' && req.body.type) {
        cashPipeline.push({ $match: { cashOrCredit: req.body.type } });
      }

      if (req.body.searchValue) {
        const searchRegex = new RegExp(req.body.searchValue, 'i');
        cashPipeline.push({
          $match: {
            $or: [
              { description: { $regex: searchRegex } },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$amount' },
                    regex: searchRegex,
                  },
                },
              },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$maxWithdraw' },
                    regex: searchRegex,
                  },
                },
              },
            ],
          },
        });
      }

      cashPipeline.push({
        $group: {
          _id: "$_id",  // Use the original ID directly
          originalId: { $first: "$_id" },
          description: { $first: "$description" },
          amount: { $sum: "$amount" },
          balance: { $last: "$balance" },
          availableBalance: { $last: "$availableBalance" },
          maxWithdraw: { $last: "$maxWithdraw" },
          betTime: { $first: "$betDateTime" },
          cashOrCredit: { $first: "$cashOrCredit" },
          date: { $first: "$date" },
          createdAt: { $first: "$createdAt" },
          sportsId: { $first: "$sportsId" },
          marketId: { $first: "$marketId" },
          roundId: { $first: "$roundId" },
          betId: { $first: "$betId" },
          userId: { $first: "$userId" },
          matchId: { $first: "$matchId" },
          // Add other fields as necessary
        },
      });

      cashPipeline.push(
        { $sort: { date: 1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            results: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          },
        }
      );

      Cash.aggregate(cashPipeline, async (err, result) => {
        if (result[0].results && result[0].results.length > 0) {
          for (let i = 0; i < result[0].results.length; i++) {
            if (result[0].results[i].betId) {
              try {
                const betInfo = await Bet.findOne({ _id: result[0].results[i].betId });
                result[0].results[i].betSession = betInfo?.betSession;
                result[0].results[i].matchType = betInfo?.matchType;
                result[0].results[i].matchId = betInfo?.matchId;
                result[0].results[i].SessionScore = betInfo?.SessionScore;
                result[0].results[i].winnerRunnerData = betInfo?.winnerRunnerData;
                result[0].results[i].fancyData = betInfo?.fancyData;
                result[0].results[i].isfancyOrbookmaker = betInfo?.isfancyOrbookmaker;
                result[0].results[i].roundId = betInfo?.roundId;
                result[0].results[i].subMarketId = betInfo?.subMarketId;
              } catch (err) {
                continue;
              }
            }
          }
        }

        if (err || !result || result.length === 0 || result[0].results.length === 0) {
          console.log('Error:', err);
          console.log('Result:', result);
          return res.status(200).send({ message: 'Deposit record not found' });
        }

        const responseData = {
          message: 'Deposit Records',
          results: {
            docs: result[0].results,
            total: result[0].metadata[0] ? result[0].metadata[0].total : 0,
            limit: limit ? limit : 0,
            page: page ? page : 0,
            pages: limit && result[0].metadata[0].total ? Math.ceil(result[0].metadata[0].total / limit) : 0,
          },
        };

        return res.send(responseData);
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Ledger Detail info" });
  }
}

function getdepositDetailsCredit(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).send({ errors: errors.errors });
    }

    const query = { userId: req.decoded.userId };
    let page = 1;
    let sort = -1;
    let sortValue = '_id';
    let limit = config.pageSize;

    if (req.body.numRecords && req.body.numRecords > 0 && !isNaN(req.body.numRecords)) {
      limit = Number(req.body.numRecords);
    }
    if (req.body.sortValue) sortValue = req.body.sortValue;
    if (req.body.sort) sort = Number(req.body.sort);
    if (req.body.page) page = Number(req.body.page);

    User.findOne(query, (err, user) => {
      if (err || !user) {
        return res.status(404).send({ message: 'User not found' });
      }

      let cashPipeline = [{
        $match: {
          userId: Number(req.decoded.userId),
          cashOrCredit: "Credit",
          $and: [
            {
              createdAt: { $gte: req.body.startDate }
            },
            {
              createdAt: { $lte: req.body.endDate }
            }
          ]
        }
      }];

      const userRole = user.role;

      if (userRole !== '5' && req.body.type) {
        cashPipeline.push({ $match: { cashOrCredit: req.body.type }, });
      }

      if (req.body.searchValue) {
        const searchRegex = new RegExp(req.body.searchValue, 'i');
        cashPipeline.push({
          $match: {
            $or: [
              { description: { $regex: searchRegex } },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$amount' },
                    regex: searchRegex,
                  },
                },
              },
              {
                $expr: {
                  $regexMatch: {
                    input: { $toString: '$maxWithdraw' },
                    regex: searchRegex,
                  },
                },
              },
            ],
          },
        });
      }

      cashPipeline.push({
        $group: {
          _id: {
            $cond: {
              if: { $in: ["$cashOrCredit", ['Credit']] },
              then: "$_id",
              else: {
                matchId: "$matchId",
                marketId: "$marketId",
                betSession: "$betSession",
                roundId: "$roundId"
              }
            }
          },
          originalId: { $first: "$_id" },
          description: { $first: "$description" },
          amount: { $sum: "$amount" },
          balance: { $last: "$balance" },
          availableBalance: { $last: "$availableBalance" },
          maxWithdraw: { $last: "$maxWithdraw" },
          betTime: { $first: "$betDateTime" },
          cashOrCredit: { $first: "$cashOrCredit" },
          date: { $first: "$date" },
          createdAt: { $first: "$createdAt" },
          sportsId: { $first: "$sportsId" },
          marketId: { $first: "$marketId" },
          roundId: { $first: "$roundId" },
          betId: { $first: "$betId" },
          userId: { $first: "$userId" },
          matchId: { $first: "$matchId" },
        },
      });

      cashPipeline.push(
        { $sort: { date: 1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }],
            results: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          },
        }
      );

      Cash.aggregate(cashPipeline, async (err, result) => {
        if (result[0].results && result[0].results.length > 0) {
          for (let i = 0; i < result[0].results.length; i++) {
            if (result[0].results[i].betId) {
              try {
                const betInfo = await Bet.findOne({ _id: result[0].results[i].betId });
                result[0].results[i].betSession = betInfo?.betSession;
                result[0].results[i].matchType = betInfo?.matchType;
                result[0].results[i].matchId = betInfo?.matchId;
                result[0].results[i].SessionScore = betInfo?.SessionScore;
                result[0].results[i].winnerRunnerData = betInfo?.winnerRunnerData;
                result[0].results[i].fancyData = betInfo?.fancyData;
                result[0].results[i].isfancyOrbookmaker = betInfo?.isfancyOrbookmaker;
                result[0].results[i].roundId = betInfo?.roundId;
              } catch (err) {
                continue;
              }
            }
          }
        }

        if (
          err ||
          !result ||
          result.length === 0 ||
          result[0].results.length === 0
        ) {
          console.log('Error:', err);
          console.log('Result:', result);
          console.log('Result length:', result ? result.length : 'result is null or undefined');
          console.log('First result\'s results length:', result && result[0] ? result[0].results.length : 'first result is null or undefined');
          return res.status(200).send({ message: 'Deposit record not found' });
        }

        const responseData = {
          message: 'Deposit Records',
          results: {
            docs: result[0].results,
            total: result[0].metadata[0] ? result[0].metadata[0].total : 0,
            limit: limit ? limit : 0,
            page: page ? page : 0,
            pages: limit && result[0].metadata[0].total ? Math.ceil(result[0].metadata[0].total / limit) : 0,
          },
        };

        return res.send(responseData);
      });
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Failed to get Ledger Detail info" });
  }
}

async function getAllDeposits(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }

  User.findOne({ userId: req.query.userId }, (err, user) => {
    if (err || !user)
      return res.status(404).send({ message: 'User not found' });
    User.findOne({ userId: user.createdBy }, (err, parentUser) => {
      if (err || !parentUser)
        return res.status(404).send({ message: 'User not found' });
      Cash.findOne(
        { userId: req.query.userId },
        // creditlimit should be of the parent user
        { maxWithdraw: 1 }
      )
        .sort({ _id: -1 })
        .exec(async (err, results) => {
          // const resp = await userWithdrawStatusCheck(Number(req.query.userId))
          if (err) {
            //console.log('Error'.err);
            return res.status(404).send({ message: 'Record not found' });
          }
          if (!results) {
            return res.status(200).send({
              message: 'Record not found',
              // status: resp,
              results: {
                maxWithdraw: 0,
                creditLimit: 0,
                balance: 0,
                credit: 0,
                availableBalance: 0,
              },
            });
          }



          if (user.role == '5') {
            return res.send({
              message: 'Deposit Record Found',
              // status: resp,
              results: {
                maxWithdraw: user.availableBalance,
                creditLimit: parentUser.creditRemaining,
                balance: user.balance,
                credit: user.credit,
                availableBalance: user.availableBalance,
              },
            });
          } else {
            return res.send({
              message: 'Deposit Record Found',
              // status: resp,
              results: {
                ...results._doc,
                creditLimit: parentUser.creditRemaining,
                balance: user.balance,
                credit: user.credit,
                availableBalance: user.availableBalance,
              },
            });
          }
        });
    });
  });
}

// const userWithdrawStatusCheck = async (userId) => {
//   const resp = {
//     status: 200,
//     englush: "Take screenshot and contact support team",
//     urdu: "اسکرین شاٹ لیں اور سپورٹ ٹیم سے رابطہ کریں۔"
//   }
//   // const userId = Number(req.query.id);
//   const user   = await  User.findOne({ userId: userId })
//   const deposit = await Cash.find({ userId: userId }).sort({ _id: -1 }).limit(1);
//   const lastDeposit = deposit[0]
//   const activeBetsCount = await Bet.countDocuments({ userId: userId, status: 1 });
//   const difference = lastDeposit.availableBalance - user.availableBalance - (-user.exposure)
//   if(user.exposure > 1 ){
//     resp.status = 400;
//   }else if(user.exposure < -1 && activeBetsCount === 0){
//     resp.status = 400;
//   }else if(user.exposure < -1 && activeBetsCount > 0 &&   ( difference < -1 || difference > 1 )){
//     resp.status = 400;
//   }
//   return resp
// }

loginRouter.post(
  '/addCashDeposit',
  cashValidator.validate('addCashDeposit'),
  addCashDeposit
);
loginRouter.post(
  '/withDrawCashDeposit',
  cashValidator.validate('withDrawCashDeposit'),
  withDrawCashDeposit
);
loginRouter.post('/getLedgerDetails', getLedgerDetails);
loginRouter.post('/getLedgerDetails2', getLedgerDetails2);
loginRouter.post('/getdeopsitDetailsCash', getdeopsitDetailsCash);
loginRouter.post('/getdeopsitDetailsCredit', getdepositDetailsCredit);
loginRouter.get('/getAllDeposits', getAllDeposits);
module.exports = { loginRouter, getdeopsitDetailsCash, getdepositDetailsCredit };