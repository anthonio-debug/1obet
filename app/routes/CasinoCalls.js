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
//console.log("=====================================",groupedTransactions);

for (const tran of groupedTransactions) {
  const CasinoDebitroundsCount = await CasinoCalls.countDocuments({ round_id: tran._id, action: 'debit' });
  const CasinoCreditroundsCount = await CasinoCalls.countDocuments({ round_id: tran._id, action: 'credit' });
  const CasinoUploadsDebitroundsCount = await CasinoCallsPayload.countDocuments({ round_id: tran._id, action: 'debit' });
  const CasinoUploadsCreditroundsCount = await CasinoCallsPayload.countDocuments({ round_id: tran._id, action: 'credit' });
  const CasinoUploadsRollBackroundsCount = await CasinoCallsPayload.countDocuments({ round_id: tran._id, action: 'rollback' });
  const CasinoRollBackroundsCount = await CasinoCallsPayload.countDocuments({ round_id: tran._id, action: 'rollback' });

  if (CasinoDebitroundsCount===0 || CasinoUploadsDebitroundsCount===0 ||  CasinoDebitroundsCount !== CasinoUploadsDebitroundsCount || CasinoCreditroundsCount !== CasinoUploadsCreditroundsCount || CasinoUploadsRollBackroundsCount != CasinoRollBackroundsCount ) {
    continue;
  }

  console.log("tran--------------------------------------------------", tran);

  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    const session = await mongoose.startSession();  // Start a session at the beginning of the loop
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

        const existingDeposit = await Cash.findOne({ roundId: tran._id.toString(), userId:userRecord.userId });

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
            console.log("totalDebitAmount-------------------------------->>>>>>>>>>>",totalDebitAmount);
            console.log("totalDebitAmount-------------------------------->>>>>>>>>>>",totalDebitAmount);
            console.log("totalDebitAmount-------------------------------->>>>>>>>>>>",totalDebitAmount);
            console.log("totalDebitAmount-------------------------------->>>>>>>>>>>",totalDebitAmount);
            console.log("totalDebitAmount-------------------------------->>>>>>>>>>>",totalDebitAmount);
            console.log("totalDebitAmount-------------------------------->>>>>>>>>>>",totalDebitAmount);
            console.log("totalDebitAmount-------------------------------->>>>>>>>>>>",totalDebitAmount);
            console.log("totalDebitAmount-------------------------------->>>>>>>>>>>",totalDebitAmount);
            console.log("totalDebitAmount-------------------------------->>>>>>>>>>>",totalDebitAmount);
            console.log("totalDebitAmount-------------------------------->>>>>>>>>>>",totalDebitAmount);
            console.log("totalDebitAmount-------------------------------->>>>>>>>>>>",totalDebitAmount);
            console.log("totalDebitAmount-------------------------------->>>>>>>>>>>",totalDebitAmount);
            console.log("userRecord.exposure -------------------------------->>>>>>>>>>>",userRecord.exposure);
            console.log("totalDebitAmount * casinoMultiples-------------------------------->>>>>>>>>>>",totalDebitAmount * casinoMultiples);

            console.log("userRecord.exposure + (totalDebitAmount * casinoMultiples)-------------------------------->>>>>>>>>>>",userRecord.exposure + (totalDebitAmount * casinoMultiples));
            
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
      
      expPositiveData = await expPositive.findOne({ userId:userRecord.userId,roundId:tran._id });
   
      if(expPositiveData){
        await expPositive.updateMany(
          {
            userId:userRecord.userId,roundId:tran._id
          },
          {
            expReleased: (totalDebitAmount * casinoMultiples),
            expReleasedC: (totalDebitAmount * casinoMultiples),
            expAfterRelease:userRecord.exposure + (totalDebitAmount * casinoMultiples),
            AbAtRelease:updatedAvailableBalance
            
          },
          { session }
        );
      }




            await CasinoCalls.updateMany({ round_id: tran._id.toString() }, { $set: { isProcessing: false } }, { session });

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
    //processQueue();
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
  



  console.log(" casinoooooooooo call",action, remote_id )
console.log(" casinoooooooooo call")
console.log(" casinoooooooooo call")
console.log(" casinoooooooooo call")
console.log(" casinoooooooooo call")
console.log(" casinoooooooooo call")
console.log(" casinoooooooooo call")
console.log(" casinoooooooooo call")
console.log(" casinoooooooooo call")
console.log(" casinoooooooooo call")
console.log(" casinoooooooooo call")
console.log(" casinoooooooooo call")

console.log(" casinoooooooooo call")
console.log(" casinoooooooooo call")

console.log(" casinoooooooooo call")
console.log(" casinoooooooooo call")
console.log(" casinoooooooooo call")

  if (!remote_id || !action) {
    return res.send({ status: '400', msg: 'Invalid Request' });
  }
  const payload1 = req.query
 
 
//if(payload1.provider== 'es' || payload1.provider== 'ez'  || payload1.provider== 'fg'){
  //payload1.comingFrom = 'payloads';


  
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
  
const c = await new CasinoCallsPayload(payload1)
  
console.log("c.........................",c);

c.save() 
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
  
      
      try {
        const duplicates = await CasinoCalls.aggregate([
          { $group: { 
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
          try {
              session.startTransaction();
      
              const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 }).session(session);
              const transactionId2 = matchedPayload.transaction_id.toString().trim();
      
              // Check if transaction already exists in CasinoCalls
              const idExists2 = await CasinoCalls.findOne({ transaction_id: transactionId2 }).session(session);
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
              
              if (idExists2 || user.exposure > 0) {
                  //console.log("Transaction already exists for", matchedPayload.remote_id);
                  continue; // Skip to the next iteration if the transaction already exists
              }
      
              // Check for valid conditions to process the transaction
              if (user.availableBalance >= amount && lastMaxWithdraw.availableBalance >= amount && lastMaxWithdraw.availableBalance > 0 && !idExists2) {
                  if (matchedPayload.action === 'debit' && matchedPayload.isUsed === false) {
                    expPositiveDataEx = await expPositive.findOne({ betId:matchedPayload.transactionId });
   
      if(!expPositiveDataEx){
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
                      try{
                      await CasinoCallsPayload.updateOne(
                        { transaction_id: transactionId2 },
                        { $set: { isUsed: true } },
                        { session }
                    );
                  } catch (error) {
                    console.error('Error during updating payloads for isUsed true for credit:', error);
                    throw error; // Rethrow error to trigger transaction rollback
                }


                  }else{
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
                  }else{
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