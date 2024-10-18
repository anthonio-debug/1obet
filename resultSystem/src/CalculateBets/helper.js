const Bets = require('../../../app/models/bets');
const User = require('../../../app/models/user');
const { getParents } = require('../../../app/routes/bets');
const Events = require('../../../app/models/events');
const Deposits = require('../../../app/models/deposits');
const CurrentPosition = require('../../../app/models/CurrentPosition');
const Sessions = require('../../../app/models/Session');
const config = {
    
    commissionLessSubMarkets: [2, 3, 4],
    Fancy: 7,
    BookMaker: 8,
    FigureEvenOddSmallBig: [9, 10, 34]
};


async function getAmountOfWinnerTemp(betId, selectionId) {
    console.log("Reached inside the function..............................");
    const mongoose = require('mongoose');
      const session = await mongoose.startSession();
      const maxRetries = 3; // Max retries for the transaction
    
    const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;
  const bet = await Bets.findOne({
    _id: betId._id
  });
  const userToUpdate = await User.findOne({
    userId: bet.userId,
    isDeleted: false
  });
  if (!userToUpdate) {
    console.error('Error: User Not Found');
    return;
  }
  const lastMaxWithdraw = await Deposits.findOne({ userId: bet.userId }).sort({ _id: -1 });
    let lastWithdrawalRow_AvailableBalance = lastMaxWithdraw.availableBalance;
    let lastWithdrawalRow_balance = lastMaxWithdraw.balance;
    let lastWithdrawalRow_maxWithdraw = lastMaxWithdraw.maxWithdraw;	
    let user_AvailableBalance = userToUpdate.availableBalance;
    let userPrevBalance = userToUpdate.balance;
    let userPrevClientPL = userToUpdate.clientPL;
    let user_Exposure = userToUpdate.exposure;
    let AmountAddedBacktoUserAB = 0;
    let TotalWin = 0;
    let TotalLose = 0;
    let calculatedExp = bet.calculatedExp;
    let betexposureAmount = bet.exposureAmount;
    TotalLose = betexposureAmount;
    let userId = bet.userId;


  
    console.log("calculatedExp insdie...................................",calculatedExp);
  console.log("debt insdie...................................",bet);

  console.log("userID insdie...................................",bet.userId);
  const runnerPosition = bet?.runnersPosition
  var amount = 0
  var winnerRunner = '';
  runnerPosition?.forEach(winner => {
        console.log("Winner amount for ",winner.runner,"----------------------------------------->",winner.amount);
        if (winner.runner == selectionId) {
            selectedRunnerAmount=winner.amount
            winnerRunner = winner.runner
        }
    });

    AmountAddedBacktoUserAB = betexposureAmount + selectedRunnerAmount  // 400 + ( -45 ) = 355, in case of winning we will set it zero
	TotalWin = Number(AmountAddedBacktoUserAB.toFixed(3)); // in case of winning, we will keep it same
	
	let diff = selectedRunnerAmount;
	let users_exposureNewUpdated = user_Exposure + TotalLose;
    console.log("NaN issue with user_AvailableBalance: ",user_AvailableBalance);
    console.log("NaN issue with TotalWin: ",TotalWin);
	let updatedAvailableBalance = user_AvailableBalance;
	updatedAvailableBalance = TotalWin + updatedAvailableBalance;

    let updatedDepositsAvailableBalance = lastWithdrawalRow_AvailableBalance+diff;
    
    

	let depositsNewAmount = diff;
    
	console.log("Deposits Updated Amount:",depositsNewAmount);
	
	console.log("Deposits updatedDepositsAvailableBalance:",updatedDepositsAvailableBalance);
	
	console.log("Users updatedAvailableBalance:",updatedAvailableBalance);
	
	console.log("users new exposure: ",users_exposureNewUpdated);

  console.log("Amount WON: : ",TotalWin);
  console.log("userPrevClientPL updated..........................................: : ",userPrevClientPL+diff);
    await User.updateOne(
        {
          userId: bet.userId,
          isDeleted: false
        },
        {
          balance: userPrevClientPL+diff,
          clientPL: userPrevClientPL+diff,
          exposure: users_exposureNewUpdated,
          availableBalance: updatedAvailableBalance
        }
      );

    await Deposits.create({
        userId: userToUpdate.userId,
        description: `Event (${bet.event}) Runner (${bet.runnerName})`,
        amount: diff,
        balance: lastMaxWithdraw.balance + diff,
        availableBalance: updatedDepositsAvailableBalance,
        maxWithdraw: lastMaxWithdraw.maxWithdraw,
        cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
        credit: lastMaxWithdraw?.credit || 0,
        creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
        createdBy: 0,
        cashOrCredit: 'Bet',
        marketId: bet.marketId,
        sportsId: bet.sportsId,
        matchId: bet.matchId,
        betId: bet._id,
        betType: bet.type,
        betDateTime: bet.betTime,
        date: new Date().getTime(),
        createdAt: formattedDate,
        betSession: bet.betSession,
        roundId: bet.roundId,
        addedExpoisureAmount: 0,
        UserPrevexposure: 0,
        UpdatedExposure: 0,
        sourceCodeBlock: 'newsetup',
        userAvailableBalanceBFTrans: userToUpdate.availableBalance + Math.abs(userToUpdate.exposure),
        userAvailableBalanceAFTrans: lastMaxWithdraw.availableBalance,
        UserBalanceBFTrans: userToUpdate.balance,
        UserBalanceAFTrans: 0,
        
        currentBetAmount:bet.betAmount,
        currentBetLoosingAmount:bet.loosingAmount,
        currentBetWinningAmount:bet.winningAmount,
        currentBetPosition:bet.position,
        areaCalled:'1',
        calculateExp:bet.calculateExp,
        betExpAmount:bet.betExpAmount
      });


      /// Follownig are assignments for commissions, downlines, uplines etc to parents...

      const parentUserIds = await getParents(userToUpdate.userId);
          const parentUser = await User.find({
            userId: { $in: parentUserIds },
            isDeleted: false
          }).sort({ userId: -1 });
          if (!parentUser) {
            console.error(' Error: Parent Users Not Found Location:(_handle losing bet) ');
            return;
          } else {
            
            let NeutralselectedRunnerAmount = Math.abs(diff);
            let upMovingAmount = NeutralselectedRunnerAmount;
            let totalRemainingAmount = diff;
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
            let commissionFrom = userToUpdate.userId;
            for (const user of parentUser) {

                let prevrunnersPosition = false;
                let runnersPosition = bet.runnersPosition;
                let highestAmount = Math.max(...runnersPosition.map(runner => runner.amount));
                if(bet.isFancyOrBookMaker==true && bet.fancyData != null){
                    runnersPosition = bet.runnersPosition;
                    highestAmount = Math.max(...runnersPosition.map(runner => runner.position));
                }
              let winningsShareAmount = Number(((user.commission / 100) * highestAmount).toFixed(3));
              let loosingShareAmount = Number(((user.commission / 100) * remainingAmount).toFixed(3));
              console.log("remainingAmount------------------------------------------------------->>>>>",remainingAmount);
              console.log("loosingShareAmount------------------------------------------------------->>>>>",loosingShareAmount);    
              //winningsShareAmount mean when bettor WIN so it mean dealer LOST  
              //loosingShareAmount mean when bettor LOST so it mean dealer WON

              let UpdatedExposureAmount = user.exposure + winningsShareAmount;
              console.log("Difference is caclauted and I am shoiwng as hereas..................",diff);
              let UpdatedAvailableBalance =  user.availableBalance;
              
              let totalClientPLAmount;
              let userBalance;
              let totalBalance;
              let totalClientPL;
      
              if(diff<0){ 
              
                UpdatedAvailableBalance= user.availableBalance + winningsShareAmount;
                UpdatedAvailableBalance =UpdatedAvailableBalance + loosingShareAmount  
                 totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount).toFixed(3)) : 0;
                 //60% .  .. .100-60 = 40% upline share.... 40/100 = .40 * 1000 = 400 ClientPL. . .
                 userBalance = totalClientPLAmount;
                 //400=400
                 console.log("diff<0", "----------userBalance/totalClientPLAmount----------", userBalance);
                 totalBalance = Number((user.balance + Number(((user.commission / 100) * remainingAmount).toFixed(3))).toFixed(3));



                 // suppose user.balance: 0, 0+600=600. .  2) suppose user.balance: 10, 10 + ( 600 ) = 610--- 3) user.balance: -10, -10 + ( 600 ) = 590
                 // 4) user.balance:

                 console.log("diff<0", "----------totalBalance----------", totalBalance);
                 totalClientPL = Number((user.clientPL + (-totalClientPLAmount)).toFixed(3));
                 // suppose user.clientPL: 0, 0+-400=-400. .  2) suppose user.clientPL: 10, 10 + ( -400 ) = -390--- 3) user.clientPL: -10, -10 + ( -400 ) = -410
                 // 4) user.clientPL: 
              }else{
                 totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount).toFixed(3)) : 0;
                 //60% .  .. .100-60 = 40% upline share.... 40/100 = .40 * 1000 = 400 ClientPL. . .
                 
                 userBalance = totalClientPLAmount;
                 console.log("Else", "----------userBalance/totalClientPLAmount----------", userBalance);
                 
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
                }
              );

              const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });
              await Deposits.create({
                userId: user.userId,
                description: `Event (${bet.event}) Runner (${bet.runnerName})`,
                createdBy: 0,
                amount: -(user.commission / 100) * totalRemainingAmount,
                balance: lastMaxWithdraw ? lastMaxWithdraw.balance - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
                availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
                maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
                cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
                marketId: bet.marketId,
                credit: lastMaxWithdraw?.credit || 0,
                creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
                cashOrCredit: 'Bet',
                commissionFrom: commissionFrom,
                sportsId: bet.sportsId,
                upLineAmount: -upMovingAmount,
                betId: bet._id,
                matchId: bet.matchId,
                betType: bet.type,
                betDateTime: bet.betTime,
                date: new Date().getTime(),
                createdAt: formattedDate,
                totalRemainingAmount: totalRemainingAmount,
                commissionAmount: commissionAmount,
                remainingAmount: remainingAmount,
                betSession: bet.betSession,
                roundId: bet.roundId,

                addedExpoisureAmount: Number(((user.commission / 100) * totalRemainingAmount).toFixed(3)),
                UserPrevexposure: user.exposure,
                UpdatedExposure: UpdatedExposureAmount,
                exposure: 'Number(((user.commission / 100) * totalRemainingAmount).toFixed(3))',
                sourceCodeBlock: 'handleWinningBet'
              });
              upMovingAmount = Number((upMovingAmount - (user.commission / 100) * totalRemainingAmount).toFixed(3));

              if (!config.commissionLessSubMarkets.includes(bet.type) && bet.subMarketId != config.Fancy && bet.subMarketId != config.BookMaker && TotalWin > TotalLose) {
                const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });

                await Deposits.create({
                  userId: user.userId,
                  description: `Commission From Event (${bet.event}) Runner (${bet.runnerName})`,
                  createdBy: 0,
                  commissionFrom: commissionFrom,
                  amount: (user.commission / 100) * commissionAmount,
                  balance: lastMaxWithdraw ? lastMaxWithdraw.balance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
                  availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
                  maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
                  cashOrCredit: 'Commission',
                  betId: bet._id,
                  cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
                  marketId: bet.marketId,
                  sportsId: bet.sportsId,
                  credit: lastMaxWithdraw?.credit || 0,
                  creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
                  upLineAmount: upMovingCommAmount,
                  matchId: bet.matchId,
                  betType: bet.type,
                  betDateTime: bet.betTime,
                  date: new Date().getTime(),
                  createdAt: formattedDate,
                  betSession: bet.betSession,
                  roundId: bet.roundId
                });

                upMovingCommAmount = Number((upMovingCommAmount - (user.commission / 100) * commissionAmount).toFixed(3));
              }
              //commissionFrom = user.userId;
            }

            let winnerRunnerData = 0;
            let SessionScore = 0;
            if (bet.isfancyOrbookmaker && bet.fancyData != null) {
              const marketInfo = await MarketIDS.findOne({
                sportID: bet.sportsId,
                marketId: bet.marketId,
                eventId: bet.eventId
         
              });
              
              winnerRunnerData = marketInfo?.winnerRunnerData;
            } else if (config.FigureEvenOddSmallBig.includes(Number(bet.subMarketId))) {
              const match = await Events.findById(bet.matchId);
              const marketInfo = await Sessions.findOne({
                eventId: Number(match.Id),
                sessionNo: bet.betSession
              });
              SessionScore = marketInfo?.score;
            }
            await Bets.updateMany(
              { marketId: bet.marketId,
                userId: bet.userId,
                betSession: bet.betSession,
                eventId: bet.eventId,
                sportsId: bet.sportsId },
              {
                status: 0,
                position: Number(bet.winningAmount.toFixed(3)),
                iscalculatedExp: calculatedExp,
                winnerRunnerData: winnerRunnerData,
                SessionScore: SessionScore,
                updatedAt: new Date().getTime()
              }
            );
            const betIdString = bet._id.toString();
            await CurrentPosition.deleteMany({ betId: betIdString });

            const updatedUser = await User.findOne({
              userId: userId,
              isDeleted: false
            });
            


            if(diff<0){
                //Bettor lost
            }else if(diff>0){
                //bettor won
            }else{
                //no win no loss
            }


            
        }

    
    
}


async function getAmountOfWinnerFigures(betId, selectionId) {
  console.log("Reached inside the function..............................");
  const mongoose = require('mongoose');
    const session = await mongoose.startSession();
    const maxRetries = 3; // Max retries for the transaction
  
  const now = new Date();
const year = now.getFullYear().toString();
const month = (now.getMonth() + 1).toString().padStart(2, '0');
const day = now.getDate().toString().padStart(2, '0');
const formattedDate = `${year}-${month}-${day}`;
const bet = await Bets.findOne({
  _id: betId._id
});
const userToUpdate = await User.findOne({
  userId: bet.userId,
  isDeleted: false
});
if (!userToUpdate) {
  console.error('Error: User Not Found');
  return;
}
const lastMaxWithdraw = await Deposits.findOne({ userId: bet.userId }).sort({ _id: -1 });
  let lastWithdrawalRow_AvailableBalance = lastMaxWithdraw.availableBalance;
  let lastWithdrawalRow_balance = lastMaxWithdraw.balance;
  let lastWithdrawalRow_maxWithdraw = lastMaxWithdraw.maxWithdraw;	
  let user_AvailableBalance = userToUpdate.availableBalance;
  let userPrevBalance = userToUpdate.balance;
  let userPrevClientPL = userToUpdate.clientPL;
  let user_Exposure = userToUpdate.exposure;
  let AmountAddedBacktoUserAB = 0;
  let TotalWin = 0;
  let TotalLose = 0;
  let calculatedExp = bet.calculatedExp;
  let betexposureAmount = bet.exposureAmount;
  TotalLose = betexposureAmount;
  let userId = bet.userId;



  console.log("calculatedExp insdie...................................",calculatedExp);
console.log("debt insdie...................................",bet);

console.log("userID insdie...................................",bet.userId);
const runnerPosition = bet?.runnersPosition
var amount = 0
var winnerRunner = '';
runnerPosition?.forEach(winner => {
      console.log("Winner amount for ",winner.runner,"----------------------------------------->",winner.amount);
      if (winner.runner == selectionId) {
          selectedRunnerAmount=winner.amount
          winnerRunner = winner.runner
      }
  });

  AmountAddedBacktoUserAB = betexposureAmount + selectedRunnerAmount  // 400 + ( -45 ) = 355, in case of winning we will set it zero
TotalWin = Number(AmountAddedBacktoUserAB.toFixed(3)); // in case of winning, we will keep it same

let diff = selectedRunnerAmount;
let users_exposureNewUpdated = user_Exposure + TotalLose;
  console.log("NaN issue with user_AvailableBalance: ",user_AvailableBalance);
  console.log("NaN issue with TotalWin: ",TotalWin);
let updatedAvailableBalance = user_AvailableBalance;
updatedAvailableBalance = TotalWin + updatedAvailableBalance;

  let updatedDepositsAvailableBalance = lastWithdrawalRow_AvailableBalance+diff;
  
  

let depositsNewAmount = diff;
  
console.log("Deposits Updated Amount:",depositsNewAmount);

console.log("Deposits updatedDepositsAvailableBalance:",updatedDepositsAvailableBalance);

console.log("Users updatedAvailableBalance:",updatedAvailableBalance);

console.log("users new exposure: ",users_exposureNewUpdated);

console.log("Amount WON: : ",TotalWin);
console.log("userPrevClientPL updated..........................................: : ",userPrevClientPL+diff);
  await User.updateOne(
      {
        userId: bet.userId,
        isDeleted: false
      },
      {
        balance: userPrevClientPL+diff,
        clientPL: userPrevClientPL+diff,
        exposure: users_exposureNewUpdated,
        availableBalance: updatedAvailableBalance
      }
    );

  await Deposits.create({
      userId: userToUpdate.userId,
      description: `Event (${bet.event}) Runner (${bet.runnerName})`,
      amount: diff,
      balance: lastMaxWithdraw.balance + diff,
      availableBalance: updatedDepositsAvailableBalance,
      maxWithdraw: lastMaxWithdraw.maxWithdraw,
      cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
      credit: lastMaxWithdraw?.credit || 0,
      creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
      createdBy: 0,
      cashOrCredit: 'Bet',
      marketId: bet.marketId,
      sportsId: bet.sportsId,
      matchId: bet.matchId,
      betId: bet._id,
      betType: bet.type,
      betDateTime: bet.betTime,
      date: new Date().getTime(),
      createdAt: formattedDate,
      betSession: bet.betSession,
      roundId: bet.roundId,
      addedExpoisureAmount: 0,
      UserPrevexposure: 0,
      UpdatedExposure: 0,
      sourceCodeBlock: 'newsetup',
      userAvailableBalanceBFTrans: userToUpdate.availableBalance + Math.abs(userToUpdate.exposure),
      userAvailableBalanceAFTrans: lastMaxWithdraw.availableBalance,
      UserBalanceBFTrans: userToUpdate.balance,
      UserBalanceAFTrans: 0,
      
      currentBetAmount:bet.betAmount,
      currentBetLoosingAmount:bet.loosingAmount,
      currentBetWinningAmount:bet.winningAmount,
      currentBetPosition:bet.position,
      areaCalled:'1',
      calculateExp:bet.calculateExp,
      betExpAmount:bet.betExpAmount
    });


    /// Follownig are assignments for commissions, downlines, uplines etc to parents...

    const parentUserIds = await getParents(userToUpdate.userId);
        const parentUser = await User.find({
          userId: { $in: parentUserIds },
          isDeleted: false
        }).sort({ userId: -1 });
        if (!parentUser) {
          console.error(' Error: Parent Users Not Found Location:(_handle losing bet) ');
          return;
        } else {
          
          let NeutralselectedRunnerAmount = Math.abs(diff);
          let upMovingAmount = NeutralselectedRunnerAmount;
          let totalRemainingAmount = diff;
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
          let commissionFrom = userToUpdate.userId;
          for (const user of parentUser) {

              let prevrunnersPosition = false;
              let runnersPosition = bet.runnersPosition;
              let highestAmount = Math.max(...runnersPosition.map(runner => runner.amount));
              if(bet.isFancyOrBookMaker==true && bet.fancyData != null){
                  runnersPosition = bet.runnersPosition;
                  highestAmount = Math.max(...runnersPosition.map(runner => runner.position));
              }
            let winningsShareAmount = Number(((user.commission / 100) * highestAmount).toFixed(3));
            let loosingShareAmount = Number(((user.commission / 100) * remainingAmount).toFixed(3));
            console.log("remainingAmount------------------------------------------------------->>>>>",remainingAmount);
            console.log("loosingShareAmount------------------------------------------------------->>>>>",loosingShareAmount);    
            //winningsShareAmount mean when bettor WIN so it mean dealer LOST  
            //loosingShareAmount mean when bettor LOST so it mean dealer WON

            let UpdatedExposureAmount = user.exposure + winningsShareAmount;
            console.log("Difference is caclauted and I am shoiwng as hereas..................",diff);
            let UpdatedAvailableBalance =  user.availableBalance;
            
            let totalClientPLAmount;
            let userBalance;
            let totalBalance;
            let totalClientPL;
    
            if(diff<0){ 
            
              UpdatedAvailableBalance= user.availableBalance + winningsShareAmount;
              UpdatedAvailableBalance =UpdatedAvailableBalance + loosingShareAmount  
               totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount).toFixed(3)) : 0;
               //60% .  .. .100-60 = 40% upline share.... 40/100 = .40 * 1000 = 400 ClientPL. . .
               userBalance = totalClientPLAmount;
               //400=400
               console.log("diff<0", "----------userBalance/totalClientPLAmount----------", userBalance);
               totalBalance = Number((user.balance + Number(((user.commission / 100) * remainingAmount).toFixed(3))).toFixed(3));



               // suppose user.balance: 0, 0+600=600. .  2) suppose user.balance: 10, 10 + ( 600 ) = 610--- 3) user.balance: -10, -10 + ( 600 ) = 590
               // 4) user.balance:

               console.log("diff<0", "----------totalBalance----------", totalBalance);
               totalClientPL = Number((user.clientPL + (-totalClientPLAmount)).toFixed(3));
               // suppose user.clientPL: 0, 0+-400=-400. .  2) suppose user.clientPL: 10, 10 + ( -400 ) = -390--- 3) user.clientPL: -10, -10 + ( -400 ) = -410
               // 4) user.clientPL: 
            }else{
               totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount).toFixed(3)) : 0;
               //60% .  .. .100-60 = 40% upline share.... 40/100 = .40 * 1000 = 400 ClientPL. . .
               
               userBalance = totalClientPLAmount;
               console.log("Else", "----------userBalance/totalClientPLAmount----------", userBalance);
               
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
              }
            );

            const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });
            await Deposits.create({
              userId: user.userId,
              description: `Event (${bet.event}) Runner (${bet.runnerName})`,
              createdBy: 0,
              amount: -(user.commission / 100) * totalRemainingAmount,
              balance: lastMaxWithdraw ? lastMaxWithdraw.balance - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
              availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
              maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
              cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
              marketId: bet.marketId,
              credit: lastMaxWithdraw?.credit || 0,
              creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
              cashOrCredit: 'Bet',
              commissionFrom: commissionFrom,
              sportsId: bet.sportsId,
              upLineAmount: -upMovingAmount,
              betId: bet._id,
              matchId: bet.matchId,
              betType: bet.type,
              betDateTime: bet.betTime,
              date: new Date().getTime(),
              createdAt: formattedDate,
              totalRemainingAmount: totalRemainingAmount,
              commissionAmount: commissionAmount,
              remainingAmount: remainingAmount,
              betSession: bet.betSession,
              roundId: bet.roundId,

              addedExpoisureAmount: Number(((user.commission / 100) * totalRemainingAmount).toFixed(3)),
              UserPrevexposure: user.exposure,
              UpdatedExposure: UpdatedExposureAmount,
              exposure: 'Number(((user.commission / 100) * totalRemainingAmount).toFixed(3))',
              sourceCodeBlock: 'handleWinningBet'
            });
            upMovingAmount = Number((upMovingAmount - (user.commission / 100) * totalRemainingAmount).toFixed(3));

            if (!config.commissionLessSubMarkets.includes(bet.type) && bet.subMarketId != config.Fancy && bet.subMarketId != config.BookMaker && TotalWin > TotalLose) {
              const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });

              await Deposits.create({
                userId: user.userId,
                description: `Commission From Event (${bet.event}) Runner (${bet.runnerName})`,
                createdBy: 0,
                commissionFrom: commissionFrom,
                amount: (user.commission / 100) * commissionAmount,
                balance: lastMaxWithdraw ? lastMaxWithdraw.balance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
                availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
                maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
                cashOrCredit: 'Commission',
                betId: bet._id,
                cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
                marketId: bet.marketId,
                sportsId: bet.sportsId,
                credit: lastMaxWithdraw?.credit || 0,
                creditRemaining: lastMaxWithdraw?.creditRemaining || 0,
                upLineAmount: upMovingCommAmount,
                matchId: bet.matchId,
                betType: bet.type,
                betDateTime: bet.betTime,
                date: new Date().getTime(),
                createdAt: formattedDate,
                betSession: bet.betSession,
                roundId: bet.roundId
              });

              upMovingCommAmount = Number((upMovingCommAmount - (user.commission / 100) * commissionAmount).toFixed(3));
            }
            //commissionFrom = user.userId;
          }

          let winnerRunnerData = 0;
          let SessionScore = 0;
          if (bet.isfancyOrbookmaker && bet.fancyData != null) {
            const marketInfo = await MarketIDS.findOne({
              sportID: bet.sportsId,
              marketId: bet.marketId,
              eventId: bet.eventId
       
            });
            
            winnerRunnerData = marketInfo?.winnerRunnerData;
          } else if (config.FigureEvenOddSmallBig.includes(Number(bet.subMarketId))) {
            const match = await Events.findById(bet.matchId);
            const marketInfo = await Sessions.findOne({
              eventId: Number(match.Id),
              sessionNo: bet.betSession
            });
            SessionScore = marketInfo?.score;
          }
          await Bets.updateMany(
            { marketId: bet.marketId,
              userId: bet.userId,
              betSession: bet.betSession,
              eventId: bet.eventId,
              sportsId: bet.sportsId },
            {
              status: 0,
              position: Number(bet.winningAmount.toFixed(3)),
              iscalculatedExp: calculatedExp,
              winnerRunnerData: winnerRunnerData,
              SessionScore: SessionScore,
              updatedAt: new Date().getTime()
            }
          );
          const betIdString = bet._id.toString();
          await CurrentPosition.deleteMany({ betId: betIdString });

          const updatedUser = await User.findOne({
            userId: userId,
            isDeleted: false
          });
          


          if(diff<0){
              //Bettor lost
          }else if(diff>0){
              //bettor won
          }else{
              //no win no loss
          }


          
      }

  
  
}

async function casinoSettlement(betId, selectionId) {
    



    
    
}

module.exports = {

   
    casinoSettlement,
    getAmountOfWinnerTemp,
    getAmountOfWinnerFigures
}