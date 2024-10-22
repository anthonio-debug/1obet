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
const { horseRaceStreaming, greyhoundRaceStreaming } = require("./app/routes/obsServer");
const {} = require("./app/routes/obsServer");
const {  getdeopsitDetailsCash, getdepositDetailsCredit } = require("./app/routes/deposits");
const inplayeventsraces = require("./app/models/InplayEvenetRaces");
const { default: axios } = require("axios");
const MarketIDS = require("./app/models/marketIds");

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
const header = {
  headers: {
    accept: 'application/json',
    'Content-Type': 'application/json',
    'X-App': process.env.XAPP_NAME
  }
};
function getMatchType(
  // competitionName,
  name,
  sportsId
) {
  const keywords = /(T20|twenty20|Twenty20|twenty 20|Twenty 20|ODI|One Day|one day|T10|Ten10||ten 10|Ten 10|Test|TEST)/i;
  if (sportsId == '4') {
    const nameMatch = name.match(keywords);
    // const competitionNameMatch =
    //   competitionName && competitionName.match(keywords);
    let returnMatch = '';
    if (nameMatch) {
      returnMatch = nameMatch[0];
    }
    // else if (competitionNameMatch) {
    //   returnMatch = competitionNameMatch[0];
    // }

    if (['ODI', 'One Day', 'one day'].includes(returnMatch)) {
      returnMatch = 'ODI';
    } else if (['Test', 'test'].includes(returnMatch)) {
      returnMatch = 'TEST';
    } else if (['twenty20', 'Twenty20', 'Twenty 20', 'twenty 20'].includes(returnMatch)) {
      returnMatch = 'T20';
    } else if (['T10', 'Ten10', 'ten 10', 'Ten 10'].includes(returnMatch)) {
      returnMatch = 'T10';
    }
    return returnMatch;
  }
}
// async function fetchEvents() {
//   function isValidDate(d) {
//     return new Date(d).toString() !== 'Invalid Date';
//   }
// console.log("here")
//   let from = new Date();
//   let to = new Date(from);
//   to.setTime(to.getTime() + 2 * 24 * 60 * 60 * 1000);
// const sportsId=4339
//   const requestData = {
//     filter: {
//       eventTypeIds: [sportsId]
//       // "eventIds":
//       //   sportsId === "1"
//       //   ? soccerIds
//       //   : sportsId === "4"
//       //   ? cricketIds
//       //   : []
//     }
//   };
//   let url = `${config.newThirdURL}/listEvents`;
//   try {
//     const response = await axios.post(url, requestData, header);

//     let events = response.data.result;

//     if (events.length > 0) {
//       events = events.filter(function (item) {
//         return isValidDate(item.event.openDate);
//       });
//       let apiEventIds = [];
//       for (const event of events) {
//         const existingDoc = await inplayeventsraces.findOne({ Id: event.event.id });

//         if (existingDoc && existingDoc.isCanceled === true) {
//           continue;
//         }

//         // var competitions = responseCompetition.data.result;
//         await inplayeventsraces.findOneAndUpdate(
//           { Id: event.event.id },
//           {
//             $set: {
//               sportsId: sportsId,
//               // sportsId: '4',
//               Id: event.event.id,
//               name: event.event.name,
//               countryCode: event.event.countryCode,
//               timezone: event.event.timezone,
//               openDate: Date.parse(event.event.openDate),
//               // competitionId: competitions[0]?.competition?.id ? competitions[0]?.competition?.id : null,
//               // competitionName: competitions[0]?.competition?.name ? competitions[0]?.competition?.name : null,
//               inplayFromServer: false,

//               status: 'OPEN',
//               isPremium: false,
//               type: event.event.type,
//               matchTypeProvider: getMatchType(
//                 // event.event.competitionName,
//                 event.event.name,
//                 sportsId
//               )
//             }
//           },
//           {
//             upsert: true
//           }
//         );

//         apiEventIds.push(event.event.id);
//       }

//       let dbEventIdS = [];
//       const currentEvents = await inplayeventsraces.find({ status: 'OPEN', sportsId: `${sportsId}` }, { Id: 1 });

//       for (const event of currentEvents) {
//         dbEventIdS.push(event.Id);
//       }

//       let diffs = dbEventIdS.filter((item) => !apiEventIds.includes(item));
//       // if inplayFromServer is true on old records and not available on last list.
//       // update event status with 'CLOSED-INPLAYLIST'
//       // Also update MarketIDs
//       for (const diff of diffs) {
//         //console.log("Event is closed because it not exists on listEventsBySport: ", diff)
//         await MarketIDS.updateMany({ eventId: diff }, { $set: { inPlay: false, status: 'CLOSED', readyForScore: true } });
//         await inplayeventsraces.updateOne(
//           { Id: diff },
//           {
//             $set: {
//               status: 'CLOSED-EVENTLIST',
//               inplay: false,
//               inplayFromServer: false,
//               readyForScore: true
//             }
//           }
//         );
      
//       }
        
//       return {
//         success: true,
//         message: 'Events retrieved and saved successfully',
//         events: events
//       };
//     } else {
//       return {
//         success: false,
//         message: 'Events empty'
//       };
//     }
//   }catch (error) {
//     //console.log("Problem on taking event list");
//     console.error(error);
//     return {
//       success: false,
//       message: 'Failed to get or save events',
//       error: error.message
//     };
//   }
// }
// setInterval(fetchEvents,1000)

// const allowedOrigin = 'https://dev.bookofblack.com';
// const allowedAdminOrigin = 'https://socket.bookofblack.com';
// const allowedAPI = 'https://api.bookofblack.com';



// Configure CORS options
// const allowedOrigin = 'https://1obet.com';
// const allowedAdminOrigin = 'https://admin.1obet.com';
// const allowedAPI = 'https://production.1obet.net';


// const corsOptions = {
//   origin: function(origin, callback) {
//     if (origin === allowedAPI || origin === allowedAdminOrigin || origin === allowedOrigin || !origin) {
//       // Allow requests with no origin (like mobile apps or curl requests)
//       callback(null, true);
//     } else {
//       // Disallow requests from other origins
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
// };

// const corsOptions = {
//   origin: true,
//   credentials: true,
//   optionsSuccessStatus: 200,
// };

const allowedOrigins = [
  'https://1obet.com',
  'https://www.1obet.com',
  'https://admin.1obet.com',
  'https://www.admin.1obet.com',
  'https://production.1obet.net'
];

const corsOptions = {
  origin: (origin, callback) => {
   
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, 
  optionsSuccessStatus: 200 
};

app.use(cors(corsOptions));



app.use(cors(corsOptions));
app.get("/", (req, res) => {
  return res.send(
    '<body style="background: #000; color: #fff"><h2> This is the homepage of 1obet.net </h2></body>'
  );
});
app.get("/streaming/horseracestreaming", horseRaceStreaming);
app.get("/streaming/greyhoundraceing", greyhoundRaceStreaming);

// Allowed Apis on this server
app.use(function (req, res, next) {
  apisMiddleware(req, res, next, jsonApis);
});

//Without Authorization
app.use("/api", require("./app/routes/user").router);
app.use("/api", require("./app/routes/settings").router);
app.use("/api", require("./app/routes/listScraper").router);
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
app.post("/api/getdeopsitDetailsCash", getdeopsitDetailsCash);
app.post("/api/getdepositDetailsCredit", getdepositDetailsCredit);
// app.use("/api", require("./app/routes/deposits").loginRouter);  

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
