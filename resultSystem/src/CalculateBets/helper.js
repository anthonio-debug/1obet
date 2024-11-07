const Bets = require('../../../app/models/bets');
const expPositive = require("../../../app/models/ExpPositive");
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
    console.log(betId,"Reached inside the function..............................",selectionId);

    const mongoose = require('mongoose');
      const session = await mongoose.startSession();
      const maxRetries = 3; // Max retries for the transaction
      let retries = 0;
      while (retries < maxRetries) {
  try {
          session.startTransaction();
    
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
  //console.log("userToUpdate----------------------------------------",userToUpdate.availableBalance);
  //console.log("bet----------------------------------------",bet);
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
    let calculatedExp = bet.exposureAmount;
    let betexposureAmount = bet.exposureAmount;
    TotalLose = betexposureAmount;
    let userId = bet.userId;
    let selectedRunnerAmount;


  
    //console.log("calculatedExp insdie...................................",calculatedExp);
  //console.log("debt insdie...................................",bet);

  //console.log("userID insdie...................................",bet.userId);
  const runnerPosition = bet?.runnersPosition
  var amount = 0
  var winnerRunner = '';
  runnerPosition?.forEach(winner => {
    
    if(bet.isfancyOrbookmaker==true && bet.fancyData != null){
      //console.log(winner.runner,"kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",selectionId);
      //console.log("Winner position for ",winner.runner,"----------------------------------------->",winner.position);
      if (winner.runner == selectionId) {
           selectedRunnerAmount=winner.position
          winnerRunner = winner.runner
      }
    }else{
     // console.log(winner.runner,".......................................",selectionId);
     // console.log("Winner amount for ",winner.runner,"----------------------------------------->",winner.amount);
      if (winner.runner == selectionId) {
         selectedRunnerAmount=winner.amount
          winnerRunner = winner.runner
      }
      
    }
        
    });

    //console.log("NaN issue with betexposureAmount: ",betexposureAmount);
   // console.log("NaN issue with selectedRunnerAmount: ",selectedRunnerAmount);
    AmountAddedBacktoUserAB = betexposureAmount + selectedRunnerAmount  // 400 + ( -45 ) = 355, in case of winning we will set it zero
	TotalWin = Number(AmountAddedBacktoUserAB.toFixed(3)); // in case of winning, we will keep it same
	
	let diff = selectedRunnerAmount;
	let users_exposureNewUpdated = user_Exposure + TotalLose;
    //console.log("NaN issue with user_AvailableBalance: ",user_AvailableBalance);
    //console.log("NaN issue with TotalWin: ",TotalWin);
	let updatedAvailableBalance = user_AvailableBalance;
	updatedAvailableBalance = TotalWin + updatedAvailableBalance;

    let updatedDepositsAvailableBalance = lastWithdrawalRow_AvailableBalance+diff;
    
    

	let depositsNewAmount = diff;
    
	//console.log("Deposits Updated Amount:",depositsNewAmount);
	
	//console.log("Deposits updatedDepositsAvailableBalance:",updatedDepositsAvailableBalance);
	
	//console.log("Users updatedAvailableBalance:",updatedAvailableBalance);
	
	//console.log("users new exposure: ",users_exposureNewUpdated);

  //console.log("Amount WON: : ",TotalWin);
  //console.log("userPrevClientPL updated..........................................: : ");
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
        },
        { session }
      );

      //console.log("userPrevClientPL updated..........................................: :2222 ");
      
      
      const userExpCheck = await User.findOne({ userId:bet.userId,exposure: { $gt: 0 } });

      if(userExpCheck && userExpCheck.userId!=11000){
   
        

      }

    await Deposits.create([{
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
        betId: bet._id.toString(),
        betType: bet.type,
        betDateTime: bet.betTime,
        date: new Date().getTime(),
        createdAt: formattedDate,
        betSession: bet.betSession,
        roundId: bet.marketId,
        addedExpoisureAmount: 0,
        UserPrevexposure: 0,
        UpdatedExposure: 0,

 
   
        calculateExp:bet.calculateExp,

      }],
      { session });
      //console.log("userPrevClientPL updated..........................................: : 333333");

      let expPositiveData;
      
      expPositiveData = await expPositive.findOne({ userId:userToUpdate.userId,betId:bet._id.toString() });
      //console.log("-------------------------------------user.............",expPositiveData);
      //console.log("-------------------------------------userToUpdate.userId.............",userToUpdate.userId);
      //console.log("-------------------------------------bet.betId.............",bet._id.toString());
      //console.log("-------------------------------------bet.marketId.............",bet.marketId);

      if(expPositiveData){
        await expPositive.updateOne(
          {
            userId:userToUpdate.userId,betId:bet._id.toString(),roundId:bet.marketId
          },
          {
            expReleased: TotalLose,
            expAfterRelease:users_exposureNewUpdated,
            AbAtRelease:updatedAvailableBalance,
            ABForWinAmount:TotalWin,
            
          },
          { session }
        );
      }
      
      /// Follownig are assignments for commissions, downlines, uplines etc to parents...

      const parentUserIds = await getParents(userToUpdate.userId);
      //console.log(parentUserIds,'dddddddddddddddddddddddddd');
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
            let callectiveUpline = 0;
            //console.log("-------------------------------------------------------------------------------------------------===",totalRemainingAmount);
            
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
              //console.log("remainingAmount------------------------------------------------------->>>>>",remainingAmount);
              //console.log("loosingShareAmount------------------------------------------------------->>>>>",loosingShareAmount);    
              //winningsShareAmount mean when bettor WIN so it mean dealer LOST  
              //loosingShareAmount mean when bettor LOST so it mean dealer WON

              let UpdatedExposureAmount = user.exposure + winningsShareAmount;
              //console.log("Difference is caclauted and I am shoiwng as hereas..................",diff);
              let UpdatedAvailableBalance =  user.availableBalance;
              
              let totalClientPLAmount;
              let userBalance;
              let totalBalance;
              let totalClientPL;
              let upLineAmount =0;
              
              
              if(diff<0){ 
                
                UpdatedAvailableBalance= user.availableBalance + winningsShareAmount;
                UpdatedAvailableBalance =UpdatedAvailableBalance + loosingShareAmount  
                 totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount).toFixed(3)) : 0;
                 //60% .  .. .100-60 = 40% upline share.... 40/100 = .40 * 1000 = 400 ClientPL. . .
                 userBalance = totalClientPLAmount;
                 //400=400
                 //console.log("diff<0", "----------userBalance/totalClientPLAmount----------", userBalance);
                 totalBalance = Number((user.balance + Number(((user.commission / 100) * remainingAmount).toFixed(3))).toFixed(3));



                 // suppose user.balance: 0, 0+600=600. .  2) suppose user.balance: 10, 10 + ( 600 ) = 610--- 3) user.balance: -10, -10 + ( 600 ) = 590
                 // 4) user.balance:

                 //console.log("diff<0", "----------totalBalance----------", totalBalance);
                 totalClientPL = Number((user.clientPL + (-totalClientPLAmount)).toFixed(3));
                 // suppose user.clientPL: 0, 0+-400=-400. .  2) suppose user.clientPL: 10, 10 + ( -400 ) = -390--- 3) user.clientPL: -10, -10 + ( -400 ) = -410
                 // 4) user.clientPL: 
                 upLineAmount = -totalClientPLAmount;
                }else{
                
                 totalClientPLAmount = user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount).toFixed(3)) : 0;
                 //60% .  .. .100-60 = 40% upline share.... 40/100 = .40 * 1000 = 400 ClientPL. . .
                 
                 userBalance = totalClientPLAmount;
                 //console.log("Else", "----------userBalance/totalClientPLAmount----------", userBalance);
                 
                 totalBalance = Number((user.balance - Number(((user.commission / 100) * remainingAmount).toFixed(3))).toFixed(3));
                 // suppose user.balance: 0, 0-600=-600. .  2) suppose user.balance: 10, 10 - ( 600 ) = -590--- 3) user.balance: -10, -10 - ( 600 ) = 610
                 // 4) user.balance:

                 //console.log("Else::", "----------totalBalance----------", totalBalance);
                 totalClientPL = Number((user.clientPL + totalClientPLAmount).toFixed(3));
                 // suppose user.clientPL: 0, 0+400=400. .  2) suppose user.clientPL: 10, 10 + ( 400 ) = 410--- 3) user.clientPL: -10, -10 + ( 400 ) = 390
                 // 4) user.clientPL: 
                 upLineAmount = totalClientPLAmount;

              }
              //console.log("totalBalance:::::::::::::::::::;",totalBalance);
              //console.log("UpdatedExposureAmount:::::::::::::::::::;",UpdatedExposureAmount);
              //console.log("UpdatedAvailableBalance:::::::::::::::::::;",UpdatedAvailableBalance);
              //console.log("totalClientPL:::::::::::::::::::;",totalClientPL);
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
                },
                { session }
              );


              let expPositiveDataP;
              expPositiveDataP = await expPositive.findOne({ userId:user.userId,betId:bet._id.toString() });
              
              //console.log("-------------------------------------parents.............",expPositiveDataP);
              //console.log("-------------------------------------user.userId.............",user.userId);
              //console.log("-------------------------------------bet.betId.............",bet._id.toString());
              //console.log("-------------------------------------bet.marketId.............",bet.marketId);
              
              if(expPositiveDataP){
                await expPositive.updateOne(
                  {
                    userId:user.userId,betId:bet._id.toString()
                  },
                  {
                    expReleased: winningsShareAmount,
                    expAfterRelease:UpdatedExposureAmount,
                    AbAtRelease:totalBalance + UpdatedExposureAmount
                    
                  },
                  { session }
                );
              }


              
              
              let amount = -(user.commission / 100) * totalRemainingAmount;
              
                
              let Dbalance = amount
              let DavailableBalance = amount;
              
              const shareNUpline = amount > 0 ? (Math.abs(amount) + Math.abs(upLineAmount)) : - ( Math.abs(amount) + Math.abs(upLineAmount) )

              const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });
              
              if(lastMaxWithdraw){
                Dbalance = lastMaxWithdraw.balance + (amount)
                DavailableBalance = lastMaxWithdraw.availableBalance + (amount)
              }
              //let DavailableBalance = lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (amount) : -(amount);

              let DmaxWithdraw = lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (amount) : -( amount );
              
              let Dcash = lastMaxWithdraw ? lastMaxWithdraw.cash : 0;
              let Dcredit = lastMaxWithdraw?.credit || 0;
              let DcreditRemaining = lastMaxWithdraw?.creditRemaining || 0;
              
              // if(user.userId==23330){
              //   console.log("TEMP...................................");
              //   console.log(bet.marketId,"---",bet._id.toString(),'=Deposits._id=',lastMaxWithdraw._id.toString(),"----",userToUpdate.userId,"<=",user.userId);
              //   console.log("lastMaxWithdraw.balance--",lastMaxWithdraw.balance);
              //   console.log("lastMaxWithdraw.maxWithdraw--",lastMaxWithdraw.maxWithdraw);
              //   console.log("lastMaxWithdraw.availableBalance--",lastMaxWithdraw.availableBalance);
              //   console.log("DmaxWithdraw====>",DmaxWithdraw);  
              //   console.log("amount..........",amount);
              //   console.log("Dbalance.......",Dbalance);
              
              // }else{
              //   //console.log(userToUpdate.userId,"<=",user.userId);
              // }
              
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
                creditRemaining: DcreditRemaining,
                marketId: bet.marketId,
                cashOrCredit: 'Bet',
                commissionFrom: commissionFrom,
                sportsId: bet.sportsId,
                shareNUpline:shareNUpline,
                upLineAmount: upLineAmount,
                betId: bet._id.toString(),
                matchId: bet.matchId,
                betType: bet.type,
                betDateTime: bet.betTime,
                date: new Date().getTime(),
                createdAt: formattedDate,
                totalRemainingAmount: totalRemainingAmount,
                commissionAmount: commissionAmount,
                remainingAmount: remainingAmount,
                betSession: bet.betSession,
                roundId: bet.marketId,

                addedExpoisureAmount: Number(((user.commission / 100) * totalRemainingAmount).toFixed(3)),
                UserPrevexposure: user.exposure,
                UpdatedExposure: UpdatedExposureAmount,
                exposure: 'lastMaxWithdraw ? lastMaxWithdraw.balance - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount',
            
              }],
              { session });
             
              

              upMovingAmount = Number((upMovingAmount - (user.commission / 100) * totalRemainingAmount).toFixed(3));
              //console.log("bet.type==============================================================",bet.type);
              //console.log("TotalWin==============================================================",TotalWin);
              //console.log("TotalLose==============================================================",TotalLose);

              if (!config.commissionLessSubMarkets.includes(bet.type) && bet.subMarketId != config.Fancy && bet.subMarketId != config.BookMaker && TotalWin > TotalLose) {
               const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });
               let Camount = (2/100)*( (user.commission / 100) * totalRemainingAmount);
              //  Dbalance +=Camount;
              //  DavailableBalance +=Camount;
              //  DmaxWithdraw +=Camount;
              //  
              if(user.userId==23330){
                //console.log("lastMaxWithdraw _id:",lastMaxWithdraw._id.toString());
                //console.log("lastMaxWithdraw.maxWithdraw:",lastMaxWithdraw.maxWithdraw);
                console.log("Camount--------------------------",Camount);
                //console.log("Dbalance after commission--------------------------",Dbalance);
               }
                
                
               await Deposits.create([{
                  userId: user.userId,
                  description: `Commission From Event (${bet.event}) Runner (${bet.runnerName})`,
                  createdBy: 0,
                  commissionFrom: commissionFrom,
                  amount: Camount,
                  balance:Dbalance, 
                  availableBalance: DavailableBalance,
                  maxWithdraw: DmaxWithdraw,
                  cash: Dcash,
                  credit: Dcredit,
                  creditRemaining: DcreditRemaining,
                  
                  cashOrCredit: 'Commission',
                  betId: bet._id.toString(),
                  marketId: bet.marketId,
                  sportsId: bet.sportsId,
                  shareNUpline:shareNUpline,
                  upLineAmount: upLineAmount,
                  matchId: bet.matchId,
                  betType: bet.type,
                  betDateTime: bet.betTime,
                  date: new Date().getTime(),
                  createdAt: formattedDate,
                  betSession: bet.betSession,
                  roundId: bet.marketId
                }],
                { session });

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
              },
              { session }
            );
            const betIdString = bet._id.toString();
            await CurrentPosition.deleteMany({ betId: betIdString },{ session });

            
           
            
            


            


            
        }//parents else

        await session.commitTransaction();
        break; // Exit loop if transaction succeeds
      } catch (error) {
        
        
        if (retries < maxRetries) {
          retries++;
          console.log(`Retrying transaction... attempt ${retries}`,error);
          continue; // Retry the transaction
        } else {
          console.error('Transaction Error:', error);
          await session.abortTransaction();
          break; // Exit loop if error is not transient
        }
     


       } finally {
        session.endSession();
      }
    }//end while loop
    
}


async function getAmountOfWinnerFigures(betId, selectionId) {
  //console.log("Reached inside the function..............................");
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  const maxRetries = 3; // Max retries for the transaction
  let retries = 0;

  while (retries < maxRetries) {
    try {
      session.startTransaction();

      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      
      const bet = await Bets.findOne({ _id: betId._id });
      const userToUpdate = await User.findOne({ userId: bet.userId, isDeleted: false });
      

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
      let calculatedExp = bet.exposureAmount;
      let betexposureAmount = bet.exposureAmount;
      TotalLose = betexposureAmount;
      let userId = bet.userId;

      const runnerPosition = bet?.runnersPosition;
      var amount = 0;
      var winnerRunner = '';
      runnerPosition?.forEach(winner => {
        if (winner.runner == selectionId) {
          selectedRunnerAmount = winner.amount;
          winnerRunner = winner.runner;
        }
      });

      AmountAddedBacktoUserAB = betexposureAmount + selectedRunnerAmount;
      TotalWin = Number(AmountAddedBacktoUserAB.toFixed(3));

      let diff = selectedRunnerAmount;
      let users_exposureNewUpdated = user_Exposure + TotalLose;
      let updatedAvailableBalance = user_AvailableBalance;
      updatedAvailableBalance = TotalWin + updatedAvailableBalance;
      let updatedDepositsAvailableBalance = lastWithdrawalRow_AvailableBalance + diff;
      let depositsNewAmount = diff;

    

      await User.updateOne(
        { userId: bet.userId, isDeleted: false },
        {
          balance: userPrevClientPL + diff,
          clientPL: userPrevClientPL + diff,
          exposure: users_exposureNewUpdated,
          availableBalance: updatedAvailableBalance
        },
        { session }
      );

     

      await Deposits.create(
        [{
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
          betId: bet._id.toString(),
          betType: bet.type,
          betDateTime: bet.betTime,
          date: new Date().getTime(),
          createdAt: formattedDate,
          betSession: bet.betSession,
          roundId: bet.marketId,
          addedExpoisureAmount: 0,
          UserPrevexposure: 0,
          UpdatedExposure: 0,
          calculateExp: bet.calculateExp
        }],
        { session }
      );
	 let expPositiveData;

    console.log("userId:",userToUpdate.userId,"------betId:",bet._id.toString(),"======marketId:",bet.marketId);
    expPositiveData = await expPositive.findOne({ userId:userToUpdate.userId,betId:bet._id.toString()});
      
    

      if(expPositiveData){
      

        await expPositive.updateOne(
          {
            userId:userToUpdate.userId,betId:bet._id.toString()
          },
          {
            expReleased: TotalLose,
            expAfterRelease:users_exposureNewUpdated,
            AbAtRelease:updatedAvailableBalance
            
          }
        );
      }
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
          if (bet.isFancyOrBookMaker == true && bet.fancyData != null) {
            runnersPosition = bet.runnersPosition;
            highestAmount = Math.max(...runnersPosition.map(runner => runner.position));
          }
          let winningsShareAmount = Number(((user.commission / 100) * highestAmount).toFixed(3));
          let loosingShareAmount = Number(((user.commission / 100) * remainingAmount).toFixed(3));
         
          let UpdatedExposureAmount = user.exposure + winningsShareAmount;
         let UpdatedAvailableBalance = user.availableBalance;

          let totalClientPLAmount;
          let userBalance;
          let totalBalance;
          let totalClientPL;
          let upLineAmount =0;
          if (diff < 0) {
           
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

            console.log("Else::", "----------totalBalance----------", totalBalance);
            totalClientPL = Number((user.clientPL + totalClientPLAmount).toFixed(3));
            upLineAmount = totalClientPLAmount;
          }
           const totalExpoisure = Number((user.exposure + Number(((user.commission / 100) * totalRemainingAmount).toFixed(3))).toFixed(3));
          const totalavailableBalance = Number((user.availableBalance + Number(((user.commission / 100) * commissionAmount).toFixed(3))).toFixed(3));

          await User.updateOne(
            { userId: user.userId, isDeleted: false },
            {
              balance: totalBalance,
              exposure: UpdatedExposureAmount,
              availableBalance: UpdatedAvailableBalance,
              clientPL: totalClientPL
            },
            { session }
          );


          
          let expPositiveDataP;
        expPositiveDataP = await expPositive.findOne({ userId: user.userId, betId: bet._id.toString() }).session(session);

        if (expPositiveDataP) {
          await expPositive.updateOne(
            { userId: user.userId, betId: bet._id.toString() },
            {
              expReleased: winningsShareAmount,
              expAfterRelease: UpdatedExposureAmount,
              AbAtRelease: totalBalance + UpdatedExposureAmount
            },
            { session }
          );

             
          
          let amount = -(user.commission / 100) * totalRemainingAmount;
              
                
          let Dbalance = amount
          let DavailableBalance = amount;
          
          const shareNUpline = amount > 0 ? (Math.abs(amount) + Math.abs(upLineAmount)) : - ( Math.abs(amount) + Math.abs(upLineAmount) )

          const lastMaxWithdraw = await Deposits.findOne({ userId: user.userId }).sort({ _id: -1 });
          
          if(lastMaxWithdraw){
            Dbalance = lastMaxWithdraw.balance + (amount)
            DavailableBalance = lastMaxWithdraw.availableBalance + (amount)
          }
          //let DavailableBalance = lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (amount) : -(amount);

          let DmaxWithdraw = lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (amount) : -( amount );
          
          let DCash = lastMaxWithdraw ? lastMaxWithdraw.cash : 0;
          let Dcredit = lastMaxWithdraw?.credit || 0;
          let DcreditRemaining = lastMaxWithdraw?.creditRemaining || 0;
          
          if(user.userId==23330){
            console.log("TEMP...................................");
            console.log(bet.marketId,"---",bet._id.toString(),'=Deposits._id=',lastMaxWithdraw._id.toString(),"----",userToUpdate.userId,"<=",user.userId);
            console.log("lastMaxWithdraw.balance--",lastMaxWithdraw.balance);
            console.log("lastMaxWithdraw.maxWithdraw--",lastMaxWithdraw.maxWithdraw);
            console.log("lastMaxWithdraw.availableBalance--",lastMaxWithdraw.availableBalance);
            console.log("DmaxWithdraw====>",DmaxWithdraw);  
            console.log("amount..........",amount);
            console.log("Dbalance.......",Dbalance);
          
          }else{
            //console.log(userToUpdate.userId,"<=",user.userId);
          }


        await Deposits.create([{
          userId: user.userId,
          description: `Event (${bet.event}) Runner (${bet.runnerName})`,
          amount: amount,
          balance: Dbalance,
          availableBalance: DavailableBalance,
          maxWithdraw: DmaxWithdraw,
          cash: DCash,
          credit: Dcredit,
          creditRemaining: DcreditRemaining,
          createdBy: 0,
          cashOrCredit: 'Bet',
          shareNUpline:shareNUpline,
          upLineAmount: upLineAmount,
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
          UpdatedExposure: 0,
          calculateExp: bet.calculateExp
        }], { session });


        }
        
        
          
          if (user.downLineShare != 100) {
            remainingAmount = Number((remainingAmount - winningsShareAmount).toFixed(3));
          }
          commissionAmount = commissionAmount + (user.commission / 100) * totalRemainingAmount;
        
        
        
        }//loop of parents
      }//else of parents..




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
            }, { session }
          );
          const betIdString = bet._id.toString();
          await CurrentPosition.deleteMany({ betId: betIdString }, { session });



          

      await session.commitTransaction();
      break; // Exit loop if transaction succeeds
    } catch (error) {
      if ( retries < maxRetries) {
        retries++;
        console.log(`Retrying transaction... attempt ${retries}`);
        continue; // Retry the transaction
      } else {
        console.error('Transaction Error:', error);
        await session.abortTransaction();
        break; // Exit loop if error is not transient
      }
    } finally {
      session.endSession();
    }
  }//end while loop
}

async function returnParentExposure(bet) {
  
  
    calculatedExp = 1;
    let runnersPosition = bet.runnersPosition;
    
    let highestAmount = Math.max(...runnersPosition.map(runner => runner.amount));

    let pledgedAmount = Math.abs(bet.exposureAmount);

    const userToUpdate = await User.findOne({
      userId: bet.userId,
      isDeleted: false
    });

    // console.log("pledgedAmount..............",pledgedAmount);
    // console.log("bet.availableBalance..............",userToUpdate.availableBalance);
    // 
    await User.updateOne(
      {
        userId: bet.userId,
        isDeleted: false
      },
      {
        availableBalance: userToUpdate.availableBalance + pledgedAmount,
        exposure: userToUpdate.exposure + pledgedAmount
      }
    );
  





  const parentUserIds = await getParents(bet.userId);
  const parentUser = await User.find({
    userId: { $in: parentUserIds },
    isDeleted: false
  }).sort({ userId: -1 });
  if (!parentUser) {
    console.error(' Error: Parent Users Not Found Location:(_handle losing bet) ');
    return;
  } else {
    
   
    let prev = 0;
    for (const user of parentUser) {
      let current = user.downLineShare;
      user['commission'] = current - prev;
      prev = current;
    }
    
    for (const user of parentUser) {

    if (bet.isfancyOrbookmaker == true && bet.fancyData !== null) {
      let runnersPosition = bet.runnersPosition;
                  runnersPosition = bet.runnersPosition;
                  highestAmount = Math.max(...runnersPosition.map(runner => runner.position));
    }else{

      let runnersPosition = bet.runnersPosition;
              let highestAmount = Math.max(...runnersPosition.map(runner => runner.amount));
              if(bet.isFancyOrBookMaker==true && bet.fancyData != null){
                  runnersPosition = bet.runnersPosition;
                  highestAmount = Math.max(...runnersPosition.map(runner => runner.position));
              }
              
              let winningsShareAmount = Number(((user.commission / 100) * highestAmount).toFixed(3));
              
      let UpdatedExposureAmount = user.exposure + winningsShareAmount;
      await User.updateOne(
        {
          userId: user.userId,
          isDeleted: false
        },
        {
          
          exposure: UpdatedExposureAmount,
          availableBalance: user.availableBalance + winningsShareAmount,
         
        }
      );
      await Bets.updateOne(
        { _id: bet._id },
        {
          position: 0,
          status: 2,
          iscalculatedExp: 1,
          updatedAt: new Date().getTime()
        }
      );

    
    }
  }

  }
}
async function casinoSettlement(betId, selectionId) {
    



    
    
}

module.exports = {

   
    casinoSettlement,
    getAmountOfWinnerTemp,
    getAmountOfWinnerFigures,
    returnParentExposure
}