const Bets = require("../../../app/models/bets");
const User = require("../../../app/models/user");
const { getParents } = require("../../../app/routes/bets");
const Events = require("../../../app/models/events");
const Cash = require("../../../app/models/deposits");
const CurrentPosition = require("../../../app/models/CurrentPosition");
const ExpRec = require("../../../app/models/ExpRec");


const config = {
  "PORT": 3003,
  "DBNAME": "Bet99",
  "DBHost": "mongodb://127.0.0.1/Bet99",
  "DBHostLive": "mongodb+srv://umar:ahmad123@cluster0.dillplp.mongodb.net/Bet99?retryWrites=true&w=majority",
  "secret": "umarIsLove",
  "apisFileName": "config/settings/apis/allApis.json",
  "saltRounds": 10,
  "pageSize": 10,
  "staging_apiUrl": "https://stage.game-program.com/api/seamless/provider",
  "apiUrl":"https://em-api.thegameprovider.com/api/seamless/provider",
  "eventListAPIUrl": "https://streamingtv.fun:3440/api",
  "sportsAPIUrl": "http://209.250.242.175:33332",
  "fancyUrl": "https://betfairoddsapi.com:3444/api",
  "liveTvUrl": "https://livesportscore.xyz:3440/api",
  "liveScoreUrl": "https://livesportscore.xyz:3443/api/getScoreId",
  "sportsLiveScore": "https://livesportscore.xyz:3440/api/bf_scores/",
  "horseRaceUrl": "http://136.244.77.249:33333",
  "oldSaltKey":"Loa0192Jua",
  "betMinimumAmount": 100,
  "api_username":"1obet_mc_s",
  "api_password": "b16gWs7e0QAASLTne0",
  "saltKey":"qrb4VepLav",
  "staging_api_password": "6w9GNrsxZsHBeC795N",
  "staging_api_login": "1obet_mc_s",
  "language": "en",
  "play_for_fun": false,
  "currency": "PKR",
  "createCasinoUser": true,
  "casinoMultiples": 10,
  "commission": 2,
  "SportOddsSubMarkets": [6, 13, 15],
  "sportMarkets": ["1","2", "4"],
  "raceMarkets": ["7", "4339"],
  "casinoMarketId": "6",
  "FigureEvenOddSmallBig" : [9, 10, 34],
  "commissionLessSubMarkets": [2, 3, 4],
  "balls": ["1", "2", "3", "4", "5", "6"],
  "matchTypes" : ["T10", "T20", "ODI", "TEST"],
  "ExcludedBackLay": [7, 8],
  "figureRunners": [
    { "runner": 0, "amount": 0 },
    { "runner": 1, "amount": 0 },
    { "runner": 2, "amount": 0 },
    { "runner": 3, "amount": 0 },
    { "runner": 4, "amount": 0 },
    { "runner": 5, "amount": 0 },
    { "runner": 6, "amount": 0 },
    { "runner": 7, "amount": 0 },
    { "runner": 8, "amount": 0 },
    { "runner": 9, "amount": 0 }
  ],
  "FancyKaliJotaChottaBara":[
    { "runner": 1, "amount": 0 },
    { "runner": 0, "amount": 0 }
  ],
  "soccerOdds": 13,
  "tennisOdds": 15,
  "cricketOdds": 6,
  "Fancy": 7,
  "BookMaker": 8,
  "Figure" : 9,
  "EvenOdd": 10, 
  "SmallBig" : 34,
  "Toss": 11,
  "Cup": 12,
  "tiedMatch": 35,
  "overUnder": 14,
  "raceOpenBefore" : 120000,
  "sportsOpenBefore" : 600000
}

async function getEndedMatches(sportsId) {
  try {
    const endedMatches = await Events.find({
      sportsId,
      winner: { $ne: 0 },
      betSettled: false
    });
    return endedMatches;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function getAllBets(Id) {
  try {
    // let userId = req.decoded.userId
    const allBets = await Bets.find({ matchId: Id, status: 1 });
    console.log("allBets =======", allBets);
    return allBets;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function handleLosingBet(bet) {

  console.log(`Bet ${bet._id} lost.`);
  const userId = bet.userId;
  const loosingAmount = Number(bet.loosingAmount.toFixed(2));
  console.log("loosingAmount", loosingAmount);

  const userToUpdate = await User.findOne({
    userId: userId,
    isDeleted: false,
  });

  if (!userToUpdate) {
    return res.status(404).send({ message: "user not found" });
  }
  const user_prev_balance = userToUpdate.balance;
  const user_prev_availableBalance = userToUpdate.availableBalance;
  const user_prev_exposure = userToUpdate.exposure;

  userToUpdate.balance  -= Number(loosingAmount.toFixed(2));
  userToUpdate.clientPL -= Number(loosingAmount.toFixed(2));
  let userToUpdateAvailableBalance   = - Number(loosingAmount.toFixed(2));
  if(bet.calculateExp){
    userToUpdateAvailableBalance += Number(bet.exposureAmount.toFixed(2))
    userToUpdate.exposure += Number(bet.exposureAmount.toFixed(2));
  }
  userToUpdate.availableBalance += Number(userToUpdateAvailableBalance.toFixed(2));
  await userToUpdate.save();

  const updatedUser = await User.findOne({
    userId: userId,
    isDeleted: false,
  });

  const user_new_balance = updatedUser.balance;
  const user_new_availableBalance = updatedUser.availableBalance;
  const user_new_exposure = updatedUser.exposure;
  console.log(" ======================== User Updating Sucessfully ");

  let lastTrans       = await Cash.find({  userId: userToUpdate.userId }).sort({ _id: -1 }).limit(1);
  let lastMaxWithdraw = lastTrans.length > 0? lastTrans[0] : null
  let cash = new Cash({
    userId: userToUpdate.userId,
    description: `Event (${bet.event}) Runner (${bet.runnerName})`,
    amount: - loosingAmount,
    balance: lastMaxWithdraw ? lastMaxWithdraw.balance - loosingAmount : -loosingAmount,
    availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - loosingAmount : -loosingAmount,
    maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - loosingAmount : loosingAmount,  
    cash: lastMaxWithdraw ? lastMaxWithdraw.cash  : 0,
    credit: lastMaxWithdraw?.credit || 0 ,
    creditRemaining:  lastMaxWithdraw?.creditRemaining  || 0,   
    createdBy: 0,
    cashOrCredit: "Bet",
    marketId: bet.marketId,
    sportsId: bet.sportsId,
    matchId: bet.matchId,
    betId: bet._id,
    betType: bet.type,
    betDateTime: bet.betTime
  });
  await cash.save();

  lastTrans = await Cash.find({  userId: userToUpdate.userId }).sort({ _id: -1 }).limit(1);

  const ExpTran = new ExpRec({
    userId: updatedUser.userId,
    trans_from: "BetLose",
    trans_from_id: bet._id,
    trans_bet_status :  0,
    user_prev_balance: user_prev_balance,
    user_prev_availableBalance: user_prev_availableBalance,
    user_prev_exposure: user_prev_exposure,
    user_new_balance: user_new_balance,
    user_new_availableBalance: user_new_availableBalance,
    user_new_exposure: user_new_exposure,
    marketId: bet.marketId,
    sportsId: bet.sportsId,
  })
  await ExpTran.save();

  console.log(" ======================== Cash Updating Sucessfully ");

  const parentUserIds = await getParents(userId);

  const parentUser = await User.find({
    userId: {
      $in: parentUserIds,
    },
    isDeleted: false,
  }).sort({ userId: -1 });

  if (!parentUser) {
    return res.status(404).send({ message: "user not found" });
  }

  const remainingAmount    = Number(bet.winningAmount.toFixed(2));
  const TotalLoosingAmount = Number(bet.loosingAmount.toFixed(2));

  let prev = 0;
  parentUser.forEach((user) => {
    let current = user.downLineShare;
    user["commission"] = current - prev;
    prev = current;
  });
  console.log(" ======================== Commitions Calculated  Sucessfully ");

  let commissionFrom = userToUpdate.userId;
  let upMovingAmount = TotalLoosingAmount;

  parentUser.forEach(async (user) => {
    user.exposure += Number(((user.commission / 100) * remainingAmount).toFixed(2));
    user.availableBalance += Number(((user.commission / 100) * remainingAmount + (user.commission / 100) * TotalLoosingAmount).toFixed(2));
    user.balance += Number(((user.commission / 100) * TotalLoosingAmount).toFixed(2));
    user.clientPL -= user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * TotalLoosingAmount).toFixed(2)) : 0;
    user.save();
    console.log(" ======================== Parent User Updating Sucessfully ");

    let lastTrans       = await Cash.find({  userId: user.userId }).sort({ _id: -1 }).limit(1);
    let lastMaxWithdraw = lastTrans.length > 0? lastTrans[0] : null

    let cash = new Cash({
      userId: user.userId,
      description: `Paid to Battor for  Event (${bet.event}) Runner (${bet.runnerName})`,
      createdBy: 0,
      amount: (user.commission / 100) * TotalLoosingAmount,
      balance: lastMaxWithdraw ? lastMaxWithdraw.balance + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
      availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
      maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
      commissionFrom: commissionFrom,
      cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
      credit: lastMaxWithdraw ? lastMaxWithdraw.credit: 0,
      creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining  : 0,
      cashOrCredit: "loosing",
      marketId: bet.marketId,
      sportsId: bet.sportsId,
      upLineAmount: upMovingAmount,
      betId: bet._id,
      matchId: bet.matchId,
      betType: bet.type,
      betDateTime: bet.betTime
    });
    cash.save();

    console.log(" ======================== Parent User Cash Updating Sucessfully ");

    upMovingAmount = Number((upMovingAmount - (user.commission / 100) * TotalLoosingAmount).toFixed(2));
    commissionFrom = user.userId;
  });

  console.log(" ======================== Moving to Update  Bet Status ");
  await Bets.findByIdAndUpdate(bet._id, { status: 0, position: bet.loosingAmount * -1 });

  console.log(" betIdString =============== Starting ");
  console.log(bet._id.toString());
  const betIdString = bet._id.toString();
  console.log(" betIdString =============== ", betIdString);
  await CurrentPosition.deleteMany({ betId: betIdString })

}

async function handleWinningBet(bet) {
  console.log(`Bet ${bet._id} lost.`);
  const userId = bet.userId;
  const loosingAmount = Number(bet.loosingAmount.toFixed(2));
  const betAmount = Number(bet.betAmount.toFixed(2));
  const userToUpdate = await User.findOne({
    userId: userId,
    isDeleted: false,
  });

  if (!userToUpdate) {
    return res.status(404).send({ message: "user not found" });
  }
  let remainingAmount
  let commissionAmount
  let totalRemainingAmount
  let TotalLoosingAmount
  let upMovingAmount
  let upMovingCommAmount

  if (!config.commissionLessSubMarkets.includes(bet.type) && bet.subMarketId != config.Fancy && bet.subMarketId != config.BookMaker) {
    remainingAmount      = Number(((bet.winningAmount / 100) * 98).toFixed(2));
    commissionAmount     = Number(((bet.winningAmount / 100) * 2).toFixed(2));
    totalRemainingAmount = Number(bet.winningAmount.toFixed(2));
    TotalLoosingAmount   = Number(bet.loosingAmount.toFixed(2));
    upMovingAmount       = Number(totalRemainingAmount.toFixed(2))
    upMovingCommAmount   = Number(commissionAmount.toFixed(2))
  }
  else {
    remainingAmount      = Number(bet.winningAmount.toFixed(2));
    commissionAmount     = Number(((bet.winningAmount / 100) * 2).toFixed(2));
    totalRemainingAmount = Number(bet.winningAmount.toFixed(2));
    TotalLoosingAmount   = Number(bet.loosingAmount.toFixed(2));
    upMovingAmount       = Number(totalRemainingAmount.toFixed(2))
    upMovingCommAmount   = Number(commissionAmount.toFixed(2))
  }

  const user_prev_balance = userToUpdate.balance;
  const user_prev_availableBalance = userToUpdate.availableBalance;
  const user_prev_exposure = userToUpdate.exposure;

  userToUpdate.balance  += Number(remainingAmount.toFixed(2));
  userToUpdate.clientPL += Number(remainingAmount.toFixed(2));
  let userToUpdateAvailableBalance   =  Number(remainingAmount.toFixed(2));
  if(bet.calculateExp){
    userToUpdateAvailableBalance += Number(bet.exposureAmount.toFixed(2)) 
    userToUpdate.exposure += Number(bet.exposureAmount.toFixed(2));
  }
  userToUpdate.availableBalance += Number(userToUpdateAvailableBalance.toFixed(2));

  await userToUpdate.save();

  const updatedUser = await User.findOne({
    userId: userId,
    isDeleted: false,
  });

  const user_new_balance  = updatedUser.balance;
  const user_new_exposure = updatedUser.exposure;
  const user_new_availableBalance = updatedUser.availableBalance;

  const ExpTran = new ExpRec({
    userId: updatedUser.userId,
    trans_from: "BetWin",
    trans_from_id: bet._id,
    trans_bet_status :  0,
    user_prev_balance: user_prev_balance,
    user_prev_availableBalance: user_prev_availableBalance,
    user_prev_exposure: user_prev_exposure,
    user_new_balance: user_new_balance,
    user_new_availableBalance: user_new_availableBalance,
    user_new_exposure: user_new_exposure,
    marketId: bet.marketId,
    sportsId: bet.sportsId,
  })
  await ExpTran.save();

  console.log(" =============== User Updated Successfull ");

  let lastTrans       = await Cash.find({  userId: userToUpdate.userId }).sort({ _id: -1 }).limit(1);
  let lastMaxWithdraw = lastTrans.length > 0? lastTrans[0] : null

  // console.log("lastMaxWithdraw1", lastMaxWithdraw);

  let cash = new Cash({
    userId: userToUpdate.userId,
    description: `Event (${bet.event}) Runner (${bet.runnerName})`,
    betId: bet._id,
    createdBy: 0,
    amount: remainingAmount,
    balance: lastMaxWithdraw ? lastMaxWithdraw.balance + remainingAmount : remainingAmount,
    availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + remainingAmount : remainingAmount,
    maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + remainingAmount : remainingAmount,
    cashOrCredit: "Bet",
    cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
    credit: lastMaxWithdraw?.credit || 0 ,
    creditRemaining:  lastMaxWithdraw?.creditRemaining  || 0,   
    marketId: bet.marketId,
    sportsId: bet.sportsId,
    matchId: bet.matchId,
    betType: bet.type,
    betDateTime: bet.betTime
  });
  // console.log('usercash', typeof cash);
  await cash.save();
  console.log(" =============== Cash  Save Successfull ");


  const parentUserIds = await getParents(userId);
  const parentUser = await User.find({
    userId: {
      $in: [...parentUserIds],
    },
    isDeleted: false,
  }).sort({ userId: -1 });

  if (!parentUser) {
    return res.status(404).send({ message: "user not found" });
  }
  let prev = 0;
  for (const user of parentUser) {
    let current = user.downLineShare;
    user["commission"] = current - prev;
    prev = current;
  }

  console.log(" =============== Parent Commition  Successfull ");


  let commissionFrom = userToUpdate.userId;
  for (const user of parentUser) {
    user.exposure += Number(((user.commission / 100) * totalRemainingAmount).toFixed(2));
    user.balance  -= Number(((user.commission / 100) * remainingAmount).toFixed(2));
    user.availableBalance += Number(((user.commission / 100) * commissionAmount).toFixed(2));
    user.clientPL         += user.downLineShare != 100 ? Number((((100 - user.downLineShare) / 100) * remainingAmount).toFixed(2)) : 0;
    await user.save();

    let lastTrans       = await Cash.find({  userId: user.userId }).sort({ _id: -1 }).limit(1);
    let lastMaxWithdraw = lastTrans.length > 0? lastTrans[0] : null

    console.log(" =============== Parent User Successfull ");

    if (!lastMaxWithdraw) {
      console.log('User cach record not found.', user);
    }
    
    let betTransaction = new Cash({
      userId: user.userId,
      description: `Event (${bet.event}) Runner (${bet.runnerName})`,
      createdBy: 0,
      amount: -(user.commission / 100) * totalRemainingAmount,
      balance: lastMaxWithdraw ? lastMaxWithdraw.balance - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
      availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
      maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
      cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
      marketId: bet.marketId,
      credit: lastMaxWithdraw?.credit || 0 ,
      creditRemaining:  lastMaxWithdraw?.creditRemaining  || 0,   
      cashOrCredit: "Bet",
      commissionFrom: commissionFrom,
      sportsId: bet.sportsId,
      upLineAmount: -upMovingAmount,
      betId: bet._id,
      matchId: bet.matchId,
      betType: bet.type,
      betDateTime: bet.betTime
    });

    upMovingAmount = Number((upMovingAmount - (user.commission / 100) * totalRemainingAmount).toFixed(2));
    await betTransaction.save();
    console.log(" =============== Parent bet Transaction  Successfull ");

    if (!config.commissionLessSubMarkets.includes(bet.type) && bet.subMarketId != config.Fancy && bet.subMarketId != config.BookMaker) {
      let lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });
      let commissionTransaction = new Cash({
        userId: user.userId,
        description: `Commission From Event (${bet.event}) Runner (${bet.runnerName})`,
        createdBy: 0,
        commissionFrom: commissionFrom,
        amount: (user.commission / 100) * commissionAmount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
        cashOrCredit: "Commission",
        betId: bet._id,
        cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
        marketId: bet.marketId,
        sportsId: bet.sportsId,
        credit: lastMaxWithdraw?.credit || 0 ,
        creditRemaining:  lastMaxWithdraw?.creditRemaining  || 0,   
        upLineAmount: upMovingCommAmount,
        matchId: bet.matchId,
        betType: bet.type,
        betDateTime: bet.betTime
      });
      await commissionTransaction.save();
    }
    upMovingCommAmount  = Number((upMovingCommAmount - (user.commission / 100) * commissionAmount).toFixed(2));
    commissionFrom      = user.userId;
  };
  await Bets.findByIdAndUpdate(bet._id, { status: 0, position: bet.winningAmount });
  console.log(" betIdString =============== Starting  ");
  console.log(bet._id.toString());
  const betIdString = bet._id.toString();
  console.log(" betIdString =============== ", betIdString);
  await CurrentPosition.deleteMany({ betId: betIdString })
}

const handleDrawBet = async (bet, status = 1) => {
  console.log(` Bet ${bet._id} Draw. `);
  const userId = bet.userId;
  const userToUpdate = await User.findOne({
    userId: userId,
    isDeleted: false,
  });

  if (!userToUpdate) {
    return res.status(404).send({ message: "user not found" });
  }
  const user_prev_balance = userToUpdate.balance;
  const user_prev_availableBalance = userToUpdate.availableBalance;
  const user_prev_exposure = userToUpdate.exposure;
  if(bet.calculateExp){
    Number(bet.exposureAmount.toFixed(2))
    userToUpdate.availableBalance = updatedUserBalance;
    userToUpdate.exposure = updatedUserBalance;
  }
  await userToUpdate.save();

  const updatedUser = await User.findOne({
    userId: userId,
    isDeleted: false,
  });

  const user_new_balance = updatedUser.balance;
  const user_new_availableBalance = updatedUser.availableBalance;
  const user_new_exposure = updatedUser.exposure;

  const ExpTran = new ExpRec({
    userId: updatedUser.userId,
    trans_from: "BetDrawOrCanceled",
    trans_from_id: bet._id,
    trans_bet_status :  status,
    user_prev_balance: user_prev_balance,
    user_prev_availableBalance: user_prev_availableBalance,
    user_prev_exposure: user_prev_exposure,
    user_new_balance: user_new_balance,
    user_new_availableBalance: user_new_availableBalance,
    user_new_exposure: user_new_exposure,
    marketId: bet.marketId,
    sportsId: bet.sportsId,
  })
  await ExpTran.save();

  const totalRemainingAmount = Number(bet.winningAmount.toFixed(2));

  const parentUserIds = await getParents(userId);
  const parentUser = await User.find({
    userId: {
      $in: [...parentUserIds],
    },
    isDeleted: false,
  }).sort({ role: -1 });

  if (!parentUser) {
    return res.status(404).send({ message: "user not found !" });
  }
  let prev = 0;
  // parentUser.forEach((user) => {
  for (const user of parentUser) {
    let current = user.downLineShare;
    user["commission"] = current - prev;
    prev = current;
  }
  // });

  // parentUser.forEach((user) => {
  for (const user of parentUser) {
    const amountToBeAddedExp = Number(( user.exposure + Number((user.commission / 100) * totalRemainingAmount).toFixed(2)).toFixed(2));
    const amountToBeAddedAvlBalance = Number(( user.availableBalance + Number((user.commission / 100) * totalRemainingAmount).toFixed(2)).toFixed(2));
    console.log(" ===================== exposure ===================== ",  Number(( user.exposure + ((user.commission / 100) * totalRemainingAmount)).toFixed(2)));
    console.log(" ===================== availableBalance ===================== ",  Number(( user.availableBalance + ((user.commission / 100) * totalRemainingAmount)).toFixed(2)));
    user.exposure = amountToBeAddedExp;
    user.availableBalance = amountToBeAddedAvlBalance;
    user.save();
  }
  // });

  await Bets.findByIdAndUpdate(bet._id, { status: status });
  console.log(" betIdString ============================== Starting  ");
  console.log(bet._id.toString());
  const betIdString = bet._id.toString();
  console.log(" betIdString ============================== ", betIdString);
  await CurrentPosition.deleteMany({ betId: betIdString })
}

module.exports = {
  handleDrawBet,
  getAllBets,
  getEndedMatches,
  handleLosingBet,
  handleWinningBet
}

