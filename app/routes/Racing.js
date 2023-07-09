const express = require('express');
const axios = require('axios');
const config = require('config');
const loginRouter = express.Router();

async function racesTodayMeetings(req, res) {
  const SportsId = req.params.SportsId;
  try {
    const url = `${config.horseRaceUrl}/meetings/today/${SportsId}`;
    const response = await axios.get(url);
    console.log('response', response.data);
    return res.json({
      success: true,
      message: 'Horse Race Records',
      results: response.data,
    });
  } catch (error) {
    console.error('Error retrieving Records:', error);
    return res.status(200).json({
      success: false,
      message: 'Error retrieving Records',
    });
  }
}

loginRouter.get('/racesTodayMeetings/:SportsId', racesTodayMeetings);
module.exports = { loginRouter };
