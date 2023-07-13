// Import required modules
const express = require('express');
const { validationResult } = require('express-validator');
const loginRouter = express.Router();
const SportsHighlight = require('../models/sportsHighlights'); // import SportsHighlight model
const inPlayEvents = require('../models/inPlayEvents');
const Odds = require('../models/odds');

// Define the API endpoint
async function getAllSportsHighlight(req, res) {
  try {
    const sportsHighlights = await inPlayEvents.find({});
    console.log('sportsHighlights', sportsHighlights);

    const eventIds = sportsHighlights.map(highlight => highlight.Id);
    const oddsData = await Odds.find({ eventId: { $in: eventIds } });

    const totalMatchedMap = {};

    oddsData.forEach(odds => {
      totalMatchedMap[odds.eventId] = odds.totalMatched;
    });

    const formattedData = sportsHighlights.map(highlight => ({
      sport: highlight.sport,
      name: highlight.name,
      amount: totalMatchedMap[highlight.Id] || 0
    }));

    return res.send({
      success: true,
      message: 'GETTING_ALL_SPORTSHIGHLIGHT_DATA_SUCCESS',
      results: formattedData
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
