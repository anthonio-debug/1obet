const express           = require('express');
const User              = require('../models/user');
const router            = express.Router();
const CasinoDebits      = require('../models/casinoCalls');
const crypto            = require('crypto');
const config            = require('config')
const { MongoClient } = require('mongodb');

// const client = new MongoClient(config.DBHost);


function createHashKey(salt, queryString) {
  const hash = crypto.createHash('sha1').update(salt + queryString).digest('hex');
  return hash;
}

async function balance(req, res) {
  const payload = req.query;
  const salt = config.saltKey;
  const key = payload.key;
  delete payload.key;

  const queryString = Object.keys(payload)
    .map(key => `${key}=${payload[key]}`)
    .join('&');

  const hash = createHashKey(salt, queryString);

  console.log('key:', key);
  console.log('hash:', hash);
  console.log('queryString:', queryString);

  // if (hash !== key) {
  //   return res.json({
  //     status: 403,
  //     msg: 'INCORRECT_KEY_VALIDATION'
  //   });
  // }

  try {
    const user = await User.findOne({ remoteId: payload.remote_id }).exec();

    if (!user) {
      return res.json({ status: 500, msg: 'Internal error' });
    }

    const balance = user.availableBalance;
    if (balance < 0) {
      return res.json({ status: 500, msg: 'Negative amount not allowed!' });
    }

    return res.json({
      status: 200,
      balance: balance,
    });
  } catch (err) {
    console.error(err);
    return res.json({ status: 500, msg: 'Internal error' });
  }
}


async function debit(req, res) {
  const client = new MongoClient(config.DBHost, { useUnifiedTopology: true });
  let session;
  try {
    await client.connect();
    session = client.startSession();
    const casinoCalls = client.db('Bet99').collection('casinocalls');
    const users = client.db('Bet99').collection('users');
    session.startTransaction();

    const payload = req.query;
    const salt = config.saltKey;
    const key = payload.key;
    delete payload.key;
    
    // const queryString = Object.keys(payload)
    //   .map(key => `${key}=${payload[key]}`)
    //   .join('&');
    // const hash = createHashKey(salt, queryString);
    // console.log('queryString:', queryString);
    // console.log('hash:', hash);
    // if (hash !== key) {
    //   return res.json({
    //     status: 403,
    //     msg: 'INCORRECT_KEY_VALIDATION'
    //   });
    // }


    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>")
    const sameTransId = await casinoCalls.countDocuments(
      {
        transaction_id: payload.transaction_id,
        remote_id: payload.remote_id,
        round_id: payload.round_id,
        action: "debit",
      },
      { session, readPreference: "primary" }
    ); 
    const user = await users.findOne({ remoteId: payload.remote_id }, { session, readPreference: 'primary' });    

    if (!user) {
      session.abortTransaction();
      session.endSession();
      return res.json({ status: '500', msg: 'Internal error' });
    }
    if (sameTransId > 0) {
      await session.abortTransaction();
      return res.json({
        status: 200,
        balance: user.availableBalance,
      });
    }

    if (debitAmount > user.availableBalance) {
      await session.abortTransaction();
      return res.json({
        status: 403,
        message: "Insufficient balance amount",
      });
    }
    const updatedBalance = user.availableBalance - debitAmount;
    if (updatedBalance < 0) {
      await session.abortTransaction();
      return res.json({ status: '500', msg: 'Negative balance not allowed!' });
    }
    user.availableBalance -= debitAmount;
    await user.save();

    const casinoDebits = new CasinoDebits(payload);
    await casinoDebits.save();

    await session.commitTransaction();
    return res.json({
      status: 200,
      balance: updatedBalance
    });
  } catch (err) {
    console.error('Error:', err);
    return res.json({ status: 500, msg: 'Internal error' });
  } finally {
    session.endSession();
    client.close();
  }
}

async function credit(req, res) {
  const client = new MongoClient(config.DBHost, { useUnifiedTopology: true });
  let session;
  try {
    await client.connect();
    session = client.startSession();
    const casinoCalls = client.db('Bet99').collection('casinocalls');
    const users = client.db('Bet99').collection('users');
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

    // if (hash !== key) {
    //   return res.json({
    //     status: 403,
    //     msg: 'INCORRECT_KEY_VALIDATION'
    //   });
    // }

    const sameTransId = await casinoCalls.countDocuments({transaction_id: payload.transaction_id, remote_id: payload.remote_id, round_id: payload.round_id,  action: 'credit'}, { session, readPreference: 'primary' });
    const remoteId = payload.remote_id;


    const user = await users.findOne({ remoteId: payload.remote_id }, { session, readPreference: 'primary' });
    if (!user) {
      session.abortTransaction();
      return res.json({ status: '500', msg: 'Internal error' });
    }
    if (parseInt(payload.amount) < 0) {
      session.abortTransaction();
      return res.json({
        status: 500,
        balance: user.availableBalance
      });
    }
    if (sameTransId > 0) {
      session.commitTransaction();
      return res.json({
        status: 200,
        balance: user.availableBalance,
      });
    }
    if (parseInt(req.query.amount) < 0) {
      session.abortTransaction();
      return res.json({ status: '500', msg: 'Negative amount not allowed!' });
    }

    let updatedBalance = user.availableBalance + parseInt(req.query.amount);
    user.availableBalance += parseInt(req.query.amount);
    await user.save();

    const casinoDebits = new CasinoDebits(payload);
    await casinoDebits.save();

    session.commitTransaction();

    return res.json({
      status: 200,
      balance: updatedBalance,
    });

  } catch (err) {
    console.error('Error:', err);
    return res.json({ status: 500, msg: 'Internal error' });
  } finally {
    session.endSession();
    client.close();
  }
}

async function rollback(req, res) {
  const client = new MongoClient(config.DBHost);
  try {
    await client.connect();;
    const session = client.startSession();
    const casinoCalls = client.db('Bet99').collection('casinocalls');
    const users = client.db('Bet99').collection('users');
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
      return res.json({
        status: 403,
        msg: 'INCORRECT_KEY_VALIDATION'
      });
    }

    const sameTransId = await casinoCalls.countDocuments({transaction_id: payload.transaction_id, remote_id: payload.remote_id}, { session, readPreference: 'primary' });

    users.findOne({ remoteId }, { session, readPreference: 'primary' }, async (err, user) => {
      if (err || !user) {
        session.abortTransaction();
        client.close();
        return res.json({
          status: 500,
          msg: 'Internal error'
        });
      }

      if (sameTransId == 0) {
        session.abortTransaction();
        client.close();
        return res.json({
          status: 404,
          balance: user.availableBalance
        });
      }

      if (sameTransId > 1) {
        session.abortTransaction();
        client.close();
        return res.json({
          status: 200,
          balance: user.availableBalance
        });
      }

      if (payload.action == 'rollback') {
        casinoCalls.findOne({transaction_id: payload.transaction_id}, { session, readPreference: 'primary' }, async (err, trans) => {
          if (err || !trans) {
            session.abortTransaction();
            client.close();
            return res.json({
              status: 404,
              message: 'Transaction not found'
            });
          } else {
            let amount = 0;
            const action = trans.action;
            if (action == "credit") {
              amount = -parseInt(trans.amount);
            } else if (action == "debit") {
              amount = parseInt(trans.amount);
            } else if (action == 'rollback') {
              session.abortTransaction();
              client.close();
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
            client.close();

            return res.json({
              status: 404,
              balance: user.availableBalance
            });
          }
        });
      } else {
        session.abortTransaction();
        client.close();
        return res.json({
          status: 404,
          balance: user.availableBalance
        });
      }
    });
  } catch (err) {
    session.abortTransaction();
    client.close();
    console.error(err);
    return res.json({
      status: 500,
      msg: 'Internal error'
    });
  } finally {
    session.endSession();
    client.close();
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
