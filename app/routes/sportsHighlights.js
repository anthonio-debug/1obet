// Import required modules
const express = require('express');
const { validationResult } = require('express-validator');
const loginRouter = express.Router();
const inPlayEvents = require('../models/events');
const Odds = require('../models/odds');

async function getAllSportsHighlight(req, res) {
  try {
    const sportId = req.query.sport;
    const sportsHighlights = await inPlayEvents.aggregate([
      { $match: { 
        sportsId: "4",
        openDate: {
          $gte: new Date().getTime() -12*60*60*1000
        }
      } },
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
    ]);

    return res.send({
      success: true,
      message: 'GETTING_ALL_SPORTSHIGHLIGHT_DATA_SUCCESS',
      results: sportsHighlights,
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
