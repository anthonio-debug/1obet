const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const CashDeposit = require('../models/deposits');
const User = require('../models/user');
const loginRecord = require('../models/loginRecord');

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

async function getFinalReport(req, res) {


  const userId      = parseInt(req.decoded.userId)
  const currentUser = await User.findOne({ userId: userId});
  const users       = [];
  let parents       = [userId];
  let childUsers;

  do{
    childUsers     = await User.distinct("userId", {
      createdBy: {
        $in: parents
      }
    });
    console.log(" child users ======= ", childUsers);
    if(childUsers.length) users.push(...childUsers)
    parents = childUsers
  }while (childUsers.length > 0)

  let results = {
    negativeClients: [],
    positiveClients: [],
    totalNegativeClientPL: 0,
    totalPositiveClientPL: 0
  };

  //for parent and main account, amount's mean P/L Downline	(results.balance)
  //for chield, amount's mean Balance UpLine (results.clientPL) 


  const balanceUplines = await User.find({ userId: {$in: users} }, {_id: 1, userId: 1, clientPL: 1, userName: 1});
  
  
  //userName, clientPL, userId
  

  if (currentUser.balance> -1) {
    results.positiveClients.push({userName: currentUser.userName, userId:currentUser.userId,  clientPL: currentUser.balance});
    results.totalPositiveClientPL = results.totalPositiveClientPL + currentUser.balance;
  } else {
    results.negativeClients.push({userName: currentUser.userName, userId:currentUser.userId,  clientPL: currentUser.balance});
    results.totalNegativeClientPL = results.totalNegativeClientPL + currentUser.balance;
  }



  for (let index = 0; index < balanceUplines.length; index++) {
    const userRecord = balanceUplines[index];
    if (userRecord.clientPL> -1) {
      results.positiveClients.push({userName: userRecord.userName, userId:userRecord.userId,  clientPL: userRecord.cash});
      results.totalPositiveClientPL = results.totalPositiveClientPL + userRecord.cash;
    } else {
      results.negativeClients.push({userName: userRecord.userName, userId:userRecord.userId,  clientPL: userRecord.cash});
      results.totalNegativeClientPL = results.totalNegativeClientPL + userRecord.cash;
    }
  }

  if (currentUser.createdBy !== 0) {
    const parentUserData = await User.findOne({ userId: currentUser.createdBy }, {_id: 1, userId: 1, balance: 1, userName: 1});
    if (parentUserData) {
        results.negativeClients.push({userName: parentUserData.userName, userId:parentUserData.userId,  clientPL: currentUser.clientPL * -1});
        results.totalNegativeClientPL = results.totalNegativeClientPL + (currentUser.clientPL * -1);
    } else {
        results.negativeClients.push({userName: currentUser.userName, userId:currentUser.userId,  clientPL: currentUser.clientPL * -1});
        results.totalNegativeClientPL = results.totalNegativeClientPL + (currentUser.clientPL * -1);
    }
  } else {
        results.negativeClients.push({userName: currentUser.userName, userId:currentUser.userId,  clientPL: currentUser.clientPL * -1});
        results.totalNegativeClientPL = results.totalNegativeClientPL + (currentUser.clientPL * -1);
  }




  return res.send({
    success: true,
    message: 'final report found',
    results
  });


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

function profitLossReports(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  let depositsQuery = {};
  depositsQuery.cashOrCredit = 'Bet';
  if (req.query.endDate && req.query.startDate) {
    depositsQuery.createdAt = {
      $gte: req.query.startDate,
      $lte: req.query.endDate,
    };
  }

  const userId = req.decoded.userId;

  Deposits.aggregate([
    { $match: { userId: userId, ...depositsQuery } },
    {
      $lookup: {
        from: 'markettypes',
        localField: 'marketId',
        foreignField: 'marketId',
        as: 'marketInfo',
      },
    },
    { $unwind: '$marketInfo' },
    {
      $group: {
        _id: {
          date: '$createdAt',
          market: '$marketInfo.name',
          marketId: '$marketId',
        },
        totalAmount: { $sum: '$amount' },
      },
    },
    {
      $project: {
        _id: 0,
        Date: '$_id.date',
        Market: '$_id.market',
        MarketId: '$_id.marketId',
        Amount: '$totalAmount',
      },
    },
  ])
    .exec()
    .then((results) => {
      if (!results || results.length === 0) {
        return res
          .status(404)
          .send({ message: 'No profit/loss records found' });
      }

      const response = {
        success: true,
        message: 'Profit/Loss reports found',
        results: results,
      };

      return res.send(response);
    })
    .catch((err) => {
      console.log('Error retrieving profit/loss records:', err);
      return res
        .status(404)
        .send({ message: 'Error retrieving profit/loss records' });
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


async function userLoginActivitLogs(req, res) {

  if (!req.query.id) {
    return res.json({
      message: 'User login logs',
      results: [],
    });
  }

  if (req.query.id) {
    const results = await loginRecord.find({userId: parseInt(req.query.id)}).sort({createdAt: -1});
    return res.json({
      message: 'User login logs',
      results
    });
  }

  if (req.query.ip) {
    const results = await loginRecord.find({ipAddress: (req.query.ip)}).sort({createdAt: -1});
    return res.json({
      message: 'User login logs',
      results
    });
  }

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
loginRouter.get('/profitLossReports', profitLossReports);
loginRouter.get('/userLoginActivitLogs', userLoginActivitLogs);

module.exports = { loginRouter };
