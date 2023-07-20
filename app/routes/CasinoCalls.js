const express = require('express');
const User = require('../models/user');
const router = express.Router();
const CasinoDebits = require('../models/casinoCalls');
const crypto = require('crypto');
const config = require('config')

// function createHashKey(salt, queryString) {
//   const hash = crypto.createHash('sha1').update(salt + queryString).digest('hex');
//   return hash;
// }

// const defaultSaltKey = 'Loa0192Jua'; // Replace with your default salt key

// const queryString ='callerId=1obet_mc_s&callerPassword=7d4abb4213b10af57967e4e7fa105a9aa0dcc357&callerPrefix=zrf3&action=balance&remote_id=1081553&username=user_8&session_id=&currency=EUR&provider=ez&game_id=157418&game_id_hash=ez_ez-roleta-da-sorte';

// const hashKey = createHashKey(defaultSaltKey, queryString);
// console.log('Hash key:', hashKey);


function createHashKey(salt, queryString) {
  const hash = crypto.createHash('sha1').update(salt + queryString).digest('hex');
  return hash;
}

function balance(req, res) {
  const payload = req.query;
  const salt = config.saltKey; // Replace with your default salt key

  const key = payload.key;
  delete payload.key;

  const queryString = Object.keys(payload)
    .map(key => `${key}=${payload[key]}`)
    .join('&');

  const hash = createHashKey(salt, queryString);

  console.log('key:', key);
  console.log('hash:', hash);
  console.log('queryString:', queryString);

  if (hash !== key) {
    return res.json({
      status: 403,
      msg: 'INCORRECT_KEY_VALIDATION'
    });
  }

  const casinoDebits = new CasinoDebits(payload);
  casinoDebits.save((err, savedPayload) => {
    if (err) {
      console.error(err);
      return res.send({ status: '500', msg: 'internal error' });
    }

    User.findOne({ remoteId: payload.remote_id }, (err, user) => {
      console.log('user:', user);
      if (err || !user) {
        return res.send({ status: '500', msg: 'internal error' });
      }

      const balance = (user.availableBalance / 307).toFixed(2);
      if (balance < 0) {
        return res.json({ status: '500', msg: 'Negative amount not allowed!' });
      }

      return res.send({
        status: 200,
        balance: balance,
      });
    });
  });
}

function debit(req, res) {
  const payload = req.query;
  const salt = config.saltKey;

  const key = payload.key;
  delete payload.key;

  const queryString = Object.keys(payload)
    .map(key => `${key}=${payload[key]}`)
    .join('&');

  const hash = createHashKey(salt, queryString);

  console.log('queryString:', queryString);
  console.log('hash:', hash);

  if (hash !== key) {
    return res.json({
      status: 403,
      msg: 'INCORRECT_KEY_VALIDATION'
    });
  }

  User.findOne({ remoteId: payload.remote_id }, (err, user) => {
    if (err || !user) {
      return res.send({ status: '500', msg: 'internal error' });
    }

    const debitAmount = payload.amount * 307;
    const updatedBalance = user.availableBalance - debitAmount;

    if (updatedBalance < 0) {
      return res.json({ status: '500', msg: 'Negative balance not allowed!' });
    }

    User.findOneAndUpdate(
      { remoteId: payload.remote_id },
      { $inc: { availableBalance: -debitAmount } },
      { new: true },
      (err, updatedUser) => {
        if (err || !updatedUser) {
          return res.send({ status: '500', msg: 'internal error' });
        }

      const casinoDebits = new CasinoDebits(payload);
      casinoDebits.save((err) => {
        if (err) {
          console.error(err);
          return res.send({ status: '500', msg: 'internal error' });
        }

        const updatedBalance = (updatedUser.availableBalance / 307).toFixed(2);

        return res.json({
          status: 200,
          balance: updatedBalance,
        });
      });
    }
  );
  });
}
 
function credit(req, res) {
  const payload = req.query;
  const salt = config.saltKey;

  const key = payload.key;
  delete payload.key;

  const queryString = Object.keys(payload)
    .map(key => `${key}=${payload[key]}`)
    .join('&');
  console.log('queryString', queryString);

  const hash = createHashKey(salt, queryString);
  console.log('hash', hash);

  if (hash !== key) {
    return res.json({
      status: 403,
      msg: 'INCORRECT_KEY_VALIDATION'
    });
  }

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

      const creditAmount = req.query.amount * 307;
      
      if (creditAmount < 0) {
        return res.json({ status: '500', msg: 'Negative amount not allowed!' });
      }

      user.availableBalance += creditAmount;
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
  const payload = req.query;
  const remoteId = payload.remote_id;
  const salt = config.saltKey;

  const key = payload.key;
  delete payload.key;

  const queryString = Object.keys(payload)
    .map(key => `${key}=${payload[key]}`)
    .join('&');
  console.log('queryString', queryString);

  const hash = createHashKey(salt, queryString);
  console.log('hash', hash);

  if (hash !== key) {
    return res.json({
      status: 403,
      msg: 'INCORRECT_KEY_VALIDATION'
    });
  }

  const casinoDebits = new CasinoDebits(payload);
  casinoDebits.save((err, savedPayload) => {
    if (err) {
      console.error(err);
      return res.json({
        status: 500,
        msg: 'Internal error'
      });
    }

    User.findOne({ remoteId }, (err, user) => {
      if (err || !user) {
        return res.json({
          status: 500,
          msg: 'Internal error'
        });
      }

      if (payload.action === 'rollback') {
        const rollbackAmount = payload.amount * 307;

        if (rollbackAmount < 0) {
          return res.json({
            status: 500,
            msg: 'Negative amount not allowed!'
          });
        }

        user.availableBalance += rollbackAmount;
        user.save((err) => {
          if (err) {
            console.error(err);
            return res.json({
              status: 500,
              msg: 'Internal error'
            });
          }

          const updatedBalance = (user.availableBalance / 307).toFixed(2);

          return res.json({
            status: 200,
            balance: updatedBalance
          });
        });
      } else {
        const updatedBalance = (user.availableBalance / 307).toFixed(2);

        return res.json({
          status: 200,
          balance: updatedBalance
        });
      }
    });
  });
}


// function rollback(req, res) {
//   const payload = req.query
//   const remoteId = req.query.remote_id;
//   const casinoDebits = new CasinoDebits(payload);
//   casinoDebits.save((err, savedPayload) => {
//     if (err) {
//       console.error(err);
//       return res.send({ status: '500', msg: 'internal error' });
//     }
//   User.findOne({ remoteId: remoteId }, (err, user) => {
//     if (err || !user) {
//       return res.send({ status: '500', msg: 'internal error' });
//     }
//     if(req.query.action == 'rollback'){
//       user.availableBalance += req.query.amount * 307;
//       user.save();
//     }
//     return res.send({
//       status: 200,
//       balance: (user.availableBalance / 307).toFixed(2),
//     });
//   });
// })
// }

function casino(req, res) {
  const { action, remote_id } = req.query;
  if (!remote_id || !action) {
    return res.send({ status: '400', msg: 'Invalid Request' });
  }
  switch (action) {
    case 'balance':
      return balance(req, res);
    case 'debit':
      return debit(req, res);
    case 'credit':
      return credit(req, res);
    case 'rollback':
      return rollback(req, res);
    default:
      return res.send({ status: '400', msg: 'Invalid action' });
  }
}

router.get('/casino', casino);

module.exports = { router };
