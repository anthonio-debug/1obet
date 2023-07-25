const express = require('express');
const User = require('../models/user');
const router = express.Router();
const CasinoDebits = require('../models/casinoCalls');
const crypto = require('crypto');
const config = require('config')
const { startSession } = require('mongoose');


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
  const session = await startSession();

  try {
    session.startTransaction();

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
      session.abortTransaction();
      session.endSession();
      return res.json({
        status: 403,
        msg: 'INCORRECT_KEY_VALIDATION'
      });
    }

    const sameTransId = await CasinoDebits.countDocuments({ transaction_id: payload.transaction_id, remote_id: payload.remote_id, round_id: payload.round_id, action: 'debit' });

    const user = await User.findOne({ remoteId: payload.remote_id }).session(session);
    if (!user) {
      session.abortTransaction();
      session.endSession();
      return res.json({ status: 500, msg: 'Internal error' });
    }

    if (sameTransId > 0) {
      session.commitTransaction();
      session.endSession();
      return res.json({
        status: 200,
        balance: user.availableBalance,
      });
    }

    if (parseInt(payload.amount) > user.availableBalance) {
      session.abortTransaction();
      session.endSession();
      return res.json({
        status: 403,
        message: "Insufficient balance amount",
      });
    }

    let debitAmount = parseInt(payload.amount);
    if (parseInt(payload.amount) < 0) {
      session.abortTransaction();
      session.endSession();
      return res.json({
        status: 500,
        balance: user.availableBalance
      });
    }

    const updatedBalance = user.availableBalance - debitAmount;
    if (updatedBalance < 0) {
      session.abortTransaction();
      session.endSession();
      return res.json({ status: '500', msg: 'Negative balance not allowed!' });
    }

    user.availableBalance -= debitAmount;
    await user.save();

    const casinoDebits = new CasinoDebits(payload);
    await casinoDebits.save();

    session.commitTransaction();
    session.endSession();

    return res.json({
      status: 200,
      balance: updatedBalance,
    });
  } catch (err) {
    session.abortTransaction();
    session.endSession();
    console.error(err);
    return res.json({
      status: 500,
      msg: 'Internal error'
    });
  }
}

async function credit(req, res) {
  const session = await startSession();

  try {
    session.startTransaction();

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
      session.abortTransaction();
      session.endSession();
      return res.json({
        status: 403,
        msg: 'INCORRECT_KEY_VALIDATION'
      });
    }

    const sameTransId = await CasinoDebits.countDocuments({ transaction_id: payload.transaction_id, remote_id: payload.remote_id, round_id: payload.round_id, action: 'credit' });

    const remoteId = payload.remote_id;
    const user = await User.findOne({ remoteId: remoteId }).session(session);
    if (!user) {
      session.abortTransaction();
      session.endSession();
      return res.json({ status: 500, msg: 'Internal error' });
    }

    if (parseInt(payload.amount) < 0) {
      session.abortTransaction();
      session.endSession();
      return res.json({
        status: 500,
        balance: user.availableBalance
      });
    }

    if (sameTransId > 0) {
      session.commitTransaction();
      session.endSession();
      return res.json({
        status: 200,
        balance: user.availableBalance,
      });
    }

    if (parseInt(req.query.amount) < 0) {
      session.abortTransaction();
      session.endSession();
      return res.json({ status: '500', msg: 'Negative amount not allowed!' });
    }

    user.availableBalance += parseInt(req.query.amount);
    await user.save();

    const casinoDebits = new CasinoDebits(payload);
    await casinoDebits.save();

    session.commitTransaction();
    session.endSession();

    return res.json({
      status: 200,
      balance: user.availableBalance,
    });
  } catch (err) {
    session.abortTransaction();
    session.endSession();
    console.error(err);
    return res.json({
      status: 500,
      msg: 'Internal error'
    });
  }
}

async function rollback(req, res) {
  const session = await startSession();

  try {
    session.startTransaction();

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
      session.abortTransaction();
      session.endSession();
      return res.json({
        status: 403,
        msg: 'INCORRECT_KEY_VALIDATION'
      });
    }

    const sameTransId = await CasinoDebits.countDocuments({ transaction_id: payload.transaction_id, remote_id: payload.remote_id });

    const user = await User.findOne({ remoteId }, null, { session });
    if (!user) {
      session.abortTransaction();
      session.endSession();
      return res.json({
        status: 500,
        msg: 'Internal error'
      });
    }

    if (sameTransId == 0) {
      session.abortTransaction();
      session.endSession();
      return res.json({
        status: 404,
        balance: user.availableBalance
      });
    }

    if (sameTransId > 1) {
      session.commitTransaction();
      session.endSession();
      return res.json({
        status: 200,
        balance: user.availableBalance
      });
    }

    if (payload.action === 'rollback') {
      const trans = await CasinoDebits.findOne({ transaction_id: payload.transaction_id }, null, { session });
      if (!trans) {
        session.abortTransaction();
        session.endSession();
        return res.json({
          status: 404,
          message: 'Transaction not found'
        });
      } else {
        let amount = 0;
        const action = trans.action;
        if (action === "credit") {
          amount = -parseInt(trans.amount);
        } else if (action === "debit") {
          amount = parseInt(trans.amount);
        } else if (action === 'rollback') {
          session.abortTransaction();
          session.endSession();
          return res.json({
            status: 404,
            balance: user.availableBalance
          });
        }

        user.availableBalance += amount;
        await user.save();

        const casinoDebits = new CasinoDebits(payload);
        await casinoDebits.save();

        session.commitTransaction();
        session.endSession();

        return res.json({
          status: 404,
          balance: user.availableBalance
        });
      }
    } else {
      session.abortTransaction();
      session.endSession();
      return res.json({
        status: 404,
        balance: user.availableBalance
      });
    }
  } catch (err) {
    session.abortTransaction();
    session.endSession();
    console.error(err);
    return res.json({
      status: 500,
      msg: 'Internal error'
    });
  }
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
