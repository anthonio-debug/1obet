const express           = require('express');
const User              = require('../models/user');
const router            = express.Router();
const CasinoDebits      = require('../models/casinoCalls');
const crypto            = require('crypto');
const config            = require('config')
const { MongoClient }   = require('mongodb');
const transactionOptions = {
  readPreference: 'primary',
  readConcern: { level: 'local' },
  writeConcern: { w: 'majority' }
};

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
      return res.json({ status: 500, msg: 'Internal error no user' });
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
    return res.json({ status: 500, msg: `Internal error ${err}` });
  }
}


async function debit(req, res) {
  const client = new MongoClient(config.DBHost, { useUnifiedTopology: true });
  await client.connect();
  const session = client.startSession();
  try {
    
    console.log('======', session.emit())
    const casinoCalls = client.db('Bet99').collection('casinocalls');
    const users = client.db('Bet99').collection('users');
    console.log(">>>>>>>>>>>, casinoCalls ", casinoCalls);
    // session.startTransaction();

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

    let updatedBalance = 0

    await session.withTransaction(async () => {

      console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>> remote_id ${payload.remote_id}`)
      const sameTransId = await casinoCalls.countDocuments(
        { transaction_id: payload.transaction_id, remote_id: parseInt(payload.remote_id), round_id: payload.round_id, action: 'debit' },
        { session }
      );   
      console.log('====== sameTransId', sameTransId)
      const user = await users.findOne(
        { remoteId: parseInt(payload.remote_id) },
        { session }
      )
        // { remoteId: payload.remote_id });  

      if (!user) {
        await session.abortTransaction();
        return res.json({ status: '500', msg: `Internal error no user` });
      }
      if (sameTransId > 0) {
        await session.abortTransaction();
        return res.json({
          status: 200,
          balance: user.availableBalance,
        });
      }
      console.log('==========user', user)
      if (sameTransId > 0) {
        await session.abortTransaction();
        return res.json({
          status: 200,
          balance: user.availableBalance,
        });
      }
      let debitAmount =  parseInt(payload.amount);
      if (debitAmount > user.availableBalance) {
        await session.abortTransaction();
        return res.json({
          status: 403,
          message: "Insufficient balance amount",
        });
      }
      if (parseInt(payload.amount) < 0) {
        await session.abortTransaction();
        return res.json({ status: '500', msg: 'Negative bet not allowed!' });
      }

      updatedBalance = user.availableBalance - debitAmount;
      if (updatedBalance < 0) {
        await session.abortTransaction();
        return res.json({ status: '500', msg: 'Negative balance not allowed!' });
      }
      let userResponse = await users.updateOne(
        {_id: user?._id},{$set: { availableBalance: updatedBalance}},
        { session }
        );
      console.log('========== res', userResponse)
      const casinoDebits = new CasinoDebits(payload);
      await casinoDebits.save();

      // 
    }, transactionOptions);

    await session.commitTransaction();
    return res.json({
      status: 200,
      balance: updatedBalance
    });
  } catch (err) {
    console.error('Error:', err);
    return res.json({ status: 500, msg: `Internal error ${err}` });
  } finally {
    await session.endSession();
    await client.close();
  }
}


async function credit(req, res) {
  const client = new MongoClient(config.DBHost, { useUnifiedTopology: true });
  await client.connect();
  const session = client.startSession();
  try {
    console.log('======', session.emit())
    const casinoCalls = client.db('Bet99').collection('casinocalls');
    const users = client.db('Bet99').collection('users');

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

    console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>> ${payload.remote_id}`);

    let updatedBalance = 0;
    await session.withTransaction(async () => {
      const sameTransId = await casinoCalls.countDocuments(
        {
          transaction_id: payload.transaction_id,
          remote_id: parseInt(payload.remote_id),
          round_id: payload.round_id,
          action: "credit"
        },
        { session, readPreference: 'primary'  }
      ); 

      console.log('====== sameTransId', sameTransId)
      const user = await users.findOne(
        { remoteId: parseInt(payload.remote_id) },
        { session, readPreference: 'primary'  }
      );  
      if (!user) {
        console.log();
        await session.abortTransaction();
        return res.json({ status: '500', msg: `Internal Error no User` });
      }

      if (sameTransId > 0) {
        console.log('====== same Trans already Exists ', sameTransId)
        await session.abortTransaction();
        return res.json({
          status: 200,
          balance: user.availableBalance,
        });
      }

      if (parseInt(payload.amount) < 0) {
        await session.abortTransaction();
        return res.json({
          status: 500,
          balance: user.availableBalance
        });
      }

      updatedBalance = user.availableBalance + parseInt(payload.amount);

      let userResponse   = await users.updateOne(
        {_id: user?._id},{$set: { availableBalance: updatedBalance}},
        { session, readPreference: 'primary'  }
        );

      console.log('========== res', userResponse)
      const casinoDebits = new CasinoDebits(payload);
      await casinoDebits.save();

    }, transactionOptions);

    await session.commitTransaction();
    return res.json({
      status: 200,
      balance: updatedBalance,
    });

  } catch (err) {
    console.error('Error:', err);
    return res.json({ status: 500, msg: `Internal error ${err}` });
  } finally {
    await session.endSession();
    await client.close();
  }
}

async function rollback(req, res) {
  const client = new MongoClient(config.DBHost);
  await client.connect();
  const session = client.startSession();
  try {
    console.log('======', session.emit())
    const casinoCalls = client.db('Bet99').collection('casinocalls');
    const users = client.db('Bet99').collection('users');
    if (payload.action == 'rollback') {

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

      await session.withTransaction(async () => {
        const sameTransId = await casinoCalls.countDocuments(
          {
            transaction_id: payload.transaction_id,
            remote_id: parseInt(payload.remote_id),
            // round_id: payload.round_id,
          },
          { session }
        );  
        console.log("----->>> sameTransId ", sameTransId);

        const user = await users.findOne(
          { remoteId: parseInt(payload.remote_id) },
          { session }
        );  
        if (!user) {
          await session.abortTransaction();
          return res.json({ status: '500', msg: `Internal error User Not Found` });
        }

        if (sameTransId == 0) {
          await session.abortTransaction();
          return res.json({
            status: 404,
            balance: user.availableBalance,
          });
        }

        if (sameTransId > 1) {
          console.log("---->>>> sameTransId > 1");
          await session.abortTransaction();
          return res.json({
            status: 200,
            balance: user.availableBalance,
          });
        }

        const rollbackTransaction = await casinoCalls.findOne(
          {
            transaction_id: payload.transaction_id,
            remote_id: parseInt(payload.remote_id),
            // round_id: payload.round_id,
          }
        );  

        let amount = 0;
        const action = rollbackTransaction.action;
        if (action == "credit") {
          amount = - parseInt(rollbackTransaction.amount);
        } 
        else if (action == "debit") {
          amount = parseInt(rollbackTransaction.amount);
        } 
        else if (action == 'rollback') {
          await session.abortTransaction();
          return res.json({
            status: 404,
            balance: user.availableBalance
          });
        }
        updatedBalance = user.availableBalance +  amount;
        let userResponse = await users.updateOne(
          {_id: user?._id},{$set: { availableBalance: updatedBalance}},
          { session, readPreference: 'primary'}
        );

        console.log("=========== >> userResponse", userResponse);

        const casinoDebits = new CasinoDebits(payload);
        await casinoDebits.save();

      }, transactionOptions);

      await session.commitTransaction();

      return res.json({
        status: 200,
        balance: updatedBalance
      });
      

    } else {

      const user2 = await users.findOne(
        { remoteId: parseInt(payload.remote_id) },
        { session }
      );  
      if (!user2) {
        await session.abortTransaction();
        return res.json({ status: '500', msg: `Internal error User Not Found` });
      }
      await session.abortTransaction();
      return res.json({
        status: 404,
        balance: user2.availableBalance
      });
    }

  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    return res.json({
      status: 500,
      msg: `Internal error ${err}`
    });
  } finally {
    await session.endSession();
    await client.close();
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
