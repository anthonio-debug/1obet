const express = require('express');
let config = require('config');
const fancyGames = require('../models/fancyGames');
const axios = require('axios');
const loginRouter = express.Router();

async function getFancyData(req, res) {
  const eventId = req.params.eventId;
  const url = `${config.fancyUrl}/bm_fancy/${eventId}`;
  console.log('url', url);
  try {
    const response = await axios.get(url);
    console.log('response', response.data);
    console.log('response.data.t1', response.data.t1);
    console.log('response.data.t2', response.data.data.t2);
    console.log('response.data.t3', response.data.data.t3);
    console.log('response.data.t4', response.data.data.t4);

    const fancyData = response.data;

    // Create a new fancyData document
    const newData = {
      t1: fancyData.t1,
      t2: fancyData.t2,
      t3: fancyData.t3,
      t4: fancyData.t4,
      success: fancyData.success,
      status: fancyData.status,
      updatetime: fancyData.updatetime,
      eventTypeId: fancyData.eventTypeId,
      eventTypeName: fancyData.eventTypeName,
      eventName: fancyData.eventName,
      name: fancyData.name,
      eventdate: fancyData.eventdate,
      gameId: fancyData.gameId,
    };

    // Update or insert the document in the database
    const result = await fancyGames.updateOne(
      { gameId: eventId },
      newData,
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      res.status(200).json({
        success: true,
        message: 'Fancy data saved successfully',
        fancyData: newData,
      });
    } else {
      res.status(200).json({
        success: false,
        message: 'Fancy data already exists',
        fancyData: newData,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to save fancy data',
      error: error.message,
    });
  }
}

async function getFancyResult(req, res) {
  const eventId = req.params.eventId;
  const fancyName = req.params.fancyName;
  const url = `${config.fancyUrl}/fancy_result/${eventId}/${fancyName}`;
  console.log('url', url);

  try {
    const response = await axios.get(url);
    console.log('response', response.data);
    res.status(200).json({
      success: true,
      message: 'Fancy data result found',
      fancyData: response.data,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get fancy data',
      error: error.message,
    });
  }
}

// Define the route for the API
loginRouter.get('/getFancyData/:eventId', getFancyData);
loginRouter.get('/getFancyResult/:eventId/:fancyName', getFancyResult);

module.exports = { loginRouter };
