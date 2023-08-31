// Import required modules
const express = require('express');
const { validationResult } = require('express-validator');
const loginRouter = express.Router();
const inPlayEvents = require('../models/events');
const Odds = require('../models/odds');
const { default: mongoose } = require('mongoose');

async function getAllSportsHighlight(req, res) {
  try {
    const sportId = req.query.sport;
    const sportsHighlights = await inPlayEvents.aggregate([
      {
        $match: {
          sportsId: sportId,
          openDate: {
            $gte: new Date().getTime() - 12 * 60 * 60 * 1000
          }
        }
      },
      {
        $project: {
          _id: '$_id',
          match: '$name',
          openDate: '$openDate',
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
    console.log(err);
    return res.status(404).send({
      success: false,
      message: 'Internal server error',
    });
  }
}

loginRouter.get('/getAllSportsHighlight', getAllSportsHighlight);
loginRouter.delete('/deleteSport', deleteSportHighlight);

module.exports = { loginRouter };
