const Bets = require('../../../app/models/bets');
const User = require('../../../app/models/user');
const { getParents } = require('../../../app/routes/bets');
const Events = require('../../../app/models/events');
const Deposits = require('../../../app/models/deposits');


function getAmountOfWinner(bet, selectionId) {
    console.log("Reached inside the function..............................");

    const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;

let calculatedExp = 0;
const userId = bet.userId;
let TotalWin = 0;
let TotalLose = 0;

    const runnerPosition = bet?.runnersPosition
    var amount = 0
    var winnerRunner = '';
    runnerPosition?.forEach(winner => {
        console.log("Winner amount for ",winner.runner,"----------------------------------------->",winner.amount);
        if (winner.runner == selectionId) {
            amount=winner.amount
            winnerRunner = winner.runner
        }
    });
    if(amount>0){

    }else if(amount<0){

    }else{

    }
    console.log("amountttttttttttttttttttttt AK-------------------",amount)
    console.log("userIDdddddddddddddddddddddddddddd AK-------------------",bet.userId)
return amount 
}
async function getAmountOfWinnerTemp(betId, selectionId) {
    console.log("Reached inside the function..............................");

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
    let user_AvailableBalance = userToUpdate.AvailableBalance;
    let user_balance = userToUpdate.balance;
    let user_Exposure = userToUpdate.exposure;
    let AmountAddedBacktoUserAB = 0;
    let TotalWin = 0;
    let TotalLose = 0;
    let betexposureAmount = bet.exposureAmount;
    TotalLose = betexposureAmount;


  
  console.log("debt insdie...................................",bet);

  console.log("userID insdie...................................",bet.userId);

  runnerPosition?.forEach(winner => {
        console.log("Winner amount for ",winner.runner,"----------------------------------------->",winner.amount);
        if (winner.runner == selectionId) {
            selectedRunnerAmount=winner.amount
            winnerRunner = winner.runner
        }
    });

    AmountAddedBacktoUserAB = betexposureAmount + selectedRunnerAmount  // 400 + ( -45 ) = 355, in case of winning we will set it zero
	TotalWin = AmountAddedBacktoUserAB; // in case of winning, we will keep it same
	
	let diff = selectedRunnerAmount;
	let users_exposureNewUpdated = user_Exposure + TotalLose;
	let updatedavailableBalance = user_AvailableBalance;
	updatedavailableBalance = TotalWin + updatedavailableBalance;

    
    

	let depositsNewAmount = diff;
	console.log("Deposits Updated Amount:",depositsNewAmount);
	
	console.log("Deposits updatedDepositsAvailableBalance:",updatedDepositsAvailableBalance);
	
	console.log("Users updatedavailableBalance:",updatedavailableBalance);
	
	console.log("users new exposure: ",users_exposureNewUpdated);



    await User.updateOne(
        {
          userId: bet.userId,
          isDeleted: false
        },
        {
          balance: userToUpdate.balance,
          clientPL: userToUpdate.clientPL,
          exposure: updatedavailableBalance,
          availableBalance: updatedAvailableBalance
        }
      );

    await Deposits.create({
        userId: userToUpdate.userId,
        description: `Event (${bet.event}) Runner (${bet.runnerName})`,
        amount: -loosingAmount,
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

    
    
}

module.exports = {

    getAmountOfWinner,
    getAmountOfWinnerTemp
}