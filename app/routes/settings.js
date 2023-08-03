const express = require('express');
var jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const Settings = require('../models/settings');
const moment = require('moment');
const User = require('../models/user');
const settingsValidation = require('../validators/settings');
const termsAndConditions = require('../models/termsAndConditions');
const PrivacyPolicy = require('../models/privacyPolicy');
const Competition = require('../models/listCompetitions');
const Odds = require('../models/odds');
const Exchanges = require('../models/exchanges');
const MaxBetSize = require('../models/betLimits');
const SideBarMenu = require('../models/sidebarMenu');
const Events = require('../models/events');
const EventBySports = require('../models/eventsBySport');
const config = require('config')
const axios = require('axios');
const FancyGames = require('../models/fancyGames');
const Racing = require('../models/racing');
const RaceMarkets = require('../models/raceMarkets');
const RaceOdds = require('../models/raceOdds');
const loginRouter = express.Router();
const router = express.Router();
process.env.TZ = 'UTC';

const SelectedCasino = require('../models/selectedCasino');

function updateDefaultTheme(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role !== '0') {
    return res
      .status(404)
      .send({ message: 'only company can add default theme' });
  }
  Settings.findOneAndUpdate(
    { _id: req.body._id },
    { $set: { defaultThemeName: req.body.defaultThemeName } },
    { new: true },
    (err, theme) => {
      if (err || !theme) {
        return res.status(404).send({ message: 'theme not found' });
      }

      return res.send({
        success: true,
        message: 'Theme updated successfully',
        results: theme,
      });
    }
  );
}

function updateDefaultLoginPage(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role !== '0') {
    return res
      .status(404)
      .send({ message: 'only company can add default login page' });
  }

  Settings.findOneAndUpdate(
    { _id: req.body._id },
    { $set: { defaultLoginPage: req.body.defaultLoginPage } },
    { new: true },
    (err, loginPage) => {
      if (err || !loginPage) {
        return res.status(404).send({ message: 'loginPage not found' });
      }

      return res.send({
        success: true,
        message: 'Default Login Page added successfully',
        results: loginPage,
      });
    }
  );
}

function addTermsAndConditions(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role !== '0') {
    return res
      .status(404)
      .send({ message: 'only company can add terms and conditions' });
  }
  //server _id
  termsAndConditions.findOneAndUpdate(
    { _id: '6460b601fe9cc89998d9eb29' },
    { $set: { termAndConditionsContent: req.body.termAndConditionsContent } },
    { new: true },
    (err, results) => {
      if (err || !results) {
        return res.status(404).send({ message: 'Data Not Saved' });
      }
      return res.send({
        success: true,
        message: 'Terms And Conditions Added Successfully',
        results: results,
      });
    }
  );
}

function GetAllTermsAndConditions(req, res) {
  // if (req.decoded.role !== '0') {
  //   return res
  //     .status(404)
  //     .send({ message: 'only company can see terms and conditions' });
  // }
  termsAndConditions
    .findOne(
      {},
      { termAndConditionsContent: 1, createdAt: 1, updatedAt: 1, _id: 1 }
    )
    .sort({ _id: -1 })
    .exec((err, success) => {
      if (err || !success)
        return res.status(404).send({ message: 'Record Not Found' });
      else
        return res.send({
          success: true,
          message: 'Terms And Conditions Record Found',
          results: success,
        });
    });
}

function addPrivacyPolicy(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role !== '0') {
    return res
      .status(404)
      .send({ message: 'only company can add privacy policies' });
  }

  //server _id
  PrivacyPolicy.findOneAndUpdate(
    { _id: '64647166707979d7b58f4417' },
    { $set: { privacyPolicyContent: req.body.privacyPolicyContent } },
    { new: true },
    (err, results) => {
      if (err || !results) {
        return res.status(404).send({ message: 'Data Not Saved' });
      }

      return res.send({
        success: true,
        message: 'Privacy Policy Added Successfully',
        results: results,
      });
    }
  );
}

function GetAllPrivacyPolicy(req, res) {
  // if (req.decoded.role !== '0') {
  //   return res
  //     .status(404)
  //     .send({ message: 'only company can see privacy policies' });
  // }
  PrivacyPolicy.findOne(
    {},
    { privacyPolicyContent: 1, createdAt: 1, updatedAt: 1, _id: 1 }
  )
    .sort({ _id: -1 })
    .exec((err, success) => {
      if (err || !success)
        return res.status(404).send({ message: 'Record Not Found' });
      else
        return res.send({
          success: true,
          message: 'Privacy Policy Record Found',
          results: success,
        });
    });
}

function updateDefaultExchange(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role !== '0') {
    return res
      .status(404)
      .send({ message: 'only company can add default exchange rate' });
  }

  const exchangeRates = req.body.exchangeRates;

  const updatedExchangeRates = exchangeRates.map((exchangeRates) => ({
    updateOne: {
      filter: { _id: exchangeRates._id },
      update: {
        $set: {
          currency: exchangeRates.currency,
          exchangeAmount: exchangeRates.exchangeAmount,
        },
      },
      upsert: false,
    },
  }));

  Exchanges.bulkWrite(
    updatedExchangeRates,
    { ordered: false },
    (err, exchanges) => {
      if (err || !exchanges) {
        return res.status(404).send({ message: 'exchanges not found' });
      }
      return res.send({
        success: true,
        message: 'Exchange Rate updated successfully',
      });
    }
  );
}

function GetExchangeRates(req, res) {
  Exchanges.find({}, (err, success) => {
    if (err || !success)
      return res.status(404).send({ message: 'Record Not Found' });
    return res.send({
      success: true,
      message: 'Exchange Rates Record Found',
      results: success,
    });
  });
}

function updateDefaultBetSizes(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  if (req.decoded.role !== '0') {
    return res
      .status(404)
      .json({ message: 'Only company can add default bet sizes' });
  }

  const { betLimits } = req.body;

  const updatePromises = betLimits.map((betLimit) => {
    return MaxBetSize.findOneAndUpdate(
      { _id: betLimit._id },
      { $set: { maxAmount: betLimit.maxAmount } },
      { new: true, upsert: true }
    );
  });

  Promise.all(updatePromises)
    .then((updatedBetLimits) => {
      return res.json({
        success: true,
        message: 'Max bet sizes updated successfully',
        results: updatedBetLimits,
      });
    })
    .catch((err) => {
      console.log('err', err);
      return res.status(500).json({ message: 'Server error' });
    });
}

function getDefaultBetSizes(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  if (req.decoded.role !== '0') {
    return res.status(404).json({ message: 'Unauthrized' });
  }
  MaxBetSize.find({}, (err, results) => {
    if (err) {
      return res.status(404).json({ message: 'bet sizes not found' });
    }
    return res.json({
      success: true,
      message: 'Max bet sizes Found successfully',
      results: results,
    });
  });
}

function getDefaultSettings(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  Settings.find({}, (err, results) => {
    if (err) {
      return res.status(404).json({ message: 'settings not found' });
    }
    return res.json({
      success: true,
      message: 'Setting Data Found successfully',
      results: results,
    });
  });
}

async function updateMatchType(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      return res.status(400).send({ errors: errors.errors });
  }
  try {
    const {_id, matchType, iconStatus } = req.body;
     Events.findByIdAndUpdate(
        _id,
        { $set: { matchType: matchType, iconStatus: iconStatus } },
          (err, updatedMatch) => {
              if (err) {
                  console.log("Error updating figure:", err);
              } else {
                  console.log("Updated match:", updatedMatch);
              }
          }
      );
      res.status(200).json({
          success: true,
          message: 'Updated Successfully'
      });


  }catch (error) {
      console.error(error);
      res.status(200).json({
          success: false,
          message: 'Failed to save fancy data',
          error: error.message,
      });
  }
}

function getSideBarMenu(req, res) {
  let type = [];
  if (req.decoded.role == 5) {
    type = [0];
  } else if (req.decoded.role == 0) {
    type = [1, 2];
  } else {
    type = [1];
  }
  SideBarMenu.find({ type: { $in: type } }, (err, results) => {
    if (err) {
      return res.status(404).json({ message: 'settings not found' });
    }
    return res.json({
      success: true,
      message: 'Side Bar Menu Records',
      results: results,
    });
  });
}

async function listCompetitions(req, res) {
  const sportId = req.params.id;

  try {
    const competitions = await Competition.find({ sportsId: sportId });

    res.status(200).json({
      success: true,
      message: 'Records',
      results: competitions,
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
  const sportId = req.query.id;
  try {
    let start;
    let end;
    let events; 
    if(sportId == '4' || sportId == '2' || sportId == '1' ){
      start  = moment(new Date(Date.now())).format("M/DD/YYYY h:mm:ss A +00:00");
      end    = moment(new Date(Date.now() +  24 *  60 * 60 * 1000)).format("M/DD/YYYY h:mm:ss A +00:00");

    }else if (sportId == '7' || sportId == '4339'){

      start = moment(new Date(Date.now())).format("YYYY-MM-DDThh:mm:ss+00:00");
      end   = moment(new Date(Date.now() + 6 *  60 * 60 * 1000)).format("YYYY-MM-DDThh:mm:ss+00:00");

    }
    console.log("start== ", start);
    console.log("end== ", end);
    console.log("sportId == ", sportId);

    if(sportId == "4"){
      events = await Events.find({
        sportsId: sportId,
        iconStatus: true,
        $or: [
          { inplay: true },
          { 
            $and: [
              { openDate: { $gt: start } },
              { openDate: { $lt: end } }
            ]
          }
        ]
      }).sort({ openDate: 1 });
    }else{
      events = await Events.find({
        sportsId: sportId,
        $or: [
          { inplay: true },
          { 
            $and: [
              { openDate: { $gt: start } },
              { openDate: { $lt: end } }
            ]
          }
        ]
      }).sort({ openDate: 1 });
    }
    res.status(200).json({
      success: true,
      message: 'Event By Sports Records',
      results: events,
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
  const { sportsId, competitionId } = req.params;
  try {
    const events = await EventBySports.find({
      sportsId: sportsId,
      competitionId: competitionId,
      type: "eventsByCompetitions"
    });

    res.status(200).json({
      success: true,
      message: 'Event By Competitions Records',
      results: events,
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

async function listInplayEvents(req, res) {
  const sportsId = req.query.ids.split(',');;
  try {
    const inplayEvents = await Events.find({ sportsId: { $in: sportsId } });

    res.status(200).json({
      success: true,
      message: 'Records',
      results: inplayEvents,
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

async function listOddsAPI(req, res) {
  try {
    const eventIds = req.query.ids
    // const odds = await Odds.find({ eventId: { $in: eventIds } });
    const odds = await Odds.aggregate([
      { $match: { eventId: eventIds } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$marketName", odds: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$odds" } }
    ]).exec()
    // const url = `${config.liveTvUrl}/get_live_tv_url/${eventIds}`;
    // const liveTVResponse = await axios.get(url);
    // const liveTVData = liveTVResponse.data;
    const fancyData = await FancyGames.findOne({ eventId: { $in: eventIds } }).sort({ createdAt: -1 })

    console.log('fancyData', fancyData);

    let livesportscoreData = {}

    const event = await Events.findOne({ Id: eventIds }, { _id: 0, matchType: 1, sportsId: 1,name:1,openDate:1,status:1,inplay:1 });
      const type = event ? event.sportsId : null;
      if(type == 4){
        livesportscoreData = await cricketLiveScore(eventIds)
      }else{
        livesportscoreData = await otherLiveScore(eventIds)
      }
    // console.log('liveTVResponse', liveTVResponse);
    return res.json({
      success: true,
      message: 'Records',
      results: {
        odds,
        fancyData: fancyData ? [fancyData] : [],
        livesportscoreData,
        matchData: event
      },
    });
  } catch (error) {
    console.error('Error retrieving odds:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving odds',
    });
  }
}


// const getOddsCronJob = () => {
//   // Cron job to run getOdds every second
//   cron.schedule('* * * * * *', async () => {
//     try {
//       const response = await listOddsAPI(req, res);
//       console.log('log', response);
//       const odds = response.results;
//       await getOdds(odds);
//     } catch (error) {
//       console.error('Error running getOdds cron job:', error);
//     }
//   });
// };

//for only backend
function addSideBarMenu(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role !== '0') {
    return res.status(404).send({ message: 'you are not authorized' });
  }
  const menu = new SideBarMenu(req.body);
  menu.save((err, results) => {
    if (err)
      return res.status(404).send({ message: 'side bar menu not saved' });
    return res.send({ message: 'menu record saved', results });
  });
}

async function racesAPI(req, res) {
  try {
    const id = req.params.id;
    const racesData = await Events.find(
      { sportsId: id },
      { meetingId:1,countryCode:1,countryCodes:1,eventTypeId:1,races:1,venue:1,sportsId: 1 }) 
      
      return res.json({
        success: true,
        message: 'Records',
        results: racesData,
      });
  } catch (err) {
    console.error(err);
    return res.json({
      success: false,
      message: 'error',
    });
  }
}

async function cricketLiveScore(id) {
  try {
    const apiResponse =  await   axios.get(`https://livesportscore.xyz:3440/api/bf_scores/${id}`);
    const data = apiResponse.data;
    const response = {};
    if(typeof(data[0]) == "string"){
      const event = await Events.findOne({ Id: id }, { _id: 0, matchType: 1, sportsId: 1 });
      const type = event ? event.matchType : null;
      const scoreInfo     = JSON.parse(data).score
      let score           = scoreInfo.score1;
      let played          = scoreInfo.score2;
      response.spnnation1 = scoreInfo.spnnation1;
      response.spnnation2 = scoreInfo.spnnation2;

      if(scoreInfo.activenation1 == 1){
          response.team   =  scoreInfo.spnnation1
          response.crr    = scoreInfo.spnrunrate1.substring(scoreInfo.spnrunrate1.indexOf(' ') + 1).trim()

      }
      else if(scoreInfo.activenation2 == 1){
          response.team    = scoreInfo.spnnation2;
          response.crr     = scoreInfo.spnrunrate2.substring(scoreInfo.spnrunrate2.indexOf(' ') + 1).trim()
          score            = scoreInfo.score2;
          played           = scoreInfo.score1;
      }
  
      response.type   = type
      response.balls  = scoreInfo.balls

      if(type == "TEST"){
          score = score.split('&');
          score = score[score.length - 1].trim()
          played = played.split('&');
          played = played[played.length - 1].trim();
      }
      played = played.replaceAll(/[\s-]/g, ',').replaceAll(/[())]/g, '').split(',');
      played = played.filter(element => element != 0).length;
      if(played > 0){
          response.secondInnings  = 1;
          response.spnmessage =  scoreInfo.spnmessage
           
          if(scoreInfo.activenation2 == 1){
              target = scoreInfo.score1 ? scoreInfo.score1 : ""
          }else if(scoreInfo.activenation1 == 1){
              target = scoreInfo.score2 ? scoreInfo.score2 : ""
          }

          response.target  = (parseInt(target.replaceAll(/[\s-]/g, ',').replaceAll(/[())]/g, '').split(',')[0]) + 1).toString();
          if(scoreInfo.spnreqrate1 != null && scoreInfo.spnreqrate1 != "" ){
              response.rrr = scoreInfo.spnreqrate;
          }
          else if(scoreInfo.spnreqrate2 != null && scoreInfo.spnreqrate2 != ""){
              response.rrr = scoreInfo.spnreqrate2;
          }
      }
      [response.score, response.wickets, response.overs] = score.replaceAll(/[\s-]/g, ',').replaceAll(/[())]/g, '').split(',');
      return response
    }else{
      return data[0]
    }
  } catch (error) {
      console.error(error);
      return {
          success: false,
          message: 'Failed to get data',
          error: error.message,
      };
  }
}

async function otherLiveScore(id) {
  try {
    const apiResponse =  await   axios.get(`https://livesportscore.xyz:3440/api/bf_scores/${id}`);
    const data        = apiResponse.data;
    if(typeof(data[0]) == "string"){
      // const event = await Events.findOne({ Id: id }, { _id: 0, matchType: 1, sportsId: 1 });
      return JSON.parse(data)
    }else{
      return data[0]
    }
  } catch (error) {
      console.error(error);
      return {
          success: false,
          message: 'Failed to get data',
          error: error.message,
      };
  }
}


async function racesMarketList(req, res) {
  try {
    const projectionRacesMarketsData = {
      'eventNodes.marketNodes.state': 1,
      'eventNodes.marketNodes.description.marketName': 1,
      'eventNodes.marketNodes.description.marketTime': 1,
      'eventNodes.marketNodes.description.suspendTime': 1,
      'eventNodes.marketNodes.description.turnInPlayEnabled': 1,
      'eventNodes.marketNodes.description.marketType': 1,
      'eventNodes.marketNodes.description.raceNumber': 1,
      'eventNodes.marketNodes.description.raceType': 1,
      'eventNodes.marketNodes.description.bettingType': 1,
      'eventNodes.marketNodes.runners.selectionId': 1,
      'eventNodes.marketNodes.runners.description.runnerName': 1,
      'eventNodes.marketNodes.runners.description.metadata.SIRE_NAME': 1,
      'eventNodes.marketNodes.runners.description.metadata.CLOTH_NUMBER_ALPHA': 1,
      'eventNodes.marketNodes.runners.description.metadata.COLOURS_DESCRIPTION': 1,
      'eventNodes.marketNodes.runners.description.metadata."COLOURS_FILENAME': 1,
      'eventNodes.marketNodes.runners.description.metadata.OWNER_NAME': 1,
      'eventNodes.marketNodes.runners.description.metadata.JOCKEY_NAME': 1,
      'eventNodes.marketNodes.runners.description.metadata.CLOTH_NUMBER': 1,
      'eventNodes.marketNodes.runners.description.metadata.TRAINER_NAME': 1,
      'eventNodes.event.eventName': 1
    };

    const projectionRaceOddsData = {
      'marketId': 1,
      'isMarketDataDelayed': 1,
      'state.betDelay': 1,
      'state.startTime': 1,
      'state.remainingTime': 1,
      'state.complete': 1,
      'state.inplay': 1,
      'state.numberOfWinners': 1,
      'state.numberOfRunners': 1,
      'state.numberOfActiveRunners': 1,
      'state.lastMatchTime': 1,
      'state.totalMatched': 1,
      'state.totalAvailable': 1,
      'state.status':1,
      'runners.selectionId':1,
      'runners.state.lastPriceTraded':1,
      'runners.state.totalMatched':1,
      'runners.state.lastPriceTraded':1,
      'runners.state.status':1,
      'runners.exchange':1,


      // Add any other fields you want to exclude from raceOddsData
    };
    const racesMarketsData = await RaceMarkets.findOne({'eventNodes.marketNodes.marketId': req.params.marketId },);
    const raceOddsData = await RaceOdds.findOne({ marketId: req.params.marketId },projectionRaceOddsData).sort({_id: -1})
    console.log('racesMarketsData ==>', racesMarketsData)
    console.log('raceOddsData ==>', raceOddsData)      
    if ( raceOddsData?.runners && Array.isArray(raceOddsData?.runners) && racesMarketsData?.eventNodes && Array.isArray(racesMarketsData?.eventNodes)){
      const marketNode = racesMarketsData?.eventNodes?.find((eventNode) => eventNode?.marketNodes?.marketId === raceOddsData.marketId);
      if (marketNode && marketNode?.marketNodes?.runners && Array.isArray(marketNode?.marketNodes?.runners)) {
        const mergedRunners = {};
        raceOddsData?.runners.forEach((runner) => {
          const matchingRunner = marketNode?.marketNodes?.runners.find((r) => r.selectionId === runner?.selectionId);
          if (matchingRunner) {
            mergedRunners[runner?.selectionId] = {
              ...runner,
              ...matchingRunner,
            };
          }
        });
        // Update the merged runners data into the raceOddsData object
        raceOddsData.runners = Object.values(mergedRunners);
      } else {
        console.error('Invalid data structure. Market runners data not found.');
      }
    } else {
      console.error('Invalid data structure. Please check the provided objects.');
    }

    // console.log('racesMarketsData', racesMarketsData);
    console.log('raceOddsData ===>', raceOddsData)
    return res.send({
      success: true,
      message: 'Records',
      results: {
        racesMarketsData,
        raceOddsData
      }
    });
  } catch (error) {
    console.error('Error retrieving races:', error);
    return res.send({
      success: false,
      message: 'Error retrieving races',
    });
  }
}

function updateMatch(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role !== '0') {
    return res
      .status(404)
      .send({ message: 'only company can add default theme' });
  }
  const { _id, updateType, matchStoppedReason, matchCanceledStatus, matchResumedStatus } = req.body;

  let query = {};
  let updateField = {};
  let successMessage = '';

  switch (updateType) {
    case 'stopped':
      // Check if the match is already stopped
      query = { _id };
      Events.findOne(query, (err, foundMatch) => {
        if (err || !foundMatch) {
          return res.status(400).json({
            success: false,
            message: 'Failed to find match data',
            error: err,
          });
        }

        // if (foundMatch.matchStopStatus === true) {
        //   return res.status(400).json({
        //     success: false,
        //     message: 'This match is already stopped.',
        //   });
        // }

        // Proceed with stopping the match
        updateField = {
          matchStoppedReason: matchStoppedReason,
          matchStopStatus: true,
          matchResumedStatus: false, // Ensure it's not resumed when stopped
          matchCanceledStatus:matchCanceledStatus
        };

        successMessage = 'Match stopped successfully';

        Events.findOneAndUpdate(
          { _id },
          { $set: updateField },
          (err, updatedMatch) => {
            if (err || !updatedMatch) {
              return res.status(400).json({
                success: false,
                message: 'Failed to update match data',
                error: err,
              });
            } else {
              res.status(200).json({
                success: true,
                message: successMessage,
              });
            }
          }
        );
      });
      break;

    case 'resumed':
      // Check if the match is already resumed
      query = { _id };
      Events.findOne(query, (err, foundMatch) => {
        if (err || !foundMatch) {
          return res.status(400).json({
            success: false,
            message: 'Failed to find match data',
            error: err,
          });
        }

        // if (foundMatch.matchResumedStatus === true) {
        //   return res.status(400).json({
        //     success: false,
        //     message: 'This match is already resumed.',
        //   });
        // }

        // Proceed with updating the match as resumed
        if (matchResumedStatus === false) {
          updateField.matchStopStatus = true;
        } else if (matchResumedStatus === true) {
          updateField.matchStopStatus = false;
          updateField.matchStoppedReason = '';
        }
        updateField.matchResumedStatus = matchResumedStatus;
        successMessage = 'Match resumed successfully';

        Events.findOneAndUpdate(
          { _id},
          { $set: updateField },
          (err, updatedMatch) => {
            if (err || !updatedMatch) {
              return res.status(400).json({
                success: false,
                message: 'Failed to update match data',
                error: err,
              });
            } else {
              res.status(200).json({
                success: true,
                message: successMessage,
              });
            }
          }
        );
      });
      break;

    case 'canceled':
      query = { _id };
      // Update only the matchCanceledStatus
      updateField = { matchCanceledStatus };
      successMessage = 'Match canceled status updated successfully';

      Events.findOneAndUpdate(
        query,
        { $set: updateField },
        (err, updatedMatch) => {
          if (err || !updatedMatch) {
            return res.status(400).json({
              success: false,
              message: 'Failed to update match data',
              error: err,
            });
          } else {
            res.status(200).json({
              success: true,
              message: successMessage,
            });
          }
        }
      );
      break;

    default:
      return res.status(400).json({
        success: false,
        message: 'Invalid update type',
      });
  }
}

async function bettorDashboardGames(req, res) {
  try {
    const sportsIdArray = ['1', '2', '4', '7', '4339'];
    const inplayIdArray = ['1', '2', '4'];

    const events = await Events.aggregate([
      {
        $match: {
          $or: [
            { sportsId: { $in: sportsIdArray } },
            { inplay: true, sportsId: { $in: inplayIdArray, $nin: ['7', '4339'] } },
          ],
        },
      },
      {
        $facet: {
          soccer: [
            { $match: { sportsId: '1' } },
            { $sort: { inplay: -1 } },
          ],
          tennis: [
            { $match: { sportsId: '2' } },
            { $sort: { inplay: -1 } },
          ],
          cricket: [
            { $match: { sportsId: '4', iconStatus: true } },
            { $sort: { inplay: -1 } },
          ],
          horseRace: [
            { $match: { sportsId: '7' } },
          ],
          greyhound: [
            { $match: { sportsId: '4339' } }
          ],
          inplay: [
            { $match: { inplay: true, sportsId: { $in: inplayIdArray } } },
          ],
        },
      },
    ]).exec();

    const selectedCasinoData = await SelectedCasino.find({"isDashboard":true});

    const organizedEvents = {
      soccer: events[0].soccer,
      tennis: events[0].tennis,
      cricket: events[0].cricket,
      horseRace: events[0].horseRace,
      greyhound: events[0].greyhound,
      inplay: events[0].inplay,
      casinoData: selectedCasinoData,
    };

    res.status(200).json({
      success: true,
      message: 'Event By Sports Records',
      results: organizedEvents,
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



// async function bettorDashboardGames(req, res) {
//   try {
//     const sportsIdArray = ['1', '2', '4', '7', '4339'];
//     const inplayIdArray = ['1', '2', '4'];
//     let events,inplay;
//     // if (inplay === true || inplay === 'true') {
//     //   events = await Events.find({ inplay: true, sportsId: { $in: sportsIdArray, $nin: ['7', '4339'] } });
//     // } else {
//       events = await Events.find({ sportsId: { $in: sportsIdArray } }).sort({ inplay: -1 });
//     // }
//     // console.log('events',events);
//     const inplayEvents = await Events.find({ inplay: true, sportsId: { $in: inplayIdArray} });
//     const selectedCasinoData = await SelectedCasino.find({});

//     // const organizedEvents = {
//     //   soccer: [],
//     //   tennis: [],
//     //   cricket: [],
//     //   horseRace: [],
//     //   greyhound: [],
//     //   inplay: [],
//     //   casinoData: selectedCasinoData,
//     // };
// const filterCricketData =  events?.filter((item)=> item?.sportsId==='4')?.filter((z)=>z?.iconStatus==true)
// const soccerData = events?.filter((item)=> item.sportsId==='1')
// const tenissData =  events?.filter((item)=> item?.sportsId==='2')
// const horseRAceData = events?.filter((item)=> item?.sportsId==='7')
// const greyhoundData = events?.filter((item)=> item?.sportsId==='4339')
// // const inplayData =  events?.filter((item)=> item?.inplay==true)
// const organizedEvents = {
//   soccer: soccerData,
//   tennis: tenissData,
//   cricket: filterCricketData,
//   horseRace: horseRAceData,
//   greyhound: greyhoundData,
//   inplay: Events,
//   casinoData: selectedCasinoData,
// };
//     // events.forEach((event) => {
//     //   if (event.sportsId === '1') {
//     //     organizedEvents.soccer.push(event);
//     //   } else if (event.sportsId === '2') {
//     //     organizedEvents.tennis.push(event);
//     //   } else if (event.sportsId === '4') {
//     //     organizedEvents.cricket.push(event);
//     //   } else if (event.sportsId === '7') {
//     //     organizedEvents.horseRace.push(event);
//     //   } else if (event.sportsId === '4339') {
//     //     organizedEvents.greyhound.push(event);
//     //   }

//     //   if (event.inplay === true) {
//     //     organizedEvents.inplay.push(event);
//     //   }
//     // });

//     res.status(200).json({
//       success: true,
//       message: 'Event By Sports Records',
//       results: organizedEvents,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(200).json({
//       success: false,
//       message: 'Failed to get events',
//       error: error.message,
//     });
//   }
// }
// async function bettorDashboardGames(req, res) {
//   try {
//     const sportsIdArray = ['1', '2', '4', '7', '4339'];
//     const inplayIdArray = ['1', '2', '4'];
//     let events,inplay;
//     // if (inplay === true || inplay === 'true') {
//     //   events = await Events.find({ inplay: true, sportsId: { $in: sportsIdArray, $nin: ['7', '4339'] } });
//     // } else {
//       events = await Events.find({ sportsId: { $in: sportsIdArray } })
//     // }
//     console.log('events',events);
//     const selectedCasinoData = await SelectedCasino.find({});

//     // const organizedEvents = {
//     //   soccer: [],
//     //   tennis: [],
//     //   cricket: [],
//     //   horseRace: [],
//     //   greyhound: [],
//     //   inplay: [],
//     //   casinoData: selectedCasinoData,
//     // };
// const filterCricketData =  events?.filter((item)=> item?.sportId==='4')?.filter((z)=>z?.iconStatus==true)?.sort((a, b)=> Number(b?.inplay)- Number(a.inplay))
// const soccerData = events?.filter((item)=> item.sportId==='1')?.sort((a, b)=> Number(b?.inplay)- Number(a.inplay))
// const tenissData =  events?.filter((item)=> item?.sportId==='2')?.sort((a, b)=> Number(b?.inplay)- Number(a.inplay))
// const horseRAceData = events?.filter((item)=> item?.sportId==='7')
// const greyhoundData = events?.filter((item)=> item?.sportId==='4339')
// const inplayEvents = events?.filter((item)=> item?.inplay===true)?.sort((a, b)=> Number(b?.inplay)- Number(a.inplay))

// // const inplayEvents = await Events.find({ inplay: true, sportsId: { $in: inplayIdArray} });

// // const inplayData =  events?.filter((item)=> item?.inplay==true)
// const organizedEvents = {
//   soccer: soccerData,
//   tennis: tenissData,
//   cricket: filterCricketData,
//   horseRace: horseRAceData,
//   greyhound: greyhoundData,
//   inplay: Events,
//   casinoData: selectedCasinoData,
// };
//     // events.forEach((event) => {
//     //   if (event.sportsId === '1') {
//     //     organizedEvents.soccer.push(event);
//     //   } else if (event.sportsId === '2') {
//     //     organizedEvents.tennis.push(event);
//     //   } else if (event.sportsId === '4') {
//     //     organizedEvents.cricket.push(event);
//     //   } else if (event.sportsId === '7') {
//     //     organizedEvents.horseRace.push(event);
//     //   } else if (event.sportsId === '4339') {
//     //     organizedEvents.greyhound.push(event);
//     //   }

//     //   if (event.inplay === true) {
//     //     organizedEvents.inplay.push(event);
//     //   }
//     // });

//     res.status(200).json({
//       success: true,
//       message: 'Event By Sports Records',
//       results: organizedEvents,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(200).json({
//       success: false,
//       message: 'Failed to get events',
//       error: error.message,
//     });
//   }
// }


loginRouter.post(
  '/updateDefaultTheme',
  settingsValidation.validate('updateDefaultTheme'),
  updateDefaultTheme
);
loginRouter.post(
  '/updateDefaultLoginPage',
  settingsValidation.validate('updateDefaultLoginPage'),
  updateDefaultLoginPage
);
loginRouter.post(
  '/addTermsAndConditions',
  settingsValidation.validate('addTermsAndConditions'),
  addTermsAndConditions
);
router.get('/GetAllTermsAndConditions', GetAllTermsAndConditions);
loginRouter.post(
  '/addPrivacyPolicy',
  settingsValidation.validate('addPrivacyPolicy'),
  addPrivacyPolicy
);
router.get('/GetAllPrivacyPolicy', GetAllPrivacyPolicy);
loginRouter.post(
  '/updateDefaultExchange',
  settingsValidation.validate('updateDefaultExchange'),
  updateDefaultExchange
);

loginRouter.post(
  '/updateDefaultBetSizes',
  settingsValidation.validate('updateDefaultBetSizes'),
  updateDefaultBetSizes
);

loginRouter.get('/GetExchangeRates', GetExchangeRates);
loginRouter.get('/getDefaultBetSizes', getDefaultBetSizes);
router.get('/getDefaultSettings', getDefaultSettings);

loginRouter.get('/getSideBarMenu', getSideBarMenu);
router.get('/addSideBarMenu', addSideBarMenu);

loginRouter.get('/listCompetitions/:id', listCompetitions);
loginRouter.get('/listEventsBySport', listEventsBySport);
loginRouter.get(
  '/listEventsByCompetition/:sportsId/:competitionId',
  listEventsByCompetition
);
loginRouter.get('/listInplayEvents', listInplayEvents);
loginRouter.get('/listOddsAPI', listOddsAPI);
loginRouter.get('/racesAPI/:id', racesAPI);
loginRouter.post('/updateMatchType', updateMatchType);
loginRouter.get('/racesMarketList/:marketId', racesMarketList);
loginRouter.post('/updateMatch', updateMatch);
loginRouter.get('/bettorDashboardGames', bettorDashboardGames);

module.exports = { loginRouter, router, listOddsAPI };