const cron = require("node-cron");
const axios = require("axios");
const Bets = require("../app/models/bets");
const CricketMatch = require("../app/models/cricketMatches");
const User = require("../app/models/user");
const Settings = require("../app/models/settings");
const Cash = require("../app/models/deposits");
const { getParents } = require("../app/routes/bets");
const { listOddsAPI } = require('../app/routes/settings')
const { listInplayEvents,listMarkets, getOdds } = require('../app/routes/sportsAPI')
const ListMarkets = require('../app/models/listMarkets')
const inPlayEvents = require('../app/models/inPlayEvents')
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

const getOddsCronJob = async (req) => {
  try {
    const req = {
      query: {
        ids: '32455848' // Initialize with an empty string
      }
    };
    const res = {
      json: data => {
        console.log(data);
      },
      status: code => {
        return {
          json: data => {
            console.log(`Status code: ${code}`);
            console.log(data);
          }
        };
      }
    };

    await listOddsAPI(req, res); // Pass the req and res objects to listOddsAPI
    await getOdds(req, res); // Pass the req and res objects to getOdds
  } catch (error) {
    console.error('Error running getOdds cron job:', error);
  }
};

const sportsAPICronJob = () => {
  const freshMarketIds = []; // Declare freshMarketIds outside the cron job

 // Cron job to run every 1 minute
 cron.schedule('*/1 * * * *', async () => { 
    try {
      const freshInplayIds = []; // Array to store fresh competition IDs

      const sportsIds = [4,2,1]; // Set the desired sports IDs here

      // Iterate over sportsIds
      for (const sportId of sportsIds) {
        const listInplayEventsResponse = await listInplayEvents({ params: { sportsId: sportId } });
        const listInplayEventsData = listInplayEventsResponse.data.inplayEvents;
        console.log('listInplayEventsData:', listInplayEventsData);
        console.log("listInplayEventsData.eventId",listInplayEventsData.Id);

        for (const inplayEvents of listInplayEventsData) {
          console.log("inplayEvents.eventId",inplayEvents.Id);

          freshInplayIds.push(inplayEvents.Id); // Save the new competition ID
          const eventIds = inplayEvents.Id
          const listMarketsResponse = await listMarkets({ params: { eventIds } });
          console.log('listMarketsResponse',listMarketsResponse)
          console.log('listMarketsResponse.data',listMarketsResponse.data.markets)

          const listMarketsData = listMarketsResponse.data.markets;

          for (const market of listMarketsData) {
            console.log("listMarketsData.marketId",market.marketId);

            freshMarketIds.push(market.marketId); // Save the new market ID
          }
        }
      }

      console.log('freshInplayIds', freshInplayIds);
      console.log('freshMarketIds', freshMarketIds);

      // Step 3: Remove saved inline events from ListInlineEvents collection
      // await ListInlineEvents.deleteMany({ eventId: { $in: freshInlineEvents } });

      // Step 4: Remove saved market IDs from ListMarkets collection
      // await ListMarkets.deleteMany({ marketId: { $in: freshMarketIds } });
    } catch (error) {
      console.error('Error running sports API cron job:', error);
    }
  });

  // Cron job to run every 3 mints
  cron.schedule('*/3 * * * *', async () => {
    try {
      const updatedCronTime = new Date(); // Get the current time

      // Find data from ListMarkets where cronjobTime is empty and isLocked is 0
      const marketsToProcess = await ListMarkets.find({ updatedCronTime: '', isLocked: 0 });
      console.log('ListMarkets',marketsToProcess);
      if (marketsToProcess.length <= 20) {
        // Update cronjobTime and isLocked for the matched markets
        await ListMarkets.updateMany(
          { _id: { $in: marketsToProcess.map(market => market._id) } },
          { updatedCronTime: updatedCronTime, isLocked: 1 }
        );
      }
      if (freshMarketIds.length <= 20) {
        // Call getOdds API with the fresh market IDs
        await getOdds({ query: { ids: freshMarketIds } });
      }
    } catch (error) {
      console.error('Error running secondary cron job:', error);
    }
  });
};

const listMarketCronJob = () => {
  // Cron job to run 12 times per minute
  cron.schedule('*/5 * * * * *', async () => {
    try {
      // Retrieve the IDs from the inplayEvents model
      const inplayEvents = await inPlayEvents.find({}, 'Id');

      const eventIds = inplayEvents.map(event =>parseFloat(event.Id));

      // Iterate over the eventIds
      for (const eventId of eventIds) {
       
        // Call the listMarkets API with each eventId
        const listMarketsResponse = await listMarkets({
          params: { eventId }
        }, null);
        console.log('listMarketsResponse', listMarketsResponse.data);
        // Handle the response from the listMarkets API as needed
      }
    } catch (error) {
      console.error('Error running listMarket cron job:', error);
    }
  });
}

const oddsCronJob = () => {
 // Cron job to run after 10 seconds
 cron.schedule('*/10 * * * * *', async () => {    try {
      // Retrieve the market IDs from the listMarkets model
      const listMarketsData = await ListMarkets.find({}, 'marketId');
      console.log('listMarketsData', listMarketsData);

      const marketIds = listMarketsData.map(event => parseFloat(event.marketId));
      console.log('marketIds', marketIds);

      const batchSize = 20; // Number of market IDs to pass in each request

      // Split the market IDs into batches of size batchSize
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

        // Generate the query string for the getOdds API
        const queryString = batch.join(',');
        console.log('Query String:', queryString);
        console.log('Odds:', {
          query: { ids: queryString }
        });

        // Call the getOdds API with the query string
        const oddsResponse = await getOdds({
          query: { ids: queryString }
        }, null);
        console.log('oddsResponse', oddsResponse);

        // Handle the response from the getOdds API as needed
      }
    } catch (error) {
      console.error('Error running odds cron job:', error);
    }
  });
}

module.exports = { checkBetStatus, themeCronJob,getOddsCronJob, sportsAPICronJob,listMarketCronJob,oddsCronJob };
