const express = require('express');
let config = require('config');
const axios = require('axios');

const loginRouter = express.Router();

async function listCompetitions(req, res) {
  const sportId = req.params.sportId; // Use req.query to retrieve the sportId parameter
  const url = `${config.sportsAPIUrl}/listCompetitions/${sportId}`;
  console.log('URL:', url);
  try {
    const response = await axios.get(url);
    console.log('Response:', response.data);
    const competitions = response.data;

    res.status(200).json({
      success: true,
      message: 'Competitions retrieved successfully',
      competitions: competitions,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get competitions',
      error: error.message,
    });
  }
}

async function listEventsBySport(req, res) {
  const sportId = req.params.sportId;

  try {
    const response = await axios.get(
      `${config.sportsAPIUrl}/listEventsBySport/${sportId}`
    );
    const events = response.data;

    res.status(200).json({
      success: true,
      message: 'Events retrieved successfully',
      events: events,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get events',
      error: error.message,
    });
  }
}

async function listEventsByCompetition(req, res) {
  const { sportId, competId } = req.params;
  const url = `${config.sportsAPIUrl}/listEventsByCompetition/${sportId}/${competId}`;
  console.log('URL:', url);
  try {
    const response = await axios.get(url);
    console.log('Response:', response.data);
    const events = response.data;

    res.status(200).json({
      success: true,
      message: 'Events retrieved successfully',
      events: events,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get events',
      error: error.message,
    });
  }
}

async function listMarkets(req, res) {
  const eventId = req.params.eventId;
  const url = `${config.sportsAPIUrl}/listMarkets/${eventId}`;

  try {
    const response = await axios.get(url);
    const markets = response.data;

    res.status(200).json({
      success: true,
      message: 'Markets retrieved successfully',
      markets: markets,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get markets',
      error: error.message,
    });
  }
}
async function listInplayEvents(req, res) {
  const sportsId = req.params.sportsId;
  const url = `${config.sportsAPIUrl}/listInplayEvents/${sportsId}`;

  try {
    const response = await axios.get(url);
    const inplayEvents = response.data;

    res.status(200).json({
      success: true,
      message: 'Inplay events retrieved successfully',
      inplayEvents: inplayEvents,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get inplay events',
      error: error.message,
    });
  }
}

async function getOdds(req, res) {
  const marketIds = req.query.ids.split(',').slice(0, 20).join(',');

  if (req.query.ids.split(',').length > 20) {
    return res.status(400).json({
      success: false,
      message: 'Exceeded maximum limit of 20 market IDs',
    });
  }

  const url = `${config.sportsAPIUrl}/odds/?ids=${marketIds}`;

  try {
    const response = await axios.get(url);
    const odds = response.data;

    res.status(200).json({
      success: true,
      message: 'Odds retrieved successfully',
      odds: odds,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get odds',
      error: error.message,
    });
  }
}

loginRouter.get('/listCompetitions/:sportId', listCompetitions);
loginRouter.get('/listEventsBySport/:sportId', listEventsBySport);
loginRouter.get(
  '/listEventsByCompetition/:sportId/:competId',
  listEventsByCompetition
);
loginRouter.get('/listMarkets/:eventId', listMarkets);
loginRouter.get('/listInplayEvents/:sportsId', listInplayEvents);
loginRouter.get('/getOdds', getOdds);

module.exports = { loginRouter };
