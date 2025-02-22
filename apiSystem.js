// Static libs
const mongoose = require("mongoose");
const express = require("express")();
const http = require("http");
const socketIo = require("socket.io");
require('dotenv').config();
const port = process.env.APISYSTEMPORT;
const inPlayEvents = require("./app/models/events");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");

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
      console.log("User not found");
      return { success: false, message: 'User not found' };
    }

    return {
      success: true,
      message: 'User record found',
      results: users[0],
    };
  } catch (err) {
    console.error("Server error:", err);
    return { success: false, message: 'Server error', error: err.message };
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
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        console.log("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
        socket.emit("userData", userData);
      }
    }, 3000);

    socket.on("disconnect", () => {
      clearInterval(intervalId);
      console.log("Client disconnected");
    });
  });

  httpServer.listen(port, () => {
    console.log(`Api System Server listening on port ${port}`);
  });
}

main();

module.exports.io = io;
