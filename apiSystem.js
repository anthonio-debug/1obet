// Static libs
const mongoose = require("mongoose");
const express = require("express")();
const http = require("http");
const socketIo = require("socket.io");
require('dotenv').config();
const port = process.env.APISYSTEMPORT;
const inPlayEvents = require("./app/models/events");
const morgan = require("morgan");
let config = require('config');
const axios = require('axios');
let { AURA_Partner_Id, auracasinoMultiples } = require('./config/default.json');

const bodyParser = require("body-parser");
const cors = require("cors");
const MarketIDS = require("./app/models/marketIds.js");
const CloneMarketIDS = require("./app/models/clonemarketIds.js");
const fancyOdds = require("./app/models/fancyOdds.js");
const Odds = require("./app/models/odds.js");
const RaceOdds = require("./app/models/raceOdds.js");
const Bets = require("./app/models/bets.js");
const cloneBets = require("./app/models/clonebets.js");

const ToolForRacing = require("./restApiSystem/src/tools_for_updated_racing.js")();
const ToolForSessionFancy = require("./restApiSystem/src/tools_for_session_fancy_lathyl")();
const ToolForListEvent = require("./restApiSystem/src/tools_for_list_events.js")();
const ToolForResult = require("./restApiSystem/src/tools_for_result")();
const ToolForScraper = require("./restApiSystem/src/tools_for_scraper")();
const DBHost = process.env.DBHost;
global.cricketScraperLastupdate = new Date().getTime();

express.use(require('express').json());
express.use(morgan("dev"));

// Read form data
express.use(require('express').urlencoded({ extended: false }));
express.use(bodyParser.urlencoded({ extended: false })); // Support encoded bodies
express.use(bodyParser.json({ strict: false }));

const corsOptions = {
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
};
express.use(cors(corsOptions));

const httpServer = http.createServer(express);

const io = socketIo(httpServer, {
  path: "/websocket",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

express.use((req, res, next) => {
  req.io = io;
  return next();
});

const mongooseOptions = {
  useNewUrlParser: true,
  connectTimeoutMS: 60000,  // Increased timeout for connection
  socketTimeoutMS: 60000,   // Increased timeout for socket operations
};

mongoose.set("strictQuery", false);
mongoose.set({ debug: false });

mongoose
  .connect(DBHost, mongooseOptions)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.error(`Failed to connect to the database: ${err}`);
  });

async function fetchUserData(data) {
  const User = require("./app/models/user");

  try {
    const users = await User.aggregate([
      {
        $match: {
          userId: data.userId
        }
      },
      {
        $lookup: {
          from: "deposits",
          let: { userId: "$userId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$userId", "$$userId"] } } },
            { $sort: { date: -1 } },
            { $limit: 1 }
          ],
          as: "depositInfo"
        }
      },
      {
        $unwind: {
          path: "$depositInfo",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          userId: 1,
          userName: 1,
          downLineShare: 1,
          digitVerification: 1,
          exposure: 1,
          isActive: 1,
          status: 1,
          role: 1,
          balance: 1,
          availableBalance: 1,
          depositBalance: "$depositInfo.balance",
          depositAvailableBalance: "$depositInfo.availableBalance",
          depositMaxWithdraw: "$depositInfo.maxWithdraw",
          depositAmount: "$depositInfo.amount",
        }
      }
    ]);

    if (users.length === 0) {
      console.log(data);
      console.log("User not found");
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      return { success: false, message: 'User not found' };
    }

    return {
      success: true,
      message: 'User record found',
      results: {
        ...users[0],
        AURA_Partner_Id: AURA_Partner_Id,
        auracasinoMultiples: auracasinoMultiples
      },
    };
  } catch (err) {
    console.error("Server error:", err);
    return { success: false, message: 'Server error', error: err.message };
  }
}

async function deleteOdds() {
  try {

    const twoMinutesAgo = new Date(Date.now() - 1 * 60 * 1000);

    // Find documents that meet the criteria
    let oddsDocuments = await Odds.aggregate([
      {
        $match: {
          createdAt: { $lt: twoMinutesAgo.getTime() }
        }
      },
      {
        $group: {
          _id: "$marketId",
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);
    let raceoddsDocuments = await RaceOdds.aggregate([
      {
        $match: {
          createdAt: { $lt: twoMinutesAgo.toISOString() }
        }
      },
      {
        $group: {
          _id: "$marketId",
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);
    let fancyoddsDocuments = await fancyOdds.aggregate([
      {
        $match: {
          created: { $lt: twoMinutesAgo.toISOString() }
        }
      },
      {
        $group: {
          _id: "$marketId",
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    console.log([...oddsDocuments.map(item => item._id)])

    await Odds.deleteMany({ marketId: { $in: [...oddsDocuments.map(item => item._id)] } });
    await RaceOdds.deleteMany({ marketId: { $in: [...raceoddsDocuments.map(item => item._id)] } });
    await fancyOdds.deleteMany({ marketId: { $in: [...fancyoddsDocuments.map(item => item._id)] } });
    // await Odds.deleteMany({ createdAt: { $lt: twoMinutesAgo.toISOString() } });
    // await RaceOdds.deleteMany({ createdAt: { $lt: twoMinutesAgo.toISOString() } });

  } catch (error) {
    console.error('cronMarketId: ', error);
  }
}

async function deleteMarketIds() {
  try {

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Find documents that meet the criteria
    const documents = await MarketIDS.find({
      status: 'CLOSED',
      updatedAt: { $lt: fiveMinutesAgo.getTime() },
      winnerInfo: { $ne: null },
      winnerRunnerData: { $ne: null }
    });

    if (documents.length > 0) {
      const idsToDelete = documents.map(doc => doc._id);
      await CloneMarketIDS.insertMany(documents);
      await MarketIDS.deleteMany({ _id: { $in: idsToDelete } });

      console.log(`${documents.length} => cloned and deleted (marketids)`);
    } else {
      console.log('No matching documents found.');
    }
  } catch (error) {
    console.error('cronMarketId: ', error);
  }
}

async function deleteBets() {
  try {

    // Find documents that meet the criteria
    const documents = await Bets.find({
      status: { $in: [0, 2] },
    });

    if (documents.length > 0) {
      const deleteEntries = documents.map(doc => doc._id);
      await cloneBets.insertMany(documents);
      // delete original bets and marketids
      await Bets.deleteMany({ _id: { $in: deleteEntries } });

      console.log(`${documents.length} => cloned and deleted (bets)`);
    } else {
      console.log('No matching documents found.');
    }
  } catch (error) {
    console.error('cronMarketId: ', error);
  }
}

async function cronCollections() {
  try {
    setTimeout(async () => {
      // await deleteMarketIds();
      // await deleteBets();
      await deleteOdds();

      await cronCollections();
      console.log('Cron job completed.');
    }, 2 * 60 * 1000);
  } catch (err) {
    console.log("Cron working error: ", err);
    throw new Error(err);
  }
}

async function matchOverFancyAndScoreFancy(eventId) {
  try {
    const apiUrl = `https://ofa77.xyz/cricketresultauto3.php?id=${eventId}`;
    const response = await axios.get(apiUrl);
    console.log("Response from API:", response.data);
    const { scorefancy = [], overfancy = [] } = response.data;
    const fancyList = [...scorefancy, ...overfancy];

    console.log("@@@@@@@@@@@@@@@#####################################");
    console.log(fancyList);

    let now = new Date();
    const numericDateTime = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;

    for (let fancy of fancyList) {
      const { name, result } = fancy;

      // Update the score if a match is found
      let marketid = await MarketIDS.findOneAndUpdate(
        { marketId: name, eventId },
        {
          $set: { fancyResultScore: result, winnerRunnerData: result },
          $setOnInsert: {
            eventId: eventId,
            __v: 0,
            marketId: name,
            inPlay: false,
            index: 0,
            lastCheck: 0,
            lastResultCheckTime: 0,
            openDate: 0,
            readyForScore: true,
            sportID: 4,
            status: 'Fancy Result',
            updatedAt: numericDateTime,
            totalMatched: '0'
          }
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );
      // console.log(`Updated score for ${name} ( ${marketid.marketId}) (Event ID: ${eventId})`);

    }
    console.log(`Update completed => eventId (${eventId})`);
  } catch (error) {
    console.error("Error updating scores:", error);
  }
}


async function storeFandyScore() {
  try {

    setTimeout(async () => {
      const fancyCollections = await inPlayEvents.distinct("Id", {
        CompanySetStatus: "OPEN",
        status: "OPEN",
        isShowed: true,
        hasFancy: true
      })

      console.log(fancyCollections);
      console.log("+++++++++++++++++++++++++++++ storeFnayScore ********************");


      for (const odd of fancyCollections) {
        await matchOverFancyAndScoreFancy(odd);
      }

      storeFandyScore();
    }, 1000 * 60 * 1);
  } catch (error) {
    console.error("Error updating scores:", error);
  }

}

async function main() {
  console.log("******************************************");
  console.log("******************************************");
  console.log("******************************************");
  console.log("******************************************");
  console.log("******************************************");
  console.log("******************************************");
  console.log("******************************************");
  console.log("******************************************");
  console.log("******************************************");
  console.log("******************************************");

  await inPlayEvents.updateMany({}, { inplay: false, inplayFromServer: false });

  // Init events jobs for cricket, tennis, and soccer
  ToolForRacing.init(io, express);

  // Init events jobs for fancy data for cricket
  ToolForSessionFancy.init(io, express);

  // Init events list
  ToolForListEvent.init(io, express);

  // Init events list
  ToolForResult.init(io, express);

  ToolForScraper.init(io, express);
  cronCollections();
  storeFandyScore();

  // Store userId associated with each socket connection
  io.on("connection", (socket) => {
    console.log("New client connected");

    socket.on('updateUser', (userId) => {
      socket.userId = userId;
    })

    socket.on("register", (userId) => {
      socket.userId = userId;
      console.log(`User registered with ID: ${userId}`);
    });

    // Emit user data every 3 seconds
    const intervalId = setInterval(async () => {
      if (socket.userId) {
        const userData = await fetchUserData(socket.userId);

        socket.emit("userData", userData);
      }
    }, 3000);

    socket.on("disconnect", () => {
      clearInterval(intervalId);
      console.log("Client disconnected");
    });
  });

  // cronCollections();

  httpServer.listen(port, () => {
    console.log(`Api System Server listening on port ${port}`);
  });
}

main();

module.exports.io = io;
