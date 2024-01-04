//static libs
const mongoose = require("mongoose");
const express = require("express")();
const https = require("http");
const socketIo = require("socket.io");
require('dotenv').config();
const port = process.env.APISYSTEMPORT;
const DBNAME = process.env.DB_NAME;
//Mongoose models
const inPlayEvents = require("./app/models/events");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");

//Tool
//const ToolForEvent = require("./restApiSystem/src/tools_for_events.js")();
// const ToolForRacing = require("./restApiSystem/src/tools_for_racing.js")();
const ToolForRacing = require("./restApiSystem/src/tools_for_updated_racing.js")();
const ToolForFancy = require("./restApiSystem/src/tools_for_fancy.js")();
const ToolForAsian = require("./restApiSystem/src/tools_for_asian.js")();
const ToolForTestSport = require("./restApiSystem/src/tools_for_test_sport.js")();
const ToolForListEvent = require("./restApiSystem/src/tools_for_list_events.js")();
const ToolForResult = require("./restApiSystem/src/tools_for_result")();


express.use(require('express').json());
express.use(morgan("dev"));

// READ FORM DATA
express.use(require('express').urlencoded({ extended: false }));

express.use(bodyParser.urlencoded({ extended: false })); //support encoded bodies
express.use(bodyParser.json({ strict: false }));
const corsOptions = {
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
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
  useUnifiedTopology: true,
  connectTimeoutMS: 30000,
};

mongoose.set("strictQuery", false);

mongoose.set({ debug: false });

mongoose
  .connect(`mongodb://127.0.0.1/${DBNAME}`, mongooseOptions)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.error(`Failed to connect to the database: ${err}`);
  });

express.post("/update_cricket", require("./app/routes/scrapeCricket").cricketRouter);

async function main() {
  console.log("code understanding log ---");
  await inPlayEvents.updateMany({}, { inplay: false, inplayFromServer: false });

  //init events jobs for cricket, tennis and soccer
  // ToolForEvent.init(io, express);

  // init events jobs for cricket, tennis and soccer
  ToolForRacing.init(io, express);

  // init events jobs for fancy data for cricket
  ToolForFancy.init(io, express);

  // init asian odds
  // ToolForAsian.init(io, express);

  // init test sports odd
  // ToolForTestSport.init(io, express);

  // init events list
  // ToolForListEvent.init(io, express);

  // init events list
  ToolForResult.init(io, express);

  httpServer.listen(port, () => {
    console.log(`Api System Server listening on port ${port}`);
  });
}

main();

module.exports.io = io;
