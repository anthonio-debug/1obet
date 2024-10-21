const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const CashCredit = require('../models/deposits');
const User = require('../models/user');
const cashValidator = require('../validators/deposits');
const ExpRec = require("../models/ExpRec");

const loginRouter = express.Router();

async function addCredit(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { amount, description = '(Credit)', userId } = req.body;

    if (amount < 1) {
      return res.status(400).json({ message: 'Invalid Amount!' });
    }

    const userToUpdate = await User.findOne({ userId, isDeleted: false });
    if (!userToUpdate) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUserParent = await User.findOne({ userId: userToUpdate.createdBy, isDeleted: false });
    if (!currentUserParent) {
      return res.status(404).json({ message: 'Parent user not found' });
    }

    if (currentUserParent.role !== '0') {
      const maxAvailableCredit = currentUserParent.creditRemaining + Math.min(0, currentUserParent.cash);
      if (amount > maxAvailableCredit) {
        return res.status(400).json({ message: `Max available credit is ${maxAvailableCredit}` });
      }
    }

    const lastUserCashCredit = await CashCredit.findOne({ userId: userToUpdate.userId }).sort({ _id: -1 });
    const lastParentCashCredit = await CashCredit.findOne({ userId: currentUserParent.userId }).sort({ _id: -1 });

    const Dealers = ['1', '2', '3', '4'];

    if (currentUserParent.role === '0' && userToUpdate.role !== '5') {
      userToUpdate.credit += amount;
      userToUpdate.creditRemaining += amount;
      await createCashCreditRecord(userToUpdate, amount, lastUserCashCredit, description);

    } else if (currentUserParent.role === '0' && userToUpdate.role === '5') {
      userToUpdate.balance += amount;
      userToUpdate.availableBalance += amount;
      userToUpdate.credit += amount;
      userToUpdate.creditRemaining += amount;
      await createCashCreditRecord(userToUpdate, amount, lastUserCashCredit, description);

    } else if (Dealers.includes(currentUserParent.role) && Dealers.includes(userToUpdate.role)) {
      currentUserParent.creditRemaining -= amount;
      userToUpdate.credit += amount;
      userToUpdate.creditRemaining += amount;

      await createCashCreditRecord(userToUpdate, amount, lastUserCashCredit, description);
      await createCashCreditRecord(currentUserParent, -amount, lastParentCashCredit, description);

    } else if (Dealers.includes(currentUserParent.role) && userToUpdate.role === '5') {
      currentUserParent.creditRemaining -= amount;
      userToUpdate.balance += amount;
      userToUpdate.availableBalance += amount;
      userToUpdate.credit += amount;
      userToUpdate.creditRemaining += amount;

      await createCashCreditRecord(userToUpdate, amount, lastUserCashCredit, description);
      await createCashCreditRecord(currentUserParent, -amount, lastParentCashCredit, description);

    } else {
      return res.status(400).json({ message: 'Invalid Request!' });
    }

    await userToUpdate.save();
    await currentUserParent.save();

    const updatedUser = await User.findOne({ userId, isDeleted: false });
    await logTransaction(updatedUser, userToUpdate, 'creditDeposit', lastUserCashCredit);

    return res.json({ success: true, message: 'Credit added successfully' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }

  async function createCashCreditRecord(user, amount, lastCashCredit, description) {
    const cashCredit = new CashCredit({
      userId: user.userId,
      description,  // Now properly passed
      createdBy: req.decoded.userId,
      amount,
      balance: lastCashCredit ? lastCashCredit.balance + amount : amount,
      availableBalance: lastCashCredit ? lastCashCredit.availableBalance + amount : amount,
      maxWithdraw: lastCashCredit ? lastCashCredit.maxWithdraw + amount : amount,
      cash: lastCashCredit?.cash || 0,
      credit: user.credit,
      creditRemaining: user.creditRemaining,
      cashOrCredit: 'Credit',
    });
    await cashCredit.save();
  }

  async function logTransaction(updatedUser, userToUpdate, transType, lastCashCredit) {
    const ExpTran = new ExpRec({
      userId: updatedUser.userId,
      trans_from: transType,
      trans_from_id: lastCashCredit._id,
      trans_bet_status: 0,
      user_prev_balance: userToUpdate.balance,
      user_prev_availableBalance: userToUpdate.availableBalance,
      user_prev_exposure: userToUpdate.exposure,
      user_new_balance: updatedUser.balance,
      user_new_availableBalance: updatedUser.availableBalance,
      user_new_exposure: updatedUser.exposure,
    });
    await ExpTran.save();
  }
}

async function withdrawCredit(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { amount, description = '(Credit)', userId } = req.body;

    if (amount < 1) {
      return res.status(400).json({ message: 'Invalid Amount!' });
    }

    const userToUpdate = await User.findOne({ userId, isDeleted: false });
    if (!userToUpdate) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUserParent = await User.findOne({ userId: userToUpdate.createdBy, isDeleted: false });
    if (!currentUserParent) {
      return res.status(404).json({ message: 'Parent user not found' });
    }

    if (!isValidWithdrawal(userToUpdate, amount)) {
      return res.status(400).json({ message: 'Invalid withdrawal amount' });
    }

    const lastUserCashCredit = await CashCredit.findOne({ userId: userToUpdate.userId }).sort({ _id: -1 });
    const lastParentCashCredit = await CashCredit.findOne({ userId: currentUserParent.userId }).sort({ _id: -1 });

    const Dealers = ['1', '2', '3', '4'];

    if (currentUserParent.role === '0' && userToUpdate.role !== '5') {
      userToUpdate.credit -= amount;
      userToUpdate.creditRemaining -= amount;
      await createCashCreditRecord(userToUpdate, -amount, lastUserCashCredit, description);

    } else if (currentUserParent.role === '0' && userToUpdate.role === '5') {
      userToUpdate.balance -= amount;
      userToUpdate.availableBalance -= amount;
      userToUpdate.credit -= amount;
      userToUpdate.creditRemaining -= amount;
      await createCashCreditRecord(userToUpdate, -amount, lastUserCashCredit, description);

    } else if (Dealers.includes(currentUserParent.role) && Dealers.includes(userToUpdate.role)) {
      userToUpdate.credit -= amount;
      userToUpdate.creditRemaining -= amount;
      currentUserParent.creditRemaining += amount;
      currentUserParent.credit += amount;

      await createCashCreditRecord(userToUpdate, -amount, lastUserCashCredit, description);
      await createCashCreditRecord(currentUserParent, amount, lastParentCashCredit, description);

    } else if (Dealers.includes(currentUserParent.role) && userToUpdate.role === '5') {
      userToUpdate.balance -= amount;
      userToUpdate.availableBalance -= amount;
      userToUpdate.credit -= amount;
      userToUpdate.creditRemaining -= amount;
      currentUserParent.creditRemaining += amount;
      currentUserParent.credit += amount;

      await createCashCreditRecord(userToUpdate, -amount, lastUserCashCredit, description);
      await createCashCreditRecord(currentUserParent, amount, lastParentCashCredit, description);

    } else {
      return res.status(400).json({ message: 'Invalid Request!' });
    }

    await userToUpdate.save();
    await currentUserParent.save();

    const updatedUser = await User.findOne({ userId, isDeleted: false });
    await logTransaction(updatedUser, userToUpdate, 'creditWithdraw', lastUserCashCredit);

    return res.json({ success: true, message: 'Credit withdrawal added successfully' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }

  function isValidWithdrawal(userToUpdate, amount) {
    if (userToUpdate.role !== '5') {
      const maxCredit = userToUpdate.creditRemaining + Math.min(0, userToUpdate.cash);
      return amount <= maxCredit;
    } else {
      return amount <= Math.min(userToUpdate.availableBalance, userToUpdate.credit);
    }
  }

  async function createCashCreditRecord(user, amount, lastCashCredit, description) {
    const cashCredit = new CashCredit({
      userId: user.userId,
      description,  // Now properly passed
      createdBy: req.decoded.userId,
      amount,
      balance: lastCashCredit ? lastCashCredit.balance + amount : amount,
      availableBalance: lastCashCredit ? lastCashCredit.availableBalance + amount : amount,
      maxWithdraw: lastCashCredit ? lastCashCredit.maxWithdraw + amount : amount,
      cash: lastCashCredit?.cash || 0,
      credit: user.credit,
      creditRemaining: user.creditRemaining,
      cashOrCredit: 'Credit',
    });
    await cashCredit.save();
  }

  async function logTransaction(updatedUser, userToUpdate, transType, lastCashCredit) {
    const ExpTran = new ExpRec({
      userId: updatedUser.userId,
      trans_from: transType,
      trans_from_id: lastCashCredit._id,
      trans_bet_status: 0,
      user_prev_balance: userToUpdate.balance,
      user_prev_availableBalance: userToUpdate.availableBalance,
      user_prev_exposure: userToUpdate.exposure,
      user_new_balance: updatedUser.balance,
      user_new_availableBalance: updatedUser.availableBalance,
      user_new_exposure: updatedUser.exposure,
    });
    await ExpTran.save();
  }
}


function getAllCredits(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ errors: errors.errors });
  }
  User.findOne({ userId: req.decoded.userId }, (err, success) => {
    if (err || !success)
      return res.status(404).send({ message: 'user not found' });

    CashCredit.findOne(
      { userId: req.query.userId, cashOrCredit:'Credit' },
      //creditlimit should be of the user that is login
      { credit: 1, availableBalance: 1 }
    )
      .sort({ _id: -1 })
      .exec((err, results) => {
        if (err || !results)
          return res.status(404).send({ message: 'Credit Record Not Found' });
        else
          return res.send({
            message: 'Credit Record Found',
            results: {
              ...results._doc,
              credit: success.credit,
            },
          });
      });
  });
}

loginRouter.post(
  '/addCredit',
  cashValidator.validate('withDrawCashDeposit'),
  addCredit
);
loginRouter.post(
  '/withdrawCredit',
  cashValidator.validate('withDrawCashDeposit'),
  withdrawCredit
);
loginRouter.get(
  '/getAllCredits',
  cashValidator.validate('getAllCashDeposits'),
  getAllCredits
);
module.exports = { loginRouter };
