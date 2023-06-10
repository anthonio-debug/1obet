const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const CashDeposit = require('../models/deposits');
const User = require('../models/user');

const reportValidator = require('../validators/reports');
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
    query.userId = parseInt(req.decoded.createdBy);
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

//to do
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
module.exports = { loginRouter };
