const express = require('express');
var jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const Settings = require('../models/settings');
const User = require('../models/user');
const settingsValidation = require('../validators/settings');
const termsAndConditions = require('../models/termsAndConditions');
const PrivacyPolicy = require('../models/privacyPolicy');

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
  let type = req.decoded.role == 5 ? 0 : 1;
  let onlyCompany = 0;
  if (req.decoded.role == 0) {
    onlyCompany = 1;
  }
  SideBarMenu.find({ 
      $or: [
        { type: type }, 
        { onlyCompany: onlyCompany }
      ]  
    }, (err, results) => {
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

module.exports = { loginRouter, router };
