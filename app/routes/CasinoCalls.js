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

  const  anyParentCasinoBlocked= await User.find( { userId: { $in: parentUserIds }, casinoAllowed: false });
  const anyParentBettingBlocked = await User.find( { userId: { $in: parentUserIds }, bettingAllowed: false });
  const marketId = config.casinoMarketId;
  //if any of the parents hierarchy
  if (marketIds.includes(marketId) || !user.casinoAllowed || !user.bettingAllowed || anyParentCasinoBlocked.length!=0 || anyParentBettingBlocked.length!=0 ) {
    return 1;
  } else {
    return 0;
  }
}

const WinLoseTransManagement = async (balance, payload, users123, action, res, session) => {
  try {
    // Fetch the user based on remote_id
    const user = await users.findOne({ remoteId: Number(payload.remote_id) });
    
    // Current time and formatted date for transaction logs
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    const betTime = now.getTime(); // Timestamp for bet

    // Throttling mechanism: prevent multiple transactions within 1000 ms (1 second)
    const depositLastBetTime = await Cash.find({ userId: user.userId, description: "Casino (Casino Hold'em)" }).sort({ _id: -1 });
    // if (depositLastBetTime.length > 0 && (betTime - depositLastBetTime[depositLastBetTime.length - 1].betDateTime) < 1000) {
    //   console.log('Transaction occurred too quickly, skipping...');
    //   return; // Skip the transaction
    // }

    if (action === 0) {
      // Debit action
      let amount = Number(payload.amount) * casinoMultiples;
      let UpdatedExposure = Number((user.exposure - amount).toFixed(3));
      let updatedAvailableBalance = Number((user.availableBalance - amount).toFixed(3));

      // Update user balance and exposure
      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            availableBalance: updatedAvailableBalance,
            exposure: UpdatedExposure
          }
        },
        { session }
      );

      // Save debit transaction in CasinoDebits
      const casinoDebits = new CasinoDebits(payload);
      await casinoDebits.save();

      return 0; // Debit successful

    } else if (action === 1) {
      // Credit action (player wins or no result)

      // Track previous balance, available balance, and exposure
      const user_prev_balance = user.balance;
      const user_prev_availableBalance = user.availableBalance;
      const user_prev_exposure = user.exposure;

      // Find the game based on the game_id
      const gamesList = await SelectedCasino.findOne({ "games.id": payload.game_id }, { "games.$": 1 });
      const game = gamesList?.games[0];

      // Get last debits for the same game, round, and remote_id
      const lastDebits = await CasinoDebits.find({
        action: 'debit',
        game_id: payload.game_id,
        round_id: payload.round_id,
        remote_id: Number(payload.remote_id)
      });

      let debit = 0;
      for (const lastDebit of lastDebits) {
        debit += Number(lastDebit.amount);
      }

      const credit = Number(payload.amount); // Credit from payload
      const difference = credit - debit;
      const allTrans = []; // To accumulate transaction records

      if (difference < 0) {
        // Player lost, calculate updated balances and exposure
        const bettor_lost_amount = Number(((debit - credit) * casinoMultiples).toFixed(3));
        const updatedAvailableBalance = user.availableBalance + (credit * casinoMultiples);
        const updatedClientPL = Number((user.clientPL + (difference * casinoMultiples)).toFixed(3));
        const updatedBalance = Number((user.balance + (difference * casinoMultiples)).toFixed(3));
        const UpdatedExposure = 0;

        // Update user's available balance and exposure
        await users.updateOne(
          { _id: user._id },
          {
            $set: {
              availableBalance: updatedAvailableBalance,
              exposure: UpdatedExposure,
              clientPL: updatedClientPL,
              balance: updatedBalance
            }
          },
          { session }
        );

        // Log the transaction for losing the bet
        let GameName = game ? game.name : 'N/A';
        const BettorLostTran = {
          userId: user.userId,
          description: `Casino (${GameName})`,
          date: betTime,
          createdAt: formattedDate,
          amount: -bettor_lost_amount,
          balance: updatedBalance,
          availableBalance: updatedAvailableBalance,
          // Additional fields for withdrawal, credit remaining, etc.
        };

        allTrans.push(BettorLostTran);
        
        // Handle parent user balance updates based on commissions
        await handleParentUserCommissions(parentUserIds, bettor_lost_amount, game, betTime, payload, allTrans, session);

        await Cash.insertMany(allTrans); // Save all transactions in Cash
        const casinoDebits = new CasinoDebits(payload);
        await casinoDebits.save();

      } else if (difference > 0) {
        // Player won, distribute the winnings
        const bettor_won_amount = credit - debit;
        const amount = bettor_won_amount * casinoMultiples;
        const remainingAmount = Number(((amount / 100) * (100 - config.commission)).toFixed(3));
        const updatedAvailableBalance = Number((user.availableBalance + remainingAmount).toFixed(3));
        const updatedClientPL = Number((user.clientPL + remainingAmount).toFixed(3));
        const updatedBalance = Number((user.balance + remainingAmount).toFixed(3));
        // const UpdatedExposure = Number((user.exposure + (debit * casinoMultiples)).toFixed(3));
        const UpdatedExposure = 0;

        // Update user balance, clientPL, and exposure
        await users.updateOne(
          { _id: user._id },
          {
            $set: {
              availableBalance: updatedAvailableBalance,
              clientPL: updatedClientPL,
              balance: updatedBalance,
              exposure: UpdatedExposure
            }
          },
          { session }
        );

        // Log win transaction
        const BettorWinTran = {
          userId: user.userId,
          description: `Casino (${game ? game.name : 'N/A'})`,
          date: betTime,
          createdAt: formattedDate,
          amount: remainingAmount,
          balance: updatedAvailableBalance,
          availableBalance: updatedAvailableBalance,
          // Additional fields for withdrawal, credits, etc.
        };

        allTrans.push(BettorWinTran);

        // Handle parent user commission distribution for wins
        await handleParentUserCommissions(parentUserIds, bettor_won_amount, game, betTime, payload, allTrans, session);

        await Cash.insertMany(allTrans); // Save all transactions in Cash
        const casinoDebits = new CasinoDebits(payload);
        await casinoDebits.save();

      } else if (difference === 0) {
        // No win or loss (equal amounts)

        const updatedAvailableBalance = Number((user.availableBalance + (debit * casinoMultiples)).toFixed(3));
        // const UpdatedExposure = Number((user.exposure + (debit * casinoMultiples)).toFixed(3));
        const UpdatedExposure = 0;

        await users.updateOne(
          { _id: user._id },
          {
            $set: {
              availableBalance: updatedAvailableBalance,
              exposure: UpdatedExposure
            }
          },
          { session }
        );

        const casinoDebits = new CasinoDebits(payload);
        await casinoDebits.save();
      }

      // Record exposure changes
      const updatedUser = await users.findOne({ remoteId: Number(payload.remote_id) });
      const ExpTran = new ExpRec({
        userId: user.userId,
        trans_from: "casinobet",
        trans_from_id: payload.transaction_id,
        trans_bet_status: 0,
        user_prev_balance,
        user_prev_availableBalance,
        user_prev_exposure,
        user_new_balance: updatedUser.balance,
        user_new_availableBalance: updatedUser.availableBalance,
        user_new_exposure: updatedUser.exposure,
        marketId: payload.game_id,
        sportsId: 6
      });

      await ExpTran.save();

      return 0;
    }
  } catch (error) {
    console.log('Error in WinLoseTransManagement:', error);
    throw new Error('Transaction failed');
  }
};



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
        await User.updateOne({remoteId:currentUser.remote_id},{$set:{exposure:0}})
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
          let updatedExposureAmount = user.exposure + (amount * casinoMultiples);
         
          await users.updateOne(
            { _id: user?._id }, { $set: { exposure: updatedExposureAmount, availableBalance: updatedBalance } },
            { session }
          );

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

function casino(req, res) {
  const { action, remote_id } = req.query;
  if(remote_id==6896479){
  }

  // //console.log("arham casinoooooooooo call",action, remote_id )
  if (!remote_id || !action) {
    return res.send({ status: '400', msg: 'Invalid Request' });
  }
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
module.exports = { router };