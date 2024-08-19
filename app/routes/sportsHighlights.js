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
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0)).getTime();

    const sportId = req.query.sport;
    let endOfDayTimestamp;

    if (sportId === '1' || sportId === '2') {
      endOfDayTimestamp = new Date(now.setHours(23, 59, 59, 999)).getTime();
    } else {
      endOfDayTimestamp = startOfDay + 2 * 24 * 60 * 60 * 1000; // 2 days later
    }

    const startTime = Date.now();

    const sportsHighlights = await inPlayEvents.aggregate([
      {
        $match: {
          sportsId: sportId, 
          // status: "OPEN",
          $expr: {
            $or: [
              { $eq: ["$inplay", true] }, 
              {
                $and: [
                  { $gte: ["$openDate", startOfDay] },
                  { $lt: ["$openDate", endOfDayTimestamp] }
                ]
              }
            ]
          },
        }
      },
      {
        $sort: { openDate: 1 }
      },
      {
        $project: {
          _id: 1,
          match: '$name',
          openDate: '$openDate',
          lastCheckMarket: '$lastCheckMarket',
          sportsId: '$sportsId',
          matchType: '$matchType',
          amount: '$amount',
          Id: '$Id',
          inplayFromServer: "$inplayFromServer",
          isShowed: "$isShowed",
          inplay: '$inplay',
          marketIds: "$marketIds",
          status: "$status",
          iconStatus: '$iconStatus',
          matchTypeProvider: '$matchTypeProvider',
          betAllowed: "$betAllowed",
          matchCanceledStatus: "$matchCanceledStatus",
          matchStoppedReason: '$matchStoppedReason',
          theSportsId: "$theSportsId",
          CompanySetStatus: "$CompanySetStatus",
          hasFancyMatch: "$hasFancyMatch",
          hasBookmaker: "$hasBookmaker"
        }
      },
    ]);

    const endTime = Date.now();
    console.log(`Query execution time: ${endTime - startTime}ms`);

    if (sportsHighlights.length > 0) {
      const highlightIds = sportsHighlights.map(highlight => highlight.Id);

      const marketData = await marketIds.aggregate([
        {
          $match: {
            eventId: { $in: highlightIds },
            marketName: "Match Odds"
          }
        },
        {
          $lookup: {
            from: 'odds',
            localField: 'eventId',
            foreignField: 'eventId',
            as: 'oddsData'
          }
        },
        {
          $group: {
            _id: "$eventId",
            totalMatched: { $max: '$oddsData.totalMatched' }
          }
        }
      ]);

      const marketDataMap = marketData.reduce((acc, item) => {
        acc[item._id] = item.totalMatched;
        return acc;
      }, {});

      sportsHighlights.forEach(highlight => {
        highlight.totalMatched = marketDataMap[highlight.Id] || 0;
      });
    }

    const ids = await inPlayEvents.distinct("Id", {
      sportsId: sportId,
      openDate: {
        $gte: startOfDay,
        $lt: endOfDayTimestamp
      }
    });

    const totalOpenMarkets = await marketIds.countDocuments({
      status: "OPEN",
      eventId: { $in: ids }
    });

    return res.send({
      success: true,
      message: 'GETTING_ALL_SPORTSHIGHLIGHT_DATA_SUCCESS',
      results: sportsHighlights,
      totalOpenMarkets: totalOpenMarkets
    });

  } catch (err) {
    console.error(err);
    return res.status(404).send({
      success: false,
      message: 'Something went WRONG',
    });
  }
}

async function deleteSportHighlight(req, res) {
  try {
    const id = req.query.id;
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
