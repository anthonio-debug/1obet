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
   // Max retries for the transaction
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  
    let i=0;
    
      

      const limitValue = 8; // Set your desired limit here
     
      //session.endSession();
      const groupedTransactions = await CasinoCalls.aggregate([
        {
          $match: {
            isProcessing: true,
            $or: [
              { gameplay_final: 1 },
              { action: 'rollback' },
              //{ provider: 'bf' }
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
          $sort: {
            lastCheckedTime: 1 // Sort by round_id (ascending)
          }
        },
        {
          $limit: limitValue // Limit the number of results returned
        }
      ]);  
      let groupedTransactionsIds = []
     
      if (groupedTransactions.length > 0) {
        groupedTransactions.forEach((doc) => {
          groupedTransactionsIds.push(doc._id);
          // console.log("event >>>>", element.marketId, "--Name: ", element.marketName, "==eventId=", element.eventId, "===sportID===",element.sportID);
        });
      }
      //console.log("MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM:",marketIds);
      await CasinoCalls.updateMany({ round_id: { $in: groupedTransactionsIds } }, { $set: { lastCheckedTime: Date.now() } },{session});
      
      
      console.log("groupedTransactions================",groupedTransactions.length,"=============================",groupedTransactions);
      
      if (!groupedTransactions || groupedTransactions.length === 0) {
       // console.log('No transactions found for the given round_id and username.');
       // await session.abortTransaction();  // Abort the transaction if no records found
       session.endSession();
        return;
      }
      
      for (const tran of groupedTransactions) {

    const CasinoDebitroundsCount = await CasinoCalls.countDocuments({ round_id: tran._id,action:'debit' });
    const CasinoCreditroundsCount = await CasinoCalls.countDocuments({ round_id: tran._id,action:'credit' });
    const CasinoUploadsDebitroundsCount = await CasinoCallsPayload.countDocuments({ round_id: tran._id,action:'debit' });
    const CasinoUploadsCreditroundsCount = await CasinoCallsPayload.countDocuments({ round_id: tran._id,action:'credit' });
    //console.log("tran.username=================================",tran.username);
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

    if(CasinoDebitroundsCount!= CasinoUploadsDebitroundsCount || CasinoCreditroundsCount != CasinoUploadsCreditroundsCount){
      //console.log("Round is not completed yet for ",tran._id);
     // session.endSession();

      continue
    }
       // session.startTransaction(); 
    
       const maxRetries = 3; // Max retries for the transaction
  let retries = 0;

  while (retries < maxRetries) {

    
    try {
        session.startTransaction();
        await CasinoCalls.updateMany({ round_id: tran._id }, 
          { $set: { lastCheckedTime: Date.now() } },
        { session });
        await session.commitTransaction();
        const userRecord = await users.findOne(
          { remoteId: Number(tran.remote_id) },
          { session }
        );

        if (!userRecord) {
          console.log(`User not found for remoteId: ${tran.remote_id}`);
          session.endSession();
          //await session.commitTransaction();
          //await session.abortTransaction();
          
          continue; // Skip if user not found
        }
         session.startTransaction();
        const existingDeposit = await Cash.findOne({
          roundId: tran._id.toString(),
          remote_id:tran.remote_id
        });
       
        if (!existingDeposit) {
          let totalCreditAmount = 0;
          let totalDebitAmount = 0;
          let totalRollBackAmount = 0;
          let differenceDbCr = 0;
         
          const roundIds = await CasinoCalls.find({ round_id: tran._id });
         
          console.log("round_id---------------",tran._id);
          for (const rounds of roundIds) {
            console.log("---round.amount---",rounds.amount,"==rounds.action==",rounds.action);
            
            if (rounds.action === 'credit') {
              totalCreditAmount += Number(rounds.amount);
              console.log("totalCreditAmount======",totalCreditAmount,"==totalRollBackAmount==",totalRollBackAmount);
            }
            if (rounds.action === 'debit') {

              totalDebitAmount += Number(rounds.amount);
              console.log("totalDebitAmount---",totalDebitAmount,"==totalRollBackAmount==",totalRollBackAmount);

            }
            if (rounds.action === 'rollback') {
              totalRollBackAmount += Number(rounds.amount);
              proceedIt = true;
            }
            
            
            

            
            
            usernameAllowed = rounds.username;
            

            
             if(rounds.gameplay_final===1){
               proceedIt = true;
             }
          }
          
          
          
          console.log("Here I am readched........................1");
          console.log("totalCreditAmount======",totalCreditAmount,"totalDebitAmount---",totalDebitAmount,"==totalRollBackAmount==",totalRollBackAmount);
          const gamesList = await SelectedCasino.findOne(
            { "games.id": tran.game_id },
            { "games.$": 1 }
          );
          let CgameName;
          let Cgame_id;
          if(gamesList){
            const game = gamesList?.games[0];
             CgameName = game.name;
             Cgame_id = game.game_id;
          }
         
          
          


          
          // if(proceedIt===false){
            
          //   console.log('Result not announced yet for this transaction:.',tran._id);
          //   await session.abortTransaction();  // Abort the transaction if no records found
          //   return;
          // }
          let userPrevClientPL = userRecord.clientPL;
          totalCreditAmount += totalRollBackAmount;
          differenceDbCr = (totalCreditAmount - totalDebitAmount) * casinoMultiples;

          let AccumulativeDebit = totalDebitAmount * casinoMultiples;
          let AccumulativeCredit = totalCreditAmount * casinoMultiples;
          const updatedAvailableBalance = userRecord.availableBalance + AccumulativeCredit;

          const lastMaxWithdraw = await Cash.findOne({ userId: userRecord.userId }).sort({ _id: -1 });
          
          // console.log("tran._idt........................",tran._id, "--userRecord.userId--", userRecord.userId);
           console.log("userRecord.exposure........................",userRecord.exposure);
           console.log("AccumulativeDebit........................",AccumulativeDebit);
           console.log("AccumulativeCredit........................",AccumulativeCredit);
           console.log("userRecord.exposure + AccumulativeDebit........................",userRecord.exposure + AccumulativeDebit);
           
           









          


          //if(userRecord.exposure + AccumulativeDebit<=0){
          
          i++;
          console.log("--------------------------------------------------->>>>",i,">>",differenceDbCr);
            // const betTransactionData = {
            //   userId: userRecord.userId,
            //   description: `Casino (${tran.game_id})`,
            //   date: new Date().getTime(),
            //   amount: differenceDbCr,
            //   balance: lastMaxWithdraw.balance + differenceDbCr,
            //   availableBalance: lastMaxWithdraw.availableBalance + differenceDbCr,
            //   maxWithdraw: lastMaxWithdraw.maxWithdraw + differenceDbCr,
            //   roundId: tran._id,
            //   updatedExposure: userRecord.exposure + AccumulativeDebit,
            //   credit: lastMaxWithdraw ? lastMaxWithdraw.credit : 0,
            //   creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining : 0,
            //   cashOrCredit: "Settlement"+i,
            //   sportsId: "6",
            //   event: CgameName,
            //   roundId: tran._id,
            //   marketId: tran._id,
            //   matchId: Cgame_id,
            // };
            
            // const deposit = new Cash(betTransactionData);
            // await deposit.save({ session });




        
          console.log("lastMaxWithdraw-------------------------------",lastMaxWithdraw);
          console.log("lastMaxWithdraw.availableBalance-------------------------------",lastMaxWithdraw.availableBalance);
          console.log("differenceDbCr-------------------------------",differenceDbCr);
          console.log("lastMaxWithdraw.maxWithdraw-------------------------------",lastMaxWithdraw.maxWithdraw);
            await Cash.create([{
              userId: userRecord.userId,
              description: `Casino (${tran.game_id})`,
              date: new Date().getTime(),
              amount: differenceDbCr,
              balance: lastMaxWithdraw.balance + differenceDbCr,
              availableBalance: lastMaxWithdraw.availableBalance + differenceDbCr,
              maxWithdraw: lastMaxWithdraw.maxWithdraw + differenceDbCr,
              roundId: tran._id,  // Keep roundId here only once
              betId: tran._id,    // This is fine if you intend for betId to be the same as roundId
              updatedExposure: userRecord.exposure + AccumulativeDebit,
              credit: lastMaxWithdraw ? lastMaxWithdraw.credit : 0,
              creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining : 0,
              cashOrCredit: "Casino Bet",
              sportsId: "6",
              event: CgameName,
              marketId: tran._id, // Ensure this is correct (may need a different value than tran._id)
              matchId: Cgame_id
            }], { session });







            console.log("lllllllllllllllllllllllllllllllllllllkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk");







            await users.updateOne(
              { _id: userRecord._id },
              {
                $set: {
                  balance: updatedAvailableBalance,
                  clientPL: userPrevClientPL+differenceDbCr,
                  availableBalance: updatedAvailableBalance,
                  exposure: userRecord.exposure + AccumulativeDebit
                }
              },
              { session }
            );





            let expPositiveData;
      
      expPositiveData = await expPositive.findOne({ userId:userRecord.userId,roundId:tran._id });
      //console.log("-------------------------------------user.............",expPositiveData);
      //console.log("-------------------------------------userToUpdate.userId.............",userToUpdate.userId);
      //console.log("-------------------------------------bet.betId.............",bet._id.toString());
      //console.log("-------------------------------------bet.marketId.............",bet.marketId);

      if(expPositiveData){
        //console.log("-------------------------------------exp insdie.............",expPositiveData);
        await expPositive.updateOne(
          {
            userId:userRecord.userId,roundId:tran._id
          },
          {
            expReleased:AccumulativeDebit,
            
          },
          { session }
        );
      }




           



    
         

                  



            await CasinoCalls.updateMany(
              { round_id: tran._id.toString() },
              { $set: { isProcessing: false } },
              { session }
            );
  
            

            const parentUserIds = await getParents(userRecord.userId);
            const parentUser = await User.find({
              userId: { $in: parentUserIds },
              isDeleted: false
            }).sort({ userId: -1 });
            if (!parentUser) {
              console.error(' Error: Parent Users Not Found Location:(_handle losing bet) ');
              return;
            } else {
              let NeutralselectedRunnerAmount = Math.abs(differenceDbCr);
              let upMovingAmount = NeutralselectedRunnerAmount;
              let totalRemainingAmount = differenceDbCr;
              let remainingAmount = NeutralselectedRunnerAmount;
              let commissionAmount = 0;
              let upMovingCommAmount = 0;
              console.log("-------------------------------------------------------------------------------------------------===",totalRemainingAmount);
              
              let prev = 0;
              for (const user of parentUser) {
                let current = user.downLineShare;
                user['commission'] = current - prev;
                prev = current;
              }
              let commissionFrom = userRecord.userId;
              for (const user of parentUser) {
                
              
                //let runnersPosition = bet.runnersPosition;
             
                
              let winningsShareAmount = Number(((user.commission / 100) * remainingAmount).toFixed(3));
              let loosingShareAmount = Number(((user.commission / 100) * remainingAmount).toFixed(3));
              let exposureAmountShare = Number(((user.commission / 100) * AccumulativeDebit).toFixed(3));
              // console.log("remainingAmount------------------------------------------------------->>>>>",remainingAmount);
              // console.log("loosingShareAmount------------------------------------------------------->>>>>",remainingAmount);    
              // //winningsShareAmount mean when bettor WIN so it mean dealer LOST  
              //loosingShareAmount mean when bettor LOST so it mean dealer WON
                // console.log("user.exposure....................,",user.userId,"...................",user.exposure);
                // console.log("winningsShareAmount....................,",user.userId,"...................",winningsShareAmount);
              let UpdatedExposureAmount = user.exposure + exposureAmountShare;
              // console.log("UpdatedExposureAmount....................,",user.userId,"...................",UpdatedExposureAmount);
              // console.log("Difference is caclauted and I am shoiwng as hereas..................",differenceDbCr);
              let UpdatedAvailableBalance =  user.availableBalance;
              
              let totalClientPLAmount;
              let userBalance;
              let totalBalance = user.balance;
              let totalClientPL = user.clientPL;
              let upLineAmount =0;
              if(differenceDbCr==0){ 

                UpdatedAvailableBalance= user.availableBalance + exposureAmountShare;
                //UpdatedAvailableBalance =UpdatedAvailableBalance + loosingShareAmount;


              }
              else if(differenceDbCr<0){ 
                
                UpdatedAvailableBalance= user.availableBalance + winningsShareAmount;
                UpdatedAvailableBalance =UpdatedAvailableBalance + loosingShareAmount;
                
               // console.log("----------user.downLineShare:", user.downLineShare);


                 totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount).toFixed(3)) : 0;
                 //60% .  .. .100-60 = 40% upline share.... 40/100 = .40 * 1000 = 400 ClientPL. . .
                 userBalance = totalClientPLAmount;
                 //400=400
                //  console.log("differenceDbCr<0", "----....",user.userName, "---------userBalance/totalClientPLAmount----------", userBalance);

                //  console.log("user.commission:",user.commission, "----------user.balance:", userBalance);

                 totalBalance = Number((user.balance + Number(((user.commission / 100) * remainingAmount).toFixed(3))).toFixed(3));
  
  
  
                 // suppose user.balance: 0, 0+600=600. .  2) suppose user.balance: 10, 10 + ( 600 ) = 610--- 3) user.balance: -10, -10 + ( 600 ) = 590
                 // 4) user.balance:
  
                 //console.log("differenceDbCr<0", "----------totalBalance----------", totalBalance);
                 totalClientPL = Number((user.clientPL + (-totalClientPLAmount)).toFixed(3));
                 // suppose user.clientPL: 0, 0+-400=-400. .  2) suppose user.clientPL: 10, 10 + ( -400 ) = -390--- 3) user.clientPL: -10, -10 + ( -400 ) = -410
                 // 4) user.clientPL: 
                 upLineAmount = -totalClientPLAmount;
              }else{
              
                totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount).toFixed(3)) : 0;
                 //60% .  .. .100-60 = 40% upline share.... 40/100 = .40 * 1000 = 400 ClientPL. . .
                 
                 userBalance = totalClientPLAmount;
                 //console.log("Else..........",user.userName, "----------userBalance/totalClientPLAmount----------", userBalance);
                 
                 totalBalance = Number((user.balance - Number(((user.commission / 100) * remainingAmount).toFixed(3))).toFixed(3));
                 // suppose user.balance: 0, 0-600=-600. .  2) suppose user.balance: 10, 10 - ( 600 ) = -590--- 3) user.balance: -10, -10 - ( 600 ) = 610
                 // 4) user.balance:
  
                 //console.log("Else::", "----------totalBalance----------", totalBalance);
                 totalClientPL = Number((user.clientPL + totalClientPLAmount).toFixed(3));
                 // suppose user.clientPL: 0, 0+400=400. .  2) suppose user.clientPL: 10, 10 + ( 400 ) = 410--- 3) user.clientPL: -10, -10 + ( 400 ) = 390
                 // 4) user.clientPL: 
                 upLineAmount = totalClientPLAmount;
  
              }
              // console.log("totalBalance:::::::::::::::::::;",totalBalance);
              // console.log("UpdatedExposureAmount:::::::::::::::::::;",UpdatedExposureAmount);
              // console.log("UpdatedAvailableBalance:::::::::::::::::::;",UpdatedAvailableBalance);
              // console.log("totalClientPL:::::::::::::::::::;",totalClientPL);
              const totalExpoisure = Number((user.exposure + Number(((user.commission / 100) * totalRemainingAmount).toFixed(3))).toFixed(3));
              //const totalBalance = Number((user.balance - Number(((user.commission / 100) * remainingAmount).toFixed(3))).toFixed(3));
              const totalavailableBalance = Number((user.availableBalance + Number(((user.commission / 100) * commissionAmount).toFixed(3))).toFixed(3));
  
            



               
                await User.updateOne(
                  {
                    userId: user.userId,
                    isDeleted: false
                  },
                  {
                    balance: totalBalance,//P/L Downline
                    exposure: UpdatedExposureAmount,
                    //availableBalance: UpdatedAvailableBalance,
                    availableBalance: totalBalance + UpdatedExposureAmount,
                    clientPL: totalClientPL //Balance Upline
                  },{ session }
                );


                expPositiveDataP = await expPositive.findOne({ userId:user.userId,roundId:tran._id });
      //console.log("-------------------------------------user.............",expPositiveData);
      //console.log("-------------------------------------userToUpdate.userId.............",userToUpdate.userId);
      //console.log("-------------------------------------bet.betId.............",bet._id.toString());
      //console.log("-------------------------------------bet.marketId.............",bet.marketId);

      if(expPositiveDataP){
        
        await expPositive.updateOne(
          {
            userId:user.userId,roundId:tran._id
          },
          {
            expReleased:exposureAmountShare,
            
          },
          { session }
        );
      }


        
                let amount = -(user.commission / 100) * totalRemainingAmount;
              
                
          let Dbalance = amount
          let DavailableBalance = amount;
          
          const shareNUpline = amount > 0 ? (Math.abs(amount) + Math.abs(upLineAmount)) : - ( Math.abs(amount) + Math.abs(upLineAmount) )

          const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });
          
          if(lastMaxWithdraw){
            Dbalance = lastMaxWithdraw.balance + (amount)
            DavailableBalance = lastMaxWithdraw.availableBalance + (amount)
          }
          //let DavailableBalance = lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (amount) : -(amount);

          let DmaxWithdraw = lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (amount) : -( amount );
          
          let DCash = lastMaxWithdraw ? lastMaxWithdraw.cash : 0;
          let Dcredit = lastMaxWithdraw?.credit || 0;
          let DcreditRemaining = lastMaxWithdraw?.creditRemaining || 0;
          
          
                
                  await Cash.create([{
                    userId: user.userId,
                    description: `Casino (${CgameName})`,
                    createdBy: 0,
                    amount: amount,
                    balance:Dbalance, 
                    availableBalance: DavailableBalance,
                    maxWithdraw: DmaxWithdraw,
                    cash: DCash,
                    credit: Dcredit,
                    creditRemaining: DcreditRemaining,
                    marketId: tran._id,
                    
                    cashOrCredit: 'Casino Bet',
                    commissionFrom: commissionFrom,
                    sportsId: "6",
                    shareNUpline:shareNUpline,
                    upLineAmount: upLineAmount,
                    betId: tran._id,
                    matchId: Cgame_id,
                    
                    betDateTime: new Date().getTime(),
                    date: new Date().getTime(),
                    createdAt: formattedDate,
                    totalRemainingAmount: totalRemainingAmount,
                    commissionAmount: commissionAmount,
                    remainingAmount: remainingAmount,
                    
                    roundId: tran._id
                  }],{ session });
              
                  
                  const userExpCheck = await users.findOne({ userId:user.userId,exposure: { $gt: 0 } });
             
                  // if(userExpCheck && userExpCheck.userId!=11000){
                    
                  //   await session.startTransaction();
                  //   expPositive.create([{
                  //     userId:userExpCheck.userId,
                  //     userFrom:userExpCheck.userId,
                  //     userRole:userExpCheck.role,
                  //     source:'casino settlement',
                  //     roundId:tran._id,
                  //     exposureAmount:userExpCheck.exposure
                      
                  //   }],{ session });
                  //   await session.commitTransaction();

                  // }
                  
                  
                  let Camount = (2/100)*( (user.commission / 100) * totalRemainingAmount);

                  upMovingAmount = Number((upMovingAmount - (user.commission / 100) * totalRemainingAmount).toFixed(3));
                  if(differenceDbCr>0){

                    // await session.startTransaction();
                    // await Cash.create([{
                    //   userId: user.userId,
                    //   description: `Commission From Casino (${CgameName})`,
                    //   createdBy: 0,
                    //   amount: Camount,
                    //   balance:Dbalance, 
                    //   availableBalance: DavailableBalance,
                    //   maxWithdraw: DmaxWithdraw,
                    //   cash: DCash,
                    //   credit: Dcredit,
                    //   creditRemaining: DcreditRemaining,marketId: bet.marketId,
                    //   commissionFrom: commissionFrom,
                      
                    //   cashOrCredit: 'Commission',
                    //       betId: tran._id,
                    //   marketId: tran._id,
                    //   sportsId: "6",
                    //   upLineAmount: upMovingCommAmount,
                    //   matchId: Cgame_id,
                     
                    //   betDateTime: new Date().getTime(),
                    //   date: new Date().getTime(),
                    //   createdAt: formattedDate,
                      
                    //   roundId: tran._id
                    // }],{ session });
                    // await session.commitTransaction();
                   
                    // upMovingCommAmount = Number((upMovingCommAmount - (user.commission / 100) * commissionAmount).toFixed(3));
                  
                  }
    
              
              }

           

            }
          }
            







        





          
          























          


        

        //ends if deposits not have entry
         else {
         // session.endSession();
          console.log("Duplicate transaction found, skipping insertion.");
          //await session.abortTransaction();
          //return;
        }

        



        await session.commitTransaction();
        break; // Exit loop if transaction succeeds
        // return; // Exit the function successfully after committing
   
       } catch (error) {
        if ( retries < maxRetries) {
          retries++;
          console.log(`Retrying transaction...casinocalls attempt ${retries}`);
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

      }//transloop end(); 



      
  
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
      let amount = Number(payload.amount) * casinoMultiples;
      let UpdatedExposure = Number((user.exposure - amount));
      let tempExposure = Number((user.tempExposure + amount));
      let updatedavailableBalance = Number((user.availableBalance - (amount)));
      const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });


      const transactionId2 = payload.transaction_id.toString().trim();
      let idExists2 = await CasinoCalls.findOne({ transaction_id: transactionId2 })
      if(user.exposure<=0 && user.availableBalance>=amount && lastMaxWithdraw.availableBalance >=amount && lastMaxWithdraw.availableBalance >0 && !idExists2){
        // await users.updateOne(
        //   { _id: user._id },
        //   {
        //     $set: {
        //       availableBalance: updatedavailableBalance,
        //       exposure: UpdatedExposure,
        //       tempExposure: tempExposure
        //     }
        //   },
        //   { session }
        // );
                    await expPositive.create([{
                      userId:user.userId,
                      
                      userRole:user.role,
                      roundId:payload.round_id,
                      source:'debitFun',
                      expCaptured:amount,
                      exposureAmount:UpdatedExposure
                      
                    }]);
        let parentUsersIds = await getParents(user.userId);
      const parentUser = await User.find({
        userId: {
          $in: [...parentUsersIds]
        },
        isDeleted: false
      }).sort({ userId: -1 });
      let dealerExposures = amount;
      let UseravailableBalancePrev = 0;
      let UseravailableBalanceNew = 0;
      let prev = 0;
      for (const user of parentUser) {
        
        let current = user.downLineShare;
          
        userPrevExposure = user.exposure;
        UseravailableBalancePrev = user.availableBalance;
         let commission = current - prev;
         user['commission'] = commission;
         prev = current;
    
    
    
        let ShareAmountInLoss = (user.commission / 100) * dealerExposures;
        let finalShareAmountInLoss = Number(ShareAmountInLoss);
          userexposureNew = user.exposure-finalShareAmountInLoss;
          UseravailableBalanceNew = UseravailableBalancePrev-finalShareAmountInLoss;
          // await users.updateOne(
          //   { _id: user._id },
          //   {
          //     $set: {
          //       availableBalance: UseravailableBalanceNew,
          //       exposure: userexposureNew
          //     }
          //   }
          // );
          if(user.userId!=11000){
            // await expPositive.create([{
            //   userId:user.userId,
              
            //   userRole:user.role,
            //   roundId:payload.round_id,
            //   source:'debitFunP',
            //   expCaptured:finalShareAmountInLoss,
            //   exposureAmount:userexposureNew
              
            // }]);
            
          }

      }//end of parents loop
      const transactionId3 = payload.transaction_id.toString().trim();
      

      let idExists3 = await CasinoCalls.findOne({ transaction_id: transactionId3 })
      if(!idExists3){

        // const casinoDebits = new CasinoDebits({
        //   ...payload,                // Spread the existing keys from payload
        //   createdAt: new Date().getTime(),     // Set the current time for createdAt
        // });
        // await casinoDebits.save();

      }
      
      
    }//If available balance etc.... 
      
      return 0
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
    
  /*  
    for (const doc of matchedDocs) {
        
         console.log("doc.username======================>>>>>>>>>>>>>>>>",doc.username);
           const matchedPayload = doc;
        if (!matchedPayload) {
          console.log('No matching payload found for:', doc);
          continue;
        }
        
          
        const transactionId = matchedPayload.transaction_id;
        const idExists = await CasinoCalls.findOne({ transaction_id: transactionId })
        if (idExists) {
          console.log("This transaction already exisits......",transactionId);
          continue;
        }
        const user = await users.findOne({ remoteId: parseInt(matchedPayload.remote_id) });
        if (!user) {
          session.endSession();
          return res.json({ status: 500, msg: 'Internal error: no user' });
          
        }
        
        
        
        
    const now = new Date();
    
      let amount = Number(matchedPayload.amount) * casinoMultiples;
      let UpdatedExposure = Number((user.exposure - amount));
      let tempExposure = Number((user.tempExposure + amount));
      let updatedavailableBalance = Number((user.availableBalance - (amount)));
      const maxRetries = 3; // Max retries for the transaction
  let retries = 0;
//console.log("outside max tries......");
  while (retries < maxRetries) {

    
    try {
        session.startTransaction();

      
      const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });


      const transactionId2 = matchedPayload.transaction_id.toString().trim();
      let idExists2 = await CasinoCalls.findOne({ transaction_id: transactionId2 })
      if(idExists2){
        console.log("idExists3 exisits already................. for",matchedPayload.remote_id);
      }
    
      if(user.exposure<=0 && user.availableBalance>=amount && lastMaxWithdraw.availableBalance >=amount && lastMaxWithdraw.availableBalance >0 && !idExists2){
       
       if(user.userId==45328){
        console.log("I am inside the condition............................");
        console.log("updatedavailableBalance-----------",updatedavailableBalance);
        console.log("UpdatedExposure-----------",UpdatedExposure);
        console.log("tempExposure-----------",tempExposure);
        console.log("user._id-----------",user._id);
        
       }
        
        
        if(matchedPayload.action=='debit'){
        try {


          session.endSession();
          
          await users.updateOne(
          { _id: user._id },
          {
            $set: {
              availableBalance: updatedavailableBalance,
              exposure: UpdatedExposure,
              tempExposure: tempExposure
            }
          }
          ,{session}
        );
      } catch (error) {
        // Print the error response to the console
        console.error('Error during update operation:', error);
      }
    

      try {


          
      //   await CasinoCallsPayload.updateOne(
      //   { _id: matchedPayload._id },
      //   {
      //     $set: {
      //       isUsed: 1
      //     }
      //   }
      //   ,{session}
      // );
    } catch (error) {
      // Print the error response to the console
      console.error('Error during update operation:', error);
    }


    
        console.log("I am inside the condition ............................0");
                    await expPositive.create([{
                      userId:user.userId,
                      
                      userRole:user.role,
                      roundId:matchedPayload.round_id,
                      source:'CasinodebitFun',
                      expCaptured:amount,
                      exposureAmount:UpdatedExposure
                      
                    }],
                    { session });
                    console.log("I am inside the condition ............................2");
                    
        let parentUsersIds = await getParents(user.userId);
      const parentUser = await User.find({
        userId: {
          $in: [...parentUsersIds]
        },
        isDeleted: false
      }).sort({ userId: -1 });
      console.log("I am inside the condition ............................3");
      let dealerExposures = amount;
      let UseravailableBalancePrev = 0;
      let UseravailableBalanceNew = 0;
      let prev = 0;
      for (const user of parentUser) {
        
        let current = user.downLineShare;
          
        userPrevExposure = user.exposure;
        UseravailableBalancePrev = user.availableBalance;
         let commission = current - prev;
         user['commission'] = commission;
         prev = current;
    
    
    
        let ShareAmountInLoss = (user.commission / 100) * dealerExposures;
        let finalShareAmountInLoss = Number(ShareAmountInLoss);
          userexposureNew = user.exposure-finalShareAmountInLoss;
          UseravailableBalanceNew = UseravailableBalancePrev-finalShareAmountInLoss;
          await users.updateOne(
            { _id: user._id },
            {
              $set: {
                availableBalance: UseravailableBalanceNew,
                exposure: userexposureNew
              }
            },
            { session }
          );
         
            await expPositive.create([{
              userId:user.userId,
              
              userRole:user.role,
              roundId:matchedPayload.round_id,
              source:'debitFunP',
              expCaptured:finalShareAmountInLoss,
              exposureAmount:userexposureNew
              
            }],
            { session });
            
          

      }
    }else{
      const transactionId3 = matchedPayload.transaction_id.toString().trim();
      

      let idExists3 = await CasinoCalls.findOne({ transaction_id: transactionId3 })
      if(idExists3){
        console.log("idExists3 exisits already................. for",matchedPayload.remote_id);
      }
      console.log("I am inside the condition ............................4");
      if(!idExists3){
        try{
        const casinoDebits = new CasinoDebits({
          ...matchedPayload,                // Spread the existing keys from payload
          createdAt: new Date().getTime(),     // Set the current time for createdAt
        },{session});
        await casinoDebits.save({ session });
      } catch (error) {
        // Print the error response to the console
        
        console.error('Error during casinodebits isnertion:', error);
      }
      }
    }
      
      
      
      
    }//If available balance etc.... 
    await session.commitTransaction();
    break; // Exit loop if transaction succeeds

} catch (error) {
        if ( retries < maxRetries) {
          retries++;
          console.log(`Retrying ...missingtrans attempt ${retries}`);
          continue; // Retry the transaction
        } else {
          console.error('Transaction Error missingtrans:', error);
          await session.abortTransaction();
          break; // Exit loop if error is not transient
        }
      } finally {
        session.endSession();
      }




    }
        
      }
  */

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