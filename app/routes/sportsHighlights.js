// Import required modules
const express = require('express');
const { validationResult } = require('express-validator');
const loginRouter = express.Router();
const inPlayEvents = require('../models/inPlayEvents');
const Odds = require('../models/odds');

// Define the API endpoint
async function getAllSportsHighlight(req, res) {
  try {
    const sportsIdList = [1, 2, 4]; // List of sportsId to filter
    const sportsHighlights = await inPlayEvents.find({ sportsId: { $in: sportsIdList } });

    const eventIds = sportsHighlights.map(highlight => highlight.Id);
    const oddsData = await Odds.find({ eventId: { $in: eventIds } });

    const totalMatchedMap = {};

    oddsData.forEach(odds => {
      totalMatchedMap[odds.eventId] = odds.totalMatched;
    });

    const formattedData = {};

    sportsHighlights.forEach(highlight => {
      const { sport, name, Id, _id,sportsId,matchType,inplay,iconStatus } = highlight;
      const amount = totalMatchedMap[Id] || 0;

      if (!formattedData[sport]) {
        formattedData[sport] = [];
      }

      formattedData[sport].push({ match:name,sportsId,matchType ,amount,Id,_id,inplay,iconStatus });
    });

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
