const cron = require("node-cron");
const axios = require("axios");
const Bets = require("../app/models/bets");
const CricketMatch = require("../app/models/cricketMatches");
const User = require("../app/models/user");
const Settings = require("../app/models/settings");
const Cash = require("../app/models/deposits");
const { getParents } = require("../app/routes/bets");
const { listMarketsByCronJob ,getnewOdds,fancyDataByCronjob,listInplayEventsJob} = require('../app/routes/sportsAPI')
const ListMarkets = require('../app/models/listMarkets')
const inplayEvents = require('../app/models/inPlayEvents');
const FancyGames = require("../app/models/fancyGames");
const { todayRaceJob, marketDescriptionCronjob,raceOddsJob }  = require('../app/routes/Racing');
const RaceMarkets = require("../app/models/raceMarkets");
let runningJob;

const checkBetStatus = (req) => {
   // Start the cron job after a 2-minute delay
  runningJob = cron.schedule("*/2 * * * *", async () => {
    try {
      const endedMatches = await getEndedMatches();
      console.log("endedMatches", endedMatches);
      for (const match of endedMatches) {
        const matchId = match.id;
        const sportsId = match.sportsId;
        const bets = await getAllBets(sportsId, matchId); // Pass the arguments separately

        for (const bet of bets) {
          console.log("bet", bets);
          console.log("bet.team", bet.runner);

          if (bet.type == 0 && bet.runner == match.winningTeam) {
            console.log("in winning cas of back");
            console.log(`Bet ${bet._id} won!`);
            handleWinningBet(req, bet);
          } else if (bet.type == 0 && bet.runner != match.winningTeam) {
            console.log("in loosing cas of back");

            console.log(`Bet ${bet._id} lost.`);
            handleLosingBet(req, bet);
          } else if (bet.type == 1 && bet.runner != match.winningTeam) {
            console.log(`Bet ${bet._id} won!`);
            console.log("in wiining cas of lay");
            handleWinningBet(req, bet);
          } else if (bet.type == 1 && bet.runner == match.winningTeam) {
            console.log(`Bet ${bet._id} lost.`);
            console.log("in loosing cas of lay");

            handleLosingBet(req, bet);
          } else {
            console.log(`Bet ${bet._id} Draw.`);
            console.log("in draw ");

            handleDrawBet(req, bet);
          }
        }
      }

      // if (endedMatches.length >= 1) {
      //   console.log('Stopping cron job');
      //   runningJob.stop();
      // }
    } catch (err) {
      console.error(err);
    }
  });
};

async function getAllBets(marketId, matchId) {
  try {
    // let userId = req.decoded.userId
    const allBets = await Bets.find({ marketId, matchId, status: 1 });
    return allBets;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function getEndedMatches() {
  try {
    sportsId = "38d3bc03-8a59-4551-85cf-a35298f75124";
    id = "648b28c825e2fe7ca23e55a4";
    const endedMatches = await CricketMatch.find({
      sportsId,
      id,
      matchEnded: true,
    });
    return endedMatches;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function handleLosingBet(req, bet) {
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
    amount: loosingAmount,
    balance: lastMaxWithdraw ? lastMaxWithdraw.balance - loosingAmount : -loosingAmount,
    availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - loosingAmount : -loosingAmount,
    maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + loosingAmount : loosingAmount,
    cashOrCredit: "Bet",
    cash: lastMaxWithdraw ? lastMaxWithdraw.cash - loosingAmount : -loosingAmount,
    marketId: bet.marketId,
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
      cashOrCredit: "Commission",
      cash: lastMaxWithdraw ? lastMaxWithdraw.cash + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
      marketId: bet.marketId,
    });
    cash.save();
    commissionFrom = user.userId;
  });

  await Bets.findByIdAndUpdate(bet._id, { status: 0 });
}

async function handleWinningBet(req, bet) {
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
  const remainingAmount = (bet.winningAmount / 100) * 98;
  const commissionAmount = (bet.winningAmount / 100) * 2;
  const totalRemainingAmount = bet.winningAmount;
  const TotalLoosingAmount = bet.loosingAmount;
  // review starts
  userToUpdate.balance  += remainingAmount;
  userToUpdate.clientPL += remainingAmount;
  // review ends
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
    amount: TotalLoosingAmount + remainingAmount,
    balance: lastMaxWithdraw
      ? lastMaxWithdraw.balance + remainingAmount
      : remainingAmount,

    availableBalance: lastMaxWithdraw
      ? lastMaxWithdraw.availableBalance + remainingAmount
      : remainingAmount,

    maxWithdraw: lastMaxWithdraw
      ? lastMaxWithdraw.maxWithdraw + remainingAmount
      : remainingAmount,
    cashOrCredit: "Bet",
    cash: lastMaxWithdraw
      ? lastMaxWithdraw.cash + remainingAmount
      : remainingAmount,
    marketId: bet.marketId,
  });
  console.log('usercash',typeof cash);
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
    console.log('lastMaxWithdraw2', lastMaxWithdraw);
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
    });
    console.log('(lastMaxWithdraw.balance)', lastMaxWithdraw.balance )
    console.log('(lastMaxWithdraw.avaialebalance)', lastMaxWithdraw.availableBalance )
    console.log('(lastMaxWithdraw.balance)',typeof lastMaxWithdraw.balance )
    console.log('(lastMaxWithdraw.availablebalance)',typeof lastMaxWithdraw.availableBalance )
    console.log('user.commission:', user.commission);
    console.log('Type of user.commission:', typeof user.commission);
    console.log('(user.commission / 100):',(user.commission / 100));

    console.log('Type of (user.commission / 100):', typeof (user.commission / 100));
    console.log('(user.commission / 100) * totalRemainingAmount',(user.commission / 100) * totalRemainingAmount)
    console.log('(typpe user.commission / 100) * totalRemainingAmount',typeof (user.commission / 100) * totalRemainingAmount)

    
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
    });
    // console.log('commissionTransaction====', commissionTransaction);
    await commissionTransaction.save();
    commissionFrom = user.userId;
  };
  await Bets.findByIdAndUpdate(bet._id, { status: 0 });
}

async function handleDrawBet(req, bet) {
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
  const remainingAmount = (bet.winningAmount / 100) * 98;
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

const updateDefaultTheme = async () => {
  try {
    const settings = await Settings.findOne({
      _id: "645e27d8ba117017eb29bad8",
    });
    const currentTheme = settings.defaultThemeName;
    console.log("current theme", currentTheme);
    let updatedTheme;

    if (currentTheme == "light-theme") {
      updatedTheme = "dark-theme";
    } else if (currentTheme == "dark-theme") {
      updatedTheme = "grey-theme";
    } else {
      updatedTheme = "light-theme";
    }

    // Update the default theme
    settings.defaultThemeName = updatedTheme;
    await settings.save();
    console.log("Default theme updated:", settings.defaultThemeName);
  } catch (err) {
    console.error(err);
  }
};

const updateDefaultLoginPage = async () => {
  try {
    const settings = await Settings.findOne({
      _id: "642bff9fc9bb7f4cb5b35d0a",
    });
    const currentLoginPage = settings.defaultLoginPage;
    console.log("current LoginPage", currentLoginPage);
    let updatedLoginPage;

    if (currentLoginPage == "login-page-one") {
      updatedLoginPage = "login-page-two";
    } else if (currentLoginPage == "login-page-two") {
      updatedLoginPage = "login-page-three";
    } else {
      updatedLoginPage = "login-page-one";
    }

    // Update the default login page
    settings.defaultLoginPage = updatedLoginPage;
    await settings.save();
    console.log("Default loginPage updated:", settings.defaultLoginPage);
  } catch (err) {
    console.error(err);
  }
};

const themeCronJob = () => {
  cron.schedule("0 0 * * *", () => {
    updateDefaultTheme();
    updateDefaultLoginPage();
  });
};

const listMarketCronJob = () => {
  // Cron job to run 12 times per minute
  cron.schedule('*/1 * * * *', async () => {
    try {
      // Retrieve the IDs from the inplayEvents api
      const sportsIds = [4,2,1]; // Set the desired sports IDs here

      // Iterate over sportsIds
      for (const sportsId of sportsIds) {

        const listInplayEventsResponse = await listInplayEventsJob(sportsId);
        const listInplayEventsData = listInplayEventsResponse.inplayEvents

        const dummydata = listInplayEventsData.map(async(item)=>{
          let eventId = item.Id
          console.log('eventId',eventId);
        // Call the listMarkets API with each eventId
        const listMarketsResponse = await listMarketsByCronJob(eventId);
        })
     }
    } catch (error) {
      console.error('Error running listMarket cron job:', error);
    }
  });
}

const oddsCronJob = () => {
  cron.schedule('*/1 * * * * *', async () => {
    try {
      const updatedCronTime = new Date();
      const batchSize = 20;

      // Retrieve market IDs from the listMarkets model where cronjobtime is empty and type is 0
      const listMarketsData = await ListMarkets.find(
        { updatedCronTime: '', islocked: 0 },
        'marketId'
      );

      const marketIds = listMarketsData.map((event) => parseFloat(event.marketId));

      if (marketIds.length > 0) {
        // Update the market IDs with the new cronjobtime and type
        await ListMarkets.updateMany(
          { marketId: { $in: marketIds } },
          { updatedCronTime, islocked: 1 }
        );

        const batches = [];
        for (let i = 0; i < marketIds.length; i += batchSize) {
          batches.push(marketIds.slice(i, i + batchSize));
        }

        console.log('Total batches:', batches.length);

        // Process each batch of market IDs
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          console.log('Batch', i + 1, 'of', batches.length);
          console.log('Market IDs:', batch);

          // Update the market IDs with updatedCronTime: '', isLocked: 0

          // Generate the query string for the getOdds API
          const queryString = batch.join(',');
          console.log('Query String:', queryString);

          // Call the getOdds API with the query string
          const oddsResponse = await getnewOdds(queryString);

          console.log('oddsResponse', oddsResponse);

          // Handle the response from the getOdds API as needed
        }
        await ListMarkets.updateMany(
          { marketId: { $in: marketIds  } },
          { updatedCronTime: '', islocked: 0 }
        );
      }
    } catch (error) {
      console.error('Error running odds cron job:', error);
    }
  });
};

const fancyDataCronJob = async () => {
  // Cron job to run every 1 mintue
  cron.schedule('*/1 * * * *', async () => {
    try {
      // Retrieve the fancy data dynamically from the database
    const sportsId = [1,2,4]
    const inplayEventsData = await inplayEvents.find({ sportsId: { $in: sportsId } }).exec();
      // Iterate over the inplayevents data
      for (const event of inplayEventsData) {
        const eventId = event.Id;
        const listInplayEventsResponse = await fancyDataByCronjob(eventId);
      }
    } catch (error) {
      console.error('Error running listMarket cron job:', error);
    }
  });
};

const todayRaceCronJob = async () => {
  // Cron job to run every 1 mintue
  cron.schedule('*/1 * * * *', async () => {
    try {
      // Retrieve the fancy data dynamically from the database
    const racesportsIds = [7,4339]
    for (const SportId of racesportsIds) {
      const listRaceDataResponse = await todayRaceJob(SportId);
      const racesData = listRaceDataResponse.horseRacesData
    }
   }
    catch (error) {
      console.error('Error running listMarket cron job:', error);
    }
  });
};

const raceMarketsCronJob = async () => {
  // Cron job to run every 1 minute
  cron.schedule('*/1 * * * *', async () => {
    try {
      // Retrieve the sportsIds dynamically from the database
      const racesportsIds = [7, 4339];

      const racesData = await inplayEvents.find({ sportsId: { $in: racesportsIds } }).select('races');

      // Extract marketIds using flatMap
      const marketIds = racesData.flatMap(event => event.races.map(race => race.marketId));
      // console.log('marketIds',marketIds);
      // Call marketDescriptionCronjob for each marketId
      for (const marketId of marketIds) {
        // console.log('marketId',marketId);
        await marketDescriptionCronjob(marketId);
      }
    } catch (error) {
      console.error('Error running listMarket cron job:', error);
    }
  });
};

const raceOddsCronJob = async () => {

  cron.schedule('*/1 * * * *', async () => {
    try {
      // Retrieve all marketIds from the race odds collection
      const allMarketIds = await RaceMarkets.find().distinct('eventNodes.marketNodes.marketId');
      console.log('allMarketIds',allMarketIds);
      // Create a query string with comma-separated marketIds
      const queryString = allMarketIds
      console.log('Query String:', queryString);

      // Call the getOdds API with the query string
      const oddsResponse = await raceOddsJob(queryString);

      console.log('oddsResponse', oddsResponse);

      // Handle the response from the getOdds API as needed
    } catch (error) {
      console.error('Error running odds cron job:', error);
    }
  });
};

module.exports = { checkBetStatus, todayRaceCronJob ,raceOddsCronJob,raceMarketsCronJob,themeCronJob,listMarketCronJob,oddsCronJob,fancyDataCronJob };
