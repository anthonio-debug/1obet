const express           = require('express');
const User              = require('../models/user');
const router            = express.Router();
const CasinoDebits      = require('../models/casinoCalls');
const crypto            = require('crypto');
const config            = require('config')
const { MongoClient }   = require('mongodb');
const casinoMultiples   = config.casinoMultiples
const transactionOptions = {
  readPreference: 'primary',
  readConcern: { level: 'local' },
  writeConcern: { w: 'majority' }
};


const handleLosingBet = async (userId) =>{
  const userToUpdate = await User.findOne({
    remoteId: userId,
    isDeleted: false,
  });

  if (!userToUpdate) {
    return res.status(404).send({ message: "user not found" });
  }
  userToUpdate.balance  -= loosingAmount;
  userToUpdate.clientPL -= loosingAmount;
  userToUpdate.exposure += loosingAmount;
  await userToUpdate.save();

  let lastMaxWithdraw = await Cash.findOne({
    userId: userToUpdate.userId,
  }).sort({
    _id: -1,
  });
  let cash = new Cash({
    userId: userToUpdate.userId,
    description: bet.name,
    betId: bet._id,
    createdBy: 0,
    amount: - loosingAmount,
    balance: lastMaxWithdraw ? lastMaxWithdraw.balance - loosingAmount : -loosingAmount,
    availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - loosingAmount : -loosingAmount,
    maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + loosingAmount : loosingAmount,
    cashOrCredit: "Bet",
    cash: lastMaxWithdraw ? lastMaxWithdraw.cash - loosingAmount : -loosingAmount,
    marketId: bet.marketId,
  });
  await cash.save();

  const parentUserIds = await getParents(userId);

  const parentUser = await User.find({
    userId: {
      $in: [...parentUserIds],
    },
    isDeleted: false,
  }).sort({ role: -1 });

  if (!parentUser) {
    return res.status(404).send({ message: "user not found" });
  }

  const remainingAmount = bet.winningAmount;
  const TotalLoosingAmount = bet.loosingAmount;

  let prev = 0;
  parentUser.forEach((user) => {
    let current = user.downLineShare;
    user["commission"] = current - prev;
    prev = current;
  });

  let commissionFrom = userToUpdate.userId;

  parentUser.forEach(async (user) => {
    user.exposure += (user.commission / 100) * remainingAmount;
    user.availableBalance += (user.commission / 100) * remainingAmount + (user.commission / 100) * TotalLoosingAmount;
    user.balance  += (user.commission / 100) * TotalLoosingAmount;
    user.clientPL -= user.downLineShare != 100 ? ((100 - user.downLineShare) / 100) * TotalLoosingAmount: 0;
    user.save();
    let lastMaxWithdraw = await Cash.findOne({
      userId: user.userId,
    }).sort({
      _id: -1,
    });
    let cash = await new Cash({
      userId: user.userId,
      description: bet.name,
      betId: bet._id,
      createdBy: 0,
      amount: (user.commission / 100) * TotalLoosingAmount,
      balance: lastMaxWithdraw ? lastMaxWithdraw.balance + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
      availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
      maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
      commissionFrom: commissionFrom,
      cashOrCredit: "loosing",
      cash: lastMaxWithdraw ? lastMaxWithdraw.cash + (user.commission / 100) * TotalLoosingAmount : (user.commission / 100) * TotalLoosingAmount,
      marketId: bet.marketId,
    });
    cash.save();
    commissionFrom = user.userId;
  });

  await Bets.findByIdAndUpdate(bet._id, { status: 0 });
}


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

  // console.log('key:', key);
  // console.log('hash:', hash);
  // console.log('queryString:', queryString);

  if (hash !== key) {
    return res.json({
      status: 403,
      msg: 'INCORRECT_KEY_VALIDATION'
    });
  }

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
      balance: balance/casinoMultiples,
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
    console.log(" debt req.query ======= ", req.query);
    const casinoCalls = client.db('Bet99').collection('casinocalls');
    const users = client.db('Bet99').collection('users');

    const payload = req.query;
    const salt = config.saltKey;
    const key = payload.key;
    delete payload.key;
    
    const queryString = Object.keys(payload)
      .map(key => `${key}=${payload[key]}`)
      .join('&');
    const hash = createHashKey(salt, queryString);
    if (hash !== key) {
      return res.json({
        status: 403,
        msg: 'INCORRECT_KEY_VALIDATION'
      });
    }

    let updatedBalance = 0

    await session.withTransaction(async () => {

      // console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>> remote_id ${payload.remote_id}`)
      const sameTransId = await casinoCalls.countDocuments(
        { transaction_id: payload.transaction_id, remote_id: parseInt(payload.remote_id), round_id: payload.round_id, action: 'debit' },
        { session }
      );   
      // console.log('====== sameTransId', sameTransId)
      const user = await users.findOne(
        { remoteId: parseInt(payload.remote_id) },
        { session }
      )
      if (!user) {
        await session.abortTransaction();
        return res.json({ status: '500', msg: `Internal error no user` });
      }
      if (sameTransId > 0) {
        await session.abortTransaction();
        return res.json({
          status: 200,
          balance: user.availableBalance / casinoMultiples,
        });
      }
      // console.log('==========user', user)
      if (sameTransId > 0) {
        await session.abortTransaction();
        return res.json({
          status: 200,
          balance: user.availableBalance / casinoMultiples,
        });
      }
      let debitAmount =  parseInt(payload.amount);

      if (debitAmount > user.availableBalance * casinoMultiples) {
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

      updatedBalance = user.availableBalance - (debitAmount * casinoMultiples);
      if (updatedBalance < 0) {
        await session.abortTransaction();
        return res.json({ status: '500', msg: 'Negative balance not allowed!' });
      }
      let userResponse = await users.updateOne(
        {_id: user?._id},{$set: { availableBalance: updatedBalance}},
        { session }
        );
      // console.log('========== res', userResponse)
      const casinoDebits = new CasinoDebits(payload);
      await casinoDebits.save();

      // 
    }, transactionOptions);

    await session.commitTransaction();
    return res.json({
      status: 200,
      balance: updatedBalance / casinoMultiples
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
    console.log(" credit req.query ======= ", req.query);
    // console.log('======', session.emit())
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
    // console.log('hash', hash);

    if (hash !== key) {
      return res.json({
        status: 403,
        msg: 'INCORRECT_KEY_VALIDATION'
      });
    }

    // console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>> ${payload.remote_id}`);

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

      // console.log('====== sameTransId', sameTransId)
      const user = await users.findOne(
        { remoteId: parseInt(payload.remote_id) },
        { session, readPreference: 'primary'  }
      );  
      if (!user) {
        // console.log();
        await session.abortTransaction();
        return res.json({ status: '500', msg: `Internal Error no User` });
      }

      if (sameTransId > 0) {
        // console.log('====== same Trans already Exists ', sameTransId)
        await session.abortTransaction();
        return res.json({
          status: 200,
          balance: user.availableBalance / casinoMultiples,
        });
      }

      if (parseInt(payload.amount) < 0) {
        await session.abortTransaction();
        return res.json({
          status: 500,
          balance: user.availableBalance / casinoMultiples
        });
      }

      updatedBalance = user.availableBalance + (parseInt(payload.amount) * casinoMultiples);

      let userResponse   = await users.updateOne(
        {_id: user?._id},{$set: { availableBalance: updatedBalance}},
        { session, readPreference: 'primary'  }
        );

      // console.log('========== res', userResponse)
      const casinoDebits = new CasinoDebits(payload);
      await casinoDebits.save();

    }, transactionOptions);

    await session.commitTransaction();
    return res.json({
      status: 200,
      balance: updatedBalance / casinoMultiples,
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
  const client = new MongoClient(config.DBHost, { useUnifiedTopology: true });
  await client.connect();
  const session = client.startSession();
  try {
    console.log(" rollback req.query ======= ", req.query);
    // console.log('======', session.emit())
    const casinoCalls = client.db('Bet99').collection('casinocalls');
    const users = client.db('Bet99').collection('users');
    // session.startTransaction();
    const payload = req.query;
    const salt = config.saltKey;
    const key = payload.key;
    delete payload.key;
    const queryString = Object.keys(payload)
      .map(key => `${key}=${payload[key]}`)
      .join('&');
    // console.log('queryString', queryString);
    const hash = createHashKey(salt, queryString);
    // console.log('hash', hash);
    if (hash !== key) {
      return res.json({
        status: 403,
        msg: 'INCORRECT_KEY_VALIDATION'
      });
    }

    let updatedBalance = 0;
    if (payload.action == 'rollback'){
      await session.withTransaction(async () => {
        const sameTransId = await casinoCalls.countDocuments(
          {
            transaction_id: payload.transaction_id,
            remote_id: parseInt(payload.remote_id),
            // round_id: payload.round_id,
          },
          { session }
        ); 
        const user = await users.findOne(
          { remoteId: parseInt(payload.remote_id) },
          { session }
        ); 
        if (!user) {
          // console.log("user not found ");
          await session.abortTransaction();
          return res.json({ status: '500', msg: `Internal error User Not Found` });
        }
        if (sameTransId == 0) {
          await session.abortTransaction();
          return res.json({
            status: 404,
            balance: user.availableBalance / casinoMultiples,
          });
        }
        if (sameTransId > 1) {
          await session.abortTransaction();
          return res.json({
            status: 200,
            balance: user.availableBalance / casinoMultiples,
          });
        }

        const rollbackTransaction = await casinoCalls.findOne(
          {
            transaction_id: payload.transaction_id,
            remote_id: parseInt(payload.remote_id)
          },
          { session }
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
            balance: user.availableBalance / casinoMultiples
          });
        }
        updatedBalance = user.availableBalance +  (amount * casinoMultiples) ;
        let userResponse = await users.updateOne(
          {_id: user?._id},{$set: { availableBalance: updatedBalance}},
          { session }
        );
    
        // console.log("=========== >> userResponse", userResponse);

        const casinoDebits = new CasinoDebits(payload);
        await casinoDebits.save();
        await session.commitTransaction();

        return res.json({
          status: 200,
          balance: updatedBalance / casinoMultiples
        });


      }, transactionOptions);
    } else {
      const user2 = await users.findOne(
        { remoteId: parseInt(payload.remote_id) }
      );  
      if (!user2) {
        return res.json({ status: '500', msg: `Internal error User Not Found` });
      }else{
        return res.json({
          status: 404,
          balance: user2.availableBalance / casinoMultiples
        });
      }
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
