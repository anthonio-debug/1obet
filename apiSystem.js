//static libs
const mongoose = require("mongoose");
const express = require("express")();
const https = require("http");
const socketIo = require("socket.io");
require('dotenv').config();
const port = process.env.APISYSTEMPORT;
// const DBNAME = process.env.DB_NAME;
//Mongoose models
const inPlayEvents = require("./app/models/events");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");

const ToolForRacing = require("./restApiSystem/src/tools_for_updated_racing.js")();
const ToolForSessionFancy = require("./restApiSystem/src/tools_for_session_fancy_lathyl")()
// const ToolForSessionFancy = require("./restApiSystem/src/tools_for_session_fancy")();
// const ToolForAsian = require("./restApiSystem/src/tools_for_asian.js")();
const ToolForListEvent = require("./restApiSystem/src/tools_for_list_events.js")();
const ToolForResult = require("./restApiSystem/src/tools_for_result")();
const ToolForScraper = require("./restApiSystem/src/tools_for_scraper")();
const DBHost = process.env.DBHost;
global.cricketScraperLastupdate = new Date().getTime()

express.use(require('express').json());
express.use(morgan("dev"));

// READ FORM DATA
express.use(require('express').urlencoded({ extended: false }));

express.use(bodyParser.urlencoded({ extended: false })); //support encoded bodies
express.use(bodyParser.json({ strict: false }));
const allowedOriginsForProduction = [
  process.env.ALLOW_ORIGIN || 'https://1obet.com',
  process.env.ALLOW_API || 'https://production.1obet.net',
  process.env.AURA_URI || 'https://aura.fawk.app',
  process.env.ADMIN_URI || 'https://admin.1obet.com',
  process.env.PRODUCTION_SOCKET || 'wss://production.1obet.net',
  process.env.PRODUCTION_SOCKET_WS || 'ws://production.1obet.net'
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOriginsForProduction.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  credentials: true,
  optionsSuccessStatus: 200
};


express.use(cors(corsOptions));

const httpServer = https.createServer(express);

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
  
async function connectWithRetry() {

  try {
    await mongoose.connect(DBHost, mongooseOptions);
    console.log("MongoDB connected");
  } catch (err) {
    console.error(`Failed to connect to MongoDB, retrying in 5 seconds...`);
    setTimeout(connectWithRetry, 5000);  // Retry after 5 seconds
  }
}

connectWithRetry();

// express.post("/update_cricket", require("./app/routes/scrapeCricket").cricketRouter);
// express.post("/update_soccer", require("./app/routes/scrapeSoccer").soccerRouter);
// express.post("/update_tennis", require("./app/routes/scrapeTennis").tennisRouter);

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

  /*init events jobs for cricket, tennis and soccer*/
  ToolForRacing.init(io, express);

  /* init events jobs for fancy data for cricket */
  ToolForSessionFancy.init(io, express);

  /*init asian odds*/
  // ToolForAsian.init(io, express);

  /*init events list*/
  ToolForListEvent.init(io, express);

  /*init events list*/
  ToolForResult.init(io, express);

  ToolForScraper.init(io, express);

  httpServer.listen(port, () => {
    console.log(`Api System Server listening on port ${port}`);
  });
}

main();

module.exports.io = io;
