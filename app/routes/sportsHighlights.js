// Import required modules
const express = require('express');
const { validationResult } = require('express-validator');
const loginRouter = express.Router();
const SportsHighlight = require('../models/sportsHighlights'); // import SportsHighlight model

// Define the API endpoint
async function getAllSportsHighlight(req, res) {
  try {
    const { searchValue } = req.query;
    const match = {};

    if (searchValue) {
      const searchRegex = new RegExp(searchValue, 'i');
      match.$or = [
        { 'highlights.match': searchRegex },
        { 'highlights.amount': parseInt(searchValue) },
      ];
    }

    const pipeline = [
      { $match: match },
      { $unwind: '$highlights' },
      { $match: match }, // added a new match stage to match the search value
      { $group: { _id: '$sport', highlights: { $push: '$highlights' } } },
      { $replaceRoot: { newRoot: { _id: '$_id', highlights: '$highlights' } } },
    ];

    const sportsHighlights = await SportsHighlight.aggregate(pipeline);

    const results = {};
    sportsHighlights.forEach((sport) => {
      results[sport._id] = sport.highlights;
    });

    return res.send({
      success: true,
      message: 'GETTING_ALL_SPORTSHIGHLIGHT_DATA_SUCCESS',
      results: results,
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
