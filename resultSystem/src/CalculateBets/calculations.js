const Bets = require("../../../app/models/bets");
const User = require("../../../app/models/user");

const { getParents } = require("../../../app/routes/bets");
const Events = require("../../../app/models/events");
const Cash = require("../../../app/models/deposits");
const CurrentPosition = require("../../../app/models/CurrentPosition");

const config = {
  "PORT": 3003,
  "DBNAME": "Bet99",
  "DBHost": "mongodb://127.0.0.1/Bet99",
  "DBHostLive": "mongodb+srv://umar:ahmad123@cluster0.dillplp.mongodb.net/Bet99?retryWrites=true&w=majority",
  "secret": "umarIsLove",
  "apisFileName": "config/settings/apis/allApis.json",
  "saltRounds": 10,
  "pageSize": 10,
  "oldApiUrl": "https://stage.game-program.com/api/seamless/provider",
  "old_api_password": "6w9GNrsxZsHBeC795N",
  "old_api_login": "1obet_mc_s",
  "language": "en",
  "play_for_fun": false,
  "currency": "PKR",
  "eventListAPIUrl": "https://streamingtv.fun:3440/api",
  "sportsAPIUrl": "http://209.250.242.175:33332",
  "fancyUrl": "https://betfairoddsapi.com:3444/api",
  "liveTvUrl": "https://livesportscore.xyz:3440/api",
  "liveScoreUrl": "https://livesportscore.xyz:3443/api/getScoreId",
  "sportsLiveScore": "https://livesportscore.xyz:3440/api/bf_scores/",
  "horseRaceUrl": "http://136.244.77.249:33333",
  "oldSaltKey": "Loa0192Jua",
  "betMinimumAmount": 100,
  "api_username": "1obet_mc_s",
  "api_password": "b16gWs7e0QAASLTne0",
  "saltKey": "qrb4VepLav",
  "apiUrl": "https://em-api.thegameprovider.com/api/seamless/provider",
  "createCasinoUser": true,
  "casinoMultiples": 10,
  "SportOddsSubMarkets": [6, 13, 15, 35, 11],
  "sportMarkets": ["1", "2", "4"],
  "raceMarkets": ["7", "4339"],
  "Fancy": 7,
  "BookMaker": 8,
  "Figure": 9,
  "EvenOdd": 10,
  "SmallBig": 34,
  "Toss": 11,
  "Cup": 12,
  "FigureEvenOddSmallBig": [9, 10, 34],
  "raceOpenBefore": 1200000000000,
  "sportsOpenBefore": 600000,
  "balls": ["1", "2", "3", "4", "5", "6"],
  "matchTypes": ["T10", "T20", "ODI", "TEST"],
  "commissionLessSubMarkets": [2, 3, 4]

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
  const loosingAmount = bet.loosingAmount;
  const betAmount = bet.betAmount;
  console.log("loosingAmount", loosingAmount);
  const userToUpdate = await User.findOne({
    userId: userId,
    isDeleted: false,
  });

  if (!userToUpdate) {
    return res.status(404).send({ message: "user not found" });
  }
  userToUpdate.balance -= loosingAmount;
  userToUpdate.clientPL -= loosingAmount;
  if(bet.calculateExp){
    userToUpdate.exposure += bet.exposureAmount;
  }
  await userToUpdate.save();
  console.log(" ======================== User Updating Sucessfully ");

  let lastMaxWithdraw = await Cash.findOne({
    userId: userToUpdate.userId,
  }).sort({
    _id: -1,
  });
  let cash = new Cash({
    userId: userToUpdate.userId,
    description: bet.name,
    betId: bet._id,
    createdBy: 0,
    amount: - loosingAmount,
    balance: lastMaxWithdraw ? lastMaxWithdraw.balance - loosingAmount : -loosingAmount,
    availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - loosingAmount : -loosingAmount,
    maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - loosingAmount : loosingAmount,  
    cashOrCredit: "Bet",
    cash: lastMaxWithdraw ? lastMaxWithdraw.cash - loosingAmount : -loosingAmount,
    credit: lastMaxWithdraw?.credit || 0 ,
    creditRemaining:  lastMaxWithdraw?.creditRemaining  || 0,   
    marketId: bet.marketId,
    sportsId: bet.sportsId,
    matchId: bet.matchId

  });
  await cash.save();

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

  const remainingAmount = bet.winningAmount;
  const TotalLoosingAmount = bet.loosingAmount;

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
    user.exposure += (user.commission / 100) * remainingAmount;
    user.availableBalance += (user.commission / 100) * remainingAmount + (user.commission / 100) * TotalLoosingAmount;
    user.balance += (user.commission / 100) * TotalLoosingAmount;
    user.clientPL -= user.downLineShare != 100 ? ((100 - user.downLineShare) / 100) * TotalLoosingAmount : 0;
    user.save();
    console.log(" ======================== Parent User Updating Sucessfully ");

    let lastMaxWithdraw = await Cash.findOne({
      userId: user.userId,
    }).sort({ _id: -1 });
    let cash = await new Cash({
      userId: user.userId,
      description: bet.name,
      betId: bet._id,
      createdBy: 0,
      amount: (user.commission / 100) * TotalLoosingAmount,
      balance: lastMaxWithdraw ? lastMaxWithdraw.balance + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
      availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
      maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
      commissionFrom: commissionFrom,
      cashOrCredit: "loosing",
      cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
      credit: lastMaxWithdraw ? lastMaxWithdraw.credit: 0,
      creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining  : 0,
      marketId: bet.marketId,
      sportsId: bet.sportsId,
      upLineAmount: upMovingAmount,
      matchId: bet.matchId
    });
    cash.save();
    console.log(" ======================== Parent User Cash Updating Sucessfully ");

    upMovingAmount = upMovingAmount - (user.commission / 100) * TotalLoosingAmount;
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
  const loosingAmount = bet.loosingAmount;
  const betAmount = bet.betAmount;
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
    remainingAmount = (bet.winningAmount / 100) * 98;
    commissionAmount = (bet.winningAmount / 100) * 2;
    totalRemainingAmount = bet.winningAmount;
    TotalLoosingAmount = bet.loosingAmount;
    upMovingAmount = totalRemainingAmount
    upMovingCommAmount = commissionAmount
  }
  else {
    remainingAmount = bet.winningAmount;
    commissionAmount = (bet.winningAmount / 100) * 2;
    totalRemainingAmount = bet.winningAmount;
    TotalLoosingAmount = bet.loosingAmount;
    upMovingAmount = totalRemainingAmount
    upMovingCommAmount = commissionAmount
  }

  let expAmount = 0;
  userToUpdate.balance += remainingAmount;
  userToUpdate.clientPL += remainingAmount;
  if(bet.calculateExp){
    userToUpdate.exposure += bet.exposureAmount;
    expAmount = bet.exposureAmount;
  }
  userToUpdate.availableBalance += expAmount + remainingAmount;
  await userToUpdate.save();
  console.log(" =============== User Updated Successfull ");


  let lastMaxWithdraw = await Cash.findOne({
    userId: userToUpdate.userId,
  }).sort({
    _id: -1,
  });
  // console.log("lastMaxWithdraw1", lastMaxWithdraw);
  let cash = new Cash({
    userId: userToUpdate.userId,
    description: bet.name,
    betId: bet._id,
    createdBy: 0,
    amount: remainingAmount,
    balance: lastMaxWithdraw ? lastMaxWithdraw.balance + remainingAmount : remainingAmount,
    availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + remainingAmount : remainingAmount,
    maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + remainingAmount : remainingAmount,
    cashOrCredit: "Bet",
    cash: lastMaxWithdraw ? lastMaxWithdraw.cash + remainingAmount : remainingAmount,
    credit: lastMaxWithdraw?.credit || 0 ,
    creditRemaining:  lastMaxWithdraw?.creditRemaining  || 0,   
    marketId: bet.marketId,
    sportsId: bet.sportsId,
    matchId: bet.matchId
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
    user.exposure += (user.commission / 100) * totalRemainingAmount;
    user.balance -= (user.commission / 100) * remainingAmount;
    user.clientPL += user.downLineShare != 100 ? ((100 - user.downLineShare) / 100) * remainingAmount : 0;
    await user.save();

    let lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });

    console.log(" =============== Parent User Successfull ");

    if (!lastMaxWithdraw) {
      console.log('User cach record not found.', user);
    }
    
    let betTransaction = await new Cash({
      userId: user.userId,
      description: bet.name,
      createdBy: 0,
      amount: -(user.commission / 100) * totalRemainingAmount,
      balance: lastMaxWithdraw ? lastMaxWithdraw.balance - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
      availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
      maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
      cashOrCredit: "Bet",
      betId: bet._id,
      cash: lastMaxWithdraw ? lastMaxWithdraw.cash : 0,
      marketId: bet.marketId,
      commissionFrom: commissionFrom,
      credit: lastMaxWithdraw?.credit || 0 ,
      creditRemaining:  lastMaxWithdraw?.creditRemaining  || 0,   
      sportsId: bet.sportsId,
      upLineAmount: -upMovingAmount,
      matchId: bet.matchId
    });

    upMovingAmount = upMovingAmount - (user.commission / 100) * totalRemainingAmount;
    await betTransaction.save();
    console.log(" =============== Parent bet Transaction  Successfull ");

    if (!config.commissionLessSubMarkets.includes(bet.type) && bet.subMarketId != config.Fancy && bet.subMarketId != config.BookMaker) {
      let lastMaxWithdraw = await Cash.findOne({ userId: user.userId }).sort({ _id: -1 });
      let commissionTransaction = await new Cash({
        userId: user.userId,
        description: bet.name,
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
        matchId: bet.matchId
      });
      await commissionTransaction.save();
    }
    upMovingCommAmount  = upMovingCommAmount - (user.commission / 100) * commissionAmount;
    commissionFrom      = user.userId;
  };
  await Bets.findByIdAndUpdate(bet._id, { status: 0, position: bet.winningAmount });
  console.log(" betIdString =============== Starting  ");
  console.log(bet._id.toString());
  const betIdString = bet._id.toString();
  console.log(" betIdString =============== ", betIdString);
  await CurrentPosition.deleteMany({ betId: betIdString })
}

async function handleDrawBet(bet) {
  console.log(`Bet ${bet._id} lost.`);

  const userId = bet.userId;
  const loosingAmount = bet.loosingAmount;
  const betAmount = bet.betAmount;
  const userToUpdate = await User.findOne({
    userId: userId,
    isDeleted: false,
  });

  if (!userToUpdate) {
    return res.status(404).send({ message: "user not found" });
  }
  const totalRemainingAmount = bet.winningAmount;
  const TotalLoosingAmount = bet.loosingAmount;

  if(bet.calculateExp){
    userToUpdate.availableBalance += bet.exposureAmount;
    userToUpdate.exposure += bet.exposureAmount;
    await userToUpdate.save();
  }

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
  parentUser.forEach((user) => {
    let current = user.downLineShare;
    user["commission"] = current - prev;
    prev = current;
  });

  parentUser.forEach((user) => {
    console.log('commission: ' + user["commission"]);
  });


  parentUser.forEach((user) => {
    user.exposure += (user.commission / 100) * totalRemainingAmount;
    user.availableBalance += (user.commission / 100) * remainingAmount;
    user.save();
  });

  await Bets.findByIdAndUpdate(bet._id, { status: 0 });
  console.log(" betIdString =============== Starting  ");
  console.log(bet._id.toString());
  const betIdString = bet._id.toString();
  console.log(" betIdString =============== ", betIdString);
  await CurrentPosition.deleteMany({ betId: betIdString })
}

module.exports = {
  getAllBets,
  getEndedMatches,
  handleLosingBet,
  handleWinningBet,
  handleDrawBet
}

