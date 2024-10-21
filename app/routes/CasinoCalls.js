const express = require('express');
const User = require('../models/user');
const router = express.Router();
const ExpRec = require("../models/ExpRec");
const CasinoDebits = require('../models/casinoCalls');
const Cash = require("../../app/models/deposits");
const expPositive = require("../../app/models/ExpPositive");
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
  await insertMissingTransactions();
  //console.log("uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>",user);
  const session = await mongoose.startSession();
  const maxRetries = 1; // Max retries for the transaction
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  
    let i=0;
    try {
      

      const limitValue = 1; // Set your desired limit here
      session.startTransaction(); 
      //session.endSession();
      const groupedTransactions = await CasinoCalls.aggregate([
        {
          $match: {
            isProcessing: true,
            $or: [
              { gameplay_final: 1 },
              { action: 'rollback' }
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
            _id: 1 // Sort by round_id (ascending)
          }
        },
        {
          $limit: limitValue // Limit the number of results returned
        }
      ]).session(session);  

      await session.commitTransaction();
      
      console.log("groupedTransactions================",groupedTransactions.length,"=============================",groupedTransactions);
      
      if (!groupedTransactions || groupedTransactions.length === 0) {
        console.log('No transactions found for the given round_id and username.');
       // await session.abortTransaction();  // Abort the transaction if no records found
       session.endSession();
        return;
      }
      
      for (const tran of groupedTransactions) {
       // session.startTransaction(); 
        
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
        await session.startTransaction();
        const existingDeposit = await Cash.findOne({
          roundId: tran._id.toString(),
          remote_id:tran.remote_id
        }).session(session);
        await session.commitTransaction();
        if (!existingDeposit) {
          let totalCreditAmount = 0;
          let totalDebitAmount = 0;
          let totalRollBackAmount = 0;
          let differenceDbCr = 0;
          let proceedIt = false;
          let usernameAllowed = '';
          await session.startTransaction();
          const roundIds = await CasinoCalls.find({ round_id: tran._id }).session(session);
          await session.commitTransaction();
          for (const rounds of roundIds) {
            const session = await mongoose.startSession();
            if (rounds.action === 'credit') {
              totalCreditAmount += Number(rounds.amount);
            }
            if (rounds.action === 'debit') {
              totalDebitAmount += Number(rounds.amount);
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
          if(proceedIt===true){
            console.log("proceedIt...............................................................",proceedIt);
          }
          

          console.log("Here I am readched........................1");
          await session.startTransaction();
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
          await session.commitTransaction();
          
          


          
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

          await session.startTransaction();
          const lastMaxWithdraw = await Cash.findOne({ userId: userRecord.userId }).sort({ _id: -1 });
          await session.commitTransaction();
          console.log("Here I am readched........................2");









          


          
          
          await session.startTransaction();
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







            await Cash.create({
              userId: userRecord.userId,
              description: `Casino (${tran.game_id})`,
              date: new Date().getTime(),
              amount: differenceDbCr,
              balance: lastMaxWithdraw.balance + differenceDbCr,
              availableBalance: lastMaxWithdraw.availableBalance + differenceDbCr,
              maxWithdraw: lastMaxWithdraw.maxWithdraw + differenceDbCr,
              roundId: tran._id,
              updatedExposure: userRecord.exposure + AccumulativeDebit,
              credit: lastMaxWithdraw ? lastMaxWithdraw.credit : 0,
              creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining : 0,
              cashOrCredit: "Settlement"+i,
              sportsId: "6",
              event: CgameName,
              roundId: tran._id,
              marketId: tran._id,
              matchId: Cgame_id
            });















            await session.commitTransaction();

            await session.startTransaction();
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



            await session.startTransaction();

            const userExpCheckorg = await user.findOne({ userId:userRecord.userId,exposure: { $gt: 0 } },{ session });
                  if(userExpCheckorg){
            
                    expPositive.create({
                      userId:userExpCheckorg.userId,
                      
                      userRole:userExpCheckorg.role,
                      source:'casino settlement',
                      roundId:tran._id,
                      exposureAmount:userExpCheckorg.exposure
                      
                    },{ session });

                  }

                  await session.commitTransaction();




            await CasinoCalls.updateMany(
              { round_id: tran._id.toString() },
              { $set: { isProcessing: false } },
              { session }
            );
           
            await session.commitTransaction();
            

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
                
                let prevrunnersPosition = false;
                //let runnersPosition = bet.runnersPosition;
                let highestAmount = remainingAmount;
                
              let winningsShareAmount = Number(((user.commission / 100) * remainingAmount).toFixed(3));
              let loosingShareAmount = Number(((user.commission / 100) * remainingAmount).toFixed(3));
              let exposureAmountShare = Number(((user.commission / 100) * AccumulativeDebit).toFixed(3));
              console.log("remainingAmount------------------------------------------------------->>>>>",remainingAmount);
              console.log("loosingShareAmount------------------------------------------------------->>>>>",remainingAmount);    
              //winningsShareAmount mean when bettor WIN so it mean dealer LOST  
              //loosingShareAmount mean when bettor LOST so it mean dealer WON
                console.log("user.exposure....................,",user.userId,"...................",user.exposure);
                console.log("winningsShareAmount....................,",user.userId,"...................",winningsShareAmount);
              let UpdatedExposureAmount = user.exposure + exposureAmountShare;
              console.log("UpdatedExposureAmount....................,",user.userId,"...................",UpdatedExposureAmount);
              console.log("Difference is caclauted and I am shoiwng as hereas..................",differenceDbCr);
              let UpdatedAvailableBalance =  user.availableBalance;
              
              let totalClientPLAmount;
              let userBalance;
              let totalBalance = user.balance;
              let totalClientPL = user.clientPL;
      
              if(differenceDbCr==0){ 

                UpdatedAvailableBalance= user.availableBalance + exposureAmountShare;
                //UpdatedAvailableBalance =UpdatedAvailableBalance + loosingShareAmount;


              }
              else if(differenceDbCr<0){ 
              
                UpdatedAvailableBalance= user.availableBalance + winningsShareAmount;
                UpdatedAvailableBalance =UpdatedAvailableBalance + loosingShareAmount;
                
                console.log("----------user.downLineShare:", user.downLineShare);


                 totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount).toFixed(3)) : 0;
                 //60% .  .. .100-60 = 40% upline share.... 40/100 = .40 * 1000 = 400 ClientPL. . .
                 userBalance = totalClientPLAmount;
                 //400=400
                 console.log("differenceDbCr<0", "----....",user.userName, "---------userBalance/totalClientPLAmount----------", userBalance);

                 console.log("user.commission:",user.commission, "----------user.balance:", userBalance);

                 totalBalance = Number((user.balance + Number(((user.commission / 100) * remainingAmount).toFixed(3))).toFixed(3));
  
  
  
                 // suppose user.balance: 0, 0+600=600. .  2) suppose user.balance: 10, 10 + ( 600 ) = 610--- 3) user.balance: -10, -10 + ( 600 ) = 590
                 // 4) user.balance:
  
                 console.log("differenceDbCr<0", "----------totalBalance----------", totalBalance);
                 totalClientPL = Number((user.clientPL + (-totalClientPLAmount)).toFixed(3));
                 // suppose user.clientPL: 0, 0+-400=-400. .  2) suppose user.clientPL: 10, 10 + ( -400 ) = -390--- 3) user.clientPL: -10, -10 + ( -400 ) = -410
                 // 4) user.clientPL: 
              }else{
                
                 totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount).toFixed(3)) : 0;
                 //60% .  .. .100-60 = 40% upline share.... 40/100 = .40 * 1000 = 400 ClientPL. . .
                 
                 userBalance = totalClientPLAmount;
                 console.log("Else..........",user.userName, "----------userBalance/totalClientPLAmount----------", userBalance);
                 
                 totalBalance = Number((user.balance - Number(((user.commission / 100) * remainingAmount).toFixed(3))).toFixed(3));
                 // suppose user.balance: 0, 0-600=-600. .  2) suppose user.balance: 10, 10 - ( 600 ) = -590--- 3) user.balance: -10, -10 - ( 600 ) = 610
                 // 4) user.balance:
  
                 console.log("Else::", "----------totalBalance----------", totalBalance);
                 totalClientPL = Number((user.clientPL + totalClientPLAmount).toFixed(3));
                 // suppose user.clientPL: 0, 0+400=400. .  2) suppose user.clientPL: 10, 10 + ( 400 ) = 410--- 3) user.clientPL: -10, -10 + ( 400 ) = 390
                 // 4) user.clientPL: 
                
  
              }
              console.log("totalBalance:::::::::::::::::::;",totalBalance);
              console.log("UpdatedExposureAmount:::::::::::::::::::;",UpdatedExposureAmount);
              console.log("UpdatedAvailableBalance:::::::::::::::::::;",UpdatedAvailableBalance);
              console.log("totalClientPL:::::::::::::::::::;",totalClientPL);
              const totalExpoisure = Number((user.exposure + Number(((user.commission / 100) * totalRemainingAmount).toFixed(3))).toFixed(3));
              //const totalBalance = Number((user.balance - Number(((user.commission / 100) * remainingAmount).toFixed(3))).toFixed(3));
              const totalavailableBalance = Number((user.availableBalance + Number(((user.commission / 100) * commissionAmount).toFixed(3))).toFixed(3));
  
            



                await session.startTransaction();
                

                await User.updateOne(
                  {
                    userId: user.userId,
                    isDeleted: false
                  },
                  {
                    balance: totalBalance,//P/L Downline
                    exposure: UpdatedExposureAmount,
                    availableBalance: UpdatedAvailableBalance,
                    clientPL: totalClientPL //Balance Upline
                  },{ session }
                );




                await session.commitTransaction();
                await session.startTransaction();
                
                const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });
                  await Cash.create({
                    userId: user.userId,
                    description: `Casino (${CgameName})`,
                    createdBy: 0,
                    amount: -(user.commission / 100) * totalRemainingAmount,
                    balance: lastMaxWithdraw ? lastMaxWithdraw.balance - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
                    availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
                    maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
                    cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
                    marketId: tran._id,
                    credit: lastMaxWithdraw?.credit || 0,
                    creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
                    cashOrCredit: 'Casino Bet',
                    commissionFrom: commissionFrom,
                    sportsId: "6",
                    upLineAmount: -upMovingAmount,
                    betId: tran._id,
                    matchId: Cgame_id,
                    
                    betDateTime: new Date().getTime(),
                    date: new Date().getTime(),
                    createdAt: formattedDate,
                    totalRemainingAmount: totalRemainingAmount,
                    commissionAmount: commissionAmount,
                    remainingAmount: remainingAmount,
                    
                    roundId: tran._id
                  },{ session });
                  await session.commitTransaction();
                  
                  await session.startTransaction();
                  
                  const userExpCheck = await user.findOne({ userId:user.userId,exposure: { $gt: 0 } },{ session });
                  if(userExpCheck){
                    

                    expPositive.create({
                      userId:userExpCheck.userId,
                      userFrom:userExpCheck.userId,
                      userRole:userExpCheck.role,
                      source:'casino settlement',
                      roundId:tran._id,
                      exposureAmount:userExpCheck.exposure
                      
                    },{ session });
                    

                  }
                  await session.commitTransaction();
                  
                  

                  upMovingAmount = Number((upMovingAmount - (user.commission / 100) * totalRemainingAmount).toFixed(3));
                  if(differenceDbCr>0){
                    await session.startTransaction();
                    await Cash.create({
                      userId: user.userId,
                      description: `Commission From Casino (${CgameName})`,
                      createdBy: 0,
                      commissionFrom: commissionFrom,
                      amount: (user.commission / 100) * commissionAmount,
                      balance: lastMaxWithdraw ? lastMaxWithdraw.balance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
                      availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
                      maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
                      cashOrCredit: 'Commission',
                      betId: tran._id,
                      cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
                      marketId: tran._id,
                      sportsId: "6",
                      credit: lastMaxWithdraw?.credit || 0,
                      creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
                      upLineAmount: upMovingCommAmount,
                      matchId: Cgame_id,
                     
                      betDateTime: new Date().getTime(),
                      date: new Date().getTime(),
                      createdAt: formattedDate,
                      
                      roundId: tran._id
                    },{ session });
                    await session.commitTransaction();
                   
                    upMovingCommAmount = Number((upMovingCommAmount - (user.commission / 100) * commissionAmount).toFixed(3));
                  }
    
              
              }

           

            }

            







        





          
          























          


        

        }//ends if deposits not have entry
         else {
         // session.endSession();
          console.log("Duplicate transaction found, skipping insertion.");
          //await session.abortTransaction();
          //return;
        }

        



        //START OF DEPOSITS FOR COMMISSIONS AND SHARES FOR DEALERS

        //END OF DEPOSITS FOR COMMISSIONS AND SHARES FOR DEALERS


      
        //await session.commitTransaction();

      }//transloop end(); 



      await session.commitTransaction();
      
     // return; // Exit the function successfully after committing

    } catch (error) {
      console.error('Error processing transactions:', error);
      //await session.abortTransaction();
      // if (attempt < maxRetries - 1) {
      //   // Delay before retrying
      //   await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for 1 second
      // } else {
      //   throw error; // Re-throw the error after max retries
      // }
    }finally {
      // End the session
      session.endSession();
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
      let tempExposure = Number((user.tempExposure + amount).toFixed(3));
      //console.log("arham exposureeeeeeeeeeeee ",UpdatedExposure )
      let updatedavailableBalance = Number((user.availableBalance - (amount)).toFixed(3));
      //console.log("arham updatedavailableBalance ",UpdatedExposure )

      const lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });

      if(user.exposure<=0 && user.availableBalance>=amount && lastMaxWithdraw.availableBalance >=amount && lastMaxWithdraw.availableBalance >0){
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
        let parentUsersIds = await getParents(user.userId);
      console.log("parentUsersIds----------------------------------------------",parentUsersIds);
      const parentUser = await User.find({
        userId: {
          $in: [...parentUsersIds]
        },
        isDeleted: false
      }).sort({ userId: -1 });
      let dealerExposures = amount;
      let UseravailableBalancePrev = 0;
      let prev = 0;
      for (const user of parentUser) {
        
        let current = user.downLineShare;
          
        userPrevExposure = user.exposure;
        UseravailableBalancePrev = user.availableBalance;
        console.log("UseravailableBalancePrev----------------------------------------------",UseravailableBalancePrev);
        console.log("userPrevExposure----------------------------------------------",userPrevExposure);

         let commission = current - prev;
         user['commission'] = commission;
         prev = current;
    
    
    
        let ShareAmountInLoss = (user.commission / 100) * dealerExposures;
        console.log("ShareAmountInLoss--------",user.commission,"---------",user.userId,"-----------------------------",ShareAmountInLoss);
        let finalShareAmountInLoss = Number(ShareAmountInLoss.toFixed(3));
       // console.log("userId:",user.userId,"------downline share:::",user.downLineShare,"-------commission:::::",user.commission,"====finalShareAmountInLoss=====",finalShareAmountInLoss);
          console.log("userPrevExposure==0::::::::::::::::::::::::",userPrevExposure);
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
      }
      //exposures for parent users end
      
      
      console.log("hereeeeeeeeeeeeeeeeeeeeeeee 2")
      const casinoDebits = new CasinoDebits(payload);
      await casinoDebits.save();
    
    }// aLLOW ONLY IF USER BALANCES ARE MORE THAN DEBITS
      
      


      ///exposures for parent users start
      

      await session.startTransaction();
      const userExpCheck = await user.findOne({ userId:user.userId,exposure: { $gt: 0 } },{ session });
                  if(userExpCheck){
                    

                    expPositive.create({
                      userId:userExpCheck.userId,
                      
                      userRole:userExpCheck.role,
                      source:'debitFun',
                      
                      exposureAmount:userExpCheck.exposure
                      
                    },{ session });
                    
                  }

                  await session.commitTransaction();





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
async function casinoListing(req, res) {
  const {startDate,endDate} = req.body;
  
  // const userId= +user
  const Datetime = new Date(startDate).getTime();
  const eDate = new Date(endDate).getTime();
  if (isNaN(Datetime) || isNaN(eDate)) {
    return res.status(400).send({ message: "Invalid date or endDate format" });
  }
  //  const Date = 1727736538561
  // const userId = +game_id; // Ensure the userId is a number
  // const now = new Date();
  // const last24Hours = now.getTime() - (24  60  60 * 1000);
  try {
   
    const casinoListing = await CasinoCalls.aggregate([
      {
        $match: {
          createdAt: { $gte: Datetime, $lte: eDate }
        }
      },
      {
        $lookup: {
          from: "deposits",
          let: {
            userId: { $toInt: { $substr: ["$username", 5, -1] } },
            local_roundid: "$round_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$userId", "$$userId"] },
                    { $eq: ["$roundId", "$$local_roundid"] }
                  ]
                }
              }
            },
            {
              $project: {
                userId: 1,
                roundId: 1,
                event: 1,
                date: 1,
                amount: 1
              }
            }
          ],
          as: "depositRec"
        }
      },
      {
        $unwind: "$depositRec"
      },
      {
        $group: {
          _id: "$round_id",
          debitCount: {
            $sum: { $cond: [{ $eq: ["$action", "debit"] }, 1, 0] }
          },
          creditCount: {
            $sum: { $cond: [{ $eq: ["$action", "credit"] }, 1, 0] }
          },
          rollbackCount: {
            $sum: { $cond: [{ $eq: ["$action", "rollback"] }, 1, 0] }
          },
          debitAmountSum: {
            $sum: { $cond: [{ $eq: ["$action", "debit"] }, { $toDouble: "$amount" }, 0] }
          },
          creditAmountSum: {
            $sum: { $cond: [{ $eq: ["$action", "credit"] }, { $toDouble: "$amount" }, 0] }
          },
          rollbackAmountSum: {
            $sum: { $cond: [{ $eq: ["$action", "rollback"] }, { $toDouble: "$amount" }, 0] }
          },
          totalRoundCount: { $sum: 1 },
          game_id: { $first: "$game_id" },
          gameName: { $first: "$depositRec.event" },
          userId: { $first: "$depositRec.userId" },
          date: { $first: "$depositRec.date" },
          amount: { $first: "$depositRec.amount" }
        }
      },
      {
        $sort: {
          _id: 1 
        }
      },
      {
        $project: {
          _id: 0,
          round_id: "$_id",
          game_id: 1,
          gameName: 1,
          userId: 1,
          date: 1,
          amount: 1,
          debitCount: 1,
          debitAmountSum: 1,
          creditCount: 1,
          creditAmountSum: 1,
          rollbackCount: 1,
          rollbackAmountSum: 1,
          totalRoundCount: 1
        }
      }
    ]);
    
    


    res.status(200).json({
      success: true,
      message: 'casinoListing fetched successfully',
      data: casinoListing
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
  try {
    const matchedDocs = await CasinoCalls.aggregate([
      {
        $match: {
          isProcessing: true
        }
      },
      {
        $lookup: {
          from: 'casinocallspayloads',
          let: { roundId: "$round_id", username: "$username" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$round_id", "$$roundId"] },
                    { $eq: ["$username", "$$username"] }
                  ]
                }
              }
            }
          ],
          as: 'matchedCasinoCallsPayload'
        }
      },
      {
        $unwind: {
          path: "$matchedCasinoCallsPayload",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $match: {
          $expr: {
            $ne: ["$matchedCasinoCallsPayload.transaction_id", "$transaction_id"]
          }
        }
      },
      {
        $project: {
          transaction_id: "$matchedCasinoCallsPayload.transaction_id",
          round_id: "$matchedCasinoCallsPayload.round_id",
          action: "$matchedCasinoCallsPayload.action",
          callerId: "$matchedCasinoCallsPayload.callerId",
          callerPassword: "$matchedCasinoCallsPayload.callerPassword",
          callerPrefix: "$matchedCasinoCallsPayload.callerPrefix",
          username: "$matchedCasinoCallsPayload.username",
          remote_id: "$matchedCasinoCallsPayload.remote_id",
          amount: "$matchedCasinoCallsPayload.amount",
          provider: "$matchedCasinoCallsPayload.provider",
          game_id: "$matchedCasinoCallsPayload.game_id",
          gameplay_final: "$matchedCasinoCallsPayload.gameplay_final",
          session_id: "$matchedCasinoCallsPayload.session_id",
          gamesession_id: "$matchedCasinoCallsPayload.gamesession_id",
          is_freeround_bet: "$matchedCasinoCallsPayload.is_freeround_bet",
          jackpot_contribution_in_amount: "$matchedCasinoCallsPayload.jackpot_contribution_in_amount",
          jackpot_contribution_ids: "$matchedCasinoCallsPayload.jackpot_contribution_ids",
          jackpot_contribution_per_id: "$matchedCasinoCallsPayload.jackpot_contribution_per_id",
          game_id_hash: "$matchedCasinoCallsPayload.game_id_hash",
          jackpot_win_ids: "$matchedCasinoCallsPayload.jackpot_win_ids",
          createdAt: "$matchedCasinoCallsPayload.createdAt",
          isProcessing: "$matchedCasinoCallsPayload.isProcessing"
        }
      }
    ]);

    // console.log("!!!!!!!!!!!!!!!!!!!!11", matchedDocs)
    if (!matchedDocs || matchedDocs.length === 0) {
      console.log('No transactions found for the given round_id and username.');
      return;
    }

    console.log("++++++++++++++++++++++++ going to save data in casinocalls");
    for (const doc of matchedDocs) {
      const matchedPayload = doc;
      if (!matchedPayload) {
        console.log('No matching payload found for:', doc);
        continue;
      }
      const idExists = await CasinoCalls.findOne({ transaction_id: matchedPayload.transaction_id })
      if (idExists) {
        continue;
      }

      console.log("++===================== going to save data in casinocalls", matchedPayload);

      const newCasinoCall = await new CasinoCalls({
        transaction_id: matchedPayload.transaction_id,
        round_id: matchedPayload.round_id,
        action: matchedPayload.action,
        callerId: matchedPayload.callerId,
        callerPassword: matchedPayload.callerPassword,
        callerPrefix: matchedPayload.callerPrefix,
        username: matchedPayload.username,
        remote_id: matchedPayload.remote_id,
        amount: matchedPayload.amount,
        provider: matchedPayload.provider,
        game_id: matchedPayload.game_id,
        gameplay_final: matchedPayload.gameplay_final,
        session_id: matchedPayload.session_id,
        gamesession_id: matchedPayload.gamesession_id,
        jackpot_contribution_ids: matchedPayload.jackpot_contribution_ids || [],
        jackpot_contribution_per_id: matchedPayload.jackpot_contribution_per_id || [],
        game_id_hash: matchedPayload.game_id_hash,
        jackpot_win_ids: matchedPayload.jackpot_win_ids || [],
        isProcessing: matchedPayload.isProcessing
      });

      console.log('Inserting new casino call:', newCasinoCall);
      await newCasinoCall.save().then(() => {

        console.log('Inserted CasinoCall:', newCasinoCall);
      });
    }

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

router.post('/track-bet/casinoListing', casinoListing)
router.get('/casino', casino);
module.exports = { router,findAndProcessTransactions };
router.get('/insertMissingTransactions', insertMissingTransactions)




