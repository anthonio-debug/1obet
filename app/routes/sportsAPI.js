const express = require('express');
let config = require('config');
const axios = require('axios');
const ListCompetitions = require('../models/listCompetitions');
const Event = require('../models/eventsBySport');
const ListMarket = require('../models/listMarkets');
const Odds = require('../models/odds');
const inPlayEvents = require('../models/inPlayEvents');
const eventsByCompetitons = require('../models/eventsByCompetition');
const rateLimit = require('express-rate-limit');

// Limit each IP to 60 requests per minute
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Too many requests from this IP, please try again later',
});

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
      const existingCompetition = await ListCompetitions.findOne({
        Id: data.Id,
        sportsId: sportId,
      });

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
    const response = await axios.get(
      `${config.sportsAPIUrl}/listEventsBySport/${sportId}`
    );
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
          sportsId: sportId,
        },
      };

      const options = { upsert: true, new: true };

      const updatedEvent = await Event.findOneAndUpdate(
        filter,
        update,
        options
      );
      events.push(updatedEvent);
    }

    if (res) {
      res.json({
        success: true,
        message: 'Events retrieved successfully',
        events: events,
      });
    }
  } catch (error) {
    console.error(error);
    if (res) {
      res.json({
        success: false,
        message: 'Failed to get events',
        error: error.message,
      });
    }
  }
}


//Id is eventId
async function listEventsByCompetition(req, res) {
  const { sportId, competId } = req.params;
  const url = `${config.sportsAPIUrl}/listEventsByCompetition/${sportId}/${competId}`;

  try {
    const response = await axios.get(url);
    const events = response.data;

    const savedEvents = [];

    for (const event of events) {
      const filter = { sportsId: sportId, Id: event.Id };
      const update = { sportsId: sportId, ...event };
      const options = { upsert: true, new: true };

      const savedEvent = await eventsByCompetitons.findOneAndUpdate(
        filter,
        update,
        options
      );
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
    const marketsData = response.data;
    // const markets = [];

    // Get the event details from the eventsByCompetition model
    const eventDetails = await inPlayEvents.findOne({ Id: eventId });

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

    //   // Update or create the market in the ListMarket model
      const savedMarket = await ListMarket.findOneAndUpdate(
        filter,
        update,
        options
      );
      markets.push(savedMarket);
    }

    res.status(200).json({
      success: true,
      message: 'Markets retrieved and saved successfully',
      markets: marketsData,
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
    const inplayEvents = response.data;

    // Save the inplayEvents data to the collection
    const savedEvents = [];

    for (const event of inplayEvents) {
      const filter = { sportsId: sportsId, Id: event.Id };
      const update = { $set: { sportsId: sportsId }, $setOnInsert: event };
      const options = { upsert: true, new: true };

      const savedEvent = await inPlayEvents.findOneAndUpdate(
        filter,
        update,
        options
      );
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
  // Apply rate limiting middleware to the API
  limiter(req, res, async () => {
    // marketIds can be more than 20, but only takes the first 20 market IDs in the request:
    const marketIds = req.query.ids.split(',').slice(0, 20);

    try {
      const url = `${config.sportsAPIUrl}/odds/?ids=${marketIds.join(',')}`;
      const response = await axios.get(url);

      const oddsData = response.data;

      for (const data of oddsData) {

        const market = await ListMarket.findOne({ marketId: data.MarketId });

        if (market) {
          await Odds.updateOne(
            { eventId: data.eventId, marketId: data.MarketId },
            {
              $set: {
                updatetime: data.updatetime,
                update: data.update,
                sport: data.sport,
                eventId: data.eventId,
                marketId: data.MarketId,
                marketName: data.marketName,
                source: data.source,
                isMarketDataDelayed: data.IsMarketDataDelayed,
                status: data.Status,
                isInplay: data.IsInplay,
                inplay: data.inplay,
                numberOfRunners: data.NumberOfRunners,
                numberOfActiveRunners: data.NumberOfActiveRunners,
                totalMatched: data.TotalMatched,
                sportsId: market.sportsId,
                runners: data.Runners,
              },
            },
            { upsert: true, new: true }
          );
        }
      }

      res.status(200).json({
        success: true,
        message: 'Odds retrieved and saved successfully',
        odds: oddsData,
      });
    } catch (error) {
      console.error(error);
      res.status(200).json({
        success: false,
        message: 'Failed to get or save odds',
        error: error.message,
      });
    }
  });
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

module.exports = { loginRouter,getOdds, listEventsBySport,listInplayEvents,listEventsByCompetition,listMarkets };
