// Import required modules
const express = require('express');
const { validationResult } = require('express-validator');
const loginRouter = express.Router();
const inPlayEvents = require('../models/events');
const Odds = require('../models/odds');

async function getAllSportsHighlight(req, res) {
  try {
    const sportsIdList = ["1", "2", "4"]; // List of sportsId to filter

    // Use MongoDB aggregation pipeline to filter and process data on the database server
    const sportsHighlights = await inPlayEvents.aggregate([
      { $match: { sportsId: { $in: sportsIdList } } },
      {
        $lookup: {
          from: 'Odds',
          localField: 'Id',
          foreignField: 'eventId',
          as: 'oddsData',
        },
      },
      {
        $project: {
          sport: 1,
          name: 1,
          Id: 1,
          _id: 1,
          sportsId: 1,
          matchType: 1,
          inplay: 1,
          iconStatus: 1,
          matchStoppedReason:1,
          matchStopStatus:1,
          matchCanceledStatus:1,
          matchResumedStatus:1,
          openDate: 1,
          marketIds: 1,
          status: 1,
          inplayFromServer: 1,
          isShowed: 1,
          oddsData: { $arrayElemAt: ['$oddsData', 0] },
        },
      },
      {
        $addFields: {
          amount: { $ifNull: ['$oddsData.totalMatched', 0] },
        },
      },
      {
        $group: {
          _id: '$sport',
          data: {
            $push: {
              match: '$name',
              openDate: '$openDate',
              sportsId: '$sportsId',
              matchType: '$matchType',
              amount: '$amount',
              Id: '$Id',
              _id: '$_id',
              inplayFromServer: "$inplayFromServer",
              isShowed: "$isShowed",
              inplay: '$inplay',
              marketIds: "$marketIds",
              status: "$status",
              iconStatus: '$iconStatus',
            },
          },
        },
      },
      {
        $project: {
          sport: '$_id',
          data: 1,
          _id: 0,
        },
      },
    ]);

    const formattedData = {};
    console.log(
      'formattedData',formattedData
    );
    sportsHighlights.forEach((highlight) => {
      formattedData[highlight.sport] = highlight.data;
    });
     // Sort the sports in formattedData alphabetically and populate the sorted data into sortedFormattedData
     const sortedFormattedData = Object.keys(formattedData).sort((a, b) => a.localeCompare(b))
     .reduce((acc, sport) => {
       acc[sport] = formattedData[sport];
       return acc;
     }, {});

    return res.send({
      success: true,
      message: 'GETTING_ALL_SPORTSHIGHLIGHT_DATA_SUCCESS',
      results: sortedFormattedData,
    });
  } catch (err) {
    console.log(err);
    return res.status(404).send({
      success: false,
      message: 'Internal server error',
    });
  }
}

loginRouter.get('/getAllSportsHighlight', getAllSportsHighlight);

module.exports = { loginRouter };
