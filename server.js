const express = require('express');
const app = express();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
let config = require('config');
let fs = require('fs');
let cors = require('cors');
var morgan = require('morgan');
const https = require('https');
const option = require('./option');
const apisMiddleware = require('./app/middlewares/apisMiddleware');
const loginMiddleWare = require('./app/middlewares/loginMiddleware');
const aclMiddleware = require('./app/middlewares/aclMiddleware');
const accessMiddleware = require('./app/middlewares/accessMiddleware');
const checkRoleMiddleware = require('./app/middlewares/checkRoleMiddleware');

var rolesContent = fs.readFileSync('config/settings/roles/roles.json');
var roles = JSON.parse(rolesContent);

var content = fs.readFileSync('config/settings/apis/general.json');
var jsonContent = JSON.parse(content);

var apisContent = fs.readFileSync(config.apisFileName);
var jsonApis = JSON.parse(apisContent);
const {
  themeCronJob,
  checkBetStatus,
  oddsCronJob,
  listMarketCronJob,
  fancyDataCronJob,
  todayRaceCronJob,
  raceMarketsCronJob,
  raceOddsCronJob
} = require('./cronJob/cronJob'); // Import only cronJob2

// Run the cron job
// themeCronJob();
// checkBetStatus();
// listMarketCronJob()
// oddsCronJob()
// fancyDataCronJob()
// todayRaceCronJob()
// raceMarketsCronJob()
// raceOddsCronJob()
// CONNECT THE DATABASE
let options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 30000, // 30 seconds
};

mongoose.set('strictQuery', false);
mongoose.set({ debug: true });
mongoose
  .connect(config.DBHost, options)
  .then(() => {
    console.log('Database connected');
  })
  .catch((err) => {
    console.log(` Database did not connect because ${err}`);
  });

// readFileSync function must use __dirname get current directory
// require use ./ refer to current directory.

// console.log('dirname',__dirname);
// JSON
app.use(express.json());
app.use(morgan('combined'));

// READ FORM DATA
app.use(express.urlencoded({ extended: false }));

app.use(bodyParser.urlencoded({ extended: false })); //support encoded bodies
app.use(bodyParser.json({ strict: false }));
var corsOptions = {
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};
app.use(cors(corsOptions));
app.get('/', (req, res) => {
  res.send(
    '<body style="background: #000; color: #fff"><h2> This is the homepage of 1obet.com </h2></body>'
  );
});

// Allowed Apis on this server
app.use(function (req, res, next) {
  apisMiddleware(req, res, next, jsonApis);
});

//Without Authorization
app.use('/api', require('./app/routes/user').router);
app.use('/api', require('./app/routes/settings').router);
app.use('/api', require('./app/routes/CasinoCalls').router);

// Login middleware
app.use(function (req, res, next) {
  loginMiddleWare(req, res, next);
});
app.use(function (req, res, next) {
  checkRoleMiddleware(req, res, next);
});

// APIS With Authorization
app.use('/api', require('./app/routes/user').loginRouter);
app.use('/api', require('./app/routes/userBetSizes').loginRouter);
app.use('/api', require('./app/routes/modulePermissionsUsers').loginRouter);
app.use('/api', require('./app/routes/modulePermissions').loginRouter);
app.use('/api', require('./app/routes/marketPlaces').loginRouter);
app.use('/api', require('./app/routes/betLocks').loginRouter);
app.use('/api', require('./app/routes/deposits').loginRouter);
app.use('/api', require('./app/routes/credits').loginRouter);
app.use('/api', require('./app/routes/reports').loginRouter);
app.use('/api', require('./app/routes/settings').loginRouter);
app.use('/api', require('./app/routes/betFairGames').loginRouter);
app.use('/api', require('./app/routes/sportsHighlights').loginRouter);
app.use('/api', require('./app/routes/bets').loginRouter);
app.use('/api', require('./app/routes/casinoGames').loginRouter);
app.use('/api', require('./app/routes/dailyPLReports').loginRouter);
app.use('/api', require('./app/routes/dailyReports').loginRouter);
app.use('/api', require('./app/routes/commissionReports').loginRouter);
app.use('/api', require('./app/routes/bookDetail2Reports').loginRouter);
app.use('/api', require('./app/routes/currentPosition').loginRouter);
app.use('/api', require('./app/routes/sportsAPI').loginRouter);
app.use('/api', require('./app/routes/fancyGames').loginRouter);
app.use('/api', require('./app/routes/liveTv').loginRouter);
app.use('/api', require('./app/routes/liveScore').loginRouter);
app.use('/api', require('./app/routes/Racing').loginRouter);
app.use('/api', require('./app/routes/BettingFigures').loginRouter);


// // Allowed Apis for this role
// app.use(function (req, res, next) {
// 	aclMiddleware(req, res, next, jsonApis)
// })

// USING THE ROUTES

// LISTEN HERE
// Create HTTPs server.
var server = https.createServer(option, app);
server.listen(config.PORT, (err) => {
  if (err) throw new Error(err);
  console.log(`Server is listening on port ${config.PORT}`);
});
