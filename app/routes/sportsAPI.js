const express = require('express');
let config = require('config');
const axios = require('axios');
const ListCompetitions = require('../models/listCompetitions');
const Event = require('../models/eventsBySport');
const ListMarket = require('../models/listMarkets');
const Odds = require('../models/odds');
const inPlayEvents = require('../models/inPlayEvents');
const eventsByCompetitons = require('../models/eventsByCompetition');

const loginRouter = express.Router();

async function listCompetitions(req, res) {
  const sportId = req.params.sportId;
  const url = `${config.sportsAPIUrl}/listCompetitions/${sportId}`;

  try {
    const response = await axios.get(url);
    const competitionData = response.data;

    // Create an array to store the created Competition documents
    const competitions = [];

    // Iterate over the competitionData array and create a new Competition document for each competition
    for (const data of competitionData) {
      const existingCompetition = await ListCompetitions.findOne({ Id: data.Id, sportsId: sportId });

      if (existingCompetition) {
        competitions.push(existingCompetition);
      } else {
        const competition = new ListCompetitions({
          Id: data.Id,
          Name: data.Name,
          sportsId: sportId,
        });

        // Save the document to the database
        await competition.save();

        competitions.push(competition);
      }
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
    const response = await axios.get(`${config.sportsAPIUrl}/listEventsBySport/${sportId}`);
    console.log('response', response.data);
    const eventsData = response.data;
    const events = [];

    for (const eventData of eventsData) {
      const filter = { Id: eventData.Id, sportsId: sportId };
      const update = {
        $setOnInsert: {
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
          sportsId: sportId
        }
      };

      const options = { upsert: true, new: true };

      const updatedEvent = await Event.findOneAndUpdate(filter, update, options);
      events.push(updatedEvent);
    }

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


 //Id is eventId
 async function listEventsByCompetition(req, res) {
  const { sportId, competId } = req.params;
  const url = `${config.sportsAPIUrl}/listEventsByCompetition/${sportId}/${competId}`;

  try {
    const response = await axios.get(url);
    const events = response.data;
    console.log('events', events);

    const savedEvents = [];

    for (const event of events) {
      const filter = { sportsId: sportId, Id: event.Id };
      const update = { sportsId: sportId, ...event };
      const options = { upsert: true, new: true };

      const savedEvent = await eventsByCompetitons.findOneAndUpdate(filter, update, options);
      savedEvents.push(savedEvent);
    }

    res.status(200).json({
      success: true,
      message: 'Events retrieved and saved successfully',
      events: savedEvents,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get or save events',
      error: error.message,
    });
  }
}


async function listMarkets(req, res) {
  const eventId = req.params.eventId;
  const url = `${config.sportsAPIUrl}/listMarkets/${eventId}`;

  try {
    const response = await axios.get(url);
    console.log('response.data', response.data);
    const marketsData = response.data;
    const markets = [];

    // Get the event details from the eventsByCompetition model
    const eventDetails = await eventsByCompetitons.findOne({ Id: eventId });

    for (const marketData of marketsData) {
      const runners = marketData.runners.map((runnerData) => ({
        selectionId: runnerData.selectionId,
        runnerName: runnerData.runnerName,
      }));

      const filter = {
        marketId: marketData.marketId,
        eventId: eventId,
        sportsId: eventDetails.sportsId,
      };
      const update = {
        Updatetime: marketData.Updatetime,
        marketName: marketData.marketName,
        totalMatched: marketData.totalMatched,
        status: marketData.status,
        runners: runners,
      };
      const options = { upsert: true, new: true };

      // Update or create the market in the ListMarket model
      const savedMarket = await ListMarket.findOneAndUpdate(filter, update, options);
      markets.push(savedMarket);
    }

    res.status(200).json({
      success: true,
      message: 'Markets retrieved and saved successfully',
      markets: markets,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get or save markets',
      error: error.message,
    });
  }
}

async function listInplayEvents(req, res) {
  const sportsId = req.params.sportsId;
  const url = `${config.sportsAPIUrl}/listInplayEvents/${sportsId}`;

  try {
    const response = await axios.get(url);
    console.log('response', response.data);
    const inplayEvents = response.data;

    // Save the inplayEvents data to the collection
    const savedEvents = [];

    for (const event of inplayEvents) {
      const filter = { sportsId: sportsId, Id: event.Id };
      const update = { $set: { sportsId:sportsId }, $setOnInsert: event };
      const options = { upsert: true, new: true };

      const savedEvent = await inPlayEvents.findOneAndUpdate(filter, update, options);
      savedEvents.push(savedEvent);
    }

    res.status(200).json({
      success: true,
      message: 'Inplay events retrieved and saved successfully',
      inplayEvents: savedEvents,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get or save inplay events',
      error: error.message,
    });
  }
}

async function getOdds(req, res) {
  const marketIds = req.query.ids.split(',').slice(0, 20);

  if (marketIds.length > 20) {
    return res.status(400).json({
      success: false,
      message: 'Exceeded maximum limit of 20 market IDs',
    });
  }

  try {
    // Retrieve the existing marketIds from the "odds" collection
    const existingMarketIds = await Odds.find({ marketId: { $in: marketIds } }).distinct('marketId');

    // Filter out the existing marketIds from the requested marketIds
    const newMarketIds = marketIds.filter((marketId) => !existingMarketIds.includes(marketId));

    // Fetch the odds data for the new marketIds from the external API
    const url = `${config.sportsAPIUrl}/odds/?ids=${newMarketIds.join(',')}`;
    const response = await axios.get(url);
    console.log('response ===', response.data);
    console.log('response.data.data', response.data.data);

    const oddsData = response.data;

    // Create an array to store the new odds data
    const newOddsData = [];

    for (const data of oddsData) {
      console.log('data',data);
      console.log('data.runner',data.Runners);
      const market = await ListMarket.findOne({ MarketId: data.marketId });

      if (market) {
        const odds = new Odds({
          updatetime: data.updatetime,
          updatetime:data.update,
          sport: data.sport,
          eventId: data.eventId,
          marketId: data.MarketId,
          marketName: data.marketName,
          source: data.source,
          isMarketDataDelayed: data.IsMarketDataDelayed,
          status: data.Status ,
          isInplay: data.IsInplay,
          inplay: data.inplay ,
          numberOfRunners: data.NumberOfRunners,
          numberOfActiveRunners: data.NumberOfActiveRunners ,
          totalMatched: data.TotalMatched,
          sportsId: market.sportsId,
          runners: data.Runners 
        });

        newOddsData.push(odds);
      }
    }

    // Save the new odds data to the "odds" collection
    await Odds.insertMany(newOddsData);

    res.status(200).json({
      success: true,
      message: 'Odds retrieved and saved successfully',
      odds: newOddsData ? newOddsData: oddsData,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to get or save odds',
      error: error.message,
    });
  }
}


loginRouter.get('/listCompetition/:sportId', listCompetitions);
loginRouter.get('/listEventBySport/:sportId', listEventsBySport);
loginRouter.get(
  '/listEventByCompetition/:sportId/:competId',
  listEventsByCompetition
);
loginRouter.get('/listMarket/:eventId', listMarkets);
loginRouter.get('/listInplayEvent/:sportsId', listInplayEvents);
loginRouter.get('/getOdds', getOdds);

module.exports = { loginRouter };
