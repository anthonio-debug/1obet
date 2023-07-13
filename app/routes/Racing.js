const express = require('express');
const mongoose = require('mongoose')
const axios = require('axios');
const config = require('config');
const loginRouter = express.Router();
const inPlayEvents = require('../models/inPlayEvents');

async function racesTodayMeetings(req, res) {
  const SportsId = req.params.SportsId;
  try {
    const url = `${config.horseRaceUrl}/meetings/today/${SportsId}`;
    const response = await axios.get(url);

  const horseRacesData = response.data;
    console.log('horseRacesData',horseRacesData);
    console.log('meetings',horseRacesData.meetings);

    for (const data of horseRacesData) {
  // Check if the meeting already exists in the schema and update it if needed
      await inPlayEvents.findOneAndUpdate(
        { meetingId: data.meetingId },
        { $setOnInsert: data },
        { upsert: true }
     );
    }
      return res.json({
        success: true,
        message: 'Horse Race Records',
        results: meetings,
      });
  } catch (error) {
    console.error('Error retrieving Records:', error);
    return res.status(200).json({
      success: false,
      message: 'Error retrieving Records',
    });
  }
}



async function racesTomorrowMeetings(req, res) {
  const SportsId = req.params.SportsId;
  try {
    console.log('config.horseRaceUrl',config.horseRaceUrl);
    const url = `${config.horseRaceUrl}/meetings/tomorrow/${SportsId}`;
    const response = await axios.get(url);
    console.log('response',url);
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
loginRouter.get('/racesTomorrowMeetings/:SportsId', racesTomorrowMeetings);

module.exports = { loginRouter };
