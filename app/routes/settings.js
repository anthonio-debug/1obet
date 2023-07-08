const express = require('express');
var jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const Settings = require('../models/settings');
const User = require('../models/user');
const settingsValidation = require('../validators/settings');
const termsAndConditions = require('../models/termsAndConditions');
const PrivacyPolicy = require('../models/privacyPolicy');
const Competition = require('../models/listCompetitions');
const Odds = require('../models/odds');
const Exchanges = require('../models/exchanges');
const MaxBetSize = require('../models/betLimits');
const SideBarMenu = require('../models/sidebarMenu');
const inPlayEvents = require('../models/inPlayEvents');
const EventBySports = require('../models/eventsBySport');
const EventsByCompetition = require('../models/eventsByCompetition');

const loginRouter = express.Router();
const router = express.Router();

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

async function ListEventsBySport(req, res) {
  const sportId = req.params.id;

  try {
    const events = await EventBySports.find({ sportsId: sportId });

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

async function ListEventsByCompetition(req, res) {
  const { sportsId, competitionId } = req.params;
  try {
    const events = await EventsByCompetition.find({
      sportsId: sportsId,
      competitionId: competitionId,
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

async function ListInplayEvents(req, res) {
  const sportsId = req.params.id;
  try {
    const inplayEvents = await inPlayEvents.find({ sportsId: sportsId });

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

async function ListOddsAPI(req, res) {
  try {
    const eventIds = req.query.ids.split(',').slice(0, 20);
    const odds = await Odds.find({ eventId: { $in: eventIds } });

    return res.json({
      success: true,
      message: 'Records',
      results: odds,
    });
  } catch (error) {
    console.error('Error retrieving odds:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving odds',
    });
  }
}

const getOddsCronJob = () => {
  // Cron job to run getOdds every second
  cron.schedule('* * * * * *', async () => {
    try {
      const response = await ListOddsAPI(req, res);
      console.log('log', response);
      const odds = response.results;
      await getOdds(odds);
    } catch (error) {
      console.error('Error running getOdds cron job:', error);
    }
  });
};

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
    if (req.params.id === '7') {
      const odds = [
        {
          meetingId: 30765138,
          venue: 'Ascot',
          eventTypeId: 7,
          countryCode: 'GB',
          races: 'movember',
          '1.186083470': 'movember',
          marketName: 'Ascot 7th Aug - 5f Hcap',
          marketId: '1.186083470',
          marketType: null,
          eventId: 30765138,
          eventName: 'Ascot 7th Aug',
          startTime: '2021-08-07T11:50:00+00:00',
          open: 1,
          inplay: 0,
          port: 20098,
        },
        {
          1.186083477: 'movember',
          marketName: 'Ascot 7th Aug - 2m Hcap',
          marketId: '1.186083477',
          marketType: null,
          eventId: 30765138,
          eventName: 'Ascot 7th Aug',
          startTime: '2021-08-07T12:25:00+00:00',
          open: 1,
          inplay: 0,
          port: 20099,
        },
        {
          1.186083484: 'movember',
          marketName: 'Ascot 7th Aug - 1m4f Hcap',
          marketId: '1.186083484',
          marketType: null,
          eventId: 30765138,
          eventName: 'Ascot 7th Aug',
          startTime: '2021-08-07T13:00:00+00:00',
          open: 1,
          inplay: 0,
          port: 20100,
        },
      ];

      return res.json({
        success: true,
        message: 'Records',
        results: odds,
      });
    } else if (req.params.id === '4339') {
      const greyhound = [
        {
          meetingId: 30765711,
          venue: 'Swindon',
          eventTypeId: 4339,
          countryCode: 'GB',
          races: {
            1.186089617: {
              marketName: 'Swindon 6th Aug - A5 476m',
              marketId: '1.186089617',
              marketType: null,
              eventId: 30765711,
              eventName: 'Swindon 6th Aug',
              startTime: '2021-08-06T11:28:00+00:00',
              open: 0,
              inplay: 0,
              port: 20311,
            },
          },
        },
        {
          meetingId: 30765572,
          venue: 'Harlow',
          eventTypeId: 4339,
          countryCode: 'GB',
          races: {
            1.186086708: {
              marketName: 'Harlow 6th Aug - D3 238m',
              marketId: '1.186086708',
              marketType: null,
              eventId: 30765572,
              eventName: 'Harlow 6th Aug',
              startTime: '2021-08-06T11:31:00+00:00',
              open: 1,
              inplay: 0,
              port: 20318,
            },
            '1.186086710': {
              marketName: 'Harlow 6th Aug - A6 415m',
              marketId: '1.186086710',
              marketType: null,
              eventId: 30765572,
              eventName: 'Harlow 6th Aug',
              startTime: '2021-08-06T11:46:00+00:00',
              open: 1,
              inplay: 0,
              port: 20319,
            },
            1.186086712: {
              marketName: 'Harlow 6th Aug - A7 415m',
              marketId: '1.186086712',
              marketType: null,
              eventId: 30765572,
              eventName: 'Harlow 6th Aug',
              startTime: '2021-08-06T12:02:00+00:00',
              open: 1,
              inplay: 0,
              port: 20320,
            },
            1.186086714: {
              marketName: 'Harlow 6th Aug - D2 238m',
              marketId: '1.186086714',
              marketType: null,
              eventId: 30765572,
              eventName: 'Harlow 6th Aug',
              startTime: '2021-08-06T12:17:00+00:00',
              open: 1,
              inplay: 0,
              port: 20321,
            },
          },
        },
        {
          meetingId: 30765711,
          venue: 'Swindon',
          eventTypeId: 4339,
          countryCode: 'GB',
          races: {
            1.186089617: {
              marketName: 'Swindon 6th Aug - A5 476m',
              marketId: '1.186089617',
              marketType: null,
              eventId: 30765711,
              eventName: 'Swindon 6th Aug',
              startTime: '2021-08-06T11:28:00+00:00',
              open: 0,
              inplay: 0,
              port: 20311,
            },
          },
        },
        {
          meetingId: 30765572,
          venue: 'Harlow',
          eventTypeId: 4339,
          countryCode: 'GB',
          races: {
            1.186086708: {
              marketName: 'Harlow 6th Aug - D3 238m',
              marketId: '1.186086708',
              marketType: null,
              eventId: 30765572,
              eventName: 'Harlow 6th Aug',
              startTime: '2021-08-06T11:31:00+00:00',
              open: 1,
              inplay: 0,
              port: 20318,
            },
            '1.186086710': {
              marketName: 'Harlow 6th Aug - A6 415m',
              marketId: '1.186086710',
              marketType: null,
              eventId: 30765572,
              eventName: 'Harlow 6th Aug',
              startTime: '2021-08-06T11:46:00+00:00',
              open: 1,
              inplay: 0,
              port: 20319,
            },
            1.186086712: {
              marketName: 'Harlow 6th Aug - A7 415m',
              marketId: '1.186086712',
              marketType: null,
              eventId: 30765572,
              eventName: 'Harlow 6th Aug',
              startTime: '2021-08-06T12:02:00+00:00',
              open: 1,
              inplay: 0,
              port: 20320,
            },
            1.186086714: {
              marketName: 'Harlow 6th Aug - D2 238m',
              marketId: '1.186086714',
              marketType: null,
              eventId: 30765572,
              eventName: 'Harlow 6th Aug',
              startTime: '2021-08-06T12:17:00+00:00',
              open: 1,
              inplay: 0,
              port: 20321,
            },
          },
        },
      ];
      return res.json({
        success: true,
        message: 'Records',
        results: greyhound,
      });
    }
  } catch (err) {
    console.error(err);
    return res.json({
      success: false,
      message: 'error',
    });
  }
}

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
loginRouter.get('/ListEventsBySport/:id', ListEventsBySport);
loginRouter.get(
  '/ListEventsByCompetition/:sportsId/:competitionId',
  ListEventsByCompetition
);
loginRouter.get('/ListInplayEvents/:id', ListInplayEvents);
loginRouter.get('/ListOddsAPI', ListOddsAPI);
loginRouter.get('/racesAPI/:id', racesAPI);

module.exports = { loginRouter, router, ListOddsAPI };
