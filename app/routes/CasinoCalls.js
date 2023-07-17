const express = require('express');
const User = require('../models/user');
const router = express.Router();
const CasinoDebits = require('../models/casinoCalls');
const crypto = require('crypto');
const config = require('config')

// function validateKey(key, payload, salt) {
//   const { key: keyParam, ...queryParams } = payload;

//   const queryString = Object.keys(queryParams)
//     .sort()
//     .map(key => `${key}=${queryParams[key]}`)
//     .join('&');

//   const hash = crypto.createHash('sha1').update(salt + queryString).digest('hex');
//   console.log('queryString',queryString);
//   console.log('Hash',hash);

//   return hash === key;
// }

// function rollback(req, res) {
//   const payload = req.query;
//   const remoteId = payload.remote_id;
//   const salt = config.saltKey;

//   const key = payload.key;
//   delete payload.key;

//   console.log('Received key:', key);

//   if (!validateKey(key, payload, salt)) {
//     console.log('Key validation failed');
//     return res.json({
//       status: 403,
//       msg: 'INCORRECT_KEY_VALIDATION'
//     });
//   }

//   console.log('Key validation successful');

//   const casinoDebits = new CasinoDebits(payload);
//   casinoDebits.save((err, savedPayload) => {
//     if (err) {
//       console.error(err);
//       return res.json({
//         status: 500,
//         msg: 'Internal error'
//       });
//     }

//     User.findOne({ remoteId }, (err, user) => {
//       if (err || !user) {
//         return res.json({
//           status: 500,
//           msg: 'Internal error'
//         });
//       }

//       if (payload.action === 'rollback') {
//         user.availableBalance += payload.amount * 307;
//         user.save((err) => {
//           if (err) {
//             console.error(err);
//             return res.json({
//               status: 500,
//               msg: 'Internal error'
//             });
//           }

//           const updatedBalance = (user.availableBalance / 307).toFixed(2);

//           return res.json({
//             status: 200,
//             balance: updatedBalance
//           });
//         });
//       } else {
//         const updatedBalance = (user.availableBalance / 307).toFixed(2);

//         return res.json({
//           status: 200,
//           balance: updatedBalance
//         });
//       }
//     });
//   });
// }

function balance(req, res) {
  const payload = req.query;
  const casinoDebits = new CasinoDebits(payload);
  casinoDebits.save((err, savedPayload) => {
    if (err) {
      console.error(err);
      return res.send({ status: '500', msg: 'internal error' });
    }
  User.findOne({ remoteId: payload.remote_id }, (err, user) => {
    console.log('user',user);
    if (err || !user) {
      return res.send({ status: '500', msg: 'internal error' });
    }
    return res.send({
      status: 200,
      balance: (user.availableBalance / 307).toFixed(2),
    });
  });
 })
}

function debit(req, res) {
  const payload = req.query;
  User.findOneAndUpdate(
    { remoteId: payload.remote_id },
    { $inc: { availableBalance: -(payload.amount * 307) } },
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
}
 
function credit(req, res) {
  const payload = req.query
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
    user.availableBalance += req.query.amount * 307;
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
  const payload = req.query
  const remoteId = req.query.remote_id;
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
    if(req.query.action == 'rollback'){
      user.availableBalance += req.query.amount * 307;
      user.save();
    }
    return res.send({
      status: 200,
      balance: (user.availableBalance / 307).toFixed(2),
    });
  });
})
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
