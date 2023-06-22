const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const CashDeposit = require('../models/deposits');
const User = require('../models/user');

const reportValidator = require('../validators/reports');
const Deposits = require('../models/deposits');
const MarketType = require('../models/marketTypes');
const Bets = require('../models/bets');
const loginRouter = express.Router();

function getCommissionReport(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  let query = {};
  let depositsQuery = {};
  let userId = String(req.decoded.userId);

  if (req.decoded.role !== '5') {
    query.createdBy = userId;
  }

  if (req.query.endDate && req.query.startDate) {
    depositsQuery.createdAt = {
      $gte: req.query.startDate,
      $lte: req.query.endDate,
    };
  }

  User.find(query, (err, users) => {
    if (err || !users) {
      return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
    }
    if (!users || users.length === 0) {
      return res.status(404).send({ message: 'No users found' });
    }

    let createdByIDs = users.map((user) => user.userId);
    Deposits.find({ commissionFrom: { $in: createdByIDs }, ...depositsQuery }).exec(
      (err, deposits) => {
        if (err) {
          return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
        }
        if (!deposits || deposits.length === 0) {
          return res.status(404).send({ message: 'No records found' });
        }

        // Retrieve user data for mapping
        const userIds = deposits.map((deposit) => deposit.commissionFrom);
        User.find(
          { userId: { $in: userIds } },
          'userId userName',
          (err, users) => {
            if (err) {
              return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
            }

            // Map user data to deposits
            const depositMap = {};
            users.forEach((user) => {
              depositMap[user.userId] = user.userName;
            });

            const results = deposits.reduce((acc, deposit) => {
              const existingUser = acc.find((user) => user.userId === deposit.commissionFrom);
              if (existingUser) {
                existingUser.amount += deposit.amount;
              } else {
                acc.push({
                  userId: deposit.commissionFrom,
                  userName: depositMap[deposit.commissionFrom],
                  amount: deposit.amount,
                });
              }
              return acc;
            }, []);

            return res.send({
              success: true,
              message: 'daily pl records found',
              results: results,
            });
          }
        )
      });
  });
}

function sportsWiseCommissionReport(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  let depositsQuery = {};

  if (req.query.endDate && req.query.startDate) {
    depositsQuery.createdAt = {
      $gte: req.query.startDate,
      $lte: req.query.endDate,
    };
  }


  User.find({userId: req.query.userId})
    .then((users) => {
      if (!users || users.length === 0) {
        return res.status(404).send({ message: 'No users found' });
      }     
      Deposits.find({ commissionFrom: req.query.userId,  ...depositsQuery })
        .exec()
        .then((deposits) => {
          if (!deposits || deposits.length === 0) {
            return res.status(404).send({ message: 'No records found' });
          }

          const marketIds = deposits.map((deposit) => deposit.marketId);

          MarketType.find({ marketId: { $in: marketIds } }, 'marketId name')
            .then((markets) => {
              const marketMap = {};
              markets.forEach((market) => {
                marketMap[market.marketId] = market.name;
              });

              const results = deposits.reduce((acc, deposit) => {
                const existingMarket = acc.find((item) => item.name === marketMap[deposit.marketId]);
                if (existingMarket) {
                  existingMarket.amount += deposit.amount;
                } else {
                  acc.push({
                    name: marketMap[deposit.marketId],
                    amount: deposit.amount,
                  });
                }
                return acc;
              }, []);

              return res.send({
                success: true,
                message: 'daily sportswise pl records found',
                results: results,
              });
            })
            .catch((err) => {
              return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
            });
        })
        .catch((err) => {
          return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
        });
    })
    .catch((err) => {
      return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
    });
}

function MarketWiseCommissionReport(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }


  let depositsQuery = {};

  if (req.query.endDate && req.query.startDate) {
    depositsQuery.createdAt = {
      $gte: req.query.startDate,
      $lte: req.query.endDate,
    };
  }


  const userId = req.query.userId;
  const marketId = req.query.marketId;
  Deposits.find({ commissionFrom: userId, marketId: marketId, ...depositsQuery }, { _id: 0, amount: 1, createdAt:1 })
    .exec()
    .then((deposits) => {
      if (!deposits || deposits.length === 0) {
        return res.status(404).send({ message: 'No deposit records found' });
      }

      Bets.find({ marketId: marketId }, { _id: 0, event: 1, createdAt: 1 })
        .exec()
        .then((bets) => {
          if (!bets || bets.length === 0) {
            return res.status(404).send({ message: 'No bet records found' });
          }

          const totalAmount = deposits.reduce((sum, deposit) => sum + deposit.amount, 0);

          const response = {
            success: true,
            message: 'Daily PL Markets Reports found',
            results: [{
              Date: deposits[0].createdAt,
              Event: bets[0].event,
              Amount: totalAmount,
            }],
          };

          return res.send(response);
        })
        .catch((err) => {
          return res.status(404).send({ message: 'Error retrieving bet records' });
        });
    })
    .catch((err) => {
      return res.status(404).send({ message: 'Error retrieving deposit records' });
    });
}

loginRouter.get('/getCommissionReport',reportValidator.validate('getDailyPLReport'), getCommissionReport);
loginRouter.get('/sportsWiseCommissionReport',reportValidator.validate('dailyPLSportsWiseReport'), sportsWiseCommissionReport);
loginRouter.get('/MarketWiseCommissionReport',reportValidator.validate('dailyPlMarketsReports'), MarketWiseCommissionReport);

module.exports = { loginRouter };
