// Import required modules
const express = require('express');
const { validationResult } = require('express-validator');
const loginRouter = express.Router();
const inPlayEvents = require('../models/events');
const Odds = require('../models/odds');
const { default: mongoose } = require('mongoose');
const marketIds = require('../models/marketIds');

const { Transform } = require('stream');

async function getAllSportsHighlight(req, res) {
  try {
    let now = new Date();
    let startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    let startOfDayTimestamp = startOfDay.getTime();

    let endOfDayTimestamp;
    const sportId = req.query.sport;

    if (sportId == '1') {
      let endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      endOfDayTimestamp = endOfDay.getTime();
    } else {
      if (sportId == "2") endOfDayTimestamp = new Date(startOfDayTimestamp + (24 * 60 * 60 * 1000)).getTime();
      else endOfDayTimestamp = new Date(startOfDayTimestamp + (2 * 24 * 60 * 60 * 1000)).getTime(); // 2 days
    }

    // Start writing response headers
    res.setHeader('Content-Type', 'application/json');
    res.write('[');

    let isFirst = true;

    // Create a cursor to stream the results
    const cursor = inPlayEvents.aggregate([
      {
        $match: {
          $expr: {
            sportsId: sportId,
            $or: [
              { $eq: ["$inplay", true] },
              {
                $and: [
                  { $gte: ["$openDate", startOfDayTimestamp] },
                  { $lt: ["$openDate", endOfDayTimestamp] }
                ]
              }
            ]
          },
        }
      },
      {
        $sort: {
          openDate: 1
        }
      },
      {
        $project: {
          _id: 0,
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
      }
    ]).cursor();

    cursor.on('data', (doc) => {
      if (!isFirst) {
        res.write(',');
      } else {
        isFirst = false;
      }
      res.write(JSON.stringify(doc));
    });

    cursor.on('end', () => {
      res.write(']');
      res.end();
    });

    cursor.on('error', (err) => {
      console.error(err);
      res.status(500).send({
        success: false,
        message: 'Something went wrong while streaming the data.'
      });
    });

  } catch (err) {
    console.error(err);
    return res.status(500).send({
      success: false,
      message: 'Something went wrong while fetching the data.',
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
