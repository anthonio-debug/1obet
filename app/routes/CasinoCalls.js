const express = require('express');
const User = require('../models/user');
const router = express.Router();
const ExpRec = require("../models/ExpRec");
const CasinoDebits = require('../models/casinoCalls');
const Cash = require("../../app/models/deposits");
const crypto = require('crypto');
const config = require('config');
const { MongoClient } = require('mongodb');
const casinoMultiples = config.casinoMultiples;
const { getParents } = require("./bets");
const SelectedCasino = require("../models/selectedCasino");
const path = require('path');
const log = require('log-to-file');
const CasinoCalls = require('../models/casinoCalls');
const CasinoCallsPAyload = require('../models/casinoCallsPayload');
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
const mongoose = require('mongoose');

async function findAndProcessTransactions(user) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const groupedTransactions = await CasinoCalls.aggregate([
      { 
        $match: { 
          gameplay_final: 1, 
          isProcessing: true 
        } 
      },
      {
        $group: {
          _id: "$round_id",
          remote_id: { $first: "$remote_id" }, 
          username: { $first: "$username" },
          game_id: { $first: "$game_id" },
        }
      }
    ]).session(session);  

    if (!groupedTransactions || groupedTransactions.length === 0) {
      console.log('No transactions found for the given round_id and username.');
      await session.abortTransaction();  // Abort the transaction if no records found
      session.endSession();
      return;
    }

    let totalCreditAmount = 0;
    let totalDebitAmount = 0;
    let totalRollBackAmount = 0;

    for (const tran of groupedTransactions) {
      let adjustedNewExposure = 0;
      let adjustedNewTempExposure = 0;
      const roundIds = await CasinoCalls.find({ round_id: tran._id }).session(session);

      console.log("rouuuuuuuuuuuuuuuuuuuundID=========", tran._id.toString());

      for (const rounds of roundIds) {
        console.log("userName=========", rounds.username);
        
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

      const session = await mongoose.startSession();
session.startTransaction();

try {
  // Find the user with the specified remote ID using the session
  const user = await users.findOne(
    { remoteId: Number(tran.remote_id) },
    null,
    { session }
  );

  if (!user) {
    throw new Error('User not found');
  }

  

  await session.commitTransaction(); // Commit the transaction
} catch (error) {
  await session.abortTransaction(); // Rollback on error
  throw error; // Handle the error as needed
} finally {
  session.endSession(); // Clean up the session
}

      adjustedNewExposure = user.exposure + (totalDebitAmount * casinoMultiples);
      adjustedNewTempExposure = user.tempExposure - (totalDebitAmount * casinoMultiples);
      updatedavailableBalance=user.availableBalance+(totalCreditAmount *  casinoMultiples)
      Updatedbalance=user.balance+(totalCreditAmount *  casinoMultiples)
      updatedClientPL = user.client + (totalCreditAmount * casinoMultiples)
      const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });
    
          console.log('Total credit amount:', totalCreditAmount*  casinoMultiples);
        console.log('Total debit amount:', totalDebitAmount*  casinoMultiples);
        console.log('Total adjustedNewExposure amount:', adjustedNewExposure);
        console.log('Total adjustedNewTempExposure amount:', adjustedNewTempExposure);
          // console.log('Total updatedavailableBalance amount:', updatedavailableBalance);
          console.log('Total lastMaxWithdraw balance amount:', lastMaxWithdraw.balance);
          console.log('Total lastMaxWithdraw availableBalance amount:', lastMaxWithdraw.availableBalance);
          console.log('Total lastMaxWithdraw maxWithdraw amount:', lastMaxWithdraw.maxWithdraw);
        console.log('Total updatedavailableBalance amount:', updatedavailableBalance);
        console.log('Total Updatedbalance amount:', Updatedbalance);
        console.log('Total updatedClientPL amount:', updatedClientPL);
        
        
        let AmountDeposits = (totalCreditAmount * casinoMultiples )- (totalDebitAmount * casinoMultiples)

        
        let NewDepositsBalance = lastMaxWithdraw.balance + AmountDeposits;
        
        let NewDepositsAvailableBalance = lastMaxWithdraw.availableBalance + AmountDeposits
        
        let NewDepositsWithdraw = lastMaxWithdraw.maxWithdraw + AmountDeposits
        console.log('Total AmountDeposits amount:', AmountDeposits);
        console.log('Total NewDepositsBalance amount:', NewDepositsBalance);
        console.log('Total NewDepositsAvailableBalance amount:', NewDepositsAvailableBalance);
        console.log('Total NewDepositsWithdraw amount:', NewDepositsWithdraw);

      var upMovingAmount = 0;
      if (amountDeposits < 0) {
        upMovingAmount = Number(amountDeposits);
      }

      const gamesList = await SelectedCasino.findOne(
        { "games.id": tran.game_id },
        { "games.$": 1 }
      ).session(session);

      const game = gamesList?.games[0];
      let gameName = game ? game.name : 'N/A';

      const now = new Date();
      const formattedDate = now.toISOString().split('T')[0];
      const betTime = now.getTime();

      let betTransaction = {
        userId: user.userId,
        description: `Casino (${gameName})`,
        date: now.getTime(),
        createdAt: formattedDate,
        commissionFrom: user.userId,
        createdBy: 0,
        betDateTime: betTime,
        casinoBetAmount: totalDebitAmount,
        amount: amountDeposits,
        balance: newDepositsBalance,
        availableBalance: newDepositsAvailableBalance,
        maxWithdraw: newDepositsWithdraw,
        cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
        credit: lastMaxWithdraw ? lastMaxWithdraw.credit : 0,
        creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining : 0,
        cashOrCredit: "Bet",
        sportsId: "6",
        event: gameName,
        roundId: tran._id,
        marketId: tran._id,
        matchId: tran.game_id,
        upLineAmount: upMovingAmount,
        userAvailableBalanceBFTrans: user.availableBalance,
        userAvailableBalanceAFTrans: updatedAvailableBalance,
        userPrevExposure: user.exposure,
        updatedExposure: adjustedNewExposure
      };

      const deposit = new Cash(betTransaction);
      await deposit.save({ session });

      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            clientPL: updatedAvailableBalance,
            balance: updatedAvailableBalance,
            availableBalance: updatedAvailableBalance,
            exposure: adjustedNewExposure,
            tempExposure: adjustedNewTempExposure
          }
        },
        { session }
      );

      await casinoCalls.updateMany(
        { round_id: tran._id.toString() },
        { $set: { isProcessing: false } },
        { session }
      );
    }

    await session.commitTransaction();  
  } catch (error) {
    console.error('Error processing transactions:', error);
    await session.abortTransaction();
  } finally {
    session.endSession();  
  }
}

setTimeout(() => {
  findAndProcessTransactions()
},2000)
const WinLoseTransManagement = async (balance, payload, users123, action, res, session) => {
  try {



    const user = await users.findOne({ remoteId: Number(payload.remote_id) });

    /*
      action= 0 debit
      action= 1 credit( decision came from casino )
      debit = 1350
      credit=  600 or 1350 or 1800
      let bettor_winning_amount = 0;
      let bettor_lost_amount = 0;
    */
    // //console.log( payload ,"payloaaaaaad",  action,"actionsssssssss", res,"resssssssss", session,"arhamteeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeest")
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    if (action === 0) {
      let amount = Number(payload.amount) * casinoMultiples;
      console.log("hereeeeeeeeeeeeeeeeeeeeeeee 1")
      let UpdatedExposure = Number((user.exposure - amount).toFixed(3));
      let tempExposure = Number((user.tempExposure + amount).toFixed(3));
      //console.log("arham exposureeeeeeeeeeeee ",UpdatedExposure )
      let updatedavailableBalance = Number((user.availableBalance - (amount)).toFixed(3));
      //console.log("arham updatedavailableBalance ",UpdatedExposure )

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
      console.log("hereeeeeeeeeeeeeeeeeeeeeeee 2")
      const casinoDebits = new CasinoDebits(payload);
      await casinoDebits.save();

      return 0
    } else if (action === 1) {
      // await findAndProcessTransactions(user)
      console.log("userid=========================>",user.userId)
      // const depositLastBetTime = await Cash.find({ userId: user.userId,  description: "Casino (Casino Hold'em)" }).sort({ _id: -1 });
      // if (depositLastBetTime.length > 0 && (betTime - depositLastBetTime[depositLastBetTime.length-1].betDateTime) < 500) {
      //   console.log('Transaction occurred too quickly, skipping...');
      //   return; // Skip transaction
      // }
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

      const casinoDebits = new CasinoDebits(payload);
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
      console.log("debit==============>?",debit)
      console.log("credit==============>?",credit)
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
   

    if (!user) {
      return res.json({ status: 500, msg: 'Internal error no user' });
    }

    const checkMarketBlockedResponse = await checkMarketBlocked(user);
    // //console.log(user.availableBalance,"arham --------- balance",checkMarketBlockedResponse,"checkMarketBlockedResponse arham")
    if (checkMarketBlockedResponse == 1) {
      return res.json({ status: '500', msg: ' Batting is not allowed ! ' });
    }

    const balance = user.availableBalance;
    if (balance < 0) {
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

      let updatedAvailableBalance = user.availableBalance - (parseInt(payload.amount) * casinoMultiples);
      if (updatedAvailableBalance < 0) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }
        return res.json({ status: 500, msg: 'Insufficient balance' });
      }

      const balance = user.availableBalance / casinoMultiples;
      await WinLoseTransManagement(balance, payload, user, 0, res);

      await session.commitTransaction();

      const updatedUser = await users.findOne({ remoteId: parseInt(payload.remote_id) }, { session });
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
  if (game.isAllowed === false) {
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

          const casinoDebits = new CasinoDebits(payload);
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
  

  if (remote_id == 6896479) {
  }

  // //console.log("arham casinoooooooooo call",action, remote_id )
  if (!remote_id || !action) {
    return res.send({ status: '400', msg: 'Invalid Request' });
  }
  const payload1 = req.query
  const c = await new CasinoCallsPayload(payload1)
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
}

router.get('/casino', casino);
module.exports = { router,findAndProcessTransactions };