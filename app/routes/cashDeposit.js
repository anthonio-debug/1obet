const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const Cash = require('../models/cashDeposit');
const User = require('../models/user');
const cashValidator = require('../validators/cashDeposit');
const loginRouter = express.Router();

async function addCashDeposit(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    const currentUser = await User.findOne({ userId: req.decoded.userId });
    if (!currentUser) {
      return res.status(404).send({ message: 'user not found' });
    }
    if (currentUser.balance < req.body.amount) {
      return res
        .status(400)
        .send({ message: 'Insufficient balance to make the deposit' });
    }
    const userToUpdate = await User.findOne({
      userId: req.body.userId,
      role: req.body.role,
    });
    if (!userToUpdate) {
      return res.status(404).send({ message: 'user not found' });
    }

    let lastDeposit = await Cash.findOne({
      userId: userToUpdate.userId,
    }).sort({
      _id: -1,
      cashOrCredit: -1,
    });
    if (req.decoded.role == '0') {
      if (
        req.body.role == '1' ||
        req.body.role == '2' ||
        req.body.role == '3' ||
        req.body.role == '4'
      ) {
        userToUpdate.clientPL += req.body.amount;
        userToUpdate.balance += req.body.amount;
      } else if (req.body.role == '5') {
        userToUpdate.balance += req.body.amount;
        userToUpdate.availableBalance += req.body.amount;
        userToUpdate.clientPL += req.body.amount;
      }
    }
    if (req.decoded.role == '1') {
      if (
        req.body.role == '2' ||
        req.body.role == '3' ||
        req.body.role == '4'
      ) {
        userToUpdate.clientPL += req.body.amount;
        userToUpdate.balance += req.body.amount;
      } else if (req.body.role == '5') {
        userToUpdate.balance += req.body.amount;
        userToUpdate.availableBalance += req.body.amount;
        userToUpdate.clientPL += req.body.amount;
      }
    }
    if (req.decoded.role == '2') {
      if (req.body.role == '3' || req.body.role == '4') {
        userToUpdate.clientPL += req.body.amount;
        userToUpdate.balance += req.body.amount;
      } else if (req.body.role == '5') {
        userToUpdate.balance += req.body.amount;
        userToUpdate.availableBalance += req.body.amount;
        userToUpdate.clientPL += req.body.amount;
      }
    } else if (req.decoded.role == '3') {
      if (req.body.role == '4') {
        userToUpdate.clientPL += req.body.amount;
        userToUpdate.balance += req.body.amount;
      } else if (req.body.role == '5') {
        userToUpdate.balance += req.body.amount;
        userToUpdate.availableBalance += req.body.amount;
        userToUpdate.clientPL += req.body.amount;
      }
    } else if (req.decoded.role == '4') {
      if (req.body.role == '5') {
        userToUpdate.balance += req.body.amount;
        userToUpdate.availableBalance += req.body.amount;
        userToUpdate.clientPL += req.body.amount;
      }
    }

    await userToUpdate.save();
    // if the user has made previous deposits, add the amount to the existing balance and availableBalance
    const newBalance = lastDeposit
      ? lastDeposit.balance + req.body.amount
      : req.body.amount;
    const newAvailableBalance = lastDeposit
      ? lastDeposit.availableBalance + req.body.amount
      : req.body.amount;

    const cash = new Cash({
      userId: userToUpdate.userId,
      description: req.body.description ? req.body.description : '(Cash)',
      createdBy: currentUser.role,
      amount: req.body.amount,
      balance: newBalance,
      availableBalance: newAvailableBalance,
      maxWithdraw: newBalance,
      cashOrCredit: 'Cash',
    });

    // if the user making the deposit is not the same as the user receiving the deposit, deduct the amount from the user's balance
    if (currentUser.userId !== userToUpdate.userId) {
      currentUser.balance -= req.body.amount;
      await currentUser.save();
    }

    await cash.save();

    return res.send({
      success: true,
      message: 'Cash deposit added successfully',
      results: cash,
    });
  } catch (err) {
    return res.status(404).send({ message: 'server error', err });
  }
}

async function withDrawCashDeposit(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (typeof req.body.amount === 'string') {
    return res.status(404).send({ message: 'amount must be integer' });
  }
  try {
    const currentUser = await User.findOne({ userId: req.decoded.userId });
    if (!currentUser) {
      return res.status(404).send({ message: 'user not found' });
    }

    const userToUpdate = await User.findOne({
      userId: req.body.userId,
      role: req.body.role,
    });
    if (!userToUpdate) {
      return res.status(404).send({ message: 'user not found' });
    }
    if (
      typeof userToUpdate.balance !== 'number' ||
      isNaN(userToUpdate.balance)
    ) {
      console.log('Invalid balance value:', userToUpdate.balance);
      return res.status(400).send({ message: 'Invalid balance value' });
    }
    // Check if the requested withdrawal amount is greater than the maxWithdraw amount
    if (req.body.amount > userToUpdate.clientPL) {
      return res
        .status(400)
        .send({ message: 'Requested amount exceeds max withdraw amount' });
    }
    let lastWithdraw = await Cash.findOne({
      userId: userToUpdate.userId,
    }).sort({
      _id: -1,
    });
    if (req.decoded.role == '0') {
      if (
        req.body.role == '1' ||
        req.body.role == '2' ||
        req.body.role == '3' ||
        req.body.role == '4'
      ) {
        userToUpdate.clientPL -= req.body.amount;
        userToUpdate.balance -= req.body.amount;
      } else if (req.body.role == '5') {
        userToUpdate.balance -= req.body.amount;
        userToUpdate.availableBalance -= req.body.amount;
        userToUpdate.clientPL -= req.body.amount;
      }
    }
    if (req.decoded.role == '1') {
      if (
        req.body.role == '2' ||
        req.body.role == '3' ||
        req.body.role == '4'
      ) {
        userToUpdate.clientPL -= req.body.amount;
        userToUpdate.balance -= req.body.amount;
      } else if (req.body.role == '5') {
        userToUpdate.balance -= req.body.amount;
        userToUpdate.availableBalance -= req.body.amount;
        userToUpdate.clientPL -= req.body.amount;
      }
    }
    if (req.decoded.role == '2') {
      if (req.body.role == '3' || req.body.role == '4') {
        userToUpdate.clientPL -= req.body.amount;
        userToUpdate.balance -= req.body.amount;
      } else if (req.body.role == '5') {
        userToUpdate.balance -= req.body.amount;
        userToUpdate.availableBalance -= req.body.amount;
        userToUpdate.clientPL -= req.body.amount;
      }
    } else if (req.decoded.role == '3') {
      if (req.body.role == '4') {
        userToUpdate.clientPL -= req.body.amount;
        userToUpdate.balance -= req.body.amount;
      } else if (req.body.role == '5') {
        userToUpdate.balance -= req.body.amount;
        userToUpdate.availableBalance -= req.body.amount;
        userToUpdate.clientPL -= req.body.amount;
      }
    } else if (req.decoded.role == '4') {
      userToUpdate.balance -= req.body.amount;
      if (req.body.role == '5') {
        userToUpdate.balance -= req.body.amount;
        userToUpdate.availableBalance -= req.body.amount;
        userToUpdate.clientPL -= req.body.amount;
      }
    }

    await userToUpdate.save();
    // if the user has made previous deposits, add the amount to the existing balance and availableBalance
    const newBalance = lastWithdraw
      ? lastWithdraw.balance - req.body.amount
      : req.body.amount;
    const newAvailableBalance = lastWithdraw
      ? lastWithdraw.availableBalance - req.body.amount
      : req.body.amount;
    // Create a new Cash object for the transaction
    const cash = new Cash({
      userId: userToUpdate.userId,
      description: req.body.description
        ? req.body.description
        : 'Cash withdrawal',
      createdBy: currentUser.role,
      amount: -req.body.amount,
      balance: newBalance,
      availableBalance: newAvailableBalance,
      maxWithdraw: newBalance,
      cashOrCredit: 'Cash',
    });

    // if the user making the deposit is not the same as the user receiving the deposit, deduct the amount from the user's balance
    if (currentUser.userId !== userToUpdate.userId) {
      currentUser.creditLimit += req.body.amount;
      currentUser.credit += req.body.amount;

      await currentUser.save();
    }

    await cash.save();

    return res.send({
      success: true,
      message: 'Cash withdrawl added successfully',
      results: cash,
    });
  } catch (err) {
    return res.status(404).send({ message: 'server error', err });
  }
}

function getAllCashDeposits(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }
  Cash.findOne(
    { userId: req.query.userId },
    { credit: 1, balance: 1, maxWithdraw: 1, userId: 1 }
  )
    .sort({ _id: -1 })
    .exec((err, results) => {
      if (err || !results)
        return res
          .status(404)
          .send({ message: 'cash deposit record not found' });
      else return res.send({ message: 'Cash Deposit Record Found', results });
    });
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
loginRouter.get(
  '/getAllCashDeposits',
  cashValidator.validate('getAllCashDeposits'),
  getAllCashDeposits
);

module.exports = { loginRouter };
