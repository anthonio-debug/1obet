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

function cashDepositLedger(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({
      errors: errors.errors,
    });
  }
  let page = 1;
  var sortValue = 'createdAt';
  var limit = config.pageSize;
  var sort = 1;
  if (req.body.page) {
    page = req.body.page;
  }
  if (req.body.sort) {
    sort = req.body.sort;
  }
  if (req.body.numRecords) {
    if (isNaN(req.body.numRecords))
      return res.status(404).send({ message: 'NUMBER_RECORD_IS_NOT_PROPER' });
    if (req.body.numRecords < 0)
      return res.status(404).send({ message: 'NUMBER_RECORDS_IS_NOT_PROPER' });
    if (req.body.numRecords > 1000)
      return res
        .status(404)
        .send({ message: 'NUMBER_RECORDS_NEED_TO_LESS_THAN_1000' });
    limit = Number(req.body.numRecords);
  }

  let match = { userId: req.body.userId };
  if (req.body.endDate && req.body.startDate) {
    match.createdAt = {
      $gte: req.body.startDate,
      $lte: req.body.endDate,
    };
  } else if (req.body.endDate) {
    match.createdAt = { $lte: req.body.endDate };
  } else if (req.body.startDate) {
    match.createdAt = { $gte: req.body.startDate };
  }

  if (req.body.searchValue) {
    const searchRegex = new RegExp(req.body.searchValue, 'i');
    match.$or = [
      { description: { $regex: searchRegex } },
      {
        $expr: {
          $regexMatch: { input: { $toString: '$amount' }, regex: searchRegex },
        },
      },
      {
        $expr: {
          $regexMatch: { input: { $toString: '$balance' }, regex: searchRegex },
        },
      },
    ];
  }

  CashDeposit.paginate(
    match,
    {
      page: page,
      sort: { [sortValue]: sort },
      limit: limit,
      select: '-_id userId description amount balance createdAt',
    },

    (err, results) => {
      if (!results || !results.total || results.total == 0) {
        return res.status(404).send({ message: 'No records found' });
      }
      if (err)
        return res
          .status(404)
          .send({ message: 'CASH_DEPOSIT_LEDGER_PAGINATION_FAILED' });
      return res.json({
        message: 'Cash Deposit Ledger Report found',
        results,
      });
    }
  );
}

function cashCreditLedger(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({
      errors: errors.errors,
    });
  }
  let page = 1;
  var sortValue = 'createdAt';
  var limit = config.pageSize;
  var sort = -1;
  if (req.body.page) {
    page = req.body.page;
  }
  if (req.body.sort) {
    sort = req.body.sort;
  }
  if (req.body.numRecords) {
    if (isNaN(req.body.numRecords))
      return res.status(404).send({ message: 'NUMBER_RECORD_IS_NOT_PROPER' });
    if (req.body.numRecords < 0)
      return res.status(404).send({ message: 'NUMBER_RECORDS_IS_NOT_PROPER' });
    if (req.body.numRecords > 1000)
      return res
        .status(404)
        .send({ message: 'NUMBER_RECORDS_NEED_TO_LESS_THAN_1000' });
    limit = Number(req.body.numRecords);
  }

  let match = {};
  if (req.body.endDate && req.body.startDate) {
    match.createdAt = {
      $gte: req.body.startDate,
      $lte: req.body.endDate,
    };
  } else if (req.body.endDate) {
    match.createdAt = { $lte: req.body.endDate };
  } else if (req.body.startDate) {
    match.createdAt = { $gte: req.body.startDate };
  }
  if (req.body.searchValue) {
    const searchRegex = new RegExp(req.body.searchValue, 'i');
    match.$or = [
      { description: { $regex: searchRegex } },
      {
        $expr: {
          $regexMatch: { input: { $toString: '$amount' }, regex: searchRegex },
        },
      },
      {
        $expr: {
          $regexMatch: { input: { $toString: '$balance' }, regex: searchRegex },
        },
      },
    ];
  }
  match.userId = req.body.userId;
  CashDeposit.paginate(
    match,
    {
      page: page,
      sort: { [sortValue]: sort },
      limit: limit,
      select: '-_id description amount balance createdAt',
    },

    (err, results) => {
      if (!results || !results.total || results.total == 0) {
        return res.status(404).send({ message: 'No records found' });
      }
      if (err)
        return res
          .status(404)
          .send({ message: 'CASH_DEPOSIT_LEDGER_PAGINATION_FAILED' });
      return res.json({
        message: 'Credit Ledger Report found',
        results,
      });
    }
  );
}

function getFinalReport(req, res) {
  let query = {};

  if (req.decoded.login.role !== '5') {
    query.createdBy = String(req.decoded.userId)
  }

  User.aggregate(
    [
      {
        $match: query,
      },
      {
        $group: {
          _id: '$userName',
          clientPL: { $sum: '$clientPL' },
        },
      },
      {
        $group: {
          _id: null,
          positiveClients: {
            $push: {
              $cond: {
                if: { $gte: ['$clientPL', 0] },
                then: { userName: '$_id', clientPL: '$clientPL' },
                else: null,
              },
            },
          },
          negativeClients: {
            $push: {
              $cond: {
                if: { $lt: ['$clientPL', 0] },
                then: { userName: '$_id', clientPL: '$clientPL' },
                else: null,
              },
            },
          },
          totalPositiveClientPL: {
            $sum: {
              $cond: {
                if: { $gte: ['$clientPL', 0] },
                then: '$clientPL',
                else: 0,
              },
            },
          },
          totalNegativeClientPL: {
            $sum: {
              $cond: {
                if: { $lt: ['$clientPL', 0] },
                then: '$clientPL',
                else: 0,
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          positiveClients: {
            $filter: {
              input: '$positiveClients',
              cond: { $ne: ['$$this', null] },
            },
          },
          negativeClients: {
            $filter: {
              input: '$negativeClients',
              cond: { $ne: ['$$this', null] },
            },
          },
          totalPositiveClientPL: 1,
          totalNegativeClientPL: 1,
        },
      },
    ],

    function (err, result) {
      console.log('rerrr', err);
      if (err) {
        return res.status(404).send({ message: 'final report not found' });
      }
      return res.send({
        success: true,
        message: 'final report found',
        results: result[0],
      });
    }
  );
}

function getClientList(req, res) {
  // Initialize variables with default values
  let query = { isDeleted: false };
  let countQuery = { isDeleted: false };

  if (req.query.userId) {
    const userId = parseInt(req.query.userId);
    query = { userId, isDeleted: false };
    countQuery.createdBy = userId;
  }
  // Retrieve the desired fields from the User collection
  User.findOne(query)
    // .select('credit creditRemaining clientPL plDownline plUpline')
    .exec((err, results) => {
      console.log('user', results);
      if (err) {
        return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
      }
      if (!results) {
        return res.status(404).send({ message: 'No records found' });
      }

      // Find the total user count for the logged-in user
      User.countDocuments(countQuery, (err, count) => {
        if (err) {
          return res.status(404).send({ message: 'COUNT_FAILED' });
        }
        // Combine the User fields and user count into a single response object
        const response = {
          creditRecieved: results.credit,
          creditRemaining: results.creditRemaining,
          cash: results.cash,
          plDownline: results.balance,
          balanceUpline: results.clientPL,
          users: count,
        };
        return res.send({
          success: true,
          message: 'client record found',
          results: response,
        });
      });
    });
}

function GetAllCashCreditLedger(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({
      errors: errors.errors,
    });
  }

  let match = {};
  if (req.body.endDate && req.body.startDate) {
    match.createdAt = {
      $gte: req.body.startDate,
      $lte: req.body.endDate,
    };
  } else if (req.body.endDate) {
    match.createdAt = { $lte: req.body.endDate };
  } else if (req.body.startDate) {
    match.createdAt = { $gte: req.body.startDate };
  }
  match.userId = req.body.userId;
  if (req.body.searchValue) {
    const searchRegex = new RegExp(req.body.searchValue, 'i');
    match.$or = [
      { description: { $regex: searchRegex } },
      {
        $expr: {
          $regexMatch: { input: { $toString: '$amount' }, regex: searchRegex },
        },
      },
      {
        $expr: {
          $regexMatch: { input: { $toString: '$balance' }, regex: searchRegex },
        },
      },
    ];
  }

  CashDeposit.find(
    match,
    { description: 1, amount: 1, balance: 1, createdAt: 1, _id: 0 },

    (err, results) => {
      if (err || !results)
        return res.status(404).send({ message: 'No Record found' });
      return res.json({
        message: 'ALL Credit Ledger Report found',
        results,
      });
    }
  );
}

function GetAllCashDepositLedger(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({
      errors: errors.errors,
    });
  }

  let match = {};
  if (req.body.endDate && req.body.startDate) {
    match.createdAt = {
      $gte: req.body.startDate,
      $lte: req.body.endDate,
    };
  } else if (req.body.endDate) {
    match.createdAt = { $lte: req.body.endDate };
  } else if (req.body.startDate) {
    match.createdAt = { $gte: req.body.startDate };
  }
  if (req.body.searchValue) {
    const searchRegex = new RegExp(req.body.searchValue, 'i');
    match.$or = [
      { description: { $regex: searchRegex } },
      {
        $expr: {
          $regexMatch: { input: { $toString: '$amount' }, regex: searchRegex },
        },
      },
      {
        $expr: {
          $regexMatch: { input: { $toString: '$balance' }, regex: searchRegex },
        },
      },
    ];
  }

  match.userId = req.body.userId;
  CashDeposit.find(
    match,
    { description: 1, amount: 1, balance: 1, createdAt: 1, _id: 0 },

    (err, results) => {
      if (err || !results)
        return res.status(404).send({ message: 'No Record found' });
      return res.json({
        message: 'ALL Cash Desposit Ledger Report found',
        results,
      });
    }
  );
}

function getDailyPLReport(req, res) {
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
    createdByIDs.push(userId); // Include the logged-in user in the query

    Deposits.find({ userId: { $in: createdByIDs }, ...depositsQuery }).exec(
      (err, deposits) => {
        if (err) {
          return res.status(404).send({ message: 'RETRIEVAL_FAILED' });
        }
        if (!deposits || deposits.length === 0) {
          return res.status(404).send({ message: 'No records found' });
        }

        // Retrieve user data for mapping
        const userIds = deposits.map((deposit) => deposit.userId);
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
              const existingUser = acc.find((user) => user.userId === deposit.userId);
              if (existingUser) {
                existingUser.amount += deposit.amount;
              } else {
                acc.push({
                  userId: deposit.userId,
                  userName: depositMap[deposit.userId],
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

function dailyPLSportsWiseReport(req, res) {
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
      const userIds = users.map((user) => user.userId);


      Deposits.find({ userId: { $in: userIds },  ...depositsQuery })
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


function dailyPlMarketsReports(req, res) {
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
  Deposits.find({ userId: userId, marketId: marketId, ...depositsQuery }, { _id: 0, amount: 1, createdAt:1 })
    .exec()
    .then((deposits) => {
      if (!deposits || deposits.length === 0) {
        return res.status(404).send({ message: 'No deposit records found' });
      }

      Bets.find({ userId: userId, marketId: marketId }, { _id: 0, event: 1, createdAt: 1 })
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

loginRouter.post(
  '/cashDepositLedger',
  reportValidator.validate('cashDepositLedger'),
  cashDepositLedger
);

loginRouter.post(
  '/cashCreditLedger',
  reportValidator.validate('cashDepositLedger'),
  cashCreditLedger
);

loginRouter.get('/getFinalReport', getFinalReport);

loginRouter.post('/GetAllCashCreditLedger', GetAllCashCreditLedger);

loginRouter.post('/GetAllCashDepositLedger', GetAllCashDepositLedger);

loginRouter.get('/getCLientList', getClientList);

loginRouter.get('/getDailyPLReport',reportValidator.validate('getDailyPLReport'), getDailyPLReport);
loginRouter.get('/dailyPLSportsWiseReport',reportValidator.validate('dailyPLSportsWiseReport'), dailyPLSportsWiseReport);
loginRouter.get('/dailyPlMarketsReports',reportValidator.validate('dailyPlMarketsReports'), dailyPlMarketsReports);

module.exports = { loginRouter };
