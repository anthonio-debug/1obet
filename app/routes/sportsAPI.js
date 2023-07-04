const express = require('express');
let config = require('config');
const axios = require('axios');
const ListCompetitions = require('../models/listCompetitions');
const Event = require('../models/events');
const ListMarket = require('../models/listMarkets');
const Odds = require('../models/odds');

const loginRouter = express.Router();

async function listCompetitions(req, res) {
  const sportId = req.params.sportId; // Use req.query to retrieve the sportId parameter
  const url = `${config.sportsAPIUrl}/listCompetitions/${sportId}`;
  console.log('URL:', url);
  try {
    const response = await axios.get(url);
    console.log('Response:', response.data);
    const competitionData = response.data;

    // Create an array to store the created Competition documents
    const competitions = [];

    // Iterate over the competitionData array and create a new Competition document for each competition
    for (const data of competitionData) {
      const competition = new ListCompetitions({
        Id: data.Id,
        Name: data.Name,
      });

      // Save the document to the database
      await competition.save();

      competitions.push(competition);
    }

    res.status(200).json({
      success: true,
      message: 'Competitions retrieved and saved successfully',
      competitions: competitions,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to retrieve and save competitions',
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
    console.log('response', response.data);
    const eventsData = response.data;
    const events = [];

    for (const eventData of eventsData) {
      const event = new Event({
        sport: eventData.sport,
        competitionId: eventData.competitionId,
        competitionName: eventData.competitionName,
        Id: eventData.Id,
        name: eventData.name,
        countryCode: eventData.countryCode,
        timezone: eventData.timezone,
        openDate: new Date(eventData.openDate),
        inplay: eventData.inplay,
        hasFancy: eventData.hasFancy,
        status: eventData.status,
        isPremium: eventData.isPremium,
      });

      events.push(event);
    }

    // Save all events to the database
    await Event.insertMany(events);

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
    console.log('response', response.data);
    const marketsData = response.data;
    const markets = [];

    for (const marketData of marketsData) {
      const runners = marketData.runners.map((runnerData) => ({
        selectionId: runnerData.selectionId,
        runnerName: runnerData.runnerName,
      }));

      const market = new ListMarket({
        Updatetime: marketData.Updatetime,
        marketId: marketData.marketId,
        marketName: marketData.marketName,
        totalMatched: marketData.totalMatched,
        status: marketData.status,
        runners: runners,
      });

      markets.push(market);
    }

    // Save all markets to the database
    await ListMarket.insertMany(markets);

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
    console.log('response', response.data);
    const oddsData = response.data;
    const odds = new Odds({
      updatetime: oddsData.updatetime,
      marketId: oddsData.marketId,
      marketName: oddsData.marketName,
      totalMatched: oddsData.totalMatched,
      status: oddsData.status,
      runners: oddsData.runners,
    });
    // Save the odds data to the Odds model
    await odds.save();

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
