const express             = require('express');
const User                = require('../models/user');
const AsianCasinoDebits   = require('../models/AsiancasinoCalls');
const Cash                = require("../../app/models/deposits");
const config              = require('config')
const { MongoClient }     = require('mongodb');
const casinoMultiples     = config.casinoMultiples;
const partnerKey          = config.AsianCasinopartnerKey;
const { getParents }      = require("../routes/bets");
const router              = express.Router();

const transactionOptions  = {
  readPreference: 'primary',
  readConcern: { level: 'local' },
  writeConcern: { w: 'majority' }
};

const checkMarketBlocked  = async (user) => {
  let parentUserIds       = await getParents(user.userId);
  const marketIds         = await User.distinct("blockedMarketPlaces", { userId: { $in: parentUserIds }, isDeleted: false });
  const marketId          = config.casinoMarketId ;

  if(marketIds.includes(marketId)){
    return 1;
  }else {
    return 0;
  }

}

const WinLoseTransManagement = async (payload, action) => {
  return 1;
  const client = new MongoClient(config.DBHost, { useUnifiedTopology: true });
  await client.connect();
  const session = client.startSession();
  const casinoCalls = client.db(`${config.DBNAME}`).collection('casinocalls');
  const users = client.db(`${config.DBNAME}`).collection('users');
  const user  = await users.findOne({remoteId: Number(payload.remote_id)});

  /*
    action= 0 debit
    action= 1 credit( decsion came from casino )
    debit = 1350
    credit=  600 or 1350 or 1800
    let bettor_winning_amount = 0;
    let bettor_lost_amount = 0;
  */

  // console.log(" ================ credit payload ================ ", payload);

  const now   = new Date();
  const year  = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day   = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  
  if (action == 0) {
    let amount                  = Number(payload.amount) * casinoMultiples;
    let UpdatedExposure         = user.exposure - amount;
    let updatedavailableBalance = user.availableBalance - (amount);
    // console.log(" ============ Handle Place Bet ============ ");

    /**
     * let lastMaxWithdrawRes = await Cash.find( {userId: user.userId}).sort({ _id: -1 }); 
     * let lastMaxWithdraw = lastMaxWithdrawRes.length > 0 ? lastMaxWithdrawRes[0]: null
     * console.log(" lastMaxWithdraw ============== ", lastMaxWithdraw);
     */
    console.log("----------", payload, "-----", amount, " === UpdatedExposure: ", UpdatedExposure);
    console.log(" ============ Update user balances ============ ");
    let userResponse = await users.updateOne(
      { _id: user._id }, { $set: { availableBalance: updatedavailableBalance, exposure: UpdatedExposure } },
      { session }
    );
    const casinoDebits = new CasinoDebits(payload);
    await casinoDebits.save();
    console.log("allTrans created Successfully");
    return 0
  }

  else if (action == 1) {
    const user_prev_balance = user.balance;
    const user_prev_availableBalance = user.availableBalance;
    const user_prev_exposure = user.exposure;
    const gamesList  = await SelectedCasino.findOne(
      { "games.id": payload.game_id },
      { "games.$": 1 }
    );
    const game = gamesList.games[0];

    console.log(" ======================= CREDIT IS CAALED ======================= ");
    const lastDebit = await casinoCalls.findOne({
      action: 'debit',
      game_id: payload.game_id,
      round_id: payload.round_id,
      remote_id: Number(payload.remote_id)
    })

    // console.log(" ======================= lastDebit =======================  ", lastDebit);

    const debit      = Number(lastDebit.amount);
    const credit     = Number(payload.amount);
    const difference = credit - debit;
    const allTrans   = [];
    // lose some Amount 
    if (difference < 0) {
      console.log("   ======================= difference < 0 =======================   ");
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
      const updatedclientPL = user.clientPL + (difference * casinoMultiples);
      const updatedbalance = user.balance + (difference * casinoMultiples);
      const bettor_lost_amount = (debit - credit) * casinoMultiples;
      const allTrans = [];

      // remove all exposure equal to total debit money of 1500

      const amount = debit * config.casinoMultiples;
      const UpdatedExposure = user.exposure + amount;
      const userResponseI = await users.updateOne(
        { _id: user?._id },
        { $set: { availableBalance: updatedavailableBalance, exposure: UpdatedExposure, clientPL: updatedclientPL, balance: updatedbalance } },
        { session }
      );

      const lastMaxWithdrawRes = await Cash.find({ userId: user.userId }).sort({ _id: -1 });
      const lastMaxWithdraw = lastMaxWithdrawRes.length > 0 ? lastMaxWithdrawRes[0] : null

      console.log(" ====================== ====================== ", lastMaxWithdraw);
      //divide lost money to all share holders.

      let BattorLostTran = {
        userId: user.userId,
        description: `Casino (${payload.game_id})`,
        date: now.getTime(),
        createdAt: formattedDate,
        amount: - bettor_lost_amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance - bettor_lost_amount : -bettor_lost_amount,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - bettor_lost_amount : -bettor_lost_amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - bettor_lost_amount : 0,  
        cash:  lastMaxWithdraw?.cash || 0 ,
        credit: lastMaxWithdraw?.credit || 0 ,
        creditRemaining:  lastMaxWithdraw?.creditRemaining  || 0,   
        calledArea: " difference < 0 ",
        createdBy: 0,
        event: game.name,
        // matchId: bet.matchId,
        betId: payload.transaction_id,
        cashOrCredit: "Bet",
        sportsId: "6",
      }
      allTrans.push(BattorLostTran)

      //start of code for giving shares to all share holders
      const parentUserIds = [];
      let currentUserId = user.userId;
      while (currentUserId) {

        const parentUser = await users.findOne(
          { userId: currentUserId },
          { session }
        );
        if (parentUser.role == "0") {
          console.log("break User area ");
          break;
        }
        parentUserIds.push(parentUser.createdBy);
        currentUserId = parentUser.createdBy;
      }

      console.log(" parentUser  ============ ", parentUserIds);
      const parentUser = await users.find(
        { userId: { $in: parentUserIds }, isDeleted: false }
      ).sort({ role: -1 }).toArray();

      console.log(" parentUser  ============ ", parentUser);

      if (!parentUser) {
        console.log(" ============ Parent User Not Found ============ ");
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

      console.log(" ================= Commission Setting Done ================= ");
      for (const user of parentUser) {
        /**
         * 85 Admin  15 
         * 70 Smaster  20
         * 50 Master  50
         * 0 Battor 
        */

        const availableBalance = user.availableBalance + (user.commission / 100) * bettor_lost_amount;
        const balance = user.balance + (user.commission / 100) * bettor_lost_amount;
        const clientPL = user.clientPL - user.downLineShare != 100 ?  user.clientPL - ((100 - user.downLineShare) / 100) * bettor_lost_amount : 0;
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

        const lastMaxWithdrawRes = await Cash.find({ userId: user.userId }).sort({ _id: -1 });
        const lastMaxWithdraw = lastMaxWithdrawRes.length > 0 ? lastMaxWithdrawRes[0] : null
        console.log(' last Max Withdraw ========== ', lastMaxWithdraw);
        let betTransaction = {
          userId: user.userId,
          description: `Casino (${payload.game_id})`,
          date: now.getTime(),
          createdAt: formattedDate,
          commissionFrom: commissionFrom,
          createdBy: 0,
          amount: (user.commission / 100) * bettor_lost_amount,
          balance: lastMaxWithdraw ? lastMaxWithdraw.balance + (user.commission / 100) * bettor_lost_amount : (user.commission / 100) * bettor_lost_amount,
          availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + (user.commission / 100) * bettor_lost_amount : (user.commission / 100) * bettor_lost_amount,
          maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (user.commission / 100) * bettor_lost_amount : (user.commission / 100) * bettor_lost_amount * 0,  // max withdraw cant be negative 
          cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
          credit: lastMaxWithdraw ? lastMaxWithdraw.credit: 0,
          creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining  : 0,
          betId: payload.transaction_id,
          cashOrCredit: "Bet",
          sportsId: "6",
          event: game.name, 
          marketId: payload.game_id,
          upLineAmount: upMovingAmount
        }
        allTrans.push(betTransaction)
        upMovingAmount = upMovingAmount - (user.commission / 100) * bettor_lost_amount;
        commissionFrom = user.userId;
      }
      await Cash.insertMany(allTrans);
      //end of code to give lost money to all share holders
      const casinoDebits = new CasinoDebits(payload);
      await casinoDebits.save();
    }
    // Win some Amount 
    else if (difference > 0){
      console.log(" ======================= difference > 0 ======================= ");

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

      console.log("=============start of giving commissions and loss shares on amount which is WON by bettor");
      let bettor_won_amount = credit - debit;
      //deduct commission amount from above bettor_won_amount, and UpdatedAvailableBalance ( debit + wonAmountAfterCommission )
      
      const amount = bettor_won_amount * casinoMultiples;
      const remainingAmount = (amount / 100) * ( 100 - config.commission  );
      const commissionAmount = (amount / 100) * config.commission;
      let upMovingAmount = amount;
      let commissionFrom = user.userId;
      let upMovingCommAmount = commissionAmount;

      const updatedavailableBalance = user.availableBalance + (remainingAmount) + debit*config.casinoMultiples;
      const updatedclientPL = user.clientPL + (remainingAmount);
      const updatedbalance  = user.balance + (remainingAmount);
      const UpdatedExposure = (user.exposure) + (debit * config.casinoMultiples);
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

      const lastMaxWithdrawRes = await Cash.find({ userId: user.userId }).sort({ _id: -1 });
      const lastMaxWithdraw = lastMaxWithdrawRes.length > 0 ? lastMaxWithdrawRes[0] : null

      console.log(" ================ lastMaxWithdraw ================ ", lastMaxWithdraw);
      let UserWinBetTrans = {
        userId: user.userId,
        description: `Casino (${payload.game_id})`,
        date: now.getTime(),
        createdAt: formattedDate,
        createdBy: 0,
        amount: remainingAmount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance + remainingAmount : remainingAmount,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + remainingAmount : remainingAmount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + remainingAmount : remainingAmount,
        cashOrCredit: "Bet",
        cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        betId: payload.transaction_id,
        calledArea: "difference > 0",
        event: game.name,
        sportsId: "6",
        marketId: payload.game_id,
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
          console.log("break User area ");
          break;
        }
        parentUserIds.push(parentUser.createdBy);
        currentUserId = parentUser.createdBy;
      }
      console.log(" parentUser  ============ ", parentUserIds);

      const parentUser = await users.find(
        { userId: { $in: parentUserIds }, isDeleted: false }
      ).sort({ role: -1 }).toArray();

      console.log(" parentUser  ============ ", parentUser);

      if (!parentUser) {
        console.log(" ============ Parent User Not Found ============ ");
        return res.json({ status: '500', msg: `Internal Server Error` });
      }
      let prev = 0;
      for (const user of parentUser) {
        let current = user.downLineShare;
        user["commission"] = current - prev;
        prev = current;
      }
      console.log(" ================= Commission Setting Done ================= ");

      for (const user of parentUser) {

        const lastMaxWithdrawRes = await Cash.find({ userId: user.userId }).sort({ _id: -1 });
        const lastMaxWithdraw = lastMaxWithdrawRes.length > 0 ? lastMaxWithdrawRes[0] : null
        console.log(' last Max Withdraw ========== ', lastMaxWithdraw);

        let availableBalance = user.balance - (user.commission / 100) * remainingAmount;
        let balance = user.balance - (user.commission / 100) * remainingAmount;
        let clientPL = user.clientPL + user.downLineShare != 100 ? user.clientPL + ((100 - user.downLineShare) / 100) * remainingAmount : 0;

        let userResponse = await users.updateOne(
          { _id: user?._id }, {
          $set: {
            availableBalance: availableBalance,
            clientPL: clientPL,
            balance: balance
          }
        },
          { session }
        );

        let betTransaction = {
          userId: user.userId,
          description: `Casino (${payload.game_id})`,
          date: now.getTime(),
          createdAt: formattedDate,
          createdBy: 0,
          amount: -(user.commission / 100) * amount,
          balance: lastMaxWithdraw ? lastMaxWithdraw.balance - (user.commission / 100) * amount : -(user.commission / 100) * amount,
          availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (user.commission / 100) * amount : -(user.commission / 100) * amount,
          maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - (user.commission / 100) * amount : 0,   
          cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
          credit: lastMaxWithdraw?.credit || 0,
          creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
          cashOrCredit: "Bet",
          sportsId: "6",
          event: game.name,
          marketId: payload.game_id,
          betId: payload.transaction_id,
          upLineAmount: upMovingCommAmount
        }
        allTrans.push(betTransaction)

        const prevBalance =  lastMaxWithdraw ? lastMaxWithdraw.balance - (user.commission / 100) * amount : -(user.commission / 100) * amount; 
        const prevAvailableBalance =  lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (user.commission / 100) * amount : -(user.commission / 100) * amount;
        const prevMaxWithdraw =  lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - (user.commission / 100) * amount : 0;   

        let commissionTransaction = {
          userId: user.userId,
          description: `Casino (${payload.game_id})`,
          date: now.getTime(),
          createdAt: formattedDate,
          createdBy: 0,
          commissionFrom: commissionFrom,
          amount: (user.commission / 100) * commissionAmount,
          balance: prevBalance + (user.commission / 100) * commissionAmount,
          availableBalance: prevAvailableBalance + (user.commission / 100) * commissionAmount,
          maxWithdraw: prevMaxWithdraw + (user.commission / 100) * commissionAmount,
          // balance: lastMaxWithdraw ? lastMaxWithdraw.balance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
          // availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
          // maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
          cash: lastMaxWithdraw ? lastMaxWithdraw.cash + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
          credit: lastMaxWithdraw?.credit || 0,
          creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
          cashOrCredit: "Commission",
          betId: payload.transaction_id,
          sportsId: "6",
          event: game.name,
          marketId: payload.game_id,
          upLineAmount: upMovingCommAmount
        }

        allTrans.push(commissionTransaction)
        upMovingAmount = upMovingAmount - (user.commission / 100) * amount;
        upMovingCommAmount = upMovingCommAmount - (user.commission / 100) * commissionAmount;
        commissionFrom = user.userId;
      }

      await Cash.insertMany(allTrans);
      console.log("=============end of giving commissions and loss shares on amount which is WON by bettor");

      const casinoDebits = new CasinoDebits(payload);
      await casinoDebits.save();
      console.log("=============end of }else if (difference > 0){=============");
    }
    // No Win lose 
    else if(difference == 0) {
      const updatedavailableBalance = user.availableBalance + ( debit*casinoMultiples )
      const UpdatedExposure         = user.exposure + ( debit*casinoMultiples )
      await users.updateOne(
        { _id: user?._id },
        { $set: { availableBalance: updatedavailableBalance, exposure: UpdatedExposure } },
        { session }
      );
      const casinoDebits = new CasinoDebits(payload);
      await casinoDebits.save();
    }

    const updatedUser = await users.findOne({remoteId: Number(payload.remote_id)});
    const user_new_balance = updatedUser.balance;
    const user_new_availableBalance = updatedUser.availableBalance;
    const user_new_exposure = updatedUser.exposure;
  
    const ExpTran = new ExpRec({
      userId: user.userId,
      trans_from: "casinobet",
      trans_from_id: payload.transaction_id,
      trans_bet_status :  0,
      user_prev_balance: user_prev_balance,
      user_prev_availableBalance: user_prev_availableBalance,
      user_prev_exposure: user_prev_exposure,
      user_new_balance: user_new_balance,
      user_new_availableBalance: user_new_availableBalance,
      user_new_exposure: user_new_exposure,
      marketId: payload.game_id,
      sportsId: 6,
    })
    await ExpTran.save();
    console.log(" ===================================================== ");
    console.log("All Transection Successfull ");
    console.log(" ===================================================== ");
    return 0
  }
}

async function balance(req, res){
  console.warn(" ================================================================= ");
  console.warn(" ======================== balance REQUEST ======================== ");
  console.warn(" ================================================================= ");
  const payload     = req.body;
  const timestamp   = new Date().getTime() / 1000
  try {
    if(payload.partnerKey != partnerKey){
      return res.json({
        partnerKey : payload?.partnerKey,
        userId : payload?.user?.id,
        balance : 0.0,
        status:{
          "code" : "VALIDATION_ERROR",
          "message" : "partnerKey is not valid or empty"
        },
        timestamp : timestamp
      })
    }
    const user = await User.findOne({ userId: Number(payload.userId) });
    if (!user) {
      return res.json({
        partnerKey : payload?.partnerKey,
        userId : payload?.user?.id,
        balance:0.0,
        status:{
          "code":"VALIDATION_ERROR",
          "message":"Userid is not valid or empty"
        },
        timestamp : timestamp
      })
    }

    if (!payload.timestamp || payload.timestamp == "" ){
      return res.json({
        partnerKey : payload?.partnerKey,
        userId : payload?.user?.id,
        balance:0.0,
        status:{
          "code" : "VALIDATION_ERROR",
          "message" : "Timestamp is not valid or empty"
        },
        timestamp : timestamp
      })
    }

    if(payload.partnerKey != partnerKey){
      return res.json({
        partnerKey : payload?.partnerKey,
        userId : payload?.user?.id,
        balance : 0.0,
        status:{
          "code" : "VALIDATION_ERROR",
          "message" : "partnerKey is not valid or empty"
        },
        timestamp : timestamp
      })
    }

    const balance = user.availableBalance;
    if (balance < 0) {
      return res.json({
        partnerKey : payload?.partnerKey,
        userId : payload?.user?.id,
        balance : 0.0,
        status:{
          "code" : "VALIDATION_ERROR",
          "message" : "Internal server error !"
        },
        timestamp : timestamp
      })
    }
    return res.json({
      status:{
        "code": "SUCCESS",
        "message": ""
      },
      balance: balance/casinoMultiples,
      userId: user.userId,
      timestamp: new Date().getTime() / 1000
    });

  } catch (err) {
    console.error(`Internal Error ${err}`);
    return res.json({
      partnerKey : payload?.partnerKey,
      userId : payload?.user?.id,
      balance : 0.0,
      status:{
        "code" : "VALIDATION_ERROR",
        "message" : "Internal server error !"
      },
      timestamp : timestamp
    })
  }
}


async function debit(req, res) {
  console.warn(" ================================================================= ");
  console.warn(" ========================= DEBIT REQUEST ========================= ");
  console.warn(" ================================================================= ");
  const client = new MongoClient(config.DBHost, { useUnifiedTopology: true });
  await client.connect(); 
  const session = client.startSession();
  try {
    const casinoCalls = client.db(`${config.DBNAME}`).collection('asiancasinocalls');
    const users       = client.db(`${config.DBNAME}`).collection('users');
    const payload     = req.body;
    const timestamp   = new Date().getTime() / 1000;

    console.log(" ================================================================= ");
    console.log(" ====================== Debit Request Ruery ====================== ", payload);
    console.log(" ================================================================= ");

    const game  = payload.gameData;
    const trans = payload.transactionData;
    if(payload.partnerKey != partnerKey){
      return res.json({
        partnerKey : payload?.partnerKey,
        userId : payload?.user?.id,
        balance : 0.0,
        status:{
          "code" : "VALIDATION_ERROR",
          "message" : "partnerKey is not valid or empty"
        },
        timestamp : timestamp
      })
    }

    await session.withTransaction(async () => {
      const sameTransId = await casinoCalls.countDocuments(
        {
          userId: parseInt(payload.user.id),
          // providerTransactionId: game.providerTransactionId, 
          // providerCode: game.providerCode, 
          // gameCode: game.gameCode, 
          // description:  game.description, 
          // providerRoundId: game.providerRoundId, 
          id: trans.id, 
          // type: "DEBIT"
        },
        { session }
      );   
      const user = await users.findOne({ userId: parseInt(payload.user.id) })
      if (!user) {
        await session.abortTransaction();
        return res.json({
          partnerKey : payload?.partnerKey,
          userId : payload?.user?.id,
          balance : 0.0,
          status:{
            "code":"VALIDATION_ERROR",
            "message":"Userid is not valid or empty"
          },
          timestamp : timestamp
        })
      }

      /* === Validations can work on it === */ 
      if(!trans.id || trans.id == "" ){
        return res.json({
          partnerKey : payload?.partnerKey,
          userId : payload?.user?.id,
          balance : 0.0,
          status:{
            "code":"VALIDATION_ERROR",
            "message":"Transaction id is null or empty"
          },
          timestamp : timestamp
        })
      }
      /* ========= */

      const checkMarketBlockedResponse = await checkMarketBlocked(user);
      if(checkMarketBlockedResponse == 1){
        await session.abortTransaction(user);
        return res.json({
          partnerKey : payload?.partnerKey,
          userId : payload?.user?.id,
          balance : 0.0,
          status:{
            "code":"VALIDATION_ERROR",
            "message":"Something went wrong"
          },
          timestamp : timestamp
        })
      }

      if (sameTransId > 0 && game.description != "cancel" ) {
        await session.abortTransaction();
        return res.json({
          partnerKey : payload?.partnerKey,
          userId : payload?.user?.id,
          balance : user ?  user?.availableBalance / casinoMultiples : 0.0,
          status:{
            code:"VALIDATION_ERROR",
            message:"Request already processed"
          },
          timestamp : timestamp
        })
      }

      if (sameTransId > 0 && game.description == "cancel" ) {
        const transAvaiable = await casinoCalls.findOne({ id: trans.referenceId});
        if(!transAvaiable  || transAvaiable.cancelProcessed ==  true ){
          await session.abortTransaction();
          return res.json({
            partnerKey : payload?.partnerKey,
            userId : payload?.user?.id,
            balance : user ?  user?.availableBalance / casinoMultiples : 0.0,
            status:{
              code:"VALIDATION_ERROR",
              message:"Cancel transaction may not exist or already processed"
            },
            timestamp : timestamp
          })
        } 
        else {
          // Will cancel Bet Here 
        } 
      }

      let debitAmount =  parseInt(payload.transactionData.amount);
      const amount    = debitAmount *casinoMultiples;

      if (debitAmount > user.availableBalance * casinoMultiples) {
        await session.abortTransaction();
        return res.json({
          partnerKey : payload?.partnerKey,
          userId : payload?.user?.id,
          balance : user?.availableBalance / casinoMultiples,
          status:{
            "code":"VALIDATION_ERROR",
            "message":"Userid is not valid or empty"
          },
          timestamp : timestamp
        })
        return res.json({
          status: 403,
          message: "Insufficient balance amount",
        });
      }

      if (parseInt(payload.transactionData.amount) < 0) {
        await session.abortTransaction();    
        return res.json({
          partnerKey : payload?.partnerKey,
          userId : payload?.user?.id,
          balance : user ?  user?.availableBalance / casinoMultiples : 0.0,
          status:{
            code:"VALIDATION_ERROR",
            message:"Field Amount format is not correct"
          },
          timestamp : timestamp
        })
      }

      const updatedavailableBalance = user?.availableBalance - (amount);

      if (updatedavailableBalance < 0) {
        await session.abortTransaction();
        return res.json({
          partnerKey : payload?.partnerKey,
          userId : payload?.user?.id,
          balance : user? user.availableBalance / casinoMultiples: 0.0,
          status:{
            "code":"VALIDATION_ERROR",
            "message":"amount must be less then available balance"
          },
          timestamp : timestamp
        })
      }
      const response = await WinLoseTransManagement(payload, 0);
      if(response == 1){
        await casinoCalls.insertOne({
          userId: parseInt(payload.user.id),
          currency: payload.user.currency,
          partnerKey: payload.partnerKey,
          providerCode: game.providerCode,
          providerTransactionId: game.providerTransactionId,
          gameCode: game?.gameCode,
          description: game?.description,
          providerRoundId: game?.providerRoundId,
          id: trans.id,
          amount: trans.id,
          referenceId: trans.id,
          user: payload.user,
          gameData: game,
          transactionData: trans,
          timestamp: payload.timestamp,
          type: "DEBIT"
        })
        const userResponse = await users.updateOne(
          { userId: parseInt(payload.user.id)},
          {
            $set: {
              availableBalance: updatedavailableBalance
            }
          },
          { session }
        )
      }
    }, transactionOptions);

    await session.commitTransaction();

    const updatedUser = await users.findOne({ userId: parseInt(payload.user.id)});
    const testAmt = payload.transactionData.amount * casinoMultiples
    return res.json({
      partnerKey: config.worldCasinoOnlinePartnerKey,
      status:{
        "code": "SUCCESS",
        "message": ""
      },
      balance: ( updatedUser.availableBalance - testAmt) / casinoMultiples,
      userId: updatedUser.userId.toString(),
      timestamp: timestamp
    });

  } catch (err) {
    console.error(`Error  ${err} `);
    return res.json({
      partnerKey : payload?.partnerKey,
      userId : payload?.user?.id,
      balance : 0.0,
      status:{
        "code" : "VALIDATION_ERROR",
        "message" : "Internal server error !"
      },
      timestamp : timestamp
    })
  } finally {
    await session.endSession();
    await client.close();
  }
}

async function credit(req, res) {
  console.warn(" ================================================================= ");
  console.warn(" ======================== CREDIT  REQUEST ======================== ");
  console.warn(" ================================================================= ");
  const client = new MongoClient(config.DBHost, { useUnifiedTopology: true });
  await client.connect();
  const session = client.startSession();
  try {
    const casinoCalls = client.db(`${config.DBNAME}`).collection('asiancasinocalls');
    const users       = client.db(`${config.DBNAME}`).collection('users');
    const payload     = req.body;
    const game        = payload.gameData;
    const trans       = payload.transactionData;

    console.log(" ================================================================= ");
    console.log(" ===================== CREDIT  Request Query ===================== ", payload);
    console.log(" ================================================================= ");

    await session.withTransaction(async () => {
      const sameTransId = await casinoCalls.countDocuments(
        {
          userId: parseInt(payload.user.id),
          // providerTransactionId: game.providerTransactionId, 
          // providerCode: game.providerCode, 
          // gameCode: game.gameCode, 
          // providerRoundId: game.providerRoundId, 
          id: trans.id, 
          // type: "CREDIT"
        },
        { session }
      );
      const user = await users.findOne(
        { userId: parseInt(payload.user.id) },
        { session }
      );
      if (!user) {
        await session.abortTransaction();
        return res.json({
          partnerKey : payload?.partnerKey,
          userId : payload?.user?.id,
          balance : 0.0,
          status:{
            "code":"VALIDATION_ERROR",
            "message":"Userid is not valid or empty"
          },
          timestamp : timestamp
        })
      }

      /* === Validations can work on it === */ 
      if(!trans.id || trans.id == "" ){
        return res.json({
          partnerKey : payload?.partnerKey,
          userId : payload?.user?.id,
          balance : 0.0,
          status:{
            "code":"VALIDATION_ERROR",
            "message":"Transaction id is null or empty"
          },
          timestamp : timestamp
        })
      }
      /* ========= */

      const checkMarketBlockedResponse = await checkMarketBlocked(user);

      if(checkMarketBlockedResponse == 1){
        await session.abortTransaction(user);
        return res.json({
          partnerKey : payload?.partnerKey,
          userId : payload?.user?.id,
          balance : 0.0,
          status:{
            "code":"VALIDATION_ERROR",
            "message":"Something went wrong"
          },
          timestamp : timestamp
        })
      }

      if (sameTransId > 0 && game.description != "cancel" ) {
        await session.abortTransaction();
        return res.json({
          partnerKey : payload?.partnerKey,
          userId : payload?.user?.id,
          balance : user ?  user?.availableBalance / casinoMultiples : 0.0,
          status:{
            code:"VALIDATION_ERROR",
            message:"Request already processed"
          },
          timestamp : timestamp
        })
      }

      if (sameTransId > 0 && game.description == "cancel" ) {
        const transAvaiable = await casinoCalls.findOne({ id: trans.referenceId});
        if(!transAvaiable  || transAvaiable.cancelProcessed ==  true ){
          await session.abortTransaction();
          return res.json({
            partnerKey : payload?.partnerKey,
            userId : payload?.user?.id,
            balance : user ?  user?.availableBalance / casinoMultiples : 0.0,
            status:{
              code:"VALIDATION_ERROR",
              message:"Cancel transaction may not exist or already processed"
            },
            timestamp : timestamp
          })
        } 
        else {
          // Will cancel Bet Here 
        } 
      }

      if (parseInt( payload.transactionData.amount) < 0 ) {
        await session.abortTransaction();
        return res.json({
          status: 500,
          balance: user.availableBalance / casinoMultiples
        });
      }

      let creditAmount =  parseInt(payload.transactionData.amount);
      const amount    = creditAmount *casinoMultiples;

      const updatedavailableBalance = user?.availableBalance + (amount);

      if (creditAmount > user.availableBalance * casinoMultiples) {
        await session.abortTransaction();
        return res.json({
          partnerKey : payload?.partnerKey,
          userId : payload?.user?.id,
          balance : user?.availableBalance / casinoMultiples,
          status:{
            "code":"VALIDATION_ERROR",
            "message":"insufficient balance"
          },
          timestamp : timestamp
        })
      }

      if (parseInt(payload.transactionData.amount) < 0) {
        await session.abortTransaction();    
        return res.json({
          partnerKey : payload?.partnerKey,
          userId : payload?.user?.id,
          balance : user ?  user?.availableBalance / casinoMultiples : 0.0,
          status:{
            code:"VALIDATION_ERROR",
            message:"Field Amount format is not correct"
          },
          timestamp : timestamp
        })
      }

      if (updatedavailableBalance < 0) {
        await session.abortTransaction();
        return res.json({
          partnerKey : payload?.partnerKey,
          userId : payload?.user?.id,
          balance : user? user.availableBalance / casinoMultiples: 0.0,
          status:{
            "code":"VALIDATION_ERROR",
            "message":"insufficient balance"
          },
          timestamp : timestamp
        })
      }

      const response = await WinLoseTransManagement(payload, 1);
      if(response == 1){
        await casinoCalls.insertOne({
          userId: parseInt(payload?.user?.id),
          currency: payload?.user?.currency,
          partnerKey: payload?.partnerKey,
          providerCode: game?.providerCode,
          providerTransactionId: game?.providerTransactionId,
          gameCode: game?.gameCode,
          description: game?.description,
          providerRoundId: game?.providerRoundId,
          id: trans?.id,
          amount: trans?.id,
          referenceId: trans?.id,
          user: payload?.user,
          gameData: game,
          transactionData: trans,
          timestamp: payload.timestamp,
          type: "CREDIT"
        })
        const userResponse = await users.updateOne(
          { userId: parseInt(payload.user.id)},
          {
            $set: {
              availableBalance: updatedavailableBalance
            }
          },
          { session }
        )
        console.warn(" ================== RESPONSE INSIDE ================== ");
      }      

    }, transactionOptions);

    await session.commitTransaction();

    const updatedUser = await users.findOne({ userId: parseInt(payload.user.id) })
    const testAmt = payload.transactionData.amount * casinoMultiples
    console.log(" Amount Returnning to Casino from Credit  ", updatedUser.availableBalance / casinoMultiples);
    return res.json({
      partnerKey: config.worldCasinoOnlinePartnerKey,
      status:{
        "code": "SUCCESS",
        "message": ""
      },
      balance: (updatedUser.availableBalance + testAmt) / casinoMultiples,
      userId: updatedUser.userId.toString(),
      timestamp: new Date().getTime().toString()
    });

  } catch (err) {
    console.error(`Internal Error ${err}`);
    return res.json({
      partnerKey : payload?.partnerKey,
      userId : payload?.user?.id,
      balance : 0.0,
      status:{
        "code" : "VALIDATION_ERROR",
        "message" : "Internal server error !"
      },
      timestamp : timestamp
    })
  } finally {
    await session.endSession();
    await client.close();
  }
}
// Cancel transaction may not exist or already processed

router.post('/balance', balance);
router.post('/debit', debit);
router.post('/credit', credit);
module.exports = { router };
