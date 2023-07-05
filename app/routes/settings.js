const express = require('express');
var jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const Settings = require('../models/settings');
const User = require('../models/user');
const settingsValidation = require('../validators/settings');
const termsAndConditions = require('../models/termsAndConditions');
const PrivacyPolicy = require('../models/privacyPolicy');
const Competition = require('../models/listCompetitions');



const Exchanges = require('../models/exchanges');
const MaxBetSize = require('../models/betLimits');
const SideBarMenu = require('../models/sidebarMenu');

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
  let type = []
  if(req.decoded.role == 5){
    type = [0]
  }else if(req.decoded.role == 0){
    type = [1,2]
  }else{
    type = [1];
  }
  SideBarMenu.find(
    { type: { $in:  type } }, 
    (err, results) => {
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


function listCompetitions(req, res) {
  // const marketid = req.body.role;
  // Competition.find(
  //   {}, 
  //   (err, results) => {
  //   if (err) {
  //     return res.status(404).json({ message: 'Matches not found' });
  //   }
    return res.json({
      success: true,
      message: ' Records',
      results: [
        {Id:"801976",Name:"Egyptian Premier"},
        {Id:"6251219",Name:"Indian SuperLeague"},
        {"Id":"9513","Name":"Portuguese Segunda Liga"},
        {"Id":"117","Name":"Spanish La Liga"},
        {"Id":"7129730","Name":"English Championship"},
        {"Id":"107","Name":"Scottish Championship"},
        {"Id":"10932509","Name":"English Premier League"},
        {"Id":"99","Name":"Portuguese Primeira  Liga"}
      ] ,
    });
  // });
}

function ListEventsBySport(req, res) {
    return res.json({
      success: true,
      message: ' Records',
      results: [
        {"sport":"soccer","competitionId":"801976","competitionName":"Egyptian Premier","Id":"30207509","name":"Aswan FC v Ismaily","countryCode":null,"timezone":null,"openDate":"29-12-2020  18:00:00","inplay":false,"hasFancy":false,"status":"OPEN"},
        {"sport":"soccer","competitionId":"6251219","competitionName ":"Indian Super League","Id":"30207322","name":"Chennaiyin FC v Atletico de  Kolkata","countryCode":null,"timezone":null,"openDate":"29-12-2020 19:30:00","inplay":false,"hasFancy":false,"status":"OPEN"},
        {"sport":"soccer","competitionId":"9513","competitionName":"Portuguese Segunda Liga","Id":"30203070","name":"Oliveirense v Cova da  Piedade","countryCode":null,"timezone":null,"openDate":"29-12-2020  20:30:00","inplay":false,"hasFancy":false,"status":"OPEN"}
      ]
  });
}

function ListEventsByCompetition(req, res) {
  return res.json({
    success: true,
    message: ' Records',
    results: [
      {"competitionId":"101","competitionName":"Russian Premier League","Id":"30073318","name":"Rostov v FC Khimki","countryCode":"RU","timezone":"GMT","openDate":"10/25/2020 1:32:30 PM","inplay":true,"hasFancy":false},{"competitionId":"101","competitionName":"Russian Premier League","Id":"30073311","name":"Akhmat Grozny v FC Ufa","countryCode":"RU","timezone":"GMT","openDate":"10/25/2020 4:00:00 PM","inplay":false,"hasFancy":false}
    ]
});
}


function ListInplayEvents(req, res) {
  return res.json({
    success: true,
    message: ' Records',
    results: [
      {"sport":"cricket","competitionId":"10328858","competitionName":"Twenty20 Big Bash","Id":"30204688","name":"Melbourne Renegades v Sydney Sixers","countryCode":null,"timezone":null,"openDate":"29-12-2020 12:40:00","inplay":true,"hasFancy":false,"status":"CLOSED"},{"sport":"cricket","competitionId":"10328858","competitionName":"Twenty20 Big Bash","Id":"30205967","name":"Sydney Thunder v Melbourne Stars","countryCode":null,"timezone":null,"openDate":"29-12-2020 13:45:00","inplay":true,"hasFancy":true,"status":"OPEN"},{"sport":"cricket","competitionId":"11365612","competitionName":"Test Matches","Id":"30182810","name":"South Africa v SriLanka","countryCode":null,"timezone":null,"openDate":"29-12-2020 13:30:00","inplay":true,"hasFancy":true,"status":"SUSPENDED"}
    ]
});
}

function ListOddsAPI(req, res) {
  return res.json({
    success: true,
    message: ' Records',
    results: [
      {
        "sport": "soccer",
        "eventId": "30207509",
        "MarketId": "1.177393055",
        "marketName": "Match Odds",
        "source": 3,
        "IsMarketDataDelayed": false,
        "Status": "OPEN",
        "IsInplay": false,
        "inplay": false,
        "NumberOfRunners": 3,
        "NumberOfActiveRunners": 3,
        "TotalMatched": 0.0,
        "Runners": [
          {
            "SelectionId": 929566606,
            "runnerName": "Aswan FC",
            "Status": "ACTIVE",
            "LastPriceTraded": null,
            "TotalMatched": 0.0,
            "ExchangePrices": {
              "AvailableToBack": [
                {"Price": 4.8, "Size": 535.0},
                {"Price": 4.7, "Size": 58.0},
                {"Price": 4.6, "Size": 127.0}
              ],
              "AvailableToLay": [
                {"Price": 5.0, "Size": 700.0},
                {"Price": 5.2, "Size": 1053.0},
                {"Price": 5.3, "Size": 478.0}
              ]
            }
          },
          {
            "SelectionId": 700243574,
            "runnerName": "Ismaily",
            "Status": "ACTIVE",
            "LastPriceTraded": null,
            "TotalMatched": 0.0,
            "ExchangePrices": {
              "AvailableToBack": [
                {"Price": 1.99, "Size": 1246.0},
                {"Price": 1.98, "Size": 116.0},
                {"Price": 1.97, "Size": 4635.0}
              ],
              "AvailableToLay": [
                {"Price": 2.0, "Size": 1600.0},
                {"Price": 2.02, "Size": 702.0},
                {"Price": 2.04, "Size": 87.0}
              ]
            }
          },
          {
            "SelectionId": 294044778,
            "runnerName": "The Draw",
            "Status": "ACTIVE",
            "LastPriceTraded": null,
            "TotalMatched": 0.0,
            "ExchangePrices": {
              "AvailableToBack": [
                {"Price": 3.3, "Size": 1319.0},
                {"Price": 3.25, "Size": 1394.0},
                {"Price": 3.2, "Size": 1770.0}
              ],
              "AvailableToLay": [
                {"Price": 3.4, "Size": 756.0},
                {"Price": 3.45, "Size": 46.0},
                {"Price": 3.5, "Size": 902.0}
              ]
            }
          }
        ]
      }
    ]
    
});
}


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

router.get('/listCompetitions/:id', listCompetitions);
router.get('/ListEventsBySport/:id', ListEventsBySport);
router.get('/ListEventsByCompetition/:id', ListEventsByCompetition);
router.get('/ListInplayEvents/:id', ListInplayEvents);
router.get('/ListOddsAPI/:id', ListOddsAPI);

module.exports = { loginRouter, router };
