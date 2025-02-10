const axios = require('axios');
const express = require('express');
const InPlayEvents = require("../models/events")
const { v4: uuidv4 } = require('uuid');
const User = require('../models/user');
const router = express.Router();
const ExpRec = require("../models/ExpRec");
const CasinoDebits = require('../models/casinoCalls');
const Settings = require('../models/settings');
const Cash = require("../../app/models/deposits");
const expPositive = require("../../app/models/ExpPositive");
const MarketIDS = require("../../app/models/marketIds");
const Bets = require("../../app/models/bets");
const crypto = require('crypto');
const config = require('config');
const { MongoClient } = require('mongodb');
const casinoMultiples = config.casinoMultiples;
const { getParents,parentCommisionAmount } = require("./bets");
const SelectedCasino = require("../models/selectedCasino");
const path = require('path');
const log = require('log-to-file');
const CasinoCalls = require('../models/casinoCalls');
const CasinoCallsPayload = require('../models/casinoCallsPayload');
const DBNAME = process.env.DB_NAME;
const DBHost = process.env.DBHost;
const saltKey = process.env.saltKey;

let transactionIdMap = new Map()

/**
 *
 * Latest tasks
 * 1 > Description include game name in it
 * 2 > roundId in Deposits
 *
 */

const transactionOptions = {
  readPreference: 'primary',
  readConcern: { level: 'local' },
  writeConcern: { w: 'majority' }
}
const dbClient = new MongoClient(`${DBHost}`, { useUnifiedTopology: true });
const casinoCalls = dbClient.db(`${DBNAME}`).collection('casinocalls');
const users = dbClient.db(`${DBNAME}`).collection('users');

const checkMarketBlocked = async (user) => {
  let parentUserIds = await getParents(user.userId);
  const marketIds = await User.distinct("blockedMarketPlaces", { userId: { $in: parentUserIds }, isDeleted: false });

  const anyParentCasinoBlocked = await User.find({ userId: { $in: parentUserIds }, casinoAllowed: false });
  const anyParentBettingBlocked = await User.find({ userId: { $in: parentUserIds }, bettingAllowed: false });
  const marketId = config.casinoMarketId;
  //if any of the parents hierarchy
  if (marketIds.includes(marketId) || !user.casinoAllowed || !user.bettingAllowed || anyParentCasinoBlocked.length != 0 || anyParentBettingBlocked.length != 0) {
    return 1;
  } else {
    return 0;
  }
}

async function removeClosedMkts() {
  //console.log("---------------------------------");
  const twoMinutesAgo = Date.now() - 10 * 60 * 1000;
  //const ghclosedMkts = await MarketIDS.find({ sportID:{$in:[7,4339]},status: 'CLOSED', openDate:{$lt:twoMinutesAgo} })
  const ghclosedMkts = await MarketIDS.find({ status: 'CLOSED', updatedAt: { $lt: twoMinutesAgo } })
  console.log("List of closed markets---------------------------------", ghclosedMkts);
  ghclosedMkts &&
    (ghclosedMkts.forEach(async (market) => {
      //console.log("market.marketId........................---------------------------",market.marketId);
      let ghcountghbetsCount = await Bets.countDocuments({ marketId: market.marketId, status: 1 })
      console.log('PASSED-THROUGH---------------------------', ghcountghbetsCount);
      console.log('PASSED-THROUGH---------------------------', ghcountghbetsCount);
      console.log('PASSED-THROUGH---------------------------', ghcountghbetsCount);
      console.log('PASSED-THROUGH---------------------------', ghcountghbetsCount);
      console.log('PASSED-THROUGH---------------------------', ghcountghbetsCount);
      console.log('PASSED-THROUGH---------------------------', ghcountghbetsCount);
      console.log('PASSED-THROUGH---------------------------', ghcountghbetsCount);
      console.log('PASSED-THROUGH---------------------------', ghcountghbetsCount);
      console.log('PASSED-THROUGH---------------------------', ghcountghbetsCount);
      console.log('PASSED-THROUGH---------------------------', ghcountghbetsCount);
      console.log('PASSED-THROUGH---------------------------', ghcountghbetsCount);
      console.log('PASSED-THROUGH---------------------------', ghcountghbetsCount);
      if (!ghcountghbetsCount) {
        //await MarketIDS.deleteOne({ marketId:market.marketId } );
        await MarketIDS.updateOne({ marketId: market.marketId }, { status: 'PASSED-THROUGH' });

      }
    }));



  await MarketIDS.deleteMany({ status: 'ABANDONED' });

  await MarketIDS.deleteMany({ status: 'PASSED-THROUGH' });
  //  await InPlayEvents.deleteMany({status:'CLOSED-EVENTLIST'});
  //await InPlayEvents.deleteMany({status:'CLOSED-INPLAYLIST'});


  CasinoCallsPayload.aggregate([
    {
      $group: {
        _id: "$transaction_id",  // Group by 'transaction_id'
        count: { $sum: 1 },       // Count how many times each 'transaction_id' appears
        ids: { $push: "$_id" }    // Store the '_id' of each document in 'ids' array
      }
    },
    {
      $match: {
        count: { $gt: 1 }         // Only keep 'transaction_id's that appear more than once
      }
    }
  ]).exec().then(groups => {
    groups.forEach(group => {
      // Remove all but one document for each duplicate 'transaction_id'
      group.ids.shift();  // Remove the first ID (this one will be kept)

      // Delete the rest of the documents with the same 'transaction_id'
      CasinoCallsPayload.deleteMany({
        _id: { $in: group.ids }
      }).then(result => {
        console.log(`Deleted ${result.deletedCount} documents`);
      }).catch(err => {
        console.error('Error deleting documents:', err);
      });
    });
  }).catch(err => {
    console.error('Error in aggregation:', err);
  });

  CasinoCalls.aggregate([
    {
      $group: {
        _id: "$transaction_id",  // Group by 'transaction_id'
        count: { $sum: 1 },       // Count how many times each 'transaction_id' appears
        ids: { $push: "$_id" }    // Store the '_id' of each document in 'ids' array
      }
    },
    {
      $match: {
        count: { $gt: 1 }         // Only keep 'transaction_id's that appear more than once
      }
    }
  ]).exec().then(groups => {
    groups.forEach(group => {
      // Remove all but one document for each duplicate 'transaction_id'
      group.ids.shift();  // Remove the first ID (this one will be kept)

      // Delete the rest of the documents with the same 'transaction_id'
      CasinoCalls.deleteMany({
        _id: { $in: group.ids }
      }).then(result => {
        console.log(`Deleted ${result.deletedCount} documents`);
      }).catch(err => {
        console.error('Error deleting documents:', err);
      });
    });
  }).catch(err => {
    console.error('Error in aggregation:', err);
  });



}
const mongoose = require('mongoose');
async function findAndProcessTransactions() {
  //await insertMissingTransactions();
  //console.log("uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");

  const session = await mongoose.startSession();

  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;

  let i = 0;

  const limitValue = 8; // Set your desired limit here

  // Aggregate the transactions to process
  const groupedTransactions = await CasinoCalls.aggregate([
    {
      $match: {
        isProcessing: true,
        $or: [
          { gameplay_final: 1 },
          { action: 'rollback' },
        ]
      }
    },
    {
      $group: {
        _id: "$round_id",
        remote_id: { $first: "$remote_id" },
        username: { $first: "$username" },
        game_id: { $first: "$game_id" },
        gameplay_final: { $first: "$gameplay_final" }
      }
    },
    {
      $sort: { lastCheckedTime: 1 }
    },
    { $limit: limitValue }
  ]);

  let groupedTransactionsIds = [];

  if (groupedTransactions.length > 0) {
    groupedTransactions.forEach((doc) => {
      groupedTransactionsIds.push(doc._id);
    });
  }

  await CasinoCalls.updateMany({ round_id: { $in: groupedTransactionsIds } }, { $set: { lastCheckedTime: Date.now() } }, { session });

  if (!groupedTransactions || groupedTransactions.length === 0) {
    session.endSession();
    return;
  }
  //console.log("=====================================",groupedTransactions);

  for (const tran of groupedTransactions) {
    const CasinoDebitroundsCount = await CasinoCalls.countDocuments({ round_id: tran._id, action: 'debit' });
    const CasinoCreditroundsCount = await CasinoCalls.countDocuments({ round_id: tran._id, action: 'credit' });
    const CasinoUploadsDebitroundsCount = await CasinoCallsPayload.countDocuments({ round_id: tran._id, action: 'debit' });
    const CasinoUploadsCreditroundsCount = await CasinoCallsPayload.countDocuments({ round_id: tran._id, action: 'credit' });
    const CasinoUploadsRollBackroundsCount = await CasinoCallsPayload.countDocuments({ round_id: tran._id, action: 'rollback' });
    const CasinoRollBackroundsCount = await CasinoCallsPayload.countDocuments({ round_id: tran._id, action: 'rollback' });

    if (CasinoDebitroundsCount === 0 || CasinoUploadsDebitroundsCount === 0 || CasinoDebitroundsCount !== CasinoUploadsDebitroundsCount || CasinoCreditroundsCount !== CasinoUploadsCreditroundsCount || CasinoUploadsRollBackroundsCount != CasinoRollBackroundsCount) {
      continue;
    }

    console.log("tran--------------------------------------------------", tran);

    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
      //const session = await mongoose.startSession();  // Start a session at the beginning of the loop
      session.startTransaction();

      try {
        // Your transactional code here (Example: updating CasinoCalls)
        await CasinoCalls.updateMany({ round_id: tran._id }, { $set: { lastCheckedTime: Date.now() } }, { session });

        const userRecord = await users.findOne({ remoteId: Number(tran.remote_id) }, { session });

        if (!userRecord) {
          console.log(`User not found for remoteId: ${tran.remote_id}`);
          await session.commitTransaction(); // Commit before continuing if user not found
          session.endSession();
          continue; // Skip if user not found
        }

        const existingDeposit = await Cash.findOne({ roundId: tran._id.toString(), userId: userRecord.userId });
        console.log("existingDeposit-------------------", existingDeposit);
        if (!existingDeposit) {
          let totalCreditAmount = 0;
          let totalDebitAmount = 0;
          let totalRollBackAmount = 0;
          let differenceDbCr = 0;

          const roundIds = await CasinoCalls.find({ round_id: tran._id });

          for (const rounds of roundIds) {
            if (rounds.action === 'credit') {
              totalCreditAmount += Number(rounds.amount);
            }
            if (rounds.action === 'debit') {
              totalDebitAmount += Number(rounds.amount);
            }
            if (rounds.action === 'rollback') {
              totalRollBackAmount += Number(rounds.amount);
            }
          }
          console.log("totalDebitAmount-------------------------------->>>>>>>>>>>", totalDebitAmount);
          console.log("totalDebitAmount-------------------------------->>>>>>>>>>>", totalDebitAmount);
          console.log("totalDebitAmount-------------------------------->>>>>>>>>>>", totalDebitAmount);
          console.log("totalDebitAmount-------------------------------->>>>>>>>>>>", totalDebitAmount);
          console.log("totalDebitAmount-------------------------------->>>>>>>>>>>", totalDebitAmount);
          console.log("totalDebitAmount-------------------------------->>>>>>>>>>>", totalDebitAmount);
          console.log("totalDebitAmount-------------------------------->>>>>>>>>>>", totalDebitAmount);
          console.log("totalDebitAmount-------------------------------->>>>>>>>>>>", totalDebitAmount);
          console.log("totalDebitAmount-------------------------------->>>>>>>>>>>", totalDebitAmount);
          console.log("totalDebitAmount-------------------------------->>>>>>>>>>>", totalDebitAmount);
          console.log("totalDebitAmount-------------------------------->>>>>>>>>>>", totalDebitAmount);
          console.log("totalDebitAmount-------------------------------->>>>>>>>>>>", totalDebitAmount);
          console.log("userRecord.exposure -------------------------------->>>>>>>>>>>", userRecord.exposure);
          console.log("totalDebitAmount * casinoMultiples-------------------------------->>>>>>>>>>>", totalDebitAmount * casinoMultiples);

          console.log("userRecord.exposure + (totalDebitAmount * casinoMultiples)-------------------------------->>>>>>>>>>>", userRecord.exposure + (totalDebitAmount * casinoMultiples));

          totalCreditAmount += totalRollBackAmount;
          differenceDbCr = (totalCreditAmount - totalDebitAmount) * casinoMultiples;

          let AccumulativeDebit = totalDebitAmount * casinoMultiples;
          const updatedAvailableBalance = userRecord.availableBalance + (totalCreditAmount * casinoMultiples);
          const lastMaxWithdraw = await Cash.findOne({ userId: userRecord.userId }).sort({ _id: -1 });

          await Cash.create([{
            userId: userRecord.userId,
            description: `Casino (${tran.game_id})`,
            date: new Date().getTime(),
            amount: differenceDbCr,
            balance: lastMaxWithdraw.balance + differenceDbCr,
            availableBalance: lastMaxWithdraw.availableBalance + differenceDbCr,
            maxWithdraw: lastMaxWithdraw.maxWithdraw + differenceDbCr,
            roundId: tran._id,
            betId: tran._id,
            updatedExposure: userRecord.exposure + (totalDebitAmount * casinoMultiples),
            credit: lastMaxWithdraw ? lastMaxWithdraw.credit : 0,
            creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining : 0,
            cashOrCredit: "Casino Bet",
            sportsId: "6",
            createdAt: formattedDate,
            event: tran.game_id,
            marketId: tran._id,
            matchId: tran.game_id,
          }], { session });

          await users.updateOne({ _id: userRecord._id }, {
            $set: {
              balance: userRecord.clientPL + differenceDbCr,
              clientPL: userRecord.clientPL + differenceDbCr,
              availableBalance: updatedAvailableBalance,
              exposure: userRecord.exposure + (totalDebitAmount * casinoMultiples),
          }
          }, { session });


          let expPositiveData;

          expPositiveData = await expPositive.findOne({ userId: userRecord.userId, roundId: tran._id });

          if (expPositiveData) {
            await expPositive.updateMany(
              {
                userId: userRecord.userId, roundId: tran._id
              },
              {
                expReleased: (totalDebitAmount * casinoMultiples),
                expReleasedC: (totalDebitAmount * casinoMultiples),
                expAfterRelease: userRecord.exposure + (totalDebitAmount * casinoMultiples),
                AbAtRelease: updatedAvailableBalance

              },
              { session }
            );
          }




          await CasinoCalls.updateMany({ round_id: tran._id.toString() }, { $set: { isProcessing: false } }, { session });
          await CasinoCalls.deleteMany({ round_id: tran._id.toString() }, { session });
          await CasinoCallsPayload.deleteMany({ round_id: tran._id.toString() }, { session });
          // Parent Settlements Logic (continued as before, with added retry handling)
          let retries2 = 0;
          const maxRetries2 = 3;

          while (retries2 < maxRetries2) {
            const session2 = await mongoose.startSession();
            session2.startTransaction();

            try {
              const parentUserIds = await getParents(userRecord.userId);
              const parentUser = await User.find({
                userId: { $in: parentUserIds },
                isDeleted: false
              }).sort({ userId: -1 }).session(session2);

              if (!parentUser) {
                console.error('Error: Parent Users Not Found');
                await session2.abortTransaction();
                session2.endSession();
                return;
              }

              // Process parent settlements (same logic for commission, exposure, etc.)

              let NeutralselectedRunnerAmount = Math.abs(differenceDbCr);
              let upMovingAmount = NeutralselectedRunnerAmount;
              let totalRemainingAmount = differenceDbCr;
              let remainingAmount = NeutralselectedRunnerAmount;
              let commissionAmount = 0;
              let upMovingCommAmount = 0;

              let prev = 0;
              for (const user of parentUser) {
                let current = user.downLineShare;
                user['commission'] = current - prev;
                prev = current;
              }

              let commissionFrom = userRecord.userId;

              for (const user of parentUser) {
                let winningsShareAmount = Number(((user.commission / 100) * remainingAmount).toFixed(3));
                let loosingShareAmount = Number(((user.commission / 100) * remainingAmount).toFixed(3));
                let exposureAmountShare = Number(((user.commission / 100) * AccumulativeDebit).toFixed(3));
                let UpdatedExposureAmount = user.exposure + exposureAmountShare;
                let UpdatedAvailableBalance = user.availableBalance;

                let totalClientPLAmount;
                let userBalance;
                let totalBalance = user.balance;
                let totalClientPL = user.clientPL;
                let upLineAmount = 0;

                if (differenceDbCr == 0) {
                  UpdatedAvailableBalance = user.availableBalance + exposureAmountShare;
                }
                else if (differenceDbCr < 0) {
                  UpdatedAvailableBalance = user.availableBalance + winningsShareAmount;
                  UpdatedAvailableBalance = UpdatedAvailableBalance + loosingShareAmount;

                  totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount).toFixed(3)) : 0;
                  userBalance = totalClientPLAmount;

                  totalBalance = Number((user.balance + Number(((user.commission / 100) * remainingAmount).toFixed(3))).toFixed(3));
                  totalClientPL = Number((user.clientPL + (-totalClientPLAmount)).toFixed(3));
                  upLineAmount = -totalClientPLAmount;
                } else {
                  totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount).toFixed(3)) : 0;

                  userBalance = totalClientPLAmount;
                  totalBalance = Number((user.balance - Number(((user.commission / 100) * remainingAmount).toFixed(3))).toFixed(3));
                  totalClientPL = Number((user.clientPL + totalClientPLAmount).toFixed(3));
                  upLineAmount = totalClientPLAmount;
                }

                // Update user in the parentUser array in the transaction
                await User.updateOne(
                  {
                    userId: user.userId,
                    isDeleted: false
                  },
                  {
                    balance: totalBalance,
                    exposure: UpdatedExposureAmount,
                    availableBalance: totalBalance + UpdatedExposureAmount,
                    clientPL: totalClientPL
                  }, { session2 }
                );

                let expPositiveDataP = await expPositive.findOne({ userId: user.userId, roundId: tran._id }).session(session2);

                if (expPositiveDataP) {
                  await expPositive.updateOne(
                    {
                      userId: user.userId, roundId: tran._id
                    },
                    {
                      expReleased: exposureAmountShare,
                    },
                    { session2 }
                  );
                }

                let amount = -(user.commission / 100) * totalRemainingAmount;
                let Dbalance = amount;
                let DavailableBalance = amount;

                const shareNUpline = amount > 0 ? (Math.abs(amount) + Math.abs(upLineAmount)) : -(Math.abs(amount) + Math.abs(upLineAmount));

                const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 }).session(session2);

                if (lastMaxWithdraw) {
                  Dbalance = lastMaxWithdraw.balance + amount;
                  DavailableBalance = lastMaxWithdraw.availableBalance + amount;
                }

                let DmaxWithdraw = lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + amount : -(amount);

                let DCash = lastMaxWithdraw ? lastMaxWithdraw.cash : 0;
                let Dcredit = lastMaxWithdraw?.credit || 0;
                let DcreditRemaining = lastMaxWithdraw?.creditRemaining || 0;

                // Create Cash record in the transaction
                await Cash.create([{
                  userId: user.userId,
                  // description: `Casino (${CgameName})`,
                  description: `Casino`,
                  createdBy: 0,
                  amount: amount,
                  balance: Dbalance,
                  availableBalance: DavailableBalance,
                  maxWithdraw: DmaxWithdraw,
                  cash: DCash,
                  credit: Dcredit,
                  creditRemaining: DcreditRemaining,
                  marketId: tran._id,
                  cashOrCredit: 'Casino Bet',
                  commissionFrom: commissionFrom,
                  sportsId: "6",
                  shareNUpline: shareNUpline,
                  upLineAmount: upLineAmount,
                  betId: tran._id,
                  //matchId: Cgame_id,
                  matchId: 'Cgame_id',
                  betDateTime: new Date().getTime(),
                  date: new Date().getTime(),
                  createdAt: formattedDate,
                  totalRemainingAmount: totalRemainingAmount,
                  commissionAmount: commissionAmount,
                  remainingAmount: remainingAmount,
                  roundId: tran._id
                }], { session2 });



                upMovingAmount = Number((upMovingAmount - (user.commission / 100) * totalRemainingAmount).toFixed(3));
              }

              // Update user balances, create cash entries, etc.

              await session2.commitTransaction();
              session2.endSession();
              break;  // Exit loop if transaction succeeds
            } catch (error) {
              console.error('Transaction Error in parent settlements:', error);

              if (retries2 < maxRetries2) {
                retries2++;
                console.log(`Retrying parent transaction... attempt ${retries2}`);
                await session2.abortTransaction();
                session2.endSession();
                continue; // Retry the transaction
              } else {
                console.error('Max retries reached for parent transactions.');
                await session2.abortTransaction();
                session2.endSession();
                break;  // Exit loop if error persists
              }
            }
          }

          // Commit the transaction if everything is successful
          await session.commitTransaction();
          session.endSession();
          break; // Exit loop after a successful commit

        } else {
          ///console.log("Duplicate transaction found, skipping insertion.");
          await session.commitTransaction();  // Commit before continuing if duplicate found
          session.endSession();
          continue; // Skip if transaction already exists
        }
      } catch (error) {
        console.error('Transaction Error:', error);

        if (retries < maxRetries) {
          retries++;
          console.log(`Retrying transaction... attempt ${retries}`);
          await session.abortTransaction();  // Abort the current transaction before retrying
          session.endSession();  // End session before retrying
          continue; // Retry the transaction
        } else {
          console.error('Max retries reached. Aborting transaction.');
          await session.abortTransaction();  // Abort the transaction after max retries
          session.endSession();  // Ensure session ends even after the max retries
          break; // Exit the loop if the error persists
        }
      }
    }
  }




}


const WinLoseTransManagement = async (balance, payload, users123, action, res, session) => {
  try {
    const user = await users.findOne({ remoteId: Number(payload.remote_id) });
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    if (action === 0) {

    } else if (action === 1) {

      const user_prev_balance = user.balance;
      const user_prev_availableBalance = user.availableBalance;
      const user_prev_exposure = user.exposure;

      const gamesList = await SelectedCasino.findOne(
        { "games.id": payload.game_id },
        { "games.$": 1 }
      );

      const game = gamesList?.games[0];
      console.log("")
      if (game.isAllowed === false) {
        return res.status(400).send({ message: "This game is not allowed!!" })
      }

      const casinoDebits = new CasinoDebits({
        ...payload,                // Spread the existing keys from payload
        createdAt: new Date().getTime(),     // Set the current time for createdAt
      });
      await casinoDebits.save();





      const lastDebits = await CasinoDebits.find({
        action: 'debit',
        game_id: payload.game_id,
        round_id: payload.round_id,
        remote_id: Number(payload.remote_id)
      });

      let debit = 0;
      // for (const lastDebit of lastDebits) {
      //   debit = debit + Number(lastDebit.amount)
      // }

      const credit = Number(payload.amount);
      const difference = credit - debit;
      //console.log("debit==============>?",debit)
      //console.log("credit==============>?",credit)
      const allTrans = [];
      // lose some Amount 
      const betTime = new Date().getTime();

    }
  } catch (err) {
    // console.warn(`Error in Calculation ${err}`);
    return 1;
  }
}



function createHashKey(salt, queryString) {
  return crypto.createHash('sha1').update(salt + queryString).digest('hex');
}


async function balanceFun(req, res) {
  //console.log("balanceeeeeeeeeeee Arham ------------")
  const payload = req.query;
  const salt = saltKey;
  const key = payload.key;
  delete payload.key;

  const queryString = Object.keys(payload)
    .map(key => `${key}=${payload[key]}`)
    .join('&');

  const hash = createHashKey(salt, queryString);


  if (hash !== key) {
    return res.json({
      status: 403,
      msg: 'INCORRECT_KEY_VALIDATION'
    });
  }

  try {
    const user = await User.findOne({ remoteId: payload.remote_id }).exec();
    const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });

    if (!user) {
      return res.json({ status: 500, msg: 'Internal error no user' });
    }

    const checkMarketBlockedResponse = await checkMarketBlocked(user);
    // //console.log(user.availableBalance,"arham --------- balance",checkMarketBlockedResponse,"checkMarketBlockedResponse arham")
    if (checkMarketBlockedResponse == 1) {
      return res.json({ status: '500', msg: ' Batting is not allowed ! ' });
    }


    const balance = user.availableBalance;

    if (balance < 0 || lastMaxWithdraw.availableBalance <= 0 || user.exposure > 0) {
      // //console.log('Balance is negative:', balance); // Log for debugging
      return res.json({ status: 500, msg: 'Negative amount not allowed!' });
    }

    // //console.log('Balance before division:', balance); // Debug log
    // //console.log('Casino Multiples:', casinoMultiples); // Debug log
    const finalBalance = balance / casinoMultiples;
    // //console.log('Final balance to return:', finalBalance); // Debug log

    return res.json({
      status: 200,
      balance: finalBalance,
    });
  } catch (err) {
    // console.error(err);
    return res.json({ status: 500, msg: `Internal error ${err}` });
  }
}
// async function calculateExposure(userId) {
//   try {
//     // Fetch all bets related to the user
//     const bets = await casinoCalls.find({ remoteId: userId });

//     // Calculate the total exposure
//     const totalExposure = bets.reduce((acc, bet) => acc + bet.exposure, 0);

//     return totalExposure;
//   } catch (err) {
//     console.error('Failed to calculate exposure:', err);
//     throw new Error('Error calculating exposure');
//   }
// }
const requestQueue = []; // Queue to hold incoming requests
let processing = false;  // Flag to indicate if a request is being processed

async function processQueue() {
  if (processing || requestQueue.length === 0) return;
  processing = true;

  const { req, res, retryCount = 0 } = requestQueue.shift(); // Get the next request from the queue
  console.log("hereeeeeeeeeeee 1")
  const session = dbClient.startSession();
  const maxRetries = 3; // Maximum retry attempts
  const retryDelay = 100; // Delay in milliseconds before retrying
  const payload = req.query;

  const attemptTransaction = async (retryCount) => {
    try {
      await session.startTransaction();

      const transactionId = payload.transaction_id;

      const currentUser = await User.findOne({ remoteId: parseInt(payload.remote_id) });
      if (payload.gameplay_final == 1 || !payload.remote_id) {
        await User.updateOne({ remoteId: currentUser.remote_id }, { $set: { exposure: 0 } })
      }
      if (!currentUser) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        return res.json({ status: 500, msg: 'Internal Error: no User' });
      }

      if (transactionIdMap.has(transactionId)) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        return res.json({
          status: 200,
          balance: currentUser.availableBalance / casinoMultiples,
        });
      } else {
        transactionIdMap.set(transactionId, transactionId);
      }

      const salt = saltKey;
      const key = payload.key;
      delete payload.key;
      const queryString = Object.keys(payload)
        .map(key => `${key}=${payload[key]}`)
        .join('&');
      const hash = createHashKey(salt, queryString);

      // Validate the key
      if (hash !== key) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        return res.json({
          status: 403,
          msg: 'INCORRECT_KEY_VALIDATION'
        });
      }

      // Fetch the user again for the transaction
      const user = await users.findOne({ remoteId: parseInt(payload.remote_id) }, { session });
      if (!user) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        return res.json({ status: 500, msg: 'Internal error: no user' });
      }

      const checkMarketBlockedResponse = await checkMarketBlocked(user);
      if (checkMarketBlockedResponse == 1) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        return res.json({ status: 500, msg: 'Betting is not allowed!' });
      }
      console.log("= user.availableBalance..........................", user.availableBalance);
      console.log("(parseInt(payload.amount) * casinoMultiples)..........................", payload.amount * casinoMultiples);
      let updatedAvailableBalance = user.availableBalance - (parseInt(payload.amount) * casinoMultiples);
      if (updatedAvailableBalance < 0) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        return res.json({ status: 500, msg: 'Insufficient balance.' });
      }

      const balance = user.availableBalance / casinoMultiples;

      if (payload.action === 'debit' || payload.action === 'credit' || payload.action === 'rollback') {
        let idExists3 = await CasinoCallsPayload.findOne({ transaction_id: payload.transaction_id });
        if (!idExists3) {
          const c = await new CasinoCallsPayload(payload)

          //console.log("c.........................",c);

          c.save()
        }
      } else {
        const c = await new CasinoCallsPayload(payload)

        c.save()
      }

      //await WinLoseTransManagement(balance, payload, user, 0, res);
      //Here must be added to payloads....



      await session.commitTransaction();

      const updatedUser = await users.findOne({ remoteId: parseInt(payload.remote_id) });
      return res.json({
        status: 200,
        balance: updatedUser.availableBalance / casinoMultiples
      });

    } catch (err) {
      if (session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortErr) {
          console.error('Error aborting transaction:', abortErr);
        }
      }
      if (retryCount < maxRetries) {
        //console.log(`Retry attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay)); // Delay before retry
        return attemptTransaction(retryCount + 1);
      } else {
        console.error('Transaction failed after retries:', err);
        return res.json({ status: 500, msg: `Internal error: ${err}` });
      }
    } finally {
      await session.endSession();
      processing = false;
      processQueue();
    }
  };

  return attemptTransaction(retryCount);
}


// async function settleExposure(user) {
//   try {
//     const exposure = await calculateExposure(user.remoteId);
//     if (exposure > 0) {
//       await User.updateOne(
//         { remoteId: user.remoteId },
//         { $set: { exposure: 0 } } 
//       );
//     }
//   } catch (err) {
//     console.error('Failed to settle exposure:', err);
//   }
// }
async function debitFun(req, res) {
  //console.log("debitttttttttttttttttttttttt fun arhammmmmmmmmmmmmmm")
  requestQueue.push({ req, res });
  const payload = req.query;
  const gamesList = await SelectedCasino.findOne(
    { "games.id": payload.game_id },
    { "games.$": 1 }
  );

  const game = gamesList?.games[0];
  console.log("")
  if (game?.isAllowed === false) {
    return res.status(400).send({ message: "This game is not allowed!!" })
  }
  if (!processing) {
    processQueue();
  }
}




async function creditFun(req, res) {

  //console.log("crediiiiiiiiiiiiiiiit arham ")
  const session = dbClient.startSession();
  try {
    const payload = req.query;
    const transactionId = payload.transaction_id

    const currentUser = await User.findOne(
      { remoteId: parseInt(payload.remote_id) }
    )
    if (!currentUser) {
      return res.json({ status: '500', msg: `Internal Error no User` });
    }
    if (transactionIdMap.has(transactionId)) {

      return res.json({
        status: 200,
        balance: currentUser.availableBalance / casinoMultiples,
      });
    } else {
      transactionIdMap.set(transactionId, transactionId)
    }


    const salt = saltKey;
    const key = payload.key;
    delete payload.key;

    const queryString = Object.keys(payload).map(key => `${key}=${payload[key]}`).join('&');


    const hash = createHashKey(salt, queryString);

    if (hash !== key) {
      return res.json({
        status: 403,
        msg: 'INCORRECT_KEY_VALIDATION'
      });
    }
    const user = await users.findOne(
      { remoteId: parseInt(payload.remote_id) },
      { session, readPreference: 'primary' }
    );
    if (!user) {
      await session.abortTransaction();
      return res.json({ status: '500', msg: `Internal Error no User` });
    }

    const checkMarketBlockedResponse = await checkMarketBlocked(user);
    if (checkMarketBlockedResponse == 1) {
      await session.abortTransaction();
      return res.json({ status: '500', msg: 'Batting is not allowed !' });
    }


    await session.withTransaction(async () => {
      if (parseInt(payload.amount) < 0) {
        await session.abortTransaction();
        return res.json({
          status: 500,
          balance: user.availableBalance / casinoMultiples
        });
      } else {

        if (payload.action === 'debit' || payload.action === 'credit' || payload.action === 'rollback') {
          let idExists3 = await CasinoCallsPayload.findOne({ transaction_id: payload.transaction_id });
          if (!idExists3) {
            const c = await new CasinoCallsPayload(payload)

            //console.log("c.........................",c);

            c.save()
          }
        } else {
          const c = await new CasinoCallsPayload(payload)

          c.save()
        }

        //const response = await WinLoseTransManagement(0, payload, user, 1, res, session);
        await session.commitTransaction();
      }
    }, transactionOptions);

    const updatedUser = await users.findOne(
      { remoteId: parseInt(payload.remote_id) },
      { session }
    )
    return res.json({
      status: 200,
      balance: updatedUser.availableBalance / casinoMultiples
    });

  } catch (err) {

    return res.json({ status: 500, msg: `Internal error ${err}` });
  } finally {
    await session.endSession();
  }
}

async function rollbackFun(req, res) {

  //console.log("rooooooooooooooooolllllllback arham ")
  const session = dbClient.startSession();
  try {
    const payload = req.query;
    const salt = saltKey;
    const key = payload.key;
    delete payload.key;
    const queryString = Object.keys(payload)
      .map(key => `${key}=${payload[key]}`)
      .join('&');
    const hash = createHashKey(salt, queryString);
    if (hash !== key) {
      return res.json({
        status: 403,
        msg: 'INCORRECT_KEY_VALIDATION'
      });
    }

    let updatedBalance = 0;
    if (payload.action === 'rollback') {
      await session.withTransaction(async () => {
        const sameTransId = await casinoCalls.countDocuments(
          {
            transaction_id: payload.transaction_id,
            remote_id: parseInt(payload.remote_id),
            // round_id: payload.round_id,
          },
          { session }
        );
        const user = await One(
          { remoteId: parseInt(payload.remote_id) },
          { session }
        );
        if (!user) {
          await session.abortTransaction();
          return res.json({ status: '500', msg: `Internal error User Not Found` });
        } else if (sameTransId > 1) {
          await session.abortTransaction();
          return res.json({
            status: 200,
            balance: user.availableBalance / casinoMultiples,
          });
        } else {





          if (payload.action === 'debit' || payload.action === 'credit' || payload.action === 'rollback') {
            let idExists3 = await CasinoCallsPayload.findOne({ transaction_id: payload.transaction_id });
            if (!idExists3) {
              const c = await new CasinoCallsPayload(payload)

              //console.log("c.........................",c);

              c.save()
            }
          } else {
            const c = await new CasinoCallsPayload(payload)

            c.save()
          }


          return res.json({
            status: 200,
            balance: updatedUser.availableBalance / casinoMultiples
          });
        }

      }, transactionOptions);
      await session.endSession();
    } else {
      const newUpdatedUser = await users.findOne(
        { remoteId: parseInt(payload.remote_id) }
      );
      if (!newUpdatedUser) {
        return res.json({ status: '500', msg: `Internal error: User Not Found` });
      } else {
        return res.json({
          status: 404,
          balance: newUpdatedUser.availableBalance / casinoMultiples
        });
      }
    }
  } catch (err) {
    await session.abortTransaction();

    return res.json({
      status: 500,
      msg: `Internal error ${err}`
    });
  } finally {
    await session.endSession()
  }
}

//////////orio casinos work///////////
async function BalanceO(req, res) {


  // Sending the POST request using Axios
  axios.post(url, data, { headers })
    .then(response => {
      console.log('balance Response:', response.data);
    })
    .catch(error => {
      console.error('Error occurred:', error.response ? error.response.data : error.message);
    });
}
async function CreditO(req, res) {


  // Sending the POST request using Axios
  axios.post(url, data, { headers })
    .then(response => {
      console.log('credit Response:', response.data);
    })
    .catch(error => {
      console.error('Error occurred:', error.response ? error.response.data : error.message);
    });
}

async function debitO(req, res) {


  // Sending the POST request using Axios
  axios.post(url, data, { headers })
    .then(response => {
      console.log('debitO Response:', response.data);
    })
    .catch(error => {
      console.error('Error occurred:', error.response ? error.response.data : error.message);
    });
}


async function getGamesByProviderName(req, res) {
  // const url = 'https://stageapi.worldcasinoonline.com/api/games?partnerKey=uGT24/SXjsKcwBLu9iFoC43mX102ggFcH+KNWM9FITuSXHMEO44AkWBuJ+paSRCLz9W1sIxdHiQ=&providerCode=null';



  // const response = await axios.get(url);

  // return res.json({
  //   success: true,
  //   message: 'getting Data Found successfully',
  //   results: response
  // });

  const url = 'https://stageapi.worldcasinoonline.com/api/games';

  const data = {
    partnerKey: "uGT24/SXjsKcwBLu9iFoC43mX102ggFcH+KNWM9FITuSXHMEO44AkWBuJ+paSRCLz9W1sIxdHiQ=",
    providerCode: null  // Use null instead of "SN"
  };

  const headers = {
    'Content-Type': 'application/json'
  };

  const timeoutDuration = 30000;  // 30 seconds timeout

  axios.post(url, data, { headers, timeout: timeoutDuration })
    .then(response => {
      console.log('Products available Response:', response.data);
    })
    .catch(error => {
      if (error.response) {
        console.error('Server responded with error:', error.response.data);
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error setting up the request:', error.message);
      }
    });


}

async function Oracasino(req, res) {

  return res.status(400).json({ success: false, message: "Here is resonse.{}" });

}

async function OracasinoAuth(req, res) {
  const url = 'https://stageapiauth.worldcasinoonline.com/api/auth/userauthentication';

  const data = {
    partnerKey: "uGT24/SXjsKcwBLu9iFoC43mX102ggFcH+KNWM9FITuSXHMEO44AkWBuJ+paSRCLz9W1sIxdHiQ=",
    game: {
      gameCode: "TP",
      providerCode: "SN"
    },
    timestamp: "1624862458",
    user: {
      id: "1obetBMC",
      currency: "INR",
      displayName: "Qaiser",
      backUrl: "https://production.1obet.net/api/Oracasino"
    }
  };

  const headers = {
    'Content-Type': 'application/json'  // Make sure the content type is set to JSON
  };

  // Sending the POST request using Axios
  axios.post(url, data, { headers })
    .then(response => {
      console.log('Authentication Response:', response.data);
    })
    .catch(error => {
      console.error('Error occurred:', error.response ? error.response.data : error.message);
    });
}


async function casino(req, res) {
  const { action, remote_id } = req.query;
  if (!remote_id || !action) {
    return res.send({ status: '400', msg: 'Invalid Request' });
  }
  const payload1 = req.query
  switch (action) {

    case 'balance':
      return balanceFun(req, res);
    case 'debit':
      return debitFun(req, res);
    case 'credit':
      return creditFun(req, res);
    case 'rollback':
      return rollbackFun(req, res);
    default:
      return res.send({ status: '400', msg: 'Invalid action' });
  }

}

// Start the server


async function casinoListing(req, res) {
  let { startDate, endDate } = req.body;

  // If startDate or endDate are not provided, default to the last 24 hours
  const now = new Date();
  if (startDate == endDate) {
    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).getTime();
    console.log("startDate", startDate)
    endDate = now.getTime()
    console.log("endDate", endDate)
  } else {
    startDate = new Date(startDate).getTime();
    endDate = new Date(endDate).getTime();
    console.log("startDate in else", startDate)
    console.log("endDate in else", endDate)
  }


  const Datetime = startDate;
  const eDate = endDate;

  if (isNaN(Datetime) || isNaN(eDate)) {
    return res.status(400).send({ message: "Invalid date or endDate format" });
  }

  try {
    let missingRecords = []
    const missingTransCalls = await CasinoCallsPayload.aggregate([
      {
        $match: {
          isProcessing: true,
          action: { $in: ["debit", "credit", "rollback"] }
        }
      },
      {
        $lookup: {
          from: 'casinocalls',
          localField: 'transaction_id',
          foreignField: 'transaction_id',
          as: 'matchedRecords'
        }
      },
      {
        $match: {
          matchedRecords: { $size: 0 },
        }
      },
      {
        $project: {
          transaction_id: 1,
          round_id: 1,
          action: 1,
          callerId: 1,
          callerPassword: 1,
          callerPrefix: 1,
          username: 1,
          remote_id: 1,
          amount: 1,
          provider: 1,
          game_id: 1,
          gameplay_final: 1,
          session_id: 1,
          gamesession_id: 1,
          is_freeround_bet: 1,
          jackpot_contribution_in_amount: 1,
          jackpot_contribution_ids: 1,
          jackpot_contribution_per_id: 1,
          game_id_hash: 1,
          jackpot_win_ids: 1,
          createdAt: 1,
          isProcessing: 1,
          comingFrom: 1,
        }
      }
    ])
    const missingTransPayloads = await CasinoCalls.aggregate([
      {
        $match: {
          isProcessing: true,
          action: { $in: ["debit", "credit", "rollback"] }
        }
      },
      {
        $lookup: {
          from: 'casinocallspayloads',
          localField: 'transaction_id',
          foreignField: 'transaction_id',
          as: 'matchedRecords'
        }
      },
      {
        $match: {
          matchedRecords: { $size: 0 },
          // action: { $in: ["debit", "credit", "rollback"] }
        }
      },
      {
        $project: {
          transaction_id: 1,
          round_id: 1,
          action: 1,
          callerId: 1,
          callerPassword: 1,
          callerPrefix: 1,
          username: 1,
          remote_id: 1,
          amount: 1,
          provider: 1,
          game_id: 1,
          gameplay_final: 1,
          session_id: 1,
          gamesession_id: 1,
          is_freeround_bet: 1,
          jackpot_contribution_in_amount: 1,
          jackpot_contribution_ids: 1,
          jackpot_contribution_per_id: 1,
          game_id_hash: 1,
          jackpot_win_ids: 1,
          createdAt: 1,
          isProcessing: 1,
          comingFrom: 1,
        }
      }
    ])

    missingRecords.push(...missingTransCalls, ...missingTransPayloads)

    res.status(200).json({
      success: true,
      message: 'casinoListing fetched successfully',
      data: missingRecords,

    });
  } catch (error) {
    console.error("Error in casinoListing:", error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

async function insertMissingTransactions() {
  const session = await mongoose.startSession();
  let Settings1
  Settings1 = await Settings.findOne({ settingKey: 'isCasinoCallsRunning', settingValue: '1' })

  console.log(Settings1);
  if (Settings1) {
    console.log("I have found 1 in settings................");
    session.endSession();
    return
  }
  try {
    session.startTransaction();
    await Settings.findOneAndUpdate({ settingKey: 'isCasinoCallsRunning' }, { $set: { settingValue: '1' } }, { session });
    // await CasinoCallsPayload.updateMany(
    //   { action: { $in: ["debit", "credit", "rollback"] } },
    //   { $set: { isUsed: false } }
    // ).session(session);
    console.log("Reset isUsed: false for all relevant records.");

    const casinoMultiples = 5;
    const payloads = await CasinoCallsPayload.find({
      action: { $in: ["debit", "credit", "rollback"] },
      isUsed: false,
    })
      .sort({ lastDateTime: 1 })  // Sort by lastCheckCalls in ascending order (use -1 for descending order)
      .limit(5)  // Fetch only 5 records
      .session(session);

    if (payloads.length === 0) {
      await session.abortTransaction();
      return;
    }

    await CasinoCallsPayload.updateMany(
      { _id: { $in: payloads.map(payload => payload._id) } },
      { $set: { lastCheckedTime: Date.now() } },
      { session } // Use the same session for consistency
    );



    for (const payload of payloads) {
      try {
        const { transaction_id, action, username, amount } = payload;

        const existingTransaction = await CasinoCalls.findOneAndUpdate(
          { transaction_id },
          { $setOnInsert: payload.toObject() },
          { upsert: true, new: false, session }
        );

        await CasinoCallsPayload.updateOne(
          { transaction_id },
          { $set: { isUsed: true } },
          { session }
        );


        if (existingTransaction) {
          console.log(`Transaction ${transaction_id} already exists in casinocalls.`);

          continue;
        }

        if (action === "debit") {
          const userIdMatch = username.match(/user_(\d+)/);
          const userId = userIdMatch ? parseInt(userIdMatch[1], 10) : null;
          if (!userId) continue;

          const user = await User.findOne({ userId }).session(session);
          if (user) {
            const amountWithMultiples = Number(amount) * casinoMultiples;
            if (user.exposure > 0) throw new Error("Exposure cannot be positive.");
            const updatedExposure = user.exposure - amountWithMultiples;
            const updatedAvailableBalance = user.availableBalance - amountWithMultiples;

            await User.updateOne(
              { userId },
              { $set: { availableBalance: updatedAvailableBalance, exposure: updatedExposure } },
              { session }
            );
            // Handle exposure for parent users
            let parentUserIds = await getParents(user.userId);
            const parentUsers = await User.find({ userId: { $in: parentUserIds }, isDeleted: false }).sort({ userId: -1 }).session(session);

            let dealerExposures = amountWithMultiples;
            let prev = 0;

            for (const parent of parentUsers) {
              let current = parent.downLineShare;
              let commission = current - prev;
              prev = current;

              let shareAmountInLoss = (commission / 100) * dealerExposures;
              let finalShareAmountInLoss = Number(shareAmountInLoss);

              let userExposureNew = parent.exposure - finalShareAmountInLoss;
              let userAvailableBalanceNew = parent.availableBalance - finalShareAmountInLoss;

              await User.updateOne(
                {
                  userId: parent.userId
                },
                {
                  $set: {
                    availableBalance: userAvailableBalanceNew,
                    exposure: userExposureNew
                  }
                },
                { session }
              );
              await expPositive.create([{
                userId: parent.userId,
                userRole: parent.role,
                userFrom: user.userId,
                betId: transaction_id,
                roundId: payload.round_id,
                source: 'CasinodebitFun',
                expCaptured: finalShareAmountInLoss
              }], { session });
              console.log(`Updated parent user ${parent.userId}: exposure=${userExposureNew}, availableBalance=${userAvailableBalanceNew}.`);
            }
          }
        }

      } catch (error) {
        console.error(`Error processing transaction_id ${payload.transaction_id}:`, error);
        continue;
      }
    }

    await Settings.findOneAndUpdate({ settingKey: 'isCasinoCallsRunning' }, { $set: { settingValue: '0' } }, { session });
    await session.commitTransaction();
  } catch (error) {
    console.error("Error processing casino transactions:", error);
    await session.abortTransaction();
  } finally {
    session.endSession();
  }
}

const insertMissingTransactions1 = async (req, res) => {
  let newCasinoCall;
  try {


    // const matchedDocs =  await CasinoCallsPayload.aggregate([
    //   {
    //     $match: {
    //       action: { $in: ["debit", "credit","rollback"] },
    //       //isUsed:false
    //       //username:"user_45112"// Filter for action being "debit" or "credit"
    //     }
    //   },
    //   {
    //     $lookup: {
    //       from: "casinocalls",  // the name of the other collection
    //       let: { 
    //         roundId: "$round_id", 
    //         username: "$username", 
    //         transactionId: "$transaction_id"
    //       }, // pass local fields for comparison
    //       pipeline: [
    //         {
    //           $match: {
    //             $expr: {
    //               $and: [
    //                 { $eq: ["$round_id", "$$roundId"] },        // Match round_id
    //                 { $eq: ["$username", "$$username"] },        // Match username
    //                 { $eq: ["$transaction_id", "$$transactionId"] }  // Match transaction_id
    //               ]
    //             }
    //           }
    //         }
    //       ],
    //       as: "matched_payloads"  // Alias for matched documents from casinocallspayloads
    //     }
    //   },
    //   {
    //     $match: {
    //       "matched_payloads": { $size: 0 }  // No matches in casinocallspayloads
    //     }
    //   }
    // ]);

    const matchedDocs = await CasinoCallsPayload.find({
      action: { $in: ["debit", "credit", "rollback"] },
      username: "user_45793",
      isUsed: false
    });
    //console.log("---------------------------------------------------",matchedDocs);
    try {
      const duplicates = await CasinoCalls.aggregate([
        {
          $group: {
            _id: "$transaction_id",
            ids: { $push: "$_id" },
            count: { $sum: 1 }
          }
        },
        { $match: { count: { $gt: 1 } } } // Find groups with more than one document
      ]);

      for (const duplicate of duplicates) {
        const [keepId, ...removeIds] = duplicate.ids;

        // Remove all but the first document for this transaction_id
        await CasinoCalls.deleteMany({ _id: { $in: removeIds } });

        console.log(`Cleaned up duplicates for transaction_id: ${duplicate._id}`);
      }
    } catch (error) {
      console.error('Error removing duplicates:', error);
    }


    if (!matchedDocs || matchedDocs.length === 0) {
      console.log('No transactions found for the given round_id and username.');
      return;
    }

    //  console.log("++++++++++++++++++++++++ going to save data in casinocalls");
    const session = await mongoose.startSession();



    for (const doc of matchedDocs) {
      if (doc.username == 'user_45793') {
        console.log("doc.username------------------------------------", doc.username);
        console.log("doc.action------------------------------------", doc.action);
        console.log("doc.isUsed------------------------------------", doc.isUsed);
        console.log("=========================================");
        console.log("doc.username------------------------------------", doc.username);
        console.log("doc.action------------------------------------", doc.action);
        console.log("doc.isUsed------------------------------------", doc.isUsed);
        console.log("=========================================");
        console.log("doc.username------------------------------------", doc.username);
        console.log("doc.action------------------------------------", doc.action);
        console.log("doc.isUsed------------------------------------", doc.isUsed);
        console.log("=========================================");
        console.log("doc.username------------------------------------", doc.username);
        console.log("doc.action------------------------------------", doc.action);
        console.log("doc.isUsed------------------------------------", doc.isUsed);
        console.log("=========================================");
        console.log("doc.username------------------------------------", doc.username);
        console.log("doc.action------------------------------------", doc.action);
        console.log("doc.isUsed------------------------------------", doc.isUsed);
        console.log("=========================================");
        console.log("doc.username------------------------------------", doc.username);
        console.log("doc.action------------------------------------", doc.action);
        console.log("doc.isUsed------------------------------------", doc.isUsed);
        console.log("=========================================");
        console.log("doc.username------------------------------------", doc.username);
        console.log("doc.action------------------------------------", doc.action);
        console.log("doc.isUsed------------------------------------", doc.isUsed);
        console.log("=========================================");
        console.log("doc.username------------------------------------", doc.username);
        console.log("doc.action------------------------------------", doc.action);
        console.log("doc.isUsed------------------------------------", doc.isUsed);
        console.log("=========================================");
        console.log("doc.username------------------------------------", doc.username);
        console.log("doc.action------------------------------------", doc.action);
        console.log("doc.isUsed------------------------------------", doc.isUsed);
        console.log("=========================================");
        console.log("doc.username------------------------------------", doc.username);
        console.log("doc.action------------------------------------", doc.action);
        console.log("doc.isUsed------------------------------------", doc.isUsed);
        console.log("=========================================");
      }


      const matchedPayload = doc;

      if (!matchedPayload) {
        console.log('No matching payload found for:', doc);
        continue;
      }



      const user = await users.findOne({ remoteId: parseInt(matchedPayload.remote_id) });
      if (!user) {
        return res.json({ status: 500, msg: 'Internal error: no user' });
      }

      const now = new Date();
      let amount = Number(matchedPayload.amount) * casinoMultiples;
      let UpdatedExposure = Number(user.exposure - amount);
      let tempExposure = Number(user.tempExposure + amount);
      let updatedavailableBalance = Number(user.availableBalance - amount);

      const maxRetries = 3; // Max retries for the transaction
      let retries = 0;

      // Start the session outside the loop to avoid multiple session creation
      const session = await mongoose.startSession();

      while (retries < maxRetries) {
        const session = await mongoose.startSession(); // Create a new session for each retry
        let lastMaxWithdraw;
        try {
          session.startTransaction();
          console.log("11111111111111111111");

          try {
            // Find the latest Cash record for the user and sort by _id in descending order
            lastMaxWithdraw = await Cash.findOne({ userId: user.userId })
              .sort({ _id: -1 })
              .session(session);
          } catch (error) {
            console.error("Error finding the latest Cash record:", error);
          }

          //console.log("Retrieved lastMaxWithdraw:", lastMaxWithdraw);

          const transactionId2 = matchedPayload?.transaction_id;

          if (!transactionId2) {
            console.error("Transaction ID is undefined or invalid.");
          } else {
            console.log("Formatted transaction ID:", transactionId2);

            // Check if transaction already exists in CasinoCalls


            // console.log("Transaction existence check result:", idExists2);
          }
          // console.log("transactionId2 outside all conditions to check...........................",transactionId2);
          // console.log("idExists2 outside all conditions to check...........................",transactionId2);
          // console.log("user.exposure-----------------------------------------",user.exposure);
          // console.log("user.exposure-----------------------------------------",user.exposure);
          // console.log("user.exposure-----------------------------------------",user.exposure);
          // console.log("user.exposure-----------------------------------------",user.exposure);
          // console.log("user.exposure-----------------------------------------",user.exposure);
          // console.log("user.exposure-----------------------------------------",user.exposure);
          // console.log("user.exposure-----------------------------------------",user.exposure);
          // console.log("user.exposure-----------------------------------------",user.exposure);
          // console.log("user.exposure-----------------------------------------",user.exposure);
          // console.log("user.exposure-----------------------------------------",user.exposure);

          if (user.exposure > 0) {
            console.log("Transaction already exists for", matchedPayload.remote_id);
            continue; // Skip to the next iteration if the transaction already exists
          }
          console.log("-----------------------------------------", lastMaxWithdraw);
          // Check for valid conditions to process the transaction
          if (matchedPayload.username == 'user_45793') {
            console.log("----->>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", user);
            console.log("----->>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", lastMaxWithdraw);
            console.log("----->>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", matchedPayload.transactionId);
          }
          console.log("user.availableBalance>>>>", user.availableBalance);
          console.log("lastMaxWithdraw.availableBalance>>>>", lastMaxWithdraw.availableBalance);



          if (user.availableBalance >= amount && lastMaxWithdraw.availableBalance >= amount && lastMaxWithdraw.availableBalance > 0) {
            if (matchedPayload.action === 'debit' && matchedPayload.isUsed === false) {
              expPositiveDataEx = await expPositive.findOne({ betId: matchedPayload.transactionId });

              if (!expPositiveDataEx) {
                console.log("}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}");
                // Proceed with debit action
                try {
                  // Perform user balance and exposure updates
                  await users.updateOne(
                    { _id: user._id },
                    {
                      $set: {
                        availableBalance: updatedavailableBalance,
                        exposure: UpdatedExposure,
                        tempExposure: tempExposure
                      }
                    },
                    { session }
                  );

                  try {
                    const casinoDebits = new CasinoDebits({
                      ...matchedPayload,
                      createdAt: new Date().getTime()
                    });
                    await casinoDebits.save({ session });
                  } catch (error) {
                    console.error('Error during CasinoDebits insertion for debit:', error);
                    throw error; // Rethrow error to trigger transaction rollback
                  }

                  // Mark the transaction as used
                  await CasinoCallsPayload.updateOne(
                    { transaction_id: transactionId2 },
                    { $set: { isUsed: true } },
                    { session }
                  );

                  // Log exposure event
                  await expPositive.create([{
                    userId: user.userId,
                    userRole: user.role,
                    betId: transactionId2,
                    roundId: matchedPayload.round_id,
                    source: 'CasinodebitFun',
                    expCaptured: amount,
                    exposureAmount: UpdatedExposure
                  }], { session });

                  // Handle exposure for parent users
                  let parentUsersIds = await getParents(user.userId);
                  const parentUsers = await User.find({ userId: { $in: parentUsersIds }, isDeleted: false }).sort({ userId: -1 }).session(session);

                  let dealerExposures = amount;
                  let prev = 0;
                  for (const parent of parentUsers) {
                    let current = parent.downLineShare;
                    let commission = current - prev;
                    prev = current;

                    let ShareAmountInLoss = (commission / 100) * dealerExposures;
                    let finalShareAmountInLoss = Number(ShareAmountInLoss);

                    // Update parent user exposure and balance
                    let userexposureNew = parent.exposure - finalShareAmountInLoss;
                    let UseravailableBalanceNew = parent.availableBalance - finalShareAmountInLoss;

                    await users.updateOne(
                      { _id: parent._id },
                      { $set: { availableBalance: UseravailableBalanceNew, exposure: userexposureNew } },
                      { session }
                    );

                    // Log exposure for parent user
                    await expPositive.create([{
                      userId: parent.userId,
                      userRole: parent.role,
                      roundId: matchedPayload.round_id,
                      source: 'debitFunP',
                      expCaptured: finalShareAmountInLoss,
                      exposureAmount: userexposureNew
                    }], { session });
                  }
                } catch (error) {
                  console.error('Error during debit transaction update operation:', error);
                  throw error; // Rethrow error to trigger transaction rollback
                }
              }//entry does not exisit in exppositives then add to exposure


            }//if its debit in payloads 
            else if (matchedPayload.action === 'credit' && matchedPayload.isUsed === false) {

              //console.log("Here I am into else................................ for debit........");
              let idExists3 = await CasinoCalls.findOne({ transaction_id: transactionId2 }).session(session);
              if (!idExists3) {
                try {
                  const casinoDebits = new CasinoDebits({
                    ...matchedPayload,
                    createdAt: new Date().getTime()
                  });
                  await casinoDebits.save({ session });
                } catch (error) {
                  console.error('Error during CasinoDebits insertion:', error);
                  throw error; // Rethrow error to trigger transaction rollback
                }
                try {
                  await CasinoCallsPayload.updateOne(
                    { transaction_id: transactionId2 },
                    { $set: { isUsed: true } },
                    { session }
                  );
                } catch (error) {
                  console.error('Error during updating payloads for isUsed true for credit:', error);
                  throw error; // Rethrow error to trigger transaction rollback
                }


              } else {
                // console.log("This transaction exisit already in casino calls........",transactionId2);
                // console.log("This transaction exisit already in casino calls........",idExists3);
              }
            }
          } else {
            // console.log("Expecting credit for the casino..............",user);
            // console.log("lastMaxWithdraw--------------------------------",lastMaxWithdraw);
            // console.log("Amount................................",amount);
            // // If conditions for debit are not met, handle CasinoDebits insertion
            let idExists3 = await CasinoCalls.findOne({ transaction_id: transactionId2 }).session(session);
            if (!idExists3) {
              try {
                const casinoDebits = new CasinoDebits({
                  ...matchedPayload,
                  createdAt: new Date().getTime()
                });
                await casinoDebits.save({ session });
              } catch (error) {
                console.error('Error during updating payloads V2 for isUsed true for credit:', error);
                throw error; // Rethrow error to trigger transaction rollback
              }
            } else {
              // console.log("This transaction exisit already in casino calls........",transactionId2);
              // console.log("This transaction exisit already in casino calls........",idExists3);
            }
          }

          // Commit the transaction if everything succeeds
          await session.commitTransaction();
          // console.log('Transaction committed successfully');
          break; // Exit the loop if transaction is successful

        } catch (error) {
          // Retry logic if the transaction fails
          if (retries < maxRetries) {
            retries++;
            console.log(`Retrying... attempt ${retries}`);
            await session.abortTransaction(); // Abort the current transaction
            continue; // Retry the transaction
          } else {
            console.error('Transaction failed after retries:', error);
            await session.abortTransaction();
            break; // Exit the loop after max retries
          }
        } finally {
          session.endSession(); // Ensure the session is ended
        }
      }//while loop of tries
    }//for loop of matchedDocs
    return;
    // return res.status(200).json({
    //   success: true,
    //   message: 'missing entries inserted successfully',
    //   data: matchedDocs
    // })
    // console.log('Missing transactions successfully inserted.');
  } catch (error) {
    console.error('Error inserting missing transactions:', error);
  }
};

async function saveCasinoData(req, res) {

  const { round_id, transaction_id, amount, gameplay_final, action, targetcollection } = req.body;

  if (!targetcollection || !round_id || !transaction_id || !amount || !action) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields',
    });
  }

  try {
    if (targetcollection === "casinoCalls") {
      await CasinoCalls.create({
        round_id,
        transaction_id,
        amount,
        gameplay_final,
        action,
      });
    } else if (targetcollection === "casinoPayloads") {
      await casinoPayloads.create({
        round_id,
        transaction_id,
        amount,
        gameplay_final,
        action,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Casino data inserted successfully',
    });
  } catch (error) {
    console.error("Error in inserting:", error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}
async function fillMissingCasino(req, res) {

  const { round_id } = req.body;

  let casinoRec = [];

  if (!round_id) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields',
    });
  }
  try {

    const missingTransCalls = await CasinoCallsPayload.aggregate([
      {
        $match: {
          round_id: round_id,
          action: { $in: ["debit", "credit", "rollback"] }
        }
      },
      {
        $project: {
          transaction_id: 1,
          round_id: 1,
          action: 1,
          username: 1,
          remote_id: 1,
          amount: 1,
          game_id: 1,
          gameplay_final: 1,
          session_id: 1,
          gamesession_id: 1,
          is_freeround_bet: 1,
          game_id_hash: 1,
          createdAt: 1,
          isProcessing: 1,
          comingFrom: 1
        }
      }
    ])
    const missingTransPayloads = await CasinoCalls.aggregate([
      {
        $match: {
          round_id: round_id,
          action: { $in: ["debit", "credit", "rollback"] }
        }
      },
      {
        $project: {
          transaction_id: 1,
          round_id: 1,
          action: 1,
          username: 1,
          remote_id: 1,
          amount: 1,
          game_id: 1,
          gameplay_final: 1,
          session_id: 1,
          gamesession_id: 1,
          is_freeround_bet: 1,
          game_id_hash: 1,
          createdAt: 1,
          isProcessing: 1,
          comingFrom: 1
        }
      }
    ])

    casinoRec.push(...missingTransCalls, ...missingTransPayloads)

    res.status(200).json({
      success: true,
      message: 'casinoListing fetched successfully',
      data: casinoRec,


    });
  } catch (error) {
    console.error("Error in casinoListing:", error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

router.post('/fillMissingCasino', fillMissingCasino)

router.post('/saveCasinoData', saveCasinoData)
async function acasino(req, res) {
  console.log("acasino main function calls..............");
  console.log("acasino main function calls..............");
  console.log("acasino main function calls..............");
  console.log("acasino main function calls..............");
  console.log("acasino main function calls..............");
  console.log("acasino main function calls..............");
  console.log("acasino main function calls..............");
  console.log("acasino main function calls..............");
  console.log("acasino main function calls..............");
  console.log("acasino main function calls..............");
  console.log("acasino main function calls..............");
  try {
    if (req.body) {

    } else {
      responseData = {
        errorCode: 1,
        errorDescription: 'Body not available',
      };
      return res.status(404).json({ message: responseData });
    }
    if (req.body.operatorId != config.AURA_Partner_Id) {
      responseData = {
        errorCode: 1,
        errorDescription: 'Operator not valid',
      };
      return res.status(404).json({ message: responseData });
    }
    let responseData
    const user = await User.findOne({ token: req.body.token });
    if (!user) {
      responseData = {
        errorCode: 1,
        errorDescription: 'User not available',
      };
      return res.status(404).json({ message: responseData });
    }
    responseData = {
      operatorId: config.AURA_Partner_Id,
      userId: user.userId,
      username: user.userName,
      playerTokenAtLaunch: user.token,
      token: user.token,
      balance: user.availableBalance,
      exposure: user.exposure,
      currency: config.AURA_Currency,
      language: 'en',
      timestamp: Date.now().toString(),
      VIP: '3',
      clientIP: [
        user.clientPL
      ],
      errorCode: 0,
      errorDescription: 'ok',
    };
    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error handling casino:", error);
    //  return res.status(500).json({ success: false, message: "Error handling Userstakes.", error });
  }

}
async function poker(req, res) {
  console.log("Aura authentication......]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]");
  console.log("Aura authentication......]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]");
  console.log("Aura authentication......]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]");
  console.log("Aura authentication......]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]");
  console.log("Aura authentication......]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]");
  console.log("Aura authentication......]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]");
  console.log("Aura authentication......]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]");
  console.log("Aura authentication......]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]");
  console.log("Aura authentication......]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]");
  console.log("Aura authentication......]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]");
  console.log("Aura authentication......]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]");
  console.log("Aura authentication......]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]");
  console.log("Aura authentication......]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]");
  console.log("Aura authentication......]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]");
  console.log("Aura authentication......]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]]");

  try {
    if (req.body) {

    } else {
      responseData = {
        errorCode: 1,
        errorDescription: 'Body not available',
      };
      return res.status(404).json({ message: responseData });
    }
    if (req.body.operatorId != config.AURA_Partner_Id) {
      responseData = {
        errorCode: 1,
        errorDescription: 'Operator not valid',
      };
      return res.status(404).json({ message: responseData });
    }
    let responseData
    const user = await User.findOne({ token: req.body.token });
    if (!user) {
      responseData = {
        errorCode: 1,
        errorDescription: 'User not available',
      };
      return res.status(404).json({ message: responseData });
    }
    responseData = {
      operatorId: config.AURA_Partner_Id,
      userId: user.userId,
      username: user.userName,
      playerTokenAtLaunch: user.token,
      token: user.token,
      balance: user.availableBalance,
      exposure: user.exposure,
      currency: config.AURA_Currency,
      language: 'en',
      timestamp: Date.now().toString(),
      VIP: '3',
      clientIP: [
        user.clientPL
      ],
      errorCode: 0,
      errorDescription: 'ok',
    };
    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error handling casino:", error);
    //  return res.status(500).json({ success: false, message: "Error handling Userstakes.", error });
  }
}
async function scriptAdjustBalances(req, res) {
  try {

    // Fetch all users with role: '5'
    const users = await User.find({ role: '5' });
    //await deposits.dropIndex("roundId");
    const bulkOperations = users.map(user => ({
      updateOne: {
        filter: { userId: user.userId },
        update: {
          $set: {
            userId: user.userId,
            description: `Cash deposit into ${user.userName}`,
            amount: user.availableBalance,
            balance: user.availableBalance,
            roundId: uuidv4(),
            availableBalance: user.availableBalance,
            maxWithdraw: user.availableBalance,
            creditRemaining: user.availableBalance
          }
        },
        upsert: true // Insert if not found
      }
    }));

    if (bulkOperations.length > 0) {
      await Cash.bulkWrite(bulkOperations);
      console.log("Deposits collection updated successfully.");
    } else {
      console.log("No users found with role: '5'.");
    }
  } catch (error) {
    console.error("Error updating deposits:", error);
  } finally {

  }
}
async function pokerexposure(req, res) {

  console.log("INTO AURA EXPOSURE-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
  console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
  console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
  console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
  console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
  console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
  console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
  console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
  console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
  console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);

  console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
  console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
  console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
  console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
  console.log("1-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);


  // const usersWithRole5 = await User.find({ role: '5' });

  // const bulkOps = usersWithRole5.map(user => ({
  //     updateOne: {
  //         filter: { userId: user.userId },
  //         update: { 
  //             $set: { 
  //                 balance: user.availableBalance, 
  //                 clientPL: user.availableBalance 
  //             } 
  //         }
  //     }
  // }));
  // console.log("---------------",bulkOps);
  // if (bulkOps.length > 0) {
  //     await User.bulkWrite(bulkOps);
  // }


  // Extract userId and individual stake values from req.body
  let responseData
  if (req.body) {
    console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
    console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
    console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
    console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
    console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
    console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
    console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
    console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
    console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
    console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);

    console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
    console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
    console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
    console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
    console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>",);
    console.log("-->>>>>>>>>>>>>>>>>>>>>>>>>>>>>--------->>>>", req.body);

  }

  if (!req.body) {
    responseData = {
      errorCode: 1,
      errorDescription: 'Body not available',
    };
    return res.status(404).json({ responseData });
  }
  const requestData = req.body;




  const user = await User.findOne({ userId: requestData.userId });
  if (!user) {
    responseData = {
      errorCode: 1,
      errorDescription: 'User not validff',
    };
    return res.status(404).json({ responseData });
  }

  const exposureTime = Date.now(); // Current time in numeric format

  // Find an existing document with the same userId, token, and gameId
  const existingCall = await CasinoCalls.findOne({
    userId: requestData.userId, roundId: requestData.roundId, marketId: requestData.marketId, game_id: requestData.gameId

  });

  if (existingCall) {

    if (user.availableBalance + existingCall.calculateExposure < requestData.calculateExposure) {
      responseData = {
        errorCode: 1,
        errorDescription: 'Insufficient Balance',
      };
      return res.status(404).json({ responseData });
    }
  } else {
    if (user.availableBalance < Math.abs(requestData.calculateExposure)) {
      responseData = {
        errorCode: 1,
        errorDescription: 'Insufficient Balance',
      };
      return res.status(404).json({ responseData });
    }
  }

  const mongoose = require('mongoose');

  const session = await mongoose.startSession();

  const maxRetries = 3; // Max retries for the transaction
  let retries = 0;
  while (retries < maxRetries) {
    try {
      session.startTransaction();

      let usersUpdatedExposure
      let usersUpdatedavailableBalance
      let messageString
      if (existingCall) {
        messageString = 'Exposure updated successfully';
        console.log("casino already exisits...........");
        usersUpdatedExposure = (user.exposure + Math.abs(existingCall.calculateExposure)) + (requestData.calculateExposure)
        usersUpdatedavailableBalance = (user.availableBalance + Math.abs(existingCall.calculateExposure)) - Math.abs(requestData.calculateExposure)
        // If exists, update specific fields
        console.log("Before casnio update", Number(requestData.calculateExposure));
        console.log(existingCall.game_id, "======", requestData.gameId);
        console.log(existingCall.userId, "======", requestData.userId);
        console.log(existingCall.token, "======", requestData.token);
        try {
          await CasinoCalls.updateOne(
            { userId: requestData.userId, roundId: requestData.roundId, marketId: requestData.marketId, game_id: requestData.gameId },
            {
              $set: {
                calculateExposure: Number(requestData.calculateExposure),
                betInfo: requestData.betInfo,
                runners: requestData.runners,
                token: requestData.token,
                marketType: requestData.marketType,
                exposureTime: exposureTime
              }
            }, { session }
          );
        } catch (error) {
          console.error("Error handling Userstakes:", error);
          //  return res.status(500).json({ success: false, message: "Error handling Userstakes.", error });
        }


      } else {
        messageString = 'Exposure added successfully';
        console.log("casino not exisits......requestData.calculateExposure.....",requestData.calculateExposure);
        usersUpdatedExposure = user.exposure + (requestData.calculateExposure)
        usersUpdatedavailableBalance = user.availableBalance + requestData.calculateExposure
        console.log("1-usersUpdatedExposure::",usersUpdatedExposure);
        console.log("1-usersUpdatedavailableBalance::",usersUpdatedavailableBalance);

        // If not found, insert a new record
        const newCasinoCall = new CasinoCalls({
          game_id: requestData.gameId,
          roundId: requestData.roundId,
          marketId: requestData.marketId,
          marketType: requestData.marketType,
          token: requestData.token,
          transaction_id: requestData.marketId,
          username: "user_" + requestData.userId,
          userId: requestData.userId,
          calculateExposure: Number(requestData.calculateExposure) || 0,
          betInfo: requestData.betInfo,
          runners: requestData.runners,
          matchName: requestData.matchName,
          marketName: requestData.marketName,
          exposureTime: exposureTime
        }, { session });

        await newCasinoCall.save();



      }
      // return res.status(200).json({ pokerexposure });
      console.log("usersUpdatedavailableBalance------------------",usersUpdatedavailableBalance);
      console.log("usersUpdatedExposure------------------",usersUpdatedExposure)
      await User.updateOne(
        { userId: requestData.userId },
        {
          $set: {
            availableBalance: Number(usersUpdatedavailableBalance) || 0,
            exposure: Number(usersUpdatedExposure) || 0
          }
        }, { session }
      );

      await ParentsExpControl(user, requestData, [], 1, session)
      responseData = {
        "status": 0,
        "Message": messageString,
        "wallet": usersUpdatedavailableBalance,
        "exposure": usersUpdatedExposure
      }


      await session.commitTransaction();
      return res.status(200).json(responseData);
      break; // Exit loop if transaction succeeds
    } catch (error) {


      console.error('Transaction Error:', error);



    } finally {
      session.endSession();
    }
  }//end while loop
}
async function fetchresults(req, res) {
  console.log("AURA fetchresults========================");
  console.log("fetchresults========================");
  console.log("fetchresults========================");
  console.log("fetchresults========================");
  console.log("fetchresults========================");
  console.log("fetchresults========================");
  console.log("fetchresults========================");
  console.log("fetchresults========================");
  console.log("fetchresults========================");
  console.log("fetchresults========================");
  console.log("fetchresults========================");
  console.log("fetchresults========================");

}
async function pokererresults(req, res) {


  let responseData
  if (req.body) {
    console.log("--}}}}}}}}}}}}}}}}}}}}}}}}}}--------->>>>", req.body);
   }
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
     console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
   const now = new Date();
   const year = now.getFullYear().toString();
   const month = (now.getMonth() + 1).toString().padStart(2, '0');
   const day = now.getDate().toString().padStart(2, '0');
   const formattedDate = `${year}-${month}-${day}`;

  if (!req.body) {
    responseData = {
      errorCode: 1,
      errorDescription: 'Body not available',
    };
    return res.status(404).json({ responseData });
  }
  console.log("-------------------1-----------------------------");
  if (!req.body.result) {
    responseData = {
      errorCode: 1,
      errorDescription: 'Result not available',
    };
    return res.status(404).json({ responseData });
  }
  console.log("-------------------------2-----------------------");
  const requestData = req.body.result;
  console.log("requestData------------------------------------>>>>>>>>>>>>>>>>>>",requestData);
  let userId = requestData[0].userId
  let gameId = requestData[0].gameId
  let winnerId = requestData[0].winnerId
  let profitLoss = requestData[0].downpl
  let downpl = requestData[0].downpl
  let marketId = requestData[0].marketId
  let createdAt = formattedDate
  let updatedAt = formattedDate
  const existingCall = await CasinoCalls.findOne({
    userId: requestData[0].userId,
    remoteUpdate: false,
    game_id: gameId,
    marketId:marketId,


  });
  
  console.log("existingCall:",existingCall);
  console.log("----------------------3----------------userId:----------",userId);
  const user = await User.findOne({ userId: Number(userId) });
  console.log("user:",user);
  if (!user) {
    console.log("----------------------3A----------------userId:----------",userId);
    responseData = {
      errorCode: 1,
      errorDescription: 'User not valid',
    };
    return res.status(404).json({ responseData });
  }
  console.log("----------------------4--------------------------");
  
  console.log("-----------------------5-------------------------");
  if (!existingCall) {

    responseData = {
      errorCode: 1,
      errorDescription: 'No bet found',
    };
    return res.status(404).json({ responseData });
  }
  console.log("--------------------6----------------------------");

  // if (winnerId == '') {

  //   responseData = {
  //     errorCode: 1,
  //     errorDescription: 'Winner not found',
  //   };
  //   return res.status(404).json({ responseData });
  // }
  console.log("----------------------7--------------------------");
  const exposureTime = Date.now(); // Current time in numeric format
  

  const mongoose = require('mongoose');

  const session = await mongoose.startSession();

  
  console.log("----------------------8--------------------------");
  const maxRetries = 3; // Max retries for the transaction
  let retries = 0;
  while (retries < maxRetries) {
    try {
      
      session.startTransaction();
      console.log("----------------------9--------------------------");
      console.log("user.exposure------",user.exposure);
      console.log("existingCall.calculateExposure----------------->>>>>",existingCall.calculateExposure);
      usersUpdatedExposure = user.exposure - existingCall.calculateExposure
      usersUpdatedavailableBalance = user.availableBalance - existingCall.calculateExposure
    
    
      profitLoss = Math.abs(profitLoss)
      console.log("profitLoss=====>>.",profitLoss);
      if (downpl > 0) {
        //win
        usersUpdatedavailableBalance = Number(usersUpdatedavailableBalance) + Number(profitLoss)
      } else if (downpl < 0) {
        //lose
        usersUpdatedavailableBalance = Number(usersUpdatedavailableBalance) - Number(profitLoss)
      }
    
    
      console.log("----------------------10--------------------------");
    
      const lastMaxWithdraw = await Cash.findOne({ userId: userId }).sort({ _id: -1 });

      console.log("----------------------11--------------------------");
      await Cash.create([{
        userId: userId,
        description: `Aura Casino (${gameId})`,
        date: new Date().getTime(),
        amount: downpl,
        balance: lastMaxWithdraw.balance + downpl,
        availableBalance: lastMaxWithdraw.availableBalance + downpl,
        maxWithdraw: lastMaxWithdraw.maxWithdraw + downpl,
        roundId: existingCall.roundId,
        betId: existingCall.marketId,

        credit: lastMaxWithdraw ? lastMaxWithdraw.credit : 0,
        creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining : 0,
        cashOrCredit: "Aura Casino Bet",
        sportsId: "66",
        event: gameId,
        createdAt: createdAt,
        updatedAt: updatedAt
      }], { session });
      console.log("----------------------12--------------------------");
      console.log("exposureTime------",exposureTime);
      console.log("existingCall._id------",existingCall._id);
console.log("userId:", existingCall.userId, "==roundId::", requestData[0].roundId, "==marketId:", requestData[0].marketId, "==game_id::", requestData[0].gameId);
      await CasinoCalls.updateOne(
        { _id: existingCall._id},
        {
          $set: {
            
            exposureTime: exposureTime,
            remoteUpdate:true
          }
        }, { session }
      );

      console.log("usersUpdatedavailableBalance----------",usersUpdatedavailableBalance);
      console.log("usersUpdatedExposure----------",usersUpdatedExposure);
      
      await User.updateOne(
        { userId: userId },
        {
          $set: {
            availableBalance: Number(usersUpdatedavailableBalance) || 0,
            balance: Number(usersUpdatedavailableBalance) || 0,
            clientPL: Number(usersUpdatedavailableBalance) || 0,
            exposure: Number(usersUpdatedExposure) || 0
          }
        }, { session }
      );





      await ParentsExpControl(user, requestData, existingCall, 2, session)


      await session.commitTransaction();
      break; // Exit loop if transaction succeeds
    } catch (error) {


      if (retries < maxRetries) {
        retries++;
        console.log(`Retrying transaction...helper1 attempt ${retries}`, error);
        continue; // Retry the transaction
      } else {
        console.error('Transaction Error:', error);
        await session.abortTransaction();
        break; // Exit loop if error is not transient
      }



    } finally {
      session.endSession();
    }

  }
}
async function ParentsExpControl(userToUpdate, requestData, existingCall, action, session) {
  //action 1 for user bet place
  // action 2 for settlement
  //requestData data object from API
  const gameId = existingCall.game_id
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;

  console.log("action:",action);
  console.log("userToUpdate:",userToUpdate);
  if (action == 1) {
    let parentUserIds = await getParents(userToUpdate.userId);
    const parentUsers = await User.find({ userId: { $in: parentUserIds }, isDeleted: false }).sort({ userId: -1 }).session(session);

    let dealerExposures = Math.abs(requestData.calculateExposure);
    let prev = 0;

    for (const parent of parentUsers) {
      let current = parent.downLineShare;
      let commission = current - prev;
      prev = current;

      let shareAmountInLoss = (commission / 100) * dealerExposures;
      let finalShareAmountInLoss = Number(shareAmountInLoss);

      let userExposureNew = parent.exposure - finalShareAmountInLoss;
      let userAvailableBalanceNew = parent.availableBalance - finalShareAmountInLoss;

      await User.updateOne(
        {
          userId: parent.userId
        },
        {
          $set: {
            availableBalance: userAvailableBalanceNew,
            exposure: userExposureNew
          }
        },
        { session }
      );
      await expPositive.create([{
        userId: parent.userId,
        userRole: parent.role,
        userFrom: userToUpdate.userId,
        betId: requestData.token,
        roundId: requestData.marketId,
        betSection: requestData.gameId,
        source: 'CasinodebitFun',
        expCaptured: finalShareAmountInLoss
      }], { session });

    }


  }//action==1 closed

  if (action == 2) {
    let parentUserIds = await getParents(userToUpdate.userId);
    const parentUser = await User.find({
      userId: { $in: parentUserIds },
      isDeleted: false
    }).sort({ userId: -1 }).session(session);

    if (!parentUser) {
      console.error('Error: Parent Users Not Found');
      await session.abortTransaction();
      session.endSession();
      return;
    }
console.log("")
    // Process parent settlements (same logic for commission, exposure, etc.)

    let profitLoss = Math.abs(requestData[0].downpl);

    let downpl = requestData[0].downpl;

    let commissionAmount = 0;
    let upMovingCommAmount = 0;

    let prev = 0;
    for (const user of parentUser) {
      let current = user.downLineShare;
      user['commission'] = current - prev;
      prev = current;
    }

    let commissionFrom = userToUpdate.userId;

    for (const user of parentUser) {
      let expPositiveDataP = await expPositive.findOne({ userId: user.userId, roundId: requestData[0].marketId, betSection: requestData[0].gameId }).session(session);
      let ShareAmount = Number(((user.commission / 100) * profitLoss).toFixed(3));
      let updateExposure = expPositiveDataP.expCaptured + user.exposure
      let exposureAmountShare = expPositiveDataP.expCaptured
      let updatedtotalavailableBalance = Number(user.availableBalance)
      let usersUpdatedavailableBalance = Number(user.availableBalance) + Number(expPositiveDataP.expCaptured)
      let totalClientPLAmount;
      let userBalance;
      let totalBalance = user.balance;
      let totalClientPL = user.clientPL;
      let upLineAmount = 0;
      let amount = 0;
      let dealerscommissionAmount = 0

  
      if (downpl > 0) {

        usersUpdatedavailableBalance = Number((usersUpdatedavailableBalance - ShareAmount));
        totalBalance = Number((user.balance - ShareAmount));
        totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * profitLoss)) : 0;
        totalClientPL = Number((user.clientPL + totalClientPLAmount));
        upLineAmount = totalClientPLAmount;
        amount = -(user.commission / 100) * profitLoss;
        
        

        // amount = -ShareAmount
        // //trader WIN but dealer lost
        // usersUpdatedavailableBalance = Number(user.availableBalance)
        // totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * ShareAmount).toFixed(3)) : 0;

        // userBalance = totalClientPLAmount;
        // totalBalance = Number((user.balance - Number(((user.commission / 100) * ShareAmount).toFixed(3))).toFixed(3));
        // totalClientPL = Number((user.clientPL + totalClientPLAmount).toFixed(3));
        // upLineAmount = totalClientPLAmount;


      } else if (downpl < 0) {
        amount = (user.commission / 100) * profitLoss;
        dealerscommissionAmount = await parentCommisionAmount(profitLoss,user.commission,0.01)
        amount = amount - dealerscommissionAmount
        updatedtotalavailableBalance = Number((usersUpdatedavailableBalance + ShareAmount));
        totalBalance = Number((user.balance + Number(((user.commission / 100) * profitLoss))));
        totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * profitLoss)) : 0;
        totalClientPL = Number((user.clientPL - totalClientPLAmount));
        upLineAmount = -totalClientPLAmount;

        console.log("dealerscommissionAmount from rufnciton=========",dealerscommissionAmount);



      }



      console.log("parent user udpate.............",usersUpdatedavailableBalance);
      console.log("parent user totalBalance.............",totalBalance);
      console.log("parent user updateExposure.............",updateExposure);

      await User.updateOne(
        { userId: user.userId },
        {
          $set: {
            availableBalance: Number(usersUpdatedavailableBalance),
            balance: Number(totalBalance),
            clientPL: Number(totalClientPL),
            exposure: Number(updateExposure)
          }
        }, { session }
      );


     

      let Dbalance = amount;
      let DavailableBalance = amount;

      const shareNUpline = amount > 0 ? (Math.abs(amount) + Math.abs(upLineAmount)) : -(Math.abs(amount) + Math.abs(upLineAmount));

      console.log("shareNUpline------",shareNUpline);
      const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 }).session(session);
      
      if (lastMaxWithdraw) {
        Dbalance = lastMaxWithdraw.balance + amount;
        DavailableBalance = lastMaxWithdraw.availableBalance + amount;
      }

      let DmaxWithdraw = lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + amount : -(amount);

      let DCash = lastMaxWithdraw ? lastMaxWithdraw.cash : 0;
      let Dcredit = lastMaxWithdraw?.credit || 0;
      let DcreditRemaining = lastMaxWithdraw?.creditRemaining || 0;
      console.log("amount------",amount);
      // Create Cash record in the transaction
      await Cash.create([{
        userId: user.userId,
        // description: `Casino (${CgameName})`,
        description: `Aura Casino`,
        createdBy: 0,
        amount: amount,
        balance: Dbalance,
        availableBalance: DavailableBalance,
        maxWithdraw: DmaxWithdraw,
        cash: DCash,
        credit: Dcredit,
        creditRemaining: DcreditRemaining,
        marketId: existingCall.marketId,
        cashOrCredit: 'Aura Casino Bet',
        commissionFrom: commissionFrom,
        sportsId: "66",
        shareNUpline: shareNUpline,
        upLineAmount: upLineAmount,
        betId: existingCall.token,
        //matchId: Cgame_id,
        matchId: 'Aura game_id',
        betDateTime: new Date().getTime(),
        date: new Date().getTime(),
        createdAt: formattedDate,

        commissionAmount: commissionAmount,

        roundId: existingCall.roundId
      }], { session });


      if (expPositiveDataP) {
        await expPositive.updateOne(
          {
            userId: user.userId, roundId: requestData[0].marketId, betSection: requestData[0].gameId
          },
          {
            expReleased: exposureAmountShare,
          },
          { session }
        );
      }

      console.log("dealerscommissionAmount outside insertion--------------------------------",dealerscommissionAmount);
if(dealerscommissionAmount>0){
  console.log("Commission From game ---------------------",dealerscommissionAmount);
  await Deposits.create({
    userId: user.userId,
    description: `Commission From game (${gameId})`,
    createdBy: 0,
    commissionFrom: userToUpdate.userId,
    amount: dealerscommissionAmount,
    balance: lastMaxWithdraw ? lastMaxWithdraw.balance + dealerscommissionAmount : dealerscommissionAmount,
    availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + dealerscommissionAmount : dealerscommissionAmount,
    maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + dealerscommissionAmount : dealerscommissionAmount,
    cashOrCredit: 'Commission',
    betId: existingCall.token,
    cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
    marketId: existingCall.marketId,
    sportsId: '66',
    credit: lastMaxWithdraw?.credit || 0,
    creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
    upLineAmount: upMovingCommAmount,
    matchId: existingCall.marketId,
   
    betDateTime: new Date().getTime(),
    date: new Date().getTime(),
    createdAt: formattedDate,
    commissionAmount: dealerscommissionAmount,
    roundId: existingCall.roundId
  });
}
     


    }

  }//action==2 closed

}

router.post('/poker/exposure', pokerexposure);
router.post('/poker/fetchresults', fetchresults);
router.post('/poker/results', pokererresults);


router.post('/acasino/poker/exposure', pokerexposure);
router.post('/acasino/poker/fetchresults', fetchresults);
router.post('/acasino/poker/results', pokererresults);
router.post('/poker/auth', poker);
router.post('/track-bet/casinoListing', casinoListing)
router.get('/casino', casino);
router.get('/acasino', acasino);
router.get('/Oracasino', Oracasino);
router.get('/OracasinoAuth', OracasinoAuth);
router.get('/getGamesByProviderName', getGamesByProviderName);
router.get('/CreditO', CreditO);
router.get('/debitO', debitO);
router.get('/BalanceO', BalanceO);

module.exports = { router, findAndProcessTransactions, insertMissingTransactions, removeClosedMkts };
router.get('/insertMissingTransactions', insertMissingTransactions)