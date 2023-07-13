const express = require('express');
const mongoose = require('mongoose')
const axios = require('axios');
const config = require('config');
const loginRouter = express.Router();
const Racing = require('../models/racing');

async function racesTodayMeetings(req, res) {
  const SportsId = req.params.SportsId;
  try {
    const url = `${config.horseRaceUrl}/meetings/today/${SportsId}`;
    const response = await axios.get(url);

    const horseRacesData = response.data;
    console.log('horseRacesData', horseRacesData);
    // console.log('meetings', horseRacesData.meetings);
    // console.log('countryCodes', horseRacesData.countryCodes);

    const bulkOperations = [];
    for (const data of horseRacesData.meetings) {
      data.countryCodes = horseRacesData.countryCodes;
      data.sportsId = SportsId;
      bulkOperations.push({
        updateOne: {
          filter: { meetingId: data.meetingId },
          update: { $setOnInsert: data },
          upsert: true,
        },
      });
    }

    // Perform bulk write operation
    await Racing.bulkWrite(bulkOperations, { ordered: false });

    return res.json({
      success: true,
      message: 'Horse Race Records',
      results: horseRacesData,
    });
  } catch (error) {
    console.error(error);
    return res.status(200).json({
      success: false,
      message: 'Error retrieving Records',
    });
  }
}


async function racesTomorrowMeetings(req, res) {
  const SportsId = req.params.SportsId;
  try {
    const url = `${config.horseRaceUrl}/meetings/tomorrow/${SportsId}`;
    const response = await axios.get(url);

    const horseRacesData = response.data;
    console.log('horseRacesData', horseRacesData);
    console.log('meetings', horseRacesData.meetings);
    console.log('countryCodes', horseRacesData.countryCodes);

    const bulkOperations = [];
    for (const data of horseRacesData.meetings) {
      data.countryCodes = horseRacesData.countryCodes;
      data.sportsId = SportsId;

      bulkOperations.push({
        updateOne: {
          filter: { meetingId: data.meetingId },
          update: { $setOnInsert: data },
          upsert: true,
        },
      });
    }

    // Perform bulk write operation
    await Racing.bulkWrite(bulkOperations, { ordered: false });

    return res.json({
      success: true,
      message: 'Horse Race Records',
      results: horseRacesData,
    });
  } catch (error) {
    console.error(error);
    return res.status(200).json({
      success: false,
      message: 'Error retrieving Records',
    });
  }
}

loginRouter.get('/racesTodayMeetings/:SportsId', racesTodayMeetings);
loginRouter.get('/racesTomorrowMeetings/:SportsId', racesTomorrowMeetings);

module.exports = { loginRouter };
