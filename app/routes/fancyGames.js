const express = require('express');
let config = require('config');
const fancyGames = require('../models/fancyGames');
const axios = require('axios');
const loginRouter = express.Router();

async function getFancyData(req, res) {
  const eventId = req.params.eventId;
  const url = `${config.fancyUrl}/${eventId}`;
  console.log('url', url);
  try {
    const response = await axios.get(url);
    console.log('response', response.data);
    const fancyData = response.data.data;

    // // Create a new fancyData document
    // const data = new fancyGames({
    //   t1: fancyData.t1,
    //   t2: fancyData.t2,
    //   t3: fancyData.t3,
    //   t4: fancyData.t4,
    //   success: fancyData.success,
    //   status: fancyData.status,
    //   updatetime: fancyData.updatetime,
    //   eventTypeId: fancyData.eventTypeId,
    //   eventTypeName: fancyData.eventTypeName,
    //   eventName: fancyData.eventName,
    //   name: fancyData.name,
    //   eventdate: fancyData.eventdate,
    //   gameId: fancyData.gameId,
    // });

    // // Save the document to the database
    // await data.save();

    res.status(200).json({
      success: true,
      message: 'Fancy data saved successfully',
      fancyData: fancyData,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to save fancy data',
      error: error.message,
    });
  }
}

// Define the route for the API
loginRouter.get('/getFancyData/:eventId', getFancyData);

module.exports = { loginRouter };
