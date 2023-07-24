const express = require('express');
const User = require('../models/user');
const router = express.Router();
const CasinoDebits = require('../models/casinoCalls');
const crypto = require('crypto');
const config = require('config')


function createHashKey(salt, queryString) {
  const hash = crypto.createHash('sha1').update(salt + queryString).digest('hex');
  return hash;
}

function balance(req, res) {
  const payload = req.query;
  const salt    = config.saltKey; // Replace with your default salt key
  const key     = payload.key;
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

  // const casinoDebits = new CasinoDebits(payload);
  User.findOne({ remoteId: payload.remote_id }, (err, user) => {
    console.log('user:', user);
    if (err || !user) {
      return res.send({ status: '500', msg: 'internal error' });
    }

    const balance = user.availableBalance;
    if (balance < 0) {
      return res.json({ status: '500', msg: 'Negative amount not allowed!' });
    }

    return res.send({
      status: 200,
      balance: balance,
    });
  });
}

async function debit(req, res) {
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

  // const sameTransId = await CasinoDebits.countDocuments({transaction_id: payload.transaction_id, remote_id: payload.remote_id ,action: 'debit'});

  User.findOne({ remoteId: payload.remote_id }, (err, user) => {
    if (err || !user) {
      return res.send({ status: '500', msg: 'internal error' });
    }
    CasinoDebits.findOne({transaction_id: payload.transaction_id, action: 'debit'}, (err, counts)=>{
      if(counts.length > 0){
        return res.json({
          status: 200,
          balance: user.availableBalance,
        });
      }
    });

    if(parseInt(payload.amount) > user.availableBalance){
      return res.json({
        status: 403,
        message: " Insufficient balance amount",
      });
    }

    let  debitAmount = parseInt(payload.amount);
    if(parseInt(payload.amount) < 0){
      return res.json({
        status: 500,
        balance: user.availableBalance
      });
    }

    const updatedBalance = user.availableBalance - debitAmount;
    if (updatedBalance < 0) {
      return res.json({ status: '500', msg: 'Negative balance not allowed!' });
    }
    user.availableBalance -= debitAmount;
    user.save(
      (err, updatedUser) => {
        if (err || !updatedUser) {
          return res.send({ status: '500', msg: 'internal error' });
        }
        // const casinoDebits = new CasinoDebits(payload);
        // casinoDebits.save((err) => {
        //   if (err) {
        //     console.error(err);
        //     return res.send({ status: '500', msg: 'internal error' });
        //   }
        //     return res.json({
        //       status: 200,
        //       balance: updatedBalance,
        //     });
        // });
        return res.json({
          status: 200,
          balance: updatedBalance,
        });
    }
    );
    const casinoDebits = new CasinoDebits(payload);
    casinoDebits.save((err) => {
      if (err) {
        console.error(err);
        return res.send({ status: '500', msg: 'internal error' });
      }
    });
  });
}
 
async function credit(req, res) {
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

  const remoteId = payload.remote_id;
  User.findOne({ remoteId: remoteId }, (err, user) => {
    if (err || !user) {
      return res.send({ status: '500', msg: 'internal error' });
    }
    CasinoDebits.findOne({transaction_id: payload.transaction_id, action: 'credit'}, (err, counts)=>{
      if(counts.length > 0){
        return res.json({
          status: 200,
          balance: user.availableBalance,
        });
      }
    });

    if(parseInt(payload.amount) < 0){
      return res.json({
        status: 500,
        balance: user.availableBalance
      });
    }
    // const creditAmount = parseInt(req.query.amount);
    if ( parseInt(req.query.amount) < 0) {
      return res.json({ status: '500', msg: 'Negative amount not allowed!' });
    }
    user.availableBalance += parseInt(req.query.amount);
    user.save((err) => {
      if (err) {
        console.error(err);
        return res.send({ status: '500', msg: 'internal error' });
      }
      const casinoDebits = new CasinoDebits(payload);
      casinoDebits.save((err, savedPayload) => {
        if (err) {
          console.error(err);
          return res.send({ status: '500', msg: 'internal error' });
        }
      })
      return res.send({
        status: 200,
        balance: user.availableBalance,
      });
    });
  });
}

async function rollback(req, res) {
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

  User.findOne({ remoteId }, (err, user) => {
    if (err || !user) {
      return res.json({
        status: 500,
        msg: 'Internal error'
      });
    }
    if (payload.action == 'rollback') {
      CasinoDebits.find({transaction_id: payload.transaction_id}, (err, counts)=>{ 
        if(err){
          return res.json({
            status: 404,
            balance: user.availableBalance
          });
        }
        else if(counts.length > 1){
          return res.json({
            status: 200,
            balance: user.availableBalance
          });
        }
      });
      let amount = 0;
      const action = users[0].action;
      if(action == "credit"){
        amount = - parseInt(trans.amount);
      }
      else if(action == "debit"){
        amount = parseInt(trans.amount);
      }
      else if(action == 'rollback'){
        return res.json({
          status: 404,
          balance: user.availableBalance
        });
      }
      user.availableBalance += amount;
      user.save((err) => {
        if (err) {
          console.error(err);
          return res.json({
            status: 500,
            msg: 'Internal error'
          });
        }
        else {
          const casinoDebits = new CasinoDebits(payload);
          casinoDebits.save((err, savedPayload) => {
            if (err) {
              console.error(err);
              return res.json({
                status: 500,
                msg: 'Internal error'
              });
            }
          });
          return res.json({
            status: 404,
            balance: user.availableBalance
          });
        }  
      })
    } 
    else{
      return res.json({
        status: 404,
        balance: user.availableBalance
      });
    }
  });
  
}


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
