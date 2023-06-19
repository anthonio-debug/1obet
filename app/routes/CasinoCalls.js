const express = require('express');
const User = require('../models/user');
const router = express.Router();
const CasinoDebits = require('../models/casinoCalls');

function balance(req, res) {
  const remoteId = req.query.remoteId;
  User.findOne({ remoteId: remoteId }, (err, user) => {
    if (err || !user) {
      return res.send({ status: '500', msg: 'internal error' });
    }
    return res.send({
      status: 200,
      balance: (user.availableBalance / 307).toFixed(2),
    });
  });
}

function debit(req, res) {
  const payload = req.body
  console.log('payload',payload);
  const casinoDebits = new CasinoDebits(payload);
  casinoDebits.save((err, savedPayload) => {
    if (err) {
      console.error(err);
      return res.send({ status: '500', msg: 'internal error' });
    }

    User.findOne({ remoteId: payload.remote_id }, (err, user) => {
      if (err || !user) {
        return res.send({ status: '500', msg: 'internal error' });
      }
      user.availableBalance -= savedPayload.amount * 307;
      user.save((err) => {
        if (err) {
          console.error(err);
          return res.send({ status: '500', msg: 'internal error' });
        }
        return res.send({
          status: 200,
          balance: (user.availableBalance / 307).toFixed(2),
        });
      });
    });
  });
}
 
function credit(req, res) {
  const payload = req.body
  const casinoDebits = new CasinoDebits(payload);
  casinoDebits.save((err, savedPayload) => {
    if (err) {
      console.error(err);
      return res.send({ status: '500', msg: 'internal error' });
    }

    const remoteId = payload.remote_id;
    User.findOne({ remoteId: remoteId }, (err, user) => {
      if (err || !user) {
        return res.send({ status: '500', msg: 'internal error' });
      }
      user.availableBalance += savedPayload.amount * 307;
      user.save((err) => {
        if (err) {
          console.error(err);
          return res.send({ status: '500', msg: 'internal error' });
        }
        return res.send({
          status: 200,
          balance: (user.availableBalance / 307).toFixed(2),
        });
      });
    });
  });
}

function rollback(req, res) {
  const payload = req.body
  const remoteId = req.body.remote_id;
  const casinoDebits = new CasinoDebits(payload);
  casinoDebits.save((err, savedPayload) => {
    if (err) {
      console.error(err);
      return res.send({ status: '500', msg: 'internal error' });
    }
  User.findOne({ remoteId: remoteId }, (err, user) => {
    if (err || !user) {
      return res.send({ status: '500', msg: 'internal error' });
    }
    user.availableBalance += req.body.amount * 307;
    user.save();
    return res.send({
      status: 200,
      balance: (user.availableBalance / 307).toFixed(2),
    });
  });
})
}

router.get('/balance', balance);
router.post('/debit', debit);
router.post('/credit', credit);
router.post('/rollback', rollback);
module.exports = { router };
