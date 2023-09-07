const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const Cash = require('../models/deposits');
const User = require('../models/user');
const cashValidator = require('../validators/deposits');
const loginRouter = express.Router();

async function addCashDeposit(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {

    if ( req.body.amount < 1 ) {
      return res
        .status(400)
        .send({ message: `Invalid Amount!` });
    }

    const userToUpdate = await User.findOne({ 
      userId: req.body.userId,
      isDeleted: false
    });
    if (!userToUpdate) {
      return res.status(404).send({ message: 'user not found' });
    }
    
    const currentUserParent = await User.findOne({
      userId: userToUpdate.createdBy,
      isDeleted: false
    });
    if (!currentUserParent) {
      return res.status(404).send({ message: 'user not found' });
    }

    if (currentUserParent.role != '0') {
      if (  req.body.amount > (currentUserParent.cash + currentUserParent.credit )) {
        return res
          .status(400)
          .send({ message: `Max cash deposit is ${Math.floor(currentUserParent.cash + currentUserParent.credit)}` });
      }
    }

    let lastDeposit = await Cash.findOne({
      userId: userToUpdate.userId,
      cashOrCredit: 'Cash',
    }).sort({
      _id: -1,
    });

    let lastMaxWithdraw = await Cash.findOne({
      userId: userToUpdate.userId,
    }).sort({
      _id: -1,
    });

    let parentLastMaxWithdraw = await Cash.findOne({
      userId: currentUserParent.userId,
    }).sort({
      _id: -1,
    });

    let Dealers = ['1', '2', '3', '4'];
    // company to Dealer  Deposit 
    if (currentUserParent.role == '0' && userToUpdate.role != '5') {
      userToUpdate.clientPL += req.body.amount;
      userToUpdate.cash += req.body.amount
      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + req.body.amount : req.body.amount,
        cash: lastMaxWithdraw ? lastMaxWithdraw.cash + req.body.amount : req.body.amount,
        cashOrCredit: 'Cash',
      });
      await cash.save();

    } 
    // company to Battor 
    else if (currentUserParent.role == '0' && userToUpdate.role == '5') {
      userToUpdate.balance += req.body.amount;
      userToUpdate.availableBalance += req.body.amount;
      userToUpdate.clientPL += req.body.amount;
      userToUpdate.cash += req.body.amount;

      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance + req.body.amount  : req.body.amount,
        availableBalance: lastMaxWithdraw  ? lastMaxWithdraw.availableBalance + req.body.amount : req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + req.body.amount  : req.body.amount,
        cashOrCredit: 'Cash',
        cash: lastMaxWithdraw  ? lastMaxWithdraw.cash + req.body.amount : req.body.amount,
      });
      await cash.save();
    } 

    // Dealer to Dealer 
    else if (Dealers.includes(currentUserParent.role) && Dealers.includes(userToUpdate.role)) {
      userToUpdate.clientPL   += req.body.amount;
      userToUpdate.cash       += req.body.amount;
      // currentUserParent.clientPL -= req.body.amount;
      currentUserParent.cash -= req.body.amount;

      // Add Cash 
      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + req.body.amount : req.body.amount,
        cash: lastMaxWithdraw ? lastMaxWithdraw.cash + req.body.amount : req.body.amount,
        // balance : lastMaxWithdraw - 
        cashOrCredit: 'Cash',
      });
      await cash.save();
      // -VS Cash from parent 
      let parentCash = new Cash({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        maxWithdraw: parentLastMaxWithdraw ? parentLastMaxWithdraw.maxWithdraw - req.body.amount : -req.body.amount,
        cashOrCredit: 'Cash',
        cash: parentLastMaxWithdraw ? parentLastMaxWithdraw.cash - req.body.amount : -req.body.amount,
      });
      await parentCash.save();
    } 
    
    // Dealer to Battor 
    else if (Dealers.includes(currentUserParent.role) && userToUpdate.role == '5') {
      console.log('in here');
      userToUpdate.balance += req.body.amount;
      userToUpdate.availableBalance += req.body.amount;
      userToUpdate.clientPL += req.body.amount;
      userToUpdate.cash += req.body.amount;
      // currentUserParent.clientPL -= req.body.amount;
      currentUserParent.cash -= req.body.amount;

      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance + req.body.amount : req.body.amount,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + req.body.amount : req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + req.body.amount : req.body.amount,
        cash: lastMaxWithdraw ? lastMaxWithdraw.cash + req.body.amount : req.body.amount,
        cashOrCredit: 'Cash',
      });
      await cash.save();
      console.log("cash",cash);

      // parent update 
      let parentCash = new Cash({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        maxWithdraw: parentLastMaxWithdraw  ? parentLastMaxWithdraw.maxWithdraw - req.body.amount : -req.body.amount,
        cashOrCredit: 'Cash',
        maxWithdraw: parentLastMaxWithdraw ? parentLastMaxWithdraw.cash - req.body.amount : -req.body.amount,
      });
      await parentCash.save();
      console.log("parentCash",parentCash);
    } 
    else {
      return res.status(400).send({ message: 'Invalid Request' });
    }
    await userToUpdate.save();
    await currentUserParent.save();
    return res.send({
      success: true,
      message: 'Cash deposit added successfully',
      results: null,
    });
  } catch (err) {
    console.error(err);
    return res.status(404).send({ message: 'server error', err });
  }
}
 
//to do need to add balance and availablebalance for cronjob winning bet
async function withDrawCashDeposit(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    if ( req.body.amount < 1 ) {
      return res
        .status(400)
        .send({ message: `Invalid Amount!` });
    }
    const userToUpdate = await User.findOne({ userId: req.body.userId,
      isDeleted: false
    });
    if (!userToUpdate) {
      return res.status(404).send({ message: 'user not found' });
    }
    
    const currentUserParent = await User.findOne({
      userId: userToUpdate.createdBy,
      isDeleted: false
    });
    if (!currentUserParent) {
      return res.status(404).send({ message: 'user not found' });
    }

    if(userToUpdate.role != '5' &&  req.body.amount > (userToUpdate.cash + userToUpdate.creditRemaining ) ) {
    console.log("comming");
      return res
        .status(400)
        .send({ message: `Max cash withdraw is ${userToUpdate.clientPL + userToUpdate.creditRemaining}` });
    }
    else if(userToUpdate.role == '5' &&  req.body.amount > userToUpdate.availableBalance ){
        return res
          .status(400)
          .send({ message: `Max cash withdraw is ${userToUpdate.availableBalance }` });
    }

    let lastDeposit = await Cash.findOne({
      userId: userToUpdate.userId,
      cashOrCredit: 'Cash',
    }).sort({
      _id: -1,
    });

    let lastMaxWithdraw = await Cash.findOne({
      userId: userToUpdate.userId,
    }).sort({
      _id: -1,
    });

    let parentLastMaxWithdraw = await Cash.findOne({
      userId: currentUserParent.userId,
    }).sort({
      _id: -1,
    });

    let Dealers = ['1', '2', '3', '4'];
    // Company to Dealer 
    if (currentUserParent.role == '0' && userToUpdate.role != '5') {

      userToUpdate.clientPL -= req.body.amount;
      userToUpdate.cash -= req.body.amount;

      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - req.body.amount : -req.body.amount,
        cash: lastMaxWithdraw ? lastMaxWithdraw.cash - req.body.amount : -req.body.amount,
        cashOrCredit: 'Cash',
      });

      await cash.save();
    } 

    // Company to Battor 
    else if (currentUserParent.role == '0' && userToUpdate.role == '5') {
      userToUpdate.balance -= req.body.amount;
      userToUpdate.availableBalance -= req.body.amount;
      userToUpdate.clientPL -= req.body.amount;
      userToUpdate.cash -= req.body.amount;

      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance - req.body.amount : -req.body.amount,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - req.body.amount : -req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - req.body.amount : -req.body.amount,
        cash: lastMaxWithdraw ? lastMaxWithdraw.cash - req.body.amount: -req.body.amount,
        cashOrCredit: 'Cash',
      });
      await cash.save();
    } 

    //  Dealer to Dealer 
    else if (Dealers.includes(currentUserParent.role) && Dealers.includes(userToUpdate.role)) {
      userToUpdate.clientPL -= req.body.amount;
      userToUpdate.cash -= req.body.amount;
      // currentUserParent.clientPL += req.body.amount;
      currentUserParent.cash += req.body.amount;

      // Add Cash 
      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        maxWithdraw: lastMaxWithdraw  ? lastMaxWithdraw.maxWithdraw - req.body.amount : -req.body.amount,
        cash: lastMaxWithdraw ? lastMaxWithdraw.cash - req.body.amount : -req.body.amount,
        cashOrCredit: 'Cash',
      });
      await cash.save();
      // -VS Cash from parent 
      let parentCash = new Cash({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        maxWithdraw: parentLastMaxWithdraw ? parentLastMaxWithdraw.maxWithdraw + req.body.amount : req.body.amount,
        cash: parentLastMaxWithdraw ? parentLastMaxWithdraw.cash + req.body.amount : req.body.amount,
        cashOrCredit: 'Cash',
      });
      await parentCash.save();
    } 
    
    //  Dealer to Battor 
    else if (Dealers.includes(currentUserParent.role) && userToUpdate.role == '5') {
      userToUpdate.balance -= req.body.amount;
      userToUpdate.availableBalance -= req.body.amount;
      userToUpdate.clientPL -= req.body.amount;
      userToUpdate.cash -= req.body.amount;

      // currentUserParent.clientPL += req.body.amount;
      currentUserParent.cash += req.body.amount;

      let cash = new Cash({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance - req.body.amount : -req.body.amount,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - req.body.amount : -req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - req.body.amount : -req.body.amount,
        cash: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - req.body.amount : -req.body.amount,
        cashOrCredit: 'Cash',
      });
      await cash.save();

      // parent update 
      let parentCash = new Cash({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: 0,
        availableBalance: 0,
        maxWithdraw: parentLastMaxWithdraw ? parentLastMaxWithdraw.maxWithdraw + req.body.amount : req.body.amount,
        cash: parentLastMaxWithdraw ? parentLastMaxWithdraw.maxWithdraw + req.body.amount : req.body.amount,
        cashOrCredit: 'Cash',
      });
      await parentCash.save();

    } 
    else {
      return res.status(400).send({ message: 'Invalid Request' });
    }
    await userToUpdate.save();
    await currentUserParent.save();
    return res.send({
      success: true,
      message: 'Cash withdrawl added successfully',
      results: null,
    });
  } catch (err) {
    console.error(err);
    return res.status(404).send({ message: 'server error', err });
  }
}

function getLedgerDetails(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }

  const query = { userId: req.body.userId };
  let page = 1;
  let sort = 1;
  let sortValue = '_id';
  let limit = config.pageSize;
  
  if (req.body.numRecords && req.body.numRecords > 0 && !isNaN(req.body.numRecords)) limit = Number(req.body.numRecords);
  if (req.body.sortValue) sortValue = req.body.sortValue;
  if (req.body.sort) sort = Number(req.body.sort);
  if (req.body.page) page = Number(req.body.page);

  User.findOne(query,(err, user) => {
    if (err || !user) {
      return res.status(404).send({ message: 'User not found' });
    }

    let cashQuery = { userId: req.body.userId };

    if (user.role != '5' && req.body.type) {
      cashQuery.cashOrCredit = req.body.type;
    }
    
    // Add support for startDate and endDate search
    if (req.body.startDate && req.body.endDate) {
      cashQuery.createdAt = { $gte: req.body.startDate, $lte: req.body.endDate };
    }
    if (req.body.searchValue) {
      const searchRegex = new RegExp(req.body.searchValue, 'i');
      cashQuery.$or = [
        { description: { $regex: searchRegex } },
        {
          $expr: {
            $regexMatch: { input: { $toString: '$amount' }, regex: searchRegex },
          },
        },
        {
          $expr: {
            $regexMatch: { input: { $toString: '$maxWithdraw' }, regex: searchRegex },
          },
        },
      ];
    }
    Cash.paginate(cashQuery, { page: page, sort: { [sortValue]: sort }, limit: limit }, (err, results) => {
      if (err || !results || results.length == 0) {
        return res.status(404).send({ message: 'Deposit record not found' });
      }
      return res.send({
        message: 'Deposit Records', 
        results 
      });
    });
  });
}


function getAllDeposits(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }

  User.findOne({ userId: req.query.userId }, (err, user) => {
    if (err || !user) return res.status(404).send({ message: 'User not found' });
    User.findOne({ userId: user.createdBy }, (err, parentUser) => {
      if (err || !parentUser) return res.status(404).send({ message: 'User not found' });
      Cash.findOne(
        { userId: req.query.userId },
              //creditlimit should be of the parent user
        { maxWithdraw: 1 }
      )
        .sort({ _id: -1 })
        .exec((err, results) => {
          if (err){
            console.log("Error". err);
            return res.status(404).send({ message: 'Record not found' });
          }
          if(!results){
            return res.status(200).send({ 
              message: 'Record not found',
              results: {
                maxWithdraw: 0,
                creditLimit: 0,
                balance: 0,
                credit: 0,
                availableBalance: 0,
              }
            });
          }

          if (user.role == '5') {
            return res.send({
              message: 'Deposit Record Found',
              results: {
                maxWithdraw: user.cash,
                creditLimit: parentUser.creditRemaining,
                balance: user.balance,
                credit: user.credit,
                availableBalance: user.availableBalance,
              },
            });
          }
           else {
            return res.send({
              message: 'Deposit Record Found',
              results: {
                ...results._doc,
                creditLimit: parentUser.creditRemaining,
                balance: user.balance,
                credit: user.credit,
                availableBalance: user.availableBalance,
              },
            });
          }
        });
    });
  })
}

loginRouter.post(
  '/addCashDeposit',
  cashValidator.validate('addCashDeposit'),
  addCashDeposit
);
loginRouter.post(
  '/withDrawCashDeposit',
  cashValidator.validate('withDrawCashDeposit'),
  withDrawCashDeposit
);
loginRouter.post(
  '/getLedgerDetails',
  getLedgerDetails
);
loginRouter.get(
  '/getAllDeposits',
  getAllDeposits
);
module.exports = { loginRouter };
