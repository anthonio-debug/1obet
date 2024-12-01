const express = require('express');
const User = require('../models/user');
const router = express.Router();
const ExpRec = require("../models/ExpRec");
const CasinoDebits = require('../models/casinoCalls');
const Cash = require("../../app/models/deposits");
const expPositive = require("../../app/models/ExpPositive");
const MarketIDS = require("../../app/models/marketIds");
const Bets = require("../../app/models/bets");
const crypto = require('crypto');
const config = require('config');
const { MongoClient } = require('mongodb');
const casinoMultiples = config.casinoMultiples;
const { getParents } = require("./bets");
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
const dbClient = new MongoClient(`${DBHost}?directConnection=true`, { useUnifiedTopology: true });
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
  const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
    //const ghclosedMkts = await MarketIDS.find({ sportID:{$in:[7,4339]},status: 'CLOSED', openDate:{$lt:twoMinutesAgo} })
    const ghclosedMkts = await MarketIDS.find({status: 'CLOSED', openDate:{$lt:twoMinutesAgo} })

     ghclosedMkts &&
     ( ghclosedMkts.forEach(async (market) => {
      //console.log("market.marketId........................---------------------------",market.marketId);
      let ghcountghbetsCount = await Bets.countDocuments({ marketId:market.marketId,status:1 })
      
      if(!ghcountghbetsCount){
        //await MarketIDS.deleteOne({ marketId:market.marketId } );
        await MarketIDS.updateOne({ marketId: market.marketId }, { status: 'PASSED-THROUGH' });
                   
      }
     }));

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

for (const tran of groupedTransactions) {

  const CasinoDebitroundsCount = await CasinoCalls.countDocuments({ round_id: tran._id, action: 'debit' });
  const CasinoCreditroundsCount = await CasinoCalls.countDocuments({ round_id: tran._id, action: 'credit' });
  const CasinoUploadsDebitroundsCount = await CasinoCallsPayload.countDocuments({ round_id: tran._id, action: 'debit' });
  const CasinoUploadsCreditroundsCount = await CasinoCallsPayload.countDocuments({ round_id: tran._id, action: 'credit' });
  const CasinoUploadsRollBackroundsCount = await CasinoCallsPayload.countDocuments({ round_id: tran._id, action: 'rollback' });
  const CasinoRollBackroundsCount = await CasinoCallsPayload.countDocuments({ round_id: tran._id, action: 'rollback' });

  if (CasinoDebitroundsCount !== CasinoUploadsDebitroundsCount || CasinoCreditroundsCount !== CasinoUploadsCreditroundsCount || CasinoUploadsRollBackroundsCount != CasinoRollBackroundsCount ) {
    continue;
  }
  if(tran.username=='user_45388'){

    console.log("CasinoDebitroundsCount ::::",CasinoDebitroundsCount);
    console.log("CasinoCreditroundsCount ::::",CasinoCreditroundsCount);
    console.log("CasinoUploadsDebitroundsCount ::::",CasinoUploadsDebitroundsCount);
    console.log("CasinoUploadsCreditroundsCount ::::",CasinoUploadsCreditroundsCount);
    console.log("CasinoDebitroundsCount ::::",CasinoDebitroundsCount);
    console.log("CasinoCreditroundsCount ::::",CasinoCreditroundsCount);
    console.log("CasinoUploadsDebitroundsCount ::::",CasinoUploadsDebitroundsCount);
    console.log("CasinoUploadsCreditroundsCount ::::",CasinoUploadsCreditroundsCount);
    console.log("CasinoDebitroundsCount ::::",CasinoDebitroundsCount);
    console.log("CasinoCreditroundsCount ::::",CasinoCreditroundsCount);
    console.log("CasinoUploadsDebitroundsCount ::::",CasinoUploadsDebitroundsCount);
    console.log("CasinoUploadsCreditroundsCount ::::",CasinoUploadsCreditroundsCount);
    console.log("CasinoDebitroundsCount ::::",CasinoDebitroundsCount);
    console.log("CasinoCreditroundsCount ::::",CasinoCreditroundsCount);
    console.log("CasinoUploadsDebitroundsCount ::::",CasinoUploadsDebitroundsCount);
    console.log("CasinoUploadsCreditroundsCount ::::",CasinoUploadsCreditroundsCount);
    console.log("CasinoDebitroundsCount ::::",CasinoDebitroundsCount);
    console.log("CasinoCreditroundsCount ::::",CasinoCreditroundsCount);
    console.log("CasinoUploadsDebitroundsCount ::::",CasinoUploadsDebitroundsCount);
    console.log("CasinoUploadsCreditroundsCount ::::",CasinoUploadsCreditroundsCount);
    console.log("CasinoDebitroundsCount ::::",CasinoDebitroundsCount);
    console.log("CasinoCreditroundsCount ::::",CasinoCreditroundsCount);
    console.log("CasinoUploadsDebitroundsCount ::::",CasinoUploadsDebitroundsCount);
    console.log("CasinoUploadsCreditroundsCount ::::",CasinoUploadsCreditroundsCount);
    console.log("CasinoDebitroundsCount ::::",CasinoDebitroundsCount);
    console.log("CasinoCreditroundsCount ::::",CasinoCreditroundsCount);
    console.log("CasinoUploadsDebitroundsCount ::::",CasinoUploadsDebitroundsCount);
    console.log("CasinoUploadsCreditroundsCount ::::",CasinoUploadsCreditroundsCount);
    console.log("CasinoDebitroundsCount ::::",CasinoDebitroundsCount);
    console.log("CasinoCreditroundsCount ::::",CasinoCreditroundsCount);
    console.log("CasinoUploadsDebitroundsCount ::::",CasinoUploadsDebitroundsCount);
    console.log("CasinoUploadsCreditroundsCount ::::",CasinoUploadsCreditroundsCount);
    console.log("CasinoDebitroundsCount ::::",CasinoDebitroundsCount);
    console.log("CasinoCreditroundsCount ::::",CasinoCreditroundsCount);
    console.log("CasinoUploadsDebitroundsCount ::::",CasinoUploadsDebitroundsCount);
    console.log("CasinoUploadsCreditroundsCount ::::",CasinoUploadsCreditroundsCount);
    console.log("CasinoDebitroundsCount ::::",CasinoDebitroundsCount);
    console.log("CasinoCreditroundsCount ::::",CasinoCreditroundsCount);
    console.log("CasinoUploadsDebitroundsCount ::::",CasinoUploadsDebitroundsCount);
    console.log("CasinoUploadsCreditroundsCount ::::",CasinoUploadsCreditroundsCount);
    console.log("CasinoDebitroundsCount ::::",CasinoDebitroundsCount);
    console.log("CasinoCreditroundsCount ::::",CasinoCreditroundsCount);
    console.log("CasinoUploadsDebitroundsCount ::::",CasinoUploadsDebitroundsCount);
    console.log("CasinoUploadsCreditroundsCount ::::",CasinoUploadsCreditroundsCount);
    console.log("CasinoDebitroundsCount ::::",CasinoDebitroundsCount);
    console.log("CasinoCreditroundsCount ::::",CasinoCreditroundsCount);
    console.log("CasinoUploadsDebitroundsCount ::::",CasinoUploadsDebitroundsCount);
    console.log("CasinoUploadsCreditroundsCount ::::",CasinoUploadsCreditroundsCount);
    console.log("CasinoDebitroundsCount ::::",CasinoDebitroundsCount);
    console.log("CasinoCreditroundsCount ::::",CasinoCreditroundsCount);
    console.log("CasinoUploadsDebitroundsCount ::::",CasinoUploadsDebitroundsCount);
    console.log("CasinoUploadsCreditroundsCount ::::",CasinoUploadsCreditroundsCount);
    console.log("CasinoDebitroundsCount ::::",CasinoDebitroundsCount);
    console.log("CasinoCreditroundsCount ::::",CasinoCreditroundsCount);
    console.log("CasinoUploadsDebitroundsCount ::::",CasinoUploadsDebitroundsCount);
    console.log("CasinoUploadsCreditroundsCount ::::",CasinoUploadsCreditroundsCount);
    console.log("CasinoDebitroundsCount ::::",CasinoDebitroundsCount);
    console.log("CasinoCreditroundsCount ::::",CasinoCreditroundsCount);
    console.log("CasinoUploadsDebitroundsCount ::::",CasinoUploadsDebitroundsCount);
    console.log("CasinoUploadsCreditroundsCount ::::",CasinoUploadsCreditroundsCount);

  }
  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      session.startTransaction();

      await CasinoCalls.updateMany({ round_id: tran._id }, { $set: { lastCheckedTime: Date.now() } }, { session });

      const userRecord = await users.findOne({ remoteId: Number(tran.remote_id) }, { session });
      if (!userRecord) {
        console.log(`User not found for remoteId: ${tran.remote_id}`);
        session.endSession();
        continue; // Skip if user not found
      }

      const existingDeposit = await Cash.findOne({ roundId: tran._id.toString(), remote_id: tran.remote_id });
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

        totalCreditAmount += totalRollBackAmount;
        differenceDbCr = (totalCreditAmount - totalDebitAmount) * casinoMultiples;

        const updatedAvailableBalance = userRecord.availableBalance + totalCreditAmount;

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
          event: tran.game_id, // Adjust this if needed
          marketId: tran._id, // Adjust this if needed
          matchId: tran.game_id, // Adjust this if needed
        }], { session });

        await users.updateOne({ _id: userRecord._id }, {
          $set: {
            balance: updatedAvailableBalance,
            clientPL: userRecord.clientPL + differenceDbCr,
            availableBalance: updatedAvailableBalance,
            exposure: userRecord.exposure + (totalDebitAmount * casinoMultiples),
          }
        }, { session });

        await CasinoCalls.updateMany({ round_id: tran._id.toString() }, { $set: { isProcessing: false } }, { session });

        // Commit the transaction
        await session.commitTransaction();
        break; // Exit loop if transaction succeeds

      } else {
        console.log("Duplicate transaction found, skipping insertion.");
        session.endSession();
        continue;
      }
    } catch (error) {
      if (retries < maxRetries) {
        retries++;
        console.log(`Retrying transaction... attempt ${retries}`);
        continue; // Retry the transaction
      } else {
        console.error('Transaction Error:', error);
        await session.abortTransaction();
        break; // Exit loop if error is not transient
      }
    } finally {
      if (retries >= maxRetries) {
        session.endSession(); // Ensure session ends after retries exhausted or on error
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

    if (balance < 0 || lastMaxWithdraw.availableBalance <=0 || user.exposure > 0) {
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
      await WinLoseTransManagement(balance, payload, user, 0, res);

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

        const response = await WinLoseTransManagement(0, payload, user, 1, res, session);
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
        const user = await users.findOne(
          { remoteId: parseInt(payload.remote_id) },
          { session }
        );
        if (!user) {
          await session.abortTransaction();
          return res.json({ status: '500', msg: `Internal error User Not Found` });
        } else if (sameTransId === 0) {
          await session.abortTransaction();
          return res.json({
            status: 404,
            balance: user.availableBalance / casinoMultiples,
          });
        } else if (sameTransId > 1) {
          await session.abortTransaction();
          return res.json({
            status: 200,
            balance: user.availableBalance / casinoMultiples,
          });
        } else {
          const rollbackTransaction = await casinoCalls.findOne(
            {
              transaction_id: payload.transaction_id,
              remote_id: parseInt(payload.remote_id)
            },
            { session }
          );

          let amount = 0;

          const action = rollbackTransaction.action;

          if (action === "credit") {
            amount = -parseInt(rollbackTransaction.amount);
          } else if (action === "debit") {
            amount = parseInt(rollbackTransaction.amount);

          } else if (action === 'rollback') {
            await session.abortTransaction();
            return res.json({
              status: 404,
              balance: user.availableBalance / casinoMultiples
            });
          }

          updatedBalance = user.availableBalance + (amount * casinoMultiples);
          let updatedExposureAmount = user.exposure + (Number(user.tempExposure) * casinoMultiples);

          // await users.updateOne(
          //   { _id: user?._id }, { $set: { exposure: updatedExposureAmount, availableBalance: updatedBalance,tempExposure:0 } },
          //   { session }
          // );

          const casinoDebits = new CasinoDebits({
            ...payload,                // Spread the existing keys from payload
            createdAt: new Date().getTime(),     // Set the current time for createdAt
          });
          await casinoDebits.save();
          await session.commitTransaction();

          const updatedUser = await users.findOne(
            { remoteId: parseInt(payload.remote_id) },
            { session }
          )

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

async function  casino (req, res) {
  const { action, remote_id } = req.query;
  



  // //console.log("arham casinoooooooooo call",action, remote_id )
  if (!remote_id || !action) {
    return res.send({ status: '400', msg: 'Invalid Request' });
  }
  const payload1 = req.query
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 console.log("payload1--------------------------------------------------",payload1);
 
//if(payload1.provider== 'es' || payload1.provider== 'ez'  || payload1.provider== 'fg'){
  //payload1.comingFrom = 'payloads';

  const c = await new CasinoCallsPayload(payload1)
  
  console.log("c.........................",c);

  c.save()
  
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

// }else{
//   return
// }
  
  
}

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
    let missingRecords=[]
    const missingTransCalls = await CasinoCallsPayload.aggregate([
      {
        $match: {
          isProcessing:true,
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
          comingFrom:1,
        }
      }
    ])
    const missingTransPayloads = await CasinoCalls.aggregate([
      {
        $match: {
          isProcessing:true,
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
          comingFrom:1,
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


const insertMissingTransactions = async (req, res) => {
  let newCasinoCall;
    try {
  
  
      const matchedDocs =  await CasinoCallsPayload.aggregate([
        {
          $match: {
            action: { $in: ["debit", "credit","rollback"] },
            //isUsed:false
            //username:"user_45112"// Filter for action being "debit" or "credit"
          }
        },
        {
          $lookup: {
            from: "casinocalls",  // the name of the other collection
            let: { 
              roundId: "$round_id", 
              username: "$username", 
              transactionId: "$transaction_id"
            }, // pass local fields for comparison
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$round_id", "$$roundId"] },        // Match round_id
                      { $eq: ["$username", "$$username"] },        // Match username
                      { $eq: ["$transaction_id", "$$transactionId"] }  // Match transaction_id
                    ]
                  }
                }
              }
            ],
            as: "matched_payloads"  // Alias for matched documents from casinocallspayloads
          }
        },
        {
          $match: {
            "matched_payloads": { $size: 0 }  // No matches in casinocallspayloads
          }
        }
      ]);
  
  
      
  
      if (!matchedDocs || matchedDocs.length === 0) {
        console.log('No transactions found for the given round_id and username.');
        return;
      }
  
    //  console.log("++++++++++++++++++++++++ going to save data in casinocalls");
    const session = await mongoose.startSession();
    
  

      for (const doc of matchedDocs) {
        // console.log("doc.username------------------------------------",doc.username);
        // console.log("doc.action------------------------------------",doc.action);
        // console.log("doc.isUsed------------------------------------",doc.isUsed);
        // console.log("=========================================");
        // console.log("doc.username------------------------------------",doc.username);
        // console.log("doc.action------------------------------------",doc.action);
        // console.log("doc.isUsed------------------------------------",doc.isUsed);
        // console.log("=========================================");
        // console.log("doc.username------------------------------------",doc.username);
        // console.log("doc.action------------------------------------",doc.action);
        // console.log("doc.isUsed------------------------------------",doc.isUsed);
        // console.log("=========================================");
        // console.log("doc.username------------------------------------",doc.username);
        // console.log("doc.action------------------------------------",doc.action);
        // console.log("doc.isUsed------------------------------------",doc.isUsed);
        // console.log("=========================================");
        // console.log("doc.username------------------------------------",doc.username);
        // console.log("doc.action------------------------------------",doc.action);
        // console.log("doc.isUsed------------------------------------",doc.isUsed);
        // console.log("=========================================");
        // console.log("doc.username------------------------------------",doc.username);
        // console.log("doc.action------------------------------------",doc.action);
        // console.log("doc.isUsed------------------------------------",doc.isUsed);
        // console.log("=========================================");
        // console.log("doc.username------------------------------------",doc.username);
        // console.log("doc.action------------------------------------",doc.action);
        // console.log("doc.isUsed------------------------------------",doc.isUsed);
        // console.log("=========================================");
        // console.log("doc.username------------------------------------",doc.username);
        // console.log("doc.action------------------------------------",doc.action);
        // console.log("doc.isUsed------------------------------------",doc.isUsed);
        // console.log("=========================================");
        // console.log("doc.username------------------------------------",doc.username);
        // console.log("doc.action------------------------------------",doc.action);
        // console.log("doc.isUsed------------------------------------",doc.isUsed);
        // console.log("=========================================");
        // console.log("doc.username------------------------------------",doc.username);
        // console.log("doc.action------------------------------------",doc.action);
        // console.log("doc.isUsed------------------------------------",doc.isUsed);
        // console.log("=========================================");
        
        const matchedPayload = doc;
        
        if (!matchedPayload) {
            console.log('No matching payload found for:', doc);
            continue;
        }
    
        const transactionId = matchedPayload.transaction_id;
        const idExists = await CasinoCalls.findOne({ transaction_id: transactionId });
        
        if (idExists) {
            console.log("This transaction already exists......", transactionId);
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
            try {
                session.startTransaction();
    
                const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 }).session(session);
                const transactionId2 = matchedPayload.transaction_id.toString().trim();
                let idExists2 = await CasinoCalls.findOne({ transaction_id: transactionId2 }).session(session);
    
                if (idExists2) {
                    console.log("idExists2 exists already................. for", matchedPayload.remote_id);
                    continue;
                }
    
                if (user.exposure <= 0 && user.availableBalance >= amount && lastMaxWithdraw.availableBalance >= amount && lastMaxWithdraw.availableBalance > 0 && !idExists2) {
                    if (matchedPayload.action == 'debit' && matchedPayload.isUsed ==false) {
                        try {

                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          // console.log("UpdatedExposure/////////////////////////////////////",UpdatedExposure);
                          
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
                            
                            // Mark transaction as used
                            await CasinoCallsPayload.updateOne(
                                { transaction_id: transactionId2 },
                                { $set: { isUsed: true } },
                                { session }
                            );
    
                            // Log exposure event
                            await expPositive.create([{
                                userId: user.userId,
                                userRole: user.role,
                                roundId: matchedPayload.round_id,
                                source: 'CasinodebitFun',
                                expCaptured: amount,
                                exposureAmount: UpdatedExposure
                            }], { session });
    
                            // Handle parent user exposures
                            let parentUsersIds = await getParents(user.userId);
                            const parentUser = await User.find({
                                userId: { $in: parentUsersIds },
                                isDeleted: false
                            }).sort({ userId: -1 }).session(session);
    
                            let dealerExposures = amount;
                            let prev = 0;
    
                            for (const parent of parentUser) {
                                let current = parent.downLineShare;
                                let commission = current - prev;
                                prev = current;
    
                                let ShareAmountInLoss = (parent.commission / 100) * dealerExposures;
                                let finalShareAmountInLoss = Number(ShareAmountInLoss);
                                let userexposureNew = parent.exposure - finalShareAmountInLoss;
                                let UseravailableBalanceNew = parent.availableBalance - finalShareAmountInLoss;
    
                                await users.updateOne(
                                    { _id: parent._id },
                                    { $set: { availableBalance: UseravailableBalanceNew, exposure: userexposureNew } },
                                    { session }
                                );
    
                                // Create exposure log for parent user
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
                            console.error('Error during update operation:', error);
                        }
                    }//if its debit action
                    else{
                      console.log("doc.username------------------------------------",doc.username);
                      console.log("doc.action------------------------------------",doc.action);
                      console.log("doc.isUsed------------------------------------",doc.isUsed);
                      console.log("=========================================");
                      console.log("doc.username------------------------------------",doc.username);
                      console.log("doc.action------------------------------------",doc.action);
                      console.log("doc.isUsed------------------------------------",doc.isUsed);
                      console.log("=========================================");
                      console.log("doc.username------------------------------------",doc.username);
                      console.log("doc.action------------------------------------",doc.action);
                      console.log("doc.isUsed------------------------------------",doc.isUsed);
                      console.log("=========================================");
                      console.log("doc.username------------------------------------",doc.username);
                      console.log("doc.action------------------------------------",doc.action);
                      console.log("doc.isUsed------------------------------------",doc.isUsed);
                      console.log("=========================================");
                      console.log("doc.username------------------------------------",doc.username);
                      console.log("doc.action------------------------------------",doc.action);
                      console.log("doc.isUsed------------------------------------",doc.isUsed);
                      console.log("=========================================");
                      console.log("doc.username------------------------------------",doc.username);
                      console.log("doc.action------------------------------------",doc.action);
                      console.log("doc.isUsed------------------------------------",doc.isUsed);
                      console.log("=========================================");
                      console.log("doc.username------------------------------------",doc.username);
                      console.log("doc.action------------------------------------",doc.action);
                      console.log("doc.isUsed------------------------------------",doc.isUsed);
                      console.log("=========================================");

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
                        }
                    }
                    }
                //following bracket closed for less than zero exposure, available balance
                } else {
                    // Handle case for new transaction (CasinoDebits)
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
                        }
                    }
                }
    
                await session.commitTransaction();
                break; // Exit loop if transaction succeeds
    
            } catch (error) {
                if (retries < maxRetries) {
                    retries++;
                    console.log(`Retrying... attempt ${retries}`);
                    await session.abortTransaction(); // Abort current transaction before retrying
                    continue; // Retry the transaction
                } else {
                    console.error('Transaction Error:', error);
                    await session.abortTransaction();
                    break; // Exit loop if error is not transient
                }
            } finally {
                session.endSession();
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

    const {round_id} = req.body;
  
    let casinoRec = [] ;
  
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
            round_id:round_id,
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
            comingFrom:1
          }
        }
      ])
      const missingTransPayloads = await CasinoCalls.aggregate([
        {
          $match: {
            round_id:round_id,
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
            comingFrom:1
          }
        }
      ])
  
      casinoRec.push(...missingTransCalls,...missingTransPayloads)
  
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


  
router.post('/track-bet/casinoListing', casinoListing)
router.get('/casino', casino);
module.exports = { router,findAndProcessTransactions,insertMissingTransactions,removeClosedMkts };
router.get('/insertMissingTransactions', insertMissingTransactions)