const Bets = require("../../../app/models/bets");
const User = require("../../../app/models/user");

const { getParents } = require("../../../app/routes/bets");
const Events = require("../../../app/models/events");
const Cash = require("../../../app/models/deposits");

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
  userToUpdate.balance  -= loosingAmount;
  userToUpdate.clientPL -= loosingAmount;
  userToUpdate.exposure += loosingAmount;
  await userToUpdate.save();

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
    maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + loosingAmount : loosingAmount,
    cashOrCredit: "Bet",
    cash: lastMaxWithdraw ? lastMaxWithdraw.cash - loosingAmount : -loosingAmount,
    marketId: bet.marketId,
    sportsId: bet.sportsId,

  });
  await cash.save();

  const parentUserIds = await getParents(userId);

  const parentUser = await User.find({
    userId: {
      $in: [...parentUserIds],
    },
    isDeleted: false,
  }).sort({ role: -1 });

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

  let commissionFrom = userToUpdate.userId;
  let upMovingAmount = TotalLoosingAmount;

  parentUser.forEach(async (user) => {
    user.exposure += (user.commission / 100) * remainingAmount;
    user.availableBalance += (user.commission / 100) * remainingAmount + (user.commission / 100) * TotalLoosingAmount;
    user.balance  += (user.commission / 100) * TotalLoosingAmount;
    user.clientPL -= user.downLineShare != 100 ? ((100 - user.downLineShare) / 100) * TotalLoosingAmount: 0;
    user.save();
    let lastMaxWithdraw = await Cash.findOne({
      userId: user.userId,
    }).sort({
      _id: -1,
    });
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
      cash: lastMaxWithdraw ? lastMaxWithdraw.cash + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
      marketId: bet.marketId,
      sportsId: bet.sportsId,
      upLineAmount: upMovingAmount
    });
    cash.save();
    upMovingAmount = upMovingAmount -   (user.commission / 100) * TotalLoosingAmount;
    commissionFrom = user.userId;
  });

  await Bets.findByIdAndUpdate(bet._id, { status: 0 });
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
  const remainingAmount       = (bet.winningAmount / 100) * 98;
  const commissionAmount      = (bet.winningAmount / 100) * 2;
  const totalRemainingAmount  = bet.winningAmount;
  const TotalLoosingAmount    = bet.loosingAmount;
  let   upMovingAmount        = totalRemainingAmount
  let   upMovingCommAmount    = commissionAmount


  userToUpdate.balance  += remainingAmount;
  userToUpdate.clientPL += remainingAmount; 

  userToUpdate.availableBalance += TotalLoosingAmount + remainingAmount;
  userToUpdate.exposure += TotalLoosingAmount;
  await userToUpdate.save();

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
    availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + remainingAmount  : remainingAmount,
    maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + remainingAmount : remainingAmount,
    cashOrCredit: "Bet",
    cash: lastMaxWithdraw ? lastMaxWithdraw.cash + remainingAmount : remainingAmount,
    marketId: bet.marketId,
    sportsId: bet.sportsId
  });
  console.log('usercash',typeof cash);
  await cash.save();

  const parentUserIds = await getParents(userId);
  const parentUser    = await User.find({
    userId: {
      $in: [...parentUserIds],
    },
    isDeleted: false,
  }).sort({ role: -1 });

  if (!parentUser) {
    return res.status(404).send({ message: "user not found" });
  }
  let prev = 0;
  for (const user of parentUser) {
    let current = user.downLineShare;
    user["commission"] = current - prev;
    prev = current;
  }
  let commissionFrom = userToUpdate.userId;

  for (const user of parentUser) {
    user.exposure += (user.commission / 100) * totalRemainingAmount;
    user.balance  -= (user.commission / 100) * remainingAmount;
    user.clientPL += user.downLineShare != 100 ? ((100 - user.downLineShare) / 100) * remainingAmount : 0;
   await user.save();
    let lastMaxWithdraw = await Cash.findOne({
      userId: user.userId,
    }).sort({
      _id: -1,
    });

    if (!lastMaxWithdraw) {
      console.log('User cach record not found.',  user);
    }

    //console.log('lastMaxWithdraw2', lastMaxWithdraw);
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
      cash: lastMaxWithdraw ? lastMaxWithdraw.cash - (user.commission / 100) * totalRemainingAmount : -(user.commission / 100) * totalRemainingAmount,
      marketId: bet.marketId,
      sportsId: bet.sportsId,
      upLineAmount: -upMovingAmount
    });
    
    upMovingAmount = upMovingAmount - (user.commission / 100) * totalRemainingAmount;

    if (lastMaxWithdraw) {
      console.log('(lastMaxWithdraw.balance)', lastMaxWithdraw.balance )
      console.log('(lastMaxWithdraw.avaialebalance)', lastMaxWithdraw.availableBalance )
      console.log('(lastMaxWithdraw.balance)',typeof lastMaxWithdraw.balance )
      console.log('(lastMaxWithdraw.availablebalance)',typeof lastMaxWithdraw.availableBalance )
    }


    await betTransaction.save();
   
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
      cash: lastMaxWithdraw ? lastMaxWithdraw.cash + (user.commission / 100) * commissionAmount : (user.commission / 100) * commissionAmount,
      marketId: bet.marketId,
      sportsId: bet.sportsId,
      upLineAmount: upMovingCommAmount
    });
    await commissionTransaction.save();
    upMovingCommAmount = upMovingCommAmount - (user.commission / 100) * commissionAmount;
    commissionFrom = user.userId;
  };
  await Bets.findByIdAndUpdate(bet._id, { status: 0 });
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

  userToUpdate.availableBalance += TotalLoosingAmount;
  userToUpdate.exposure += TotalLoosingAmount;
  await userToUpdate.save();

  const parentUserIds = await getParents(userId);
  const parentUser = await User.find({
    userId: {
      $in: [...parentUserIds],
    },
    isDeleted: false,
  }).sort({ role: -1 });

  if (!parentUser) {
    return res.status(404).send({ message: "user not found" });
  }
  let prev = 0;
  parentUser.forEach((user) => {
    let current = user.downLineShare;
    user["commission"] = current - prev;
    prev = current;
  });

  parentUser.forEach((user) => {
    user.exposure += (user.commission / 100) * totalRemainingAmount;
    user.availableBalance += (user.commission / 100) * remainingAmount;
    user.save();
  });

  await Bets.findByIdAndUpdate(bet._id, { status: 0 });
}

module.exports = {
  getAllBets,
  getEndedMatches,
  handleLosingBet,
  handleWinningBet, 
  handleDrawBet
}