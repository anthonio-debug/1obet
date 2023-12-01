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

//Tool
const ToolForEvent = require("./restApiSystem/src/tools_for_events.js")();
const ToolForRacing = require("./restApiSystem/src/tools_for_racing.js")();
const ToolForFancy = require("./restApiSystem/src/tools_for_fancy.js")();
const ToolForAsian = require("./restApiSystem/src/tools_for_asian.js")();
const ToolForTestSport = require("./restApiSystem/src/tools_for_test_sport.js")();
const httpServer = https.createServer(express);
const io = socketIo(httpServer, {
  path: "/websocket",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
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
    console.log("Database connected");
  })
  .catch((err) => {
    console.error(`Failed to connect to the database: ${err}`);
  });

async function main() {
  await inPlayEvents.updateMany({}, { inplay: false, inplayFromServer: false });

  //init events jobs for cricket, tennis and soccer
  ToolForEvent.init(io, express);

  //init events jobs for cricket, tennis and soccer
  ToolForRacing.init(io, express);

  //init events jobs for fancy data for cricket
  ToolForFancy.init(io, express);

  //init asian odds
  ToolForAsian.init(io, express);

  //init test sports odd
  ToolForTestSport.init(io, express);
  
  httpServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

main();
