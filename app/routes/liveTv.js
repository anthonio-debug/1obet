const express = require('express');
let config = require('config');
const axios = require('axios');
const loginRouter = express.Router();

async function liveTv(req, res) {
  const eventId = req.query.eventId;
  const url = `${config.liveTvUrl}${eventId}`;
  try {
    const response = await axios.get(url);
    console.log('response', response.data);
    const fancyData = response.data;

    res.status(200).json({
      success: true,
      message: 'Live Tv Streaming',
      fancyData: fancyData,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get live tv streaming',
      error: error.message,
    });
  }
}

// Define the route for the API
loginRouter.get('/liveTv', liveTv);

module.exports = { loginRouter };
