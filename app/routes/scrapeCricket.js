const express = require('express');
let config = require('config');
const cricketRouter = express.Router();
const Crickets = require('../models/Crickets')
const inPlayEvents = require("../models/events");

async function updateCricketData(req, res) {
  const body = req.body;
  console.info('body: ', body.length)
  try {
    for (const item of body) {
      await Crickets.findOneAndUpdate(
        { seriesKey: item.seriesKey },
        item,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    res.status(200).json({
      success: true,
      message: 'updated cricket data ',
    });

  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to update cricket data ',
      error: error.message,
    });
  }
}

cricketRouter.post('/update_cricket', updateCricketData);

module.exports = { cricketRouter };
