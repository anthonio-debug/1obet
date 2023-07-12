const express = require('express');
const mongoose = require('mongoose')
const axios = require('axios');
const config = require('config');
const loginRouter = express.Router();
const Races = require('../models/eventsBySport')

async function racesTodayMeetings(req, res) {
  const SportsId = req.params.SportsId;
  try {
    const url = `${config.horseRaceUrl}/meetings/today/${SportsId}`;
    const response = await axios.get(url);

    const meetings = response.data.meetings;
    ;
console.log('meetingId',meetings);
    if (Array.isArray(meetings)) {
      for (const meeting of meetings) {
        const { meetingId, venue, countryCode, races } = meeting;

        // Check if the meeting already exists in the schema and update it if needed
        await Event.findOneAndUpdate(
          { meetingId },
          { venue, countryCode, races },
          { upsert: true }
        );
      }

      return res.json({
        success: true,
        message: 'Horse Race Records',
        results: meetings,
      });
    } else {
      console.log('Meetings data is not an array:', meetings);
      return res.status(200).json({
        success: false,
        message: 'Invalid response data',
      });
    }
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
