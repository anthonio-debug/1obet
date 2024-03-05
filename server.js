const express = require("express");
const app = express();
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
let config = require("config");
let fs = require("fs");
let cors = require("cors");
const morgan = require("morgan");
const http = require("http");
require('dotenv').config();
// const DBNAME = process.env.DB_NAME;
const DBHost = process.env.DBHost;
const PORT = process.env.SERVERPORT;

const apisMiddleware = require("./app/middlewares/apisMiddleware");
const loginMiddleWare = require("./app/middlewares/loginMiddleware");
const checkRoleMiddleware = require("./app/middlewares/checkRoleMiddleware");

const apisContent = fs.readFileSync(config.apisFileName);
const jsonApis = JSON.parse(apisContent);
let options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 30000, // 30 seconds
};

mongoose.set("strictQuery", false);
mongoose.set({debug: false});
mongoose
  .connect(`${DBHost}?directConnection=true`, options)
  .then(() => {
    console.log("Database connected");
  })
  .catch((err) => {
    console.log(` Database did not connect because ${err}`);
  });

// readFileSync function must use __dirname get current directory
// require use ./ refer to current directory.

// console.log('dirname',__dirname);
// JSON
app.use(express.json());
app.use(morgan("dev"));
app.set('trust proxy', true);

// READ FORM DATA
app.use(express.urlencoded({extended: false}));

app.use(bodyParser.urlencoded({extended: false})); //support encoded bodies
app.use(bodyParser.json({strict: false}));
const corsOptions = {
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));
app.get("/", (req, res) => {
  return res.send(
    '<body style="background: #000; color: #fff"><h2> This is the homepage of 1obet.net </h2></body>'
  );
});

// Allowed Apis on this server
app.use(function (req, res, next) {
  apisMiddleware(req, res, next, jsonApis);
});

//Without Authorization
app.use("/api", require("./app/routes/user").router);
app.use("/api", require("./app/routes/listScraper").router);
app.use("/api", require("./app/routes/settings").router);
app.use("/api", require("./app/routes/CasinoCalls").router);
// app.use("/api", require("./app/routes/AsianCasinoCalls").router);
app.use("/api", require("./app/routes/liveTv").router);
app.use("/api", require("./app/routes/listBetting").router);
app.use("/api", require("./app/routes/listTrackBalance").router);
app.use("/api", require("./app/routes/sportsTestAPI").router);

// Login middleware
app.use(function (req, res, next) {
  loginMiddleWare(req, res, next);
});
app.use(function (req, res, next) {
  checkRoleMiddleware(req, res, next);
});

// APIS With Authorization
app.use("/api", require("./app/routes/user").loginRouter);
app.use("/api", require("./app/routes/userBetSizes").loginRouter);
app.use("/api", require("./app/routes/modulePermissionsUsers").loginRouter);
app.use("/api", require("./app/routes/modulePermissions").loginRouter);
app.use("/api", require("./app/routes/marketPlaces").loginRouter);
app.use("/api", require("./app/routes/betLocks").loginRouter);
app.use("/api", require("./app/routes/deposits").loginRouter);
app.use("/api", require("./app/routes/credits").loginRouter);
app.use("/api", require("./app/routes/reports").loginRouter);
app.use("/api", require("./app/routes/settings").loginRouter);
app.use("/api", require("./app/routes/sportsHighlights").loginRouter);
app.use("/api", require("./app/routes/bets").loginRouter);
app.use("/api", require("./app/routes/casinoGames").loginRouter);
app.use("/api", require("./app/routes/dailyPLReports").loginRouter);
app.use("/api", require("./app/routes/dailyReports").loginRouter);
app.use("/api", require("./app/routes/commissionReports").loginRouter);
app.use("/api", require("./app/routes/bookDetail2Reports").loginRouter);
app.use("/api", require("./app/routes/bookDetail").loginRouter);
app.use("/api", require("./app/routes/currentPosition").loginRouter);
app.use("/api", require("./app/routes/sportsAPI").loginRouter);
app.use("/api", require("./app/routes/fancyGames").loginRouter);
app.use("/api", require("./app/routes/liveTv").loginRouter);
app.use("/api", require("./app/routes/liveScore").loginRouter);
app.use("/api", require("./app/routes/Racing").loginRouter);
app.use("/api", require("./app/routes/BettingFigures").loginRouter);
app.use("/api", require("./app/routes/sportBook").loginRouter);
app.use("/api", require("./app/routes/marketPositions").loginRouter);
app.use("/api", require("./app/routes/marketShares").loginRouter);
app.use("/api", require("./app/routes/betPlaceHold").loginRouter);

// // Allowed Apis for this role
// app.use(function (req, res, next) {
// 	aclMiddleware(req, res, next, jsonApis)
// })

// USING THE ROUTES

// LISTEN HERE
// Create HTTPs server.
const server = http.createServer(app);
server.listen(PORT, (err) => {
  if (err) throw new Error(err);
  console.log(`Server is listening on port ${PORT}`);
});
