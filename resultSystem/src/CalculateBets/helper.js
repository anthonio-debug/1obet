const Bets = require('../../../app/models/bets');
const cloneBets = require('../../../app/models/clonebets');
const expPositive = require("../../../app/models/ExpPositive");
const User = require('../../../app/models/user');
const { getParents, deleteExpPositives, deleteObsolete, parentCommisionAmount } = require('../../../app/routes/bets');
const Events = require('../../../app/models/events');
const Deposits = require('../../../app/models/deposits');
const CurrentPosition = require('../../../app/models/CurrentPosition');
const Settings = require('../../../app/models/settings');
const MarketIDS = require("../../../app/models/marketIds")
const CurrentPosition2 = require('../../../app/models/CurrentPosition2');
const RunnerWiselossShares = require('../../../app/models/RunnerWiselossShares');
const Sessions = require('../../../app/models/Session');
const mongoose = require('mongoose');
let config = require('config');
const commission = config.commission;


async function getAmountOfWinnerTemp(betId, selectionId, cancelled) {
  console.log("\n\n\n@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@");
  console.log(betId, selectionId, "---", cancelled);

  console.log("getAmountOfWinnerTemp function called\n\n\n");

  const session = await mongoose.startSession();

  const maxRetries = 3; // Max retries for the transaction
  let retries = 0;
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;

  if (!selectionId || selectionId === '' || selectionId === '.') {
    console.log('selectionId is null. Please check why it’s coming null.', selectionId);
    console.log("config.FigureEvenOddSmallBig::::", config.FigureEvenOddSmallBig);
    if (!config.FigureEvenOddSmallBig.includes(Number(betId.subMarketId))) {
      return;
    }
  }

  const bet = await Bets.findOne({ _id: betId._id });
  const userId = bet.userId;
  const userToUpdate = await User.findOne({ userId: bet.userId, isDeleted: false });
  let calculatedExp = bet.exposureAmount;

  if (!userToUpdate) {
    console.error('Error: user not found Location:(_handle winning bet)');
    return;
  }
  // console.log("bet._id------------":bet._id);
  console.log("betid is ...", bet.marketId);

  const exists = await Deposits.findOne({
    userId: userToUpdate.userId,
    betId: bet._id,
    marketId: bet.marketId,
    sportsId: bet.sportsId,
    matchId: bet.matchId
  });

  // if (exists) {
  //   console.log("Bet already in deposits............");
  //   return true;
  // }

  let lowestPosition;
  const runnersPosition = bet.runnersPosition;

  let selectedRunnerAmount = 0;
  let winningAmount = 0;
  let updatedBetStatus = 0;



  if (bet.subMarketId == '7') {
    //for fancies only
    lowestPosition = runnersPosition.reduce((min, entry) => entry.position < min.position ? entry : min).position;
    const highestRunner = runnersPosition.reduce((max, entry) => entry.runner > max.runner ? entry : max);
    const lowestRunner = runnersPosition.reduce((min, entry) => entry.runner < min.runner ? entry : min);
    const resultData = bet.isfancyOrbookmaker ? (!bet.resultData || bet.resultData == '.' ? bet.winnerRunnerData : bet.resultData) : Number(bet.resultData);
    // const resultData = Number(bet.resultData);

    /* find winning amount */
    if (resultData > highestRunner.runner) {
      console.log("1~~~~~~~~~~~~~Catch winning amount => ", highestRunner.position);
      winningAmount = highestRunner.position;
    } else if (resultData < lowestRunner.runner) {
      console.log("2~~~~~~~~~~~~~Catch winning amount => ", lowestRunner.position);
      winningAmount = lowestRunner.position;
    } else {
      const lowerRunners = runnersPosition.filter(entry => entry.runner < resultData);
      const higherRunners = runnersPosition.filter(entry => entry.runner > resultData);

      const closestLower = lowerRunners.reduce((prev, curr) =>
        Math.abs(curr.runner - resultData) < Math.abs(prev.runner - resultData) ? curr : prev,
        { runner: -Infinity, position: null }
      );

      const closestHigher = higherRunners.reduce((prev, curr) =>
        Math.abs(curr.runner - resultData) < Math.abs(prev.runner - resultData) ? curr : prev,
        { runner: Infinity, position: null }
      );


      console.log("closest data: ");
      console.log(closestHigher);
      console.log(closestLower);

      // if (closestLower.position === closestHigher.position) {
      //   console.log("3~~~~~~~~~~~~~Catch winning amount => ", closestHigher.position);
      //   winningAmount = closestHigher.position

      // }
      if (closestLower.position == closestHigher.position) {
        console.log("4~~~~~~~~~~~~~Catch winning amount => ", closestHigher.position);
        winningAmount = closestHigher.position
      }

    }
    /* finding winning amount ended */

  } else {
    //for all other markets
    console.log("runnersPosition:", runnersPosition);
    lowestPosition = runnersPosition.reduce((min, entry) => entry.amount < min.amount ? entry : min).amount;
    runnersPosition?.forEach(winner => { // select runner's amount and winnerRuner
      if (winner.runner == selectionId) {
        console.log("~~~~~~~~~~~~~Catch winning amount => ", winner.amount);
        selectedRunnerAmount = winner.amount;
        winnerRunner = winner.runner;
      }
    });
    console.log("else. part............");
    winningAmount = selectedRunnerAmount;
    console.log("winningAmount-------------------", winningAmount);
  }

  let updateavailableBalance

  let updateUserExposure
  let UpdatedclientPL
  let UpdatedBalance

  updateUserExposure = Number(userToUpdate.exposure + Math.abs(lowestPosition));
  updateavailableBalance = Number(userToUpdate.availableBalance);
  UpdatedclientPL = Number(userToUpdate.clientPL);
  UpdatedBalance = Number(userToUpdate.balance);
  console.log("Math.abs(lowestPosition)----------------", Math.abs(lowestPosition));
  let expCaptured = Math.abs(lowestPosition);
  console.log("expCaptured----------------", expCaptured);
  let commissionAmount = 0
  let UsercommissionAmount = 0
  if (cancelled === 1) {
    winningAmount = 0;
    updatedBetStatus = 2;
  }
  console.log("winningAmount----------------", winningAmount);
  console.log("userToUpdate.availableBalance----------------", userToUpdate.availableBalance);
  if (winningAmount > 0) {
    commissionAmount = commission / 100;
    UsercommissionAmount = await parentCommisionAmount(winningAmount, 100, commissionAmount);
    winningAmount = winningAmount - UsercommissionAmount;
    updateavailableBalance = Number(userToUpdate.availableBalance + expCaptured + winningAmount);
    UpdatedclientPL = Number(userToUpdate.clientPL + (winningAmount));
    UpdatedBalance = Number(userToUpdate.balance + (winningAmount));
  } else if (winningAmount < 0) { // have to be checked
    UpdatedclientPL = Number(userToUpdate.clientPL + (winningAmount));
    UpdatedBalance = Number(userToUpdate.balance + (winningAmount));
    updateavailableBalance = Number(userToUpdate.availableBalance + expCaptured + (winningAmount));
  } else if (winningAmount === 0) {
    updateavailableBalance = Number(userToUpdate.availableBalance + expCaptured);
  }

  console.log("updateavailableBalance----------------", updateavailableBalance);
  while (retries < maxRetries) {
    try {
      // Start a new transaction for each attempt
      await session.startTransaction();

      // Perform the required operations inside the transaction
      await User.updateOne(
        {
          userId: userId,
          isDeleted: false
        },
        {
          balance: UpdatedBalance,
          clientPL: UpdatedclientPL,
          exposure: updateUserExposure.toFixed(0),
          availableBalance: updateavailableBalance
        },
        { session }
      );

      const lastMaxWithdraw = await Deposits.findOne({ userId: userToUpdate.userId }).sort({ _id: -1 });

      console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', winningAmount);
      

      await Deposits.create([{
        userId: userToUpdate.userId,
        description: `Event (${bet.event}) Runner (${bet.runnerName})`,
        amount: winningAmount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance + winningAmount : winningAmount,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + winningAmount : winningAmount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + winningAmount : winningAmount,
        cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        createdBy: 0,
        cashOrCredit: 'Bet',
        marketId: bet.marketId,
        sportsId: bet.sportsId,
        matchId: bet.matchId,
        betId: bet._id.toString(),
        betType: bet.type,
        betDateTime: bet.betTime,
        date: new Date().getTime(),
        createdAt: formattedDate,
        betSession: bet.betSession,
        roundId: bet.marketId,
        addedExpoisureAmount: 0,
        UserPrevexposure: 0,
        UpdatedExposure: expCaptured,
        calculateExp: bet.calculateExp,
      }], { session });

      const parentUserIds = await getParents(userToUpdate.userId);
      const parentUser = await User.find({
        userId: { $in: [...parentUserIds] },
        isDeleted: false
      }).sort({ userId: -1 });

      if (!parentUser) {
        console.error('Error: Parent Users Not Found Location:(_handle losing bet)');
        return;
      } else {
        let prev = 0;
        for (const user of parentUser) {
          let current = user.downLineShare;
          user['commission'] = current - prev;
          prev = current;
        }

        for (const user of parentUser) {
          const existsP = await Deposits.findOne({
            userId: user.userId,
            betId: bet._id,
            commissionFrom: userId,
            marketId: bet.marketId,
            sportsId: bet.sportsId,
            matchId: bet.matchId
          });

          if (existsP) {
            continue;
          }

          await SettleParents(user, bet, winningAmount, session, formattedDate, cancelled);
        }
      }

      // Update Bets with the status and winner data
      let winnerRunnerData = 0;

      console.log("updating bets => ", {
        marketId: bet.marketId,
        userId: bet.userId,
        betSession: bet.betSession,
        eventId: bet.eventId,
        sportsId: bet.sportsId
      })

      await Bets.updateMany(
        {
          marketId: bet.marketId,
          userId: bet.userId,
          betSession: bet.betSession,
          eventId: bet.eventId,
          sportsId: bet.sportsId
        },
        {
          status: updatedBetStatus,
          position: Number(bet.winningAmount),
          iscalculatedExp: calculatedExp,
          winnerRunnerData: winnerRunnerData,
          updatedAt: new Date().getTime()
        },
        { session }
      );

      /*
      ***************************************
      * after updating the bets
      * moving bets entries updated to the clonebets collection to increase performance
      * ************************************
      */
      const documents = await Bets.find({
        marketId: bet.marketId,
        userId: bet.userId,
        betSession: bet.betSession,
        eventId: bet.eventId,
        sportsId: bet.sportsId
      });
      // await cloneBets.insertMany(documents, { session });
      console.log("checkcheckcheckcheck");
      console.log([...documents.map(doc => doc._id)]);
      // await Bets.deleteMany({ _id: { $in: [...documents.map(doc => doc._id)] } }, { session });
      /* end */

      await deleteObsolete(bet.marketId, bet.betSession, bet.subMarketId, bet.eventId, bet, session, bet)

      // await RunnerWiselossShares.deleteMany({
      //   userId: bet.userId,
      //   marketId: bet.marketId
      // }, { session });

      // await CurrentPosition.deleteMany({
      //   userId: bet.userId,
      //   marketId: bet.marketId
      // }, { session });

      // await CurrentPosition2.deleteMany({
      //   userId: bet.userId,
      //   marketId: bet.marketId
      // }, { session });

      // Commit the transaction if everything is successful
      await session.commitTransaction();
      break;  // Exit loop if transaction succeeds

    } catch (error) {
      console.warn(error);

      if (retries < maxRetries) {
        retries++;
        console.log(`Retrying transaction... attempt ${retries}`, error);

        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000)); // Exponential backoff

        continue; // Retry the transaction
      } else {
        console.error('Transaction Error:', error);
        await session.abortTransaction(); // Abort transaction on failure
        return false;
        break;  // Exit loop after max retries
      }
    } finally {
      session.endSession();  // Always end the session after commit or abort
    }
  }

  return true;
}


async function SettleParents(user, bet, winningAmount, session, formattedDate, cancelled) {
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss");
  console.log("ssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss", winningAmount);
  let role = user.role
  let updatedBetStatus = 0
  let FinalShareAmount
  let commissionFrom = bet.userId
  let expPositiveDataP;
  let runnersPosition = bet.runnersPosition;
  let totalExpoisure
  //highestRunner = runnersPosition.reduce((max, entry) => entry.runner > max.runner ? entry : max);
  console.log("runnersPosition-------------------", runnersPosition);
  // if (bet.subMarketId == '7') {
  //   highestAmount = Math.max(...runnersPosition.map(runner => runner.position));
  //   console.log("highestRunner.position:::::::", highestAmount);
  //   if (highestAmount <= 0) highestAmount = 0
  //   //totalExpoisure = Number(((user.commission / 100) * highestAmount))
  // } else {
  //   highestAmount = Math.max(...runnersPosition.map(runner => runner.amount));
  //   if (highestAmount <= 0) highestAmount = 0
  //   //totalExpoisure = Number(((user.commission / 100) * highestAmount))
  //   console.log("highestAmount.amount:::::::", highestAmount);
  // }
  const exposureField = `exp_${role}`;
  totalExpoisure = bet[exposureField]
  console.log('totalExpoisure------------------------', totalExpoisure, "----user.userId----", user.userId);
  if (cancelled == 1) {
    winningAmount = 0
    updatedBetStatus = 2
  }

  console.log("user in => ..............", user.userId);
  

  console.log('user.commission------------------------', user.commission);
  expPositiveDataP = await expPositive.findOne({ userId: user.userId, betId: bet._id.toString(), calculateExp: true }).sort({ _id: -1 });
  FinalShareAmount = Number(((user.commission / 100) * Math.abs(winningAmount)))
  console.log('FinalShareAmount------------------------', FinalShareAmount);
  dealersCommissionAmount = Number(((commission / 100) * FinalShareAmount))

  //totalExpoisure = FinalShareAmount

  let totalBalance = user.balance;
  let totalClientPL = user.clientPL
  let totalClientPLAmount = 0
  let updatedtotalavailableBalance = Number(user.availableBalance)
  let reversedavailableBalance = user.availableBalance + totalExpoisure
  console.log("reversedavailableBalance===================", reversedavailableBalance);
  if (winningAmount > 0) {


    updatedtotalavailableBalance = Number((reversedavailableBalance - FinalShareAmount));
    totalBalance = Number((user.balance - FinalShareAmount));
    totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * winningAmount)) : 0;
    totalClientPL = Number((user.clientPL + totalClientPLAmount));



  } else if (winningAmount < 0) {
    updatedtotalavailableBalance = Number((reversedavailableBalance + FinalShareAmount));
    totalBalance = Number(user.balance + FinalShareAmount);
    totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * Math.abs(winningAmount))) : 0;
    totalClientPL = Number((user.clientPL - totalClientPLAmount));


  } else {
    updatedtotalavailableBalance = reversedavailableBalance

  }
  console.log("totalExpoisure===================", totalExpoisure);
  let updateUserExposure = user.exposure + totalExpoisure

  await User.updateOne(
    {
      userId: user.userId,
      isDeleted: false
    },
    {
      balance: totalBalance,

      exposure: updateUserExposure.toFixed(0),
      availableBalance: updatedtotalavailableBalance,
      availableBalance2: updatedtotalavailableBalance,
      tempExposure: user.exposure + totalExpoisure,
      clientPL: totalClientPL
    },
    { session }
  );









  let upLineAmount
  console.log("winningAmount----------------------------", winningAmount);
  if (winningAmount < 0) {
    upLineAmount = -totalClientPLAmount;
    // const totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * TotalLoosingAmount)) : 0;
    // const totalClientPL = Number((user.clientPL - totalClientPLAmount));

  } else {
    upLineAmount = totalClientPLAmount;
    // const totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount)) : 0;
    // const totalClientPL = Number((user.clientPL + totalClientPLAmount));

  }


  console.log("upLineAmount------------------>>>>>", upLineAmount);
  let amount = 0;
  if (winningAmount > 0) {

    amount = -(user.commission / 100) * winningAmount;

  } else {
    amount = (user.commission / 100) * Math.abs(winningAmount);

  }

  console.log("amount------------------>>>>>", amount);
  let Dbalance = amount
  let DavailableBalance = amount;
  console.log("DavailableBalance------------------>>>>>", DavailableBalance);
  const shareNUpline = amount > 0 ? (Math.abs(amount) + Math.abs(upLineAmount)) : - (Math.abs(amount) + Math.abs(upLineAmount))
  console.log("shareNUpline------------------>>>>>", shareNUpline);
  const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });
  
  if (lastMaxWithdraw) {
    Dbalance = lastMaxWithdraw?.balance + (amount)
    DavailableBalance = lastMaxWithdraw.availableBalance + (amount)
    console.log("lastMaxWithdraw------------------>>>>>", lastMaxWithdraw);
  }
  //let DavailableBalance = lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (amount) : -(amount);
  console.log("DavailableBalance------------------>>>>>", DavailableBalance);
  let DmaxWithdraw = lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (amount) : -(amount);

  let Dcash = lastMaxWithdraw ? lastMaxWithdraw.cash : 0;
  let Dcredit = lastMaxWithdraw?.credit || 0;
  let DcreditRemaining = lastMaxWithdraw?.creditRemaining || 0;





  //if(bet.calculateExp==true){
  //if(cancelled!=1){
  await Deposits.create([{
    userId: user.userId,
    description: `Event (${bet.event}) Runner (${bet.runnerName})`,
    createdBy: 0,
    amount: amount,
    balance: Dbalance,
    availableBalance: DavailableBalance,
    maxWithdraw: DmaxWithdraw,
    cash: Dcash,
    credit: Dcredit,
    creditRemaining: DcreditRemaining, marketId: bet.marketId,
    cashOrCredit: 'Bet',
    commissionFrom: commissionFrom,
    sportsId: bet.sportsId,
    shareNUpline: shareNUpline,
    upLineAmount: upLineAmount,
    betId: bet._id.toString(),
    matchId: bet.matchId,
    subMarketId: bet.subMarketId,
    marketId: bet.marketId,
    betType: bet.type,
    betDateTime: bet.betTime,
    date: new Date().getTime(),
    createdAt: formattedDate,

    commissionAmount: dealersCommissionAmount,

    betSession: bet.betSession,
    roundId: bet.marketId,




  }],
    { session });
  //}


 if(amount<0){
  await Deposits.create([{
    userId: user.userId,
    description: `Commission From Event (${bet.event}) Runner (${bet.runnerName})`,
    createdBy: 0,
    commissionFrom: commissionFrom,
    amount: dealersCommissionAmount,
    balance: Dbalance,
    availableBalance: DavailableBalance,
    maxWithdraw: DmaxWithdraw,
    cashOrCredit: 'Commission',
    betId: bet._id.toString(),
    //cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
    marketId: bet.marketId,
    sportsId: bet.sportsId,
    //credit: lastMaxWithdraw?.credit || 0,
    //creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
    //upLineAmount: upMovingCommAmount,
    matchId: bet.matchId,
    betType: bet.type,
    betDateTime: bet.betTime,
    date: new Date().getTime(),
    createdAt: formattedDate,
    betSession: bet.betSession,
    roundId: bet.roundId
  }],
    { session });
 }
 
  //upMovingAmount = Number((upMovingAmount - (user.commission / 100) * totalRemainingAmount));




  //for parents loop

  let winnerRunnerData = 0;
  let SessionScore = 0;

  const marketInfo = await MarketIDS.findOne({
    sportID: bet.sportsId,
    marketId: bet.marketId
  });
  winnerRunnerData = marketInfo?.winnerRunnerData;
  console.log("deleting marketId:", bet.marketId, "==bet.eventId:::", bet.eventId, "===bet.userId::", bet.userId);

  console.log("updating bets: => ", {
    //_id: bet._id,
    marketId: bet.marketId,
    //subMarketId:'7',
    eventId: bet.eventId,
    userId: bet.userId
  },
    {
      status: updatedBetStatus,
      position: winningAmount,
      iscalculatedExp: bet.exposureAmount,
      winnerRunnerData: winnerRunnerData,
      SessionScore: SessionScore,
      updatedAt: new Date().getTime()
    });




  await CurrentPosition2.deleteMany({
    userId: user.userId,

    marketId: bet.marketId


  }, { session });
  await RunnerWiselossShares.deleteMany({
    userId: user.userId,

    marketId: bet.marketId


  }, { session });
}

module.exports = {

  getAmountOfWinnerTemp,
  SettleParents
}