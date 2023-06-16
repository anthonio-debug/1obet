const express = require('express');
const User = require('../models/user');
const router = express.Router();

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
  const remoteId = req.body.remote_id;
  User.findOne({ remoteId: remoteId }, (err, user) => {
    if (err || !user) {
      return res.send({ status: '500', msg: 'internal error' });
    }
    user.availableBalance -= req.body.amount * 307;
    user.save();
    return res.send({
      status: 200,
      balance: (user.availableBalance / 307).toFixed(2),
    });
  });
}

function credit(req, res) {
  const remoteId = req.body.remote_id;
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
}

function rollback(req, res) {
  const remoteId = req.body.remote_id;
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
}

router.get('/balance', balance);
router.post('/debit', debit);
router.post('/credit', credit);
router.post('/rollback', rollback);
module.exports = { router };
