// // Import required modules
// const express = require('express');
// const { validationResult } = require('express-validator');
// const loginRouter = express.Router();
// const inPlayEvents = require('../models/events');
// const Odds = require('../models/odds');
// const { default: mongoose } = require('mongoose');
// const marketIds = require('../models/marketIds');

// async function getAllSportsHighlight(req, res) {
//   let serverTime = new Date();

//   try {
//     let now = new Date();  // Get the current date and time
//     let startOfDay = new Date(now);
//     startOfDay.setHours(0, 0, 0, 0);  // Set to the start of the day
//     startOfDay.setTime(startOfDay.getTime() - 5 * 60 * 60 * 1000);  // Subtract 5 hours in milliseconds
//     let startOfDayTimestamp = startOfDay.getTime();

//     let endOfDayTimestamp;
//     const sportId = req.query.sport;
//     console.log("sportId", sportId);
    
//     if (sportId == '1' || sportId == '2') {
//       let endOfDay = new Date(now);
//       endOfDay.setHours(23, 59, 59, 999);
//       endOfDayTimestamp = endOfDay.getTime();
//     } else {
//       endOfDayTimestamp = new Date(startOfDayTimestamp + (5 * 24 * 60 * 60 * 1000)).getTime(); // 5 days
//     }
//     console.log("step 1");

//     const sportsHighlights = await inPlayEvents.aggregate([
//       {
//         $match: {
//           $expr: {
//             $or: [
//               { $eq: ["$inplay", true] },
//               {
//                 $and: [
//                   { $gte: ["$openDate", startOfDayTimestamp] },
//                   { $lt: ["$openDate", endOfDayTimestamp] }
//                 ]
//               }
//             ]
//           },
//           sportsId: sportId,
//         }
//       },
//       {
//         $sort: {
//           openDate: 1
//         }
//       },
//       {
//         $lookup: {
//           from: 'marketIds',
//           localField: 'Id',
//           foreignField: 'eventId',
//           as: 'marketData'
//         }
//       },
//       {
//         $unwind: {
//           path: '$marketData',
//           preserveNullAndEmptyArrays: true
//         }
//       },
//       {
//         $lookup: {
//           from: 'odds',
//           localField: 'marketData.eventId',
//           foreignField: 'eventId',
//           as: 'oddsData'
//         }
//       },
//       {
//         $project: {
//           _id: '$_id',
//           match: '$name',
//           openDate: '$openDate',
//           lastCheckMarket: '$lastCheckMarket',
//           sportsId: '$sportsId',
//           matchType: '$matchType',
//           amount: '$amount',
//           Id: '$Id',
//           inplayFromServer: "$inplayFromServer",
//           isShowed: "$isShowed",
//           inplay: '$inplay',
//           status: "$status",
//           iconStatus: '$iconStatus',
//           matchTypeProvider: '$matchTypeProvider',
//           betAllowed: "$betAllowed",
//           matchCanceledStatus: "$matchCanceledStatus",
//           matchStoppedReason: '$matchStoppedReason',
//           theSportsId: "$theSportsId",
//           CompanySetStatus: "$CompanySetStatus",
//           hasFancyMatch: "$hasFancyMatch",
//           hasBookmaker: "$hasBookmaker",
//           totalMatched: { $max: '$oddsData.totalMatched' },
//           MatchOddsOff: { $first: '$marketData.MatchOddsOff' },
//           serverTime: serverTime
//         },
//       },
//     ]);


//     const totalOpenMarkets = await marketIds.countDocuments({ status: "OPEN", eventId: { $in: sportsHighlights.map(sh => sh.Id) } });
//     console.log("step 2");

//     return res.send({
//       success: true,
//       message: 'GETTING_ALL_SPORTSHIGHLIGHT_DATA_SUCCESS',
//       results: sportsHighlights,
//       totalOpenMarkets: totalOpenMarkets,
//     });
//   } catch (err) {
//     return res.status(404).send({
//       success: false,
//       message: 'Something went WRONG ',
//     });
//   }
// }

// async function deleteSportHighlight(req, res) {
//   try {
//     const id = req.query.id;
//     console.log(id);
//     console.log("deleting sportshighlights...............");
//     const sportsHighlights = await inPlayEvents.deleteOne({ _id: mongoose.Types.ObjectId(id) });

//     return res.send({
//       success: true,
//       message: `${id} DELETED SUCCESSFULLY`,
//       results: sportsHighlights,
//     });
//   } catch (err) {
//     return res.status(404).send({
//       success: false,
//       message: 'Internal server error',
//     });
//   }
// }

// loginRouter.get('/getAllSportsHighlight', getAllSportsHighlight);
// loginRouter.delete('/deleteSport', deleteSportHighlight);

// module.exports = { loginRouter };












// Import required modules
const express = require('express');
const { validationResult } = require('express-validator');
const loginRouter = express.Router();
const inPlayEvents = require('../models/events');
const Odds = require('../models/odds');
const { default: mongoose } = require('mongoose');
const marketIds = require('../models/marketIds');

async function getAllSportsHighlight(req, res) {
  try {
    const serverTime = new Date();
    const now = new Date();
    
    let startOfDay = new Date(now.setHours(0, 0, 0, 0) - 5 * 60 * 60 * 1000);
    let startOfDayTimestamp = startOfDay.getTime();

    const sportId = req.query.sport;
    console.log("sportId:", sportId);

    let endOfDayTimestamp =
      sportId == '1' || sportId == '2'
        ? new Date(now.setHours(23, 59, 59, 999)).getTime()
        : startOfDayTimestamp + 5 * 24 * 60 * 60 * 1000;

    const sportsHighlights = await inPlayEvents.aggregate([
      {
        $match: {
          $or: [
            { inplay: true },
            {
              openDate: { $gte: startOfDayTimestamp, $lt: endOfDayTimestamp },
            },
          ],
          sportsId: sportId,
        },
      },
      { $sort: { openDate: 1 } },
      {
        $project: {
          _id: 1,
          match: "$name",
          openDate: 1,
          lastCheckMarket: 1,
          sportsId: 1,
          matchType: 1,
          amount: 1,
          Id: 1,
          inplayFromServer: 1,
          isShowed: 1,
          inplay: 1,
          marketIds: 1,
          status: 1,
          iconStatus: 1,
          matchTypeProvider: 1,
          betAllowed: 1,
          matchCanceledStatus: 1,
          matchStoppedReason: 1,
          theSportsId: 1,
          CompanySetStatus: 1,
          hasFancyMatch: 1,
          hasBookmaker: 1,
        },
      },
    ]);

    if (sportsHighlights.length > 0) {
      await Promise.all(
        sportsHighlights.map(async (highlight) => {
          const marketData = await marketIds.aggregate([
            {
              $match: { eventId: highlight.Id, marketName: "Match Odds" },
            },
            {
              $lookup: {
                from: "odds",
                localField: "eventId",
                foreignField: "eventId",
                as: "oddsData",
              },
            },
            {
              $project: {
                _id: 1,
                totalMatched: { $max: "$oddsData.totalMatched" },
                MatchOddsOff: 1,
              },
            },
          ]);

          highlight.totalMatched = marketData[0]?.totalMatched || 0;
          highlight.MatchOddsOff = marketData[0]?.MatchOddsOff || 0;
          highlight.serverTime = serverTime;
        })
      );
    }

    const ids = await inPlayEvents.distinct("Id", {
      sportsId: sportId,
      openDate: { $gte: startOfDayTimestamp, $lt: endOfDayTimestamp },
    });

    const totalOpenMarkets = await marketIds.countDocuments({
      status: "OPEN",
      eventId: { $in: ids },
    });

    return res.json({
      success: true,
      message: "GETTING_ALL_SPORTSHIGHLIGHT_DATA_SUCCESS",
      results: sportsHighlights,
      totalOpenMarkets,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Something went WRONG",
    });
  }
}


//original
// async function getAllSportsHighlight(req, res) {
//   let serverTime = new Date();
//   // serverTime = serverTime.toLocaleString('en-US', {
//   //   weekday: 'long',
//   //   year: 'numeric',
//   //   month: 'long',
//   //   day: 'numeric',
//   //   hour: 'numeric',
//   //   minute: 'numeric',
//   //   second: 'numeric',
//   //   hour12: true,
//   //   timeZoneName: 'short'
//   // });

//   try {

//     let now = new Date();  // Get the current date and time
//     let startOfDay = new Date(now);
//     startOfDay.setHours(0, 0, 0, 0);  // Set to the start of the day
//     startOfDay.setTime(startOfDay.getTime() - 5 * 60 * 60 * 1000);  // Subtract 5 hours in milliseconds
//     let startOfDayTimestamp = startOfDay.getTime();

//     let endOfDayTimestamp

//     const sportId = req.query.sport;
//     console.log("sportId", sportId)
//     if (sportId == '1' || sportId == '2') {
//       let endOfDay = new Date(now);
//       endOfDay.setHours(23, 59, 59, 999);
//       endOfDayTimestamp = endOfDay.getTime();
//     } else {
//       endOfDayTimestamp = new Date(startOfDayTimestamp + (5 * 24 * 60 * 60 * 1000)).getTime(); // 5days
//     }
//     const sportsHighlights = await inPlayEvents.aggregate([
//       {
//         $match: {
//           $expr: {
//             $or: [
//               { $eq: ["$inplay", true] }, // If inPlay is true, this part always evaluates to true, bypassing the date filter
//               {
//                 $and: [
//                   { $gte: ["$openDate", startOfDayTimestamp] },
//                   { $lt: ["$openDate", endOfDayTimestamp] }
//                 ]
//               }
//             ]
//           },
//           sportsId: sportId,
//         }
//       },
//       {
//         $sort: {
//           openDate: 1
//         }
//       },
//       {
//         $project: {
//           _id: '$_id',
//           match: '$name',
//           openDate: '$openDate',
//           lastCheckMarket: '$lastCheckMarket',
//           sportsId: '$sportsId',
//           matchType: '$matchType',
//           amount: '$amount',
//           Id: '$Id',
//           inplayFromServer: "$inplayFromServer",
//           isShowed: "$isShowed",
//           inplay: '$inplay',
//           marketIds: "$marketIds",
//           status: "$status",
//           iconStatus: '$iconStatus',
//           matchTypeProvider: '$matchTypeProvider',
//           betAllowed: "$betAllowed",
//           matchCanceledStatus: "$matchCanceledStatus",
//           matchStoppedReason: '$matchStoppedReason',
//           theSportsId: "$theSportsId",
//           CompanySetStatus: "$CompanySetStatus",
//           hasFancyMatch: "$hasFancyMatch",
//           hasBookmaker: "$hasBookmaker",
//         },
//       },
//     ]);

//     let marketData = [];
//     // console.log("sportsHighlight", sportsHighlights)

//     if (sportsHighlights.length > 0) {
//       for (let i = 0; i < sportsHighlights.length; i++) {
//         marketData = await marketIds.aggregate([
//           {
//             $match: { eventId: sportsHighlights[i].Id, marketName: "Match Odds" }
//           },
//           {
//             $lookup: {
//               from: 'odds',
//               localField: 'eventId',
//               foreignField: 'eventId',
//               as: 'oddsData'
//             }
//           },
//           {
//             $project: {
//               _id: 1,
//               totalMatched: { $max: '$oddsData.totalMatched' },
//               MatchOddsOff: 1
//             }
//           }
//         ]);
//         sportsHighlights[i].totalMatched = marketData[0] ? marketData[0].totalMatched : 0
//         sportsHighlights[i].serverTime = serverTime;
//         sportsHighlights[i].MatchOddsOff = marketData[0] ? marketData[0].MatchOddsOff : 0;

//         // console.log("MarketData", marketData)

//       }
//     }

//     const ids = await inPlayEvents.distinct("Id", {
//       sportsId: sportId,
//       openDate: {
//         $gte: startOfDayTimestamp,
//         $lt: endOfDayTimestamp
//       }
//     })
//     console.log("sportId....................", sportId);
//     const timestamp = 1731707700000;
//     const date = new Date(timestamp);

//     // Log the Date object
//     console.log(date);  // Logs the Date object
//     //console.log("======================>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>..",ids);
//     const totalOpenMarkets = await marketIds.countDocuments({ status: "OPEN", eventId: { $in: ids } })

//     // console.log(" ======== ids  ", ids);

//     return res.send({
//       success: true,
//       message: 'GETTING_ALL_SPORTSHIGHLIGHT_DATA_SUCCESS',
//       results: sportsHighlights,
//       totalOpenMarkets: totalOpenMarkets,
//     });
//   } catch (err) {
//     //console.log(err);
//     return res.status(404).send({
//       success: false,
//       message: 'Something went WRONG ',
//     });
//   }
// }

async function deleteSportHighlight(req, res) {
  try {
    const id = req.query.id;
    console.log(id);
    console.log("deleting sportshighlights...............");
    const sportsHighlights = await inPlayEvents.deleteOne({ _id: mongoose.Types.ObjectId(id) });

    return res.send({
      success: true,
      message: `${id} DELETED SUCCESSFULLY`,
      results: sportsHighlights,
    });
  } catch (err) {
    //console.log(err);
    return res.status(404).send({
      success: false,
      message: 'Internal server error',
    });
  }
}

loginRouter.get('/getAllSportsHighlight', getAllSportsHighlight);
loginRouter.delete('/deleteSport', deleteSportHighlight);

module.exports = { loginRouter };
