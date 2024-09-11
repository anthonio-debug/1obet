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
      //console.log("arham exposureeeeeeeeeeeee ",UpdatedExposure )
      let updatedavailableBalance = Number((user.availableBalance - (amount)).toFixed(3));
      //console.log("arham updatedavailableBalance ",UpdatedExposure )
      
      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            availableBalance: updatedavailableBalance,
            exposure: UpdatedExposure
          }
        },
        { session }
      );
      console.log("hereeeeeeeeeeeeeeeeeeeeeeee 2")
      const casinoDebits = new CasinoDebits(payload);
      await casinoDebits.save();

      return 0
    } else if (action === 1) { 
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


      const lastDebits = await CasinoDebits.find({
        action: 'debit',
        game_id: payload.game_id,
        round_id: payload.round_id,
        remote_id: Number(payload.remote_id)
      });

      let debit = 0;
      for (const lastDebit of lastDebits) {
        debit = debit + Number(lastDebit.amount);
      }

      const credit = Number(payload.amount);
      const difference = credit - debit;
      const allTrans = [];
      // lose some Amount 
      const betTime = new Date().getTime();
      if (difference < 0) {
       
          console.log("diff less 0 Arham================")
        let GameName = 'N/A';
        if(game)
          GameName = game.name;
        /**
         * lose some money mean there will not be any commission only adjust the lost amount into exposure.
         * 400-1500 = -1100 OR 1499-1500 = -1 OR 0-1500 = -1500
         * suppose 1300 was lost money. credit of 200 will be added to available balance
         *
         * debit  1500
         * credit  400
         *
         * differencee = -1100
         *
         * its mean User lose 1100
         *
         */
        const updatedavailableBalance = user.availableBalance + (credit * casinoMultiples);
        const updatedclientPL = Number((user.clientPL + (difference * casinoMultiples)).toFixed(3));
        const updatedbalance = Number((user.balance + (difference * casinoMultiples)).toFixed(3));
        const bettor_lost_amount = Number(((debit - credit) * casinoMultiples).toFixed(3));
        const allTrans = [];

        // remove all exposure equal to total debit money of 1500

        const amount = Number((debit * config.casinoMultiples).toFixed(3));
        const UpdatedExposure = 0
        console.log("updateeeeeeeeeeeeeeeeeeeeeeeeeeeeeed exposure",UpdatedExposure,debit)
        
        // //console.log("arham exposureeeeeeeeeeeee winloose addiotn credit",UpdatedExposure )
        await users.updateOne(
          { _id: user?._id },
          {
            $set: {
              availableBalance: updatedavailableBalance,
              exposure: UpdatedExposure,
              clientPL: updatedclientPL,
              balance: updatedbalance
            }
          },
          { session }
        );
       
     
        const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });
        const userAvaiableBalance = await User.findOne({ userId: user.userId }).sort({ _id: -1 });
      
        const balance = -userAvaiableBalance.balance - bettor_lost_amount 
        if (balance < 0) {
          log(
            `${JSON.stringify({
              userId: user.userId,   
              description: `Casino (${GameName})`,
              date: now.getTime(),
              createdAt: formattedDate,  
              amount: -bettor_lost_amount,  
              balance:updatedavailableBalance,
              availableBalance: updatedavailableBalance,
              maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - bettor_lost_amount : 0,
              cash: lastMaxWithdraw?.cash || 0,
              credit: lastMaxWithdraw?.credit || 0,
              creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
              calledArea: " difference < 0 ",
              createdBy: 0,
              casinoBetAmount: debit,
              event: GameName,
              betDateTime: betTime,
              betId: payload.transaction_id,
              marketId: payload.game_id,
              roundId: payload.round_id,
              matchId: payload.game_id,
              cashOrCredit: "Bet",
              sportsId: "6",
            })}\n\n\n${JSON.stringify(payload)}\n\n\n${JSON.stringify(user)}\n\n\n${JSON.stringify(lastMaxWithdraw)}\n\n\n${JSON.stringify(game)}\n\n\n${JSON.stringify(lastDebits)}`,
            path.join(__dirname, '../../../', 'log1.log')
          );
        } else {
          log(
            `${JSON.stringify({
              userId: user.userId,
              description: `Casino (${GameName})`,
              date: now.getTime(),
              createdAt: formattedDate,
              amount: -bettor_lost_amount,
              balance,
              availableBalance: updatedavailableBalance,
              maxWithdraw: updatedavailableBalance,
              cash: lastMaxWithdraw?.cash || 0,
              credit: lastMaxWithdraw?.credit || 0,
              creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
              calledArea: " difference < 0 ",
              createdBy: 0,
              casinoBetAmount: debit,
              event: GameName,
              betDateTime: betTime,
              betId: payload.transaction_id,
              marketId: payload.game_id,
              roundId: payload.round_id,
              matchId: payload.game_id,
              cashOrCredit: "Bet",
              sportsId: "6",
            })}\n\n\n${JSON.stringify(payload)}\n\n\n${JSON.stringify(user)}\n\n\n${JSON.stringify(lastMaxWithdraw)}\n\n\n${JSON.stringify(game)}\n\n\n${JSON.stringify(lastDebits)}`,
            path.join(__dirname, '../../../', 'log2.log')
          );
        }
        let BettorLostTran = {
          userId: user.userId,
          description: `Casino (${GameName})`,
          date: now.getTime(),
          createdAt: formattedDate,
          amount: -bettor_lost_amount,
          balance:updatedavailableBalance,
          availableBalance: updatedavailableBalance,
          maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - bettor_lost_amount : 0,
          cash: lastMaxWithdraw?.cash || 0,
          credit: lastMaxWithdraw?.credit || 0,
          creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
          calledArea: " difference < 0 ",
          createdBy: 0,
          casinoBetAmount: debit,
          event: GameName,
          betDateTime: betTime,
          betId: payload.transaction_id,
          marketId: payload.game_id,
          roundId: payload.round_id,
          matchId: payload.game_id,
          cashOrCredit: "Bet",
          sportsId: "6",
        }
        allTrans.push(BettorLostTran)

        //start of code for giving shares to all share holders

        const parentUserIds = [];
        let currentUserId = user.userId;
        while (currentUserId) {

          const parentUser = await users.findOne(
            { userId: currentUserId },
            { session }
          );
          if (parentUser.role == "0") {
            //////console.log("break User area ");
            break;
          }
          parentUserIds.push(parentUser.createdBy);
          currentUserId = parentUser.createdBy;
        }

        const parentUser = await users.find(
          { userId: { $in: parentUserIds }, isDeleted: false }
        ).sort({ role: -1 }).toArray();


        if (!parentUser) {
          return res.json({ status: '500', msg: `Internal Server Error` });
        }
        let commissionFrom = user.userId;
        let upMovingAmount = bettor_lost_amount;
        let prev = 0;
        for (const user of parentUser) {
          let current = user.downLineShare;
          user["commission"] = current - prev;
          prev = current;
        }

        for (const user of parentUser) {
          /**
           * 85 Admin  15
           * 70 Smaster  20
           * 50 Master  50
           * 0 Battor
           */

          const availableBalance = Number((user.availableBalance + (user.commission / 100) * bettor_lost_amount).toFixed(3));
          const balance = Number((user.balance + (user.commission / 100) * bettor_lost_amount).toFixed(3));
          const clientPL = user.clientPL - user.downLineShare !== 100 ? Number((user.clientPL - ((100 - user.downLineShare) / 100) * bettor_lost_amount).toFixed(3)) : 0;
          const userResponse = await users.updateOne(
            { _id: user?._id },
            {
              $set: {
                availableBalance: availableBalance,
                clientPL: clientPL,
                balance: balance
              }
            },
            { session }
          );

          const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });
      
          let betTransaction = {
            userId: user.userId,
            description: `Casino (${GameName})`,
            date: now.getTime(),
            createdAt: formattedDate,
            commissionFrom: commissionFrom,
            createdBy: 0,
            betDateTime: betTime,
            casinoBetAmount: debit,
            amount: availableBalance,
            balance: availableBalance,
            availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + (user.commission / 100) * bettor_lost_amount : (user.commission / 100) * bettor_lost_amount,
            maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (user.commission / 100) * bettor_lost_amount : 0,  // max withdraw cant be negative
            cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
            credit: lastMaxWithdraw ? lastMaxWithdraw.credit : 0,
            creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining : 0,
            betId: payload.transaction_id,
            cashOrCredit: "Bet",
            sportsId: "6",
            event: GameName,
            roundId: payload.round_id,
            marketId: payload.game_id,
            matchId: payload.game_id,
            upLineAmount: upMovingAmount
          }

          allTrans.push(betTransaction);

          upMovingAmount = Number((upMovingAmount - (user.commission / 100) * bettor_lost_amount).toFixed(3));
          commissionFrom = user.userId;
        }
        await Cash.insertMany(allTrans);
        //end of code to give lost money to all share holders
        const casinoDebits = new CasinoDebits(payload);
        await casinoDebits.save();
      } else if (difference > 0) {
        console.log("diff greater 0 Arham================")

        // Win some Amount

        /**
         * Win Some Amount
         * so available balance will be updated with credit money ( user.availablebalance+credit ),
         */

        /**
         * remove all exposure equal to total debit money of 1500
         * set exposure to original ( user.exposure +  debit )
         * let amount = debit * config.casinoMultiples;
         * avl balance - 1500
         * Expoisure -1500
         * Credit  Amount 1600
         * Winning Amount 100
         *
         */

        let bettor_won_amount = credit - debit;
        let GameName = 'N/A';
        if(game)
          GameName = game.name;
        //deduct commission amount from above bettor_won_amount, and UpdatedAvailableBalance ( debit + wonAmountAfterCommission )

        const amount = bettor_won_amount * casinoMultiples;
        const remainingAmount = Number(((amount / 100) * (100 - config.commission)).toFixed(3));
        const commissionAmount = Number(((amount / 100) * config.commission).toFixed(3));
        let upMovingAmount = Number(amount.toFixed(3));
        let commissionFrom = user.userId;
        let upMovingCommAmount = Number(commissionAmount.toFixed(3));

        const updatedavailableBalance = Number((user.availableBalance + (remainingAmount) + debit * config.casinoMultiples).toFixed(3));
        const updatedclientPL = Number((user.clientPL + (remainingAmount)).toFixed(3));
        const updatedbalance = Number((user.balance + (remainingAmount)).toFixed(3));
        const UpdatedExposure = Number(((user.exposure) + (debit * config.casinoMultiples)).toFixed(3));
        // //console.log("arham exposureeeeeeeeeeeee winloose addiotn debit",UpdatedExposure )
        const userResponse = await users.updateOne(
          { _id: user?._id },
          {
            $set: {
              availableBalance: updatedavailableBalance,
              clientPL: updatedclientPL,
              balance: updatedbalance,
              exposure: UpdatedExposure,
            }
          },
          { session }
        );

        const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });

        let UserWinBetTrans = {
          userId: user.userId,
          description: `Casino (${GameName})`,
          date: now.getTime(),
          createdAt: formattedDate,
          createdBy: 0,
          betDateTime: betTime,
          casinoBetAmount: debit,
          amount: remainingAmount,
          balance: updatedavailableBalance,
          availableBalance: updatedavailableBalance,
          maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + remainingAmount : remainingAmount,
          cashOrCredit: "Bet",
          cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
          credit: lastMaxWithdraw?.credit || 0,
          creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
          betId: payload.transaction_id,
          roundId: payload.round_id,
          calledArea: "difference > 0",
          event: GameName,
          sportsId: "6",
          marketId: payload.game_id,
          matchId: payload.game_id,
        }

        allTrans.push(UserWinBetTrans)

        const parentUserIds = [];
        let currentUserId = user.userId;
        while (currentUserId) {
          const parentUser = await users.findOne(
            { userId: currentUserId },
            { session }
          );
          if (parentUser.role == "0") {
            
            break;
          }
          parentUserIds.push(parentUser.createdBy);
          currentUserId = parentUser.createdBy;
        }

        const parentUser = await users.find(
          { userId: { $in: parentUserIds }, isDeleted: false }
        ).sort({ role: -1 }).toArray();


        if (!parentUser) {
  
          return res.json({ status: '500', msg: `Internal Server Error` });
        }

        let prev = 0;
        for (const user of parentUser) {
          let current = user.downLineShare;
          user["commission"] = current - prev;
          prev = current;
        }

      

        for (const user of parentUser) {

          const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });
       

          let availableBalance = Number((user.balance - (user.commission / 100) * remainingAmount).toFixed(3));
          let Balancebalance = Number((user.balance - (user.commission / 100) * remainingAmount).toFixed(3));
          let clientPL = user.downLineShare !== 100 ? Number((user.clientPL + ((100 - user.downLineShare) / 100) * remainingAmount).toFixed(3)) : 0;

          let userResponse = await users.updateOne(
            { _id: user?._id }, {
              $set: {
                availableBalance: availableBalance,
                clientPL: clientPL,
                balance: Balancebalance
              }
            },
            { session }
          );

          let betTransaction = {
            userId: user.userId,
            description: `Casino (${GameName})`,
            date: now.getTime(),
            createdAt: formattedDate,
            createdBy: 0,
            betDateTime: betTime,
            casinoBetAmount: debit,
            amount: -(user.commission / 100) * amount,
            balance: availableBalance,
            availableBalance: availableBalance,
            maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - (user.commission / 100) * amount : 0,
            cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
            credit: lastMaxWithdraw?.credit || 0,
            creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
            cashOrCredit: "Bet",
            sportsId: "6",
            event: GameName,
            marketId: payload.game_id,
            roundId: payload.round_id,
            betId: payload.transaction_id,
            matchId: payload.game_id,
            upLineAmount: upMovingCommAmount
          }
          allTrans.push(betTransaction)

          const prevBalance = lastMaxWithdraw ? lastMaxWithdraw.balance - (user.commission / 100) * amount : -(user.commission / 100) * amount;
          const prevAvailableBalance = lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (user.commission / 100) * amount : -(user.commission / 100) * amount;
          const prevMaxWithdraw = lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - (user.commission / 100) * amount : 0;

          let commissionTransaction = {
            userId: user.userId,
            description: `Casino (${GameName})`,
            date: now.getTime(),
            createdAt: formattedDate,
            createdBy: 0,
            betDateTime: betTime,
            casinoBetAmount: debit,
            commissionFrom: commissionFrom,
            amount: (user.commission / 100) * commissionAmount,
            balance: availableBalance,
            availableBalance: availableBalance,
            maxWithdraw: prevMaxWithdraw + (user.commission / 100) * commissionAmount,
            // balance: lastMaxWithdraw ? lastMaxWithdraw.balance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
            // availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
            // maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
            cash: lastMaxWithdraw ? lastMaxWithdraw.cash + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
            credit: lastMaxWithdraw?.credit || 0,
            creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
            cashOrCredit: "Commission",
            betId: payload.transaction_id,
            roundId: payload.round_id,
            sportsId: "6",
            event: GameName,
            marketId: payload.game_id,
            matchId: payload.game_id,
            upLineAmount: upMovingCommAmount
          }

          allTrans.push(commissionTransaction);

          upMovingAmount = Number((upMovingAmount - (user.commission / 100) * amount).toFixed(3));
          upMovingCommAmount = Number((upMovingCommAmount - (user.commission / 100) * commissionAmount).toFixed(3));
          commissionFrom = user.userId;
        }

        await Cash.insertMany(allTrans);

        const casinoDebits = new CasinoDebits(payload);
        await casinoDebits.save();
      } else if ((difference === 0)) {
        console.log("diff equal 0 Arham================")

        // No Win lose
        const updatedavailableBalance = Number((user.availableBalance + (debit * casinoMultiples)).toFixed(3))
        const UpdatedExposure = Number((user.exposure + (debit * casinoMultiples)).toFixed(3))
        // //console.log("arham exposureeeeeeeeeeeee winloose addiotn credit df 0",UpdatedExposure )
        await users.updateOne(
          { _id: user?._id },
          { $set: { availableBalance: updatedavailableBalance, exposure: UpdatedExposure } },
          { session }
        );

        const casinoDebits = new CasinoDebits(payload);
        await casinoDebits.save();
      }

      const updatedUser = await users.findOne({ remoteId: Number(payload.remote_id) });
      const user_new_balance = updatedUser.balance;
      const user_new_availableBalance = updatedUser.availableBalance;
      const user_new_exposure = updatedUser.exposure;

      const ExpTran = new ExpRec({
        userId: user.userId,
        trans_from: "casinobet",
        trans_from_id: payload.transaction_id,
        trans_bet_status: 0,
        user_prev_balance: user_prev_balance,
        user_prev_availableBalance: user_prev_availableBalance,
        user_prev_exposure: user_prev_exposure,
        user_new_balance: user_new_balance,
        user_new_availableBalance: user_new_availableBalance,
        user_new_exposure: user_new_exposure,
        marketId: payload.game_id,
        sportsId: 6,
      });

      await ExpTran.save();

      return 0
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