const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const CashCredit = require('../models/deposits');

const User = require('../models/user');
const cashValidator = require('../validators/deposits');
const loginRouter = express.Router();

async function addCredit(req, res) {
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

    console.log("currentUserParent =========== ", currentUserParent);

    if (!currentUserParent) {
      return res.status(404).send({ message: 'user not found' });
    }

    if (currentUserParent.role != '0') {
      if ( req.body.amount > currentUserParent.creditRemaining  || 
          (currentUserParent.cash < 0 && req.body.amount >  currentUserParent.creditRemaining + currentUserParent.cash)
      ){
        return res
          .status(400)
          .send({ message: `Max available credit is is ${currentUserParent.cash < 0 ? currentUserParent.creditRemaining + currentUserParent.cash : currentUserParent.creditRemaining }` });
      }
    }

    let lastMaxWithdraw = await CashCredit.findOne({
      userId: userToUpdate.userId,
    }).sort({
      _id: -1,
    });

    let parentLastMaxWithdraw = await CashCredit.findOne({
      userId: currentUserParent.userId,
    }).sort({
      _id: -1,
    });

    let Dealers = ['1', '2', '3', '4'];
    // Company to Dealer 
    if (currentUserParent.role == '0' && userToUpdate.role != '5') {

      userToUpdate.credit += req.body.amount;
      userToUpdate.creditRemaining += req.body.amount;

      let cashCredit = new CashCredit({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        amount: req.body.amount,
        maxWithdraw: lastMaxWithdraw? lastMaxWithdraw.maxWithdraw + req.body.amount : req.body.amount,
        cash: lastMaxWithdraw?.cash || 0 ,
        credit: lastMaxWithdraw ? lastMaxWithdraw.credit + req.body.amount : req.body.amount,
        creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining + req.body.amount : req.body.amount,
        cashOrCredit: 'Credit',
        createdBy: req.decoded.userId,
      });
      await cashCredit.save();
    } 
    //  Company to Battor 
    else if (currentUserParent.role == '0' && userToUpdate.role == '5') {
      userToUpdate.balance += req.body.amount;
      userToUpdate.availableBalance += req.body.amount;
      userToUpdate.credit += req.body.amount;

      let cashCredit = new CashCredit({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance + req.body.amount : req.body.amount,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + req.body.amount : req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + req.body.amount : req.body.amount,
        cash: lastMaxWithdraw?.cash || 0 ,
        credit: lastMaxWithdraw ? lastMaxWithdraw.credit + req.body.amount : req.body.amount,
        cashOrCredit: 'Credit'
      });
      await cashCredit.save();
    } 

    // Dealer to Dealer
    else if (Dealers.includes(currentUserParent.role) && Dealers.includes(userToUpdate.role)) {
      currentUserParent.creditRemaining -= req.body.amount;

      userToUpdate.credit += req.body.amount;
      userToUpdate.creditRemaining += req.body.amount;

      // Add Cash 
      let cashCredit = new CashCredit({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + req.body.amount : req.body.amount,
        cash: lastMaxWithdraw?.cash || 0 ,
        credit: lastMaxWithdraw ? lastMaxWithdraw.credit + req.body.amount : req.body.amount,
        creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining + req.body.amount : req.body.amount,
        cashOrCredit: 'Credit',
      });
      await cashCredit.save();
      // -ve Cash from parent 
      let parentCash = new CashCredit({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        maxWithdraw: parentLastMaxWithdraw ? parentLastMaxWithdraw.maxWithdraw - req.body.amount : -req.body.amount,
        cash: parentLastMaxWithdraw?.cash || 0 ,
        credit: parentLastMaxWithdraw ? parentLastMaxWithdraw.credit - req.body.amount : -req.body.amount,
        creditRemaining: parentLastMaxWithdraw ? parentLastMaxWithdraw.creditRemaining - req.body.amount : -req.body.amount,
        cashOrCredit: 'Credit',
      });
      await parentCash.save();
    } 

    // Dealer to Battor 
    else if (Dealers.includes(currentUserParent.role) && userToUpdate.role == '5') {
      currentUserParent.creditRemaining -= req.body.amount;

      userToUpdate.balance += req.body.amount;
      userToUpdate.availableBalance += req.body.amount;
      userToUpdate.credit += req.body.amount;
      // userToUpdate.creditRemaining += req.body.amount;

      let cashCredit = new CashCredit({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance + req.body.amount : req.body.amount,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance + req.body.amount : req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw + req.body.amount  : req.body.amount,
        cash: lastMaxWithdraw?.cash || 0 ,
        credit: lastMaxWithdraw ? lastMaxWithdraw.credit + req.body.amount : req.body.amount,
        creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining +req.body.amount : req.body.amount,
        cashOrCredit: 'Credit',
      });
      await cashCredit.save();

      // parent update 
      let parentCash = new CashCredit({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        maxWithdraw: parentLastMaxWithdraw? parentLastMaxWithdraw.maxWithdraw - req.body.amount : -req.body.amount,
        cash: parentLastMaxWithdraw?.cash || 0 ,
        credit: parentLastMaxWithdraw ? parentLastMaxWithdraw.credit - req.body.amount : -req.body.amount,
        creditRemaining: parentLastMaxWithdraw ? parentLastMaxWithdraw.creditRemaining - req.body.amount : -req.body.amount,
        cashOrCredit: 'Credit',
      });
      await parentCash.save();

    } 
    else {
      return res.status(400).send({ message: 'Invalid Request!' });
    }
    await userToUpdate.save();
    await currentUserParent.save();

    return res.send({
      success: true,
      message: 'Credit added successfully',
      results: null,
    });
  } catch (err) {
    console.error(err);
    return res.status(404).send({ message: 'server error', err });
  }
}

async function withdrawCredit(req, res) {
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
    const userToUpdate = await User.findOne({ userId: req.body.userId ,isDeleted: false});
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

    if ( userToUpdate.role != '5'  &&  req.body.amount >  userToUpdate.clientPL && req.body.amount >  userToUpdate.creditRemaining) {

      if( userToUpdate.clientPL >  userToUpdate.creditRemaining){
       
      } return res
        .status(400)
        .send({ message: `Max credit to withdraw is ${userToUpdate.creditRemaining}` });
      return res
        .status(400)
        .send({ message: `Max credit to withdraw is ${userToUpdate.clientPL}` });
    }
    
    else if( userToUpdate.role == '5'  && (req.body.amount >  userToUpdate.availableBalance || req.body.amount >  userToUpdate.credit )){
      if( userToUpdate.availableBalance >  userToUpdate.credit){
        return res
        .status(400)
        .send({ message: `Max credit to withdraw is ${userToUpdate.credit}` });
      }
      return res
      .status(400)
      .send({ message: `Max credit to withdraw is ${userToUpdate.availableBalance}` });
    }

    let lastMaxWithdraw = await CashCredit.findOne({
      userId: userToUpdate.userId,
    }).sort({ _id: -1 });

    let parentLastMaxWithdraw = await CashCredit.findOne({
      userId: currentUserParent.userId,
    }).sort({ _id: -1 });

    let Dealers = ['1', '2', '3', '4'];
    //  Deealer to Company
    if (currentUserParent.role == '0' && userToUpdate.role != '5'){
      userToUpdate.credit -= req.body.amount;
      userToUpdate.creditRemaining -= req.body.amount;
      let cashCredit = new CashCredit({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - req.body.amount : req.body.amount,
        cash: lastMaxWithdraw?.cash || 0 ,
        credit: lastMaxWithdraw ? lastMaxWithdraw.credit - req.body.amount : -req.body.amount,
        creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining - req.body.amount : -req.body.amount,
        cashOrCredit: 'Credit',
      });
      await cashCredit.save();
    } 

    //  battor  to company  
    else if (currentUserParent.role == '0' && userToUpdate.role == '5'){
      userToUpdate.balance -= req.body.amount;
      userToUpdate.availableBalance -= req.body.amount;
      userToUpdate.credit -= req.body.amount;

      let cashCredit = new CashCredit({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: - req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance - req.body.amount : req.body.amount,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - req.body.amount : -req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - req.body.amount : -req.body.amount,
        cash: lastMaxWithdraw?.cash || 0 ,
        credit: lastMaxWithdraw ? lastMaxWithdraw.credit - req.body.amount : -req.body.amount,
        // creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining - req.body.amount : -req.body.amount,
        cashOrCredit: 'Credit',
      });
      await cashCredit.save();
    } 

    // Dealer to Dealer
    else if (Dealers.includes(currentUserParent.role) && Dealers.includes(userToUpdate.role)) {
      userToUpdate.credit -= req.body.amount;
      userToUpdate.creditRemaining -= req.body.amount;

      currentUserParent.creditRemaining += req.body.amount;

      // Add Cash 
      let cashCredit = new CashCredit({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - req.body.amount : req.body.amount,
        cash: lastMaxWithdraw?.cash || 0 ,
        credit: lastMaxWithdraw ? lastMaxWithdraw.credit - req.body.amount : -req.body.amount,
        creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining - req.body.amount : -req.body.amount,
        cashOrCredit: 'Credit',
      });
      await cashCredit.save();
      // -ve Cash from parent 
      let parentCash = new CashCredit({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Credit)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        maxWithdraw: parentLastMaxWithdraw ? parentLastMaxWithdraw.maxWithdraw + req.body.amount : req.body.amount,
        cash: parentLastMaxWithdraw?.cash || 0 ,
        credit: parentLastMaxWithdraw ? parentLastMaxWithdraw.credit + req.body.amount : req.body.amount,
        creditRemaining: parentLastMaxWithdraw ? parentLastMaxWithdraw.creditRemaining + req.body.amount : req.body.amount,
        cashOrCredit: 'Credit',
      });

      await parentCash.save();

    } 
    
    // Battor to Dealer 
    else if(Dealers.includes(currentUserParent.role) && userToUpdate.role == '5'){
      userToUpdate.balance -= req.body.amount;
      userToUpdate.availableBalance -= req.body.amount;
      userToUpdate.credit -= req.body.amount;

      currentUserParent.creditRemaining += req.body.amount;

      let cashCredit = new CashCredit({
        userId: userToUpdate.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: -req.body.amount,
        balance: lastMaxWithdraw ? lastMaxWithdraw.balance - req.body.amount : req.body.amount,
        availableBalance: lastMaxWithdraw ? lastMaxWithdraw.availableBalance - req.body.amount : req.body.amount,
        maxWithdraw: lastMaxWithdraw ? lastMaxWithdraw.maxWithdraw - req.body.amount : req.body.amount,
        cash: lastMaxWithdraw?.cash || 0 ,
        credit: lastMaxWithdraw ? lastMaxWithdraw.credit - req.body.amount : -req.body.amount,
        creditRemaining: lastMaxWithdraw ? lastMaxWithdraw.creditRemaining - req.body.amount : -req.body.amount,
        cashOrCredit: 'Credit',
      });

      await cashCredit.save();

      // parent update 
      let parentCash = new CashCredit({
        userId: currentUserParent.userId,
        description: req.body.description ? req.body.description : '(Cash)',
        createdBy: req.decoded.userId,
        amount: req.body.amount,
        maxWithdraw: parentLastMaxWithdraw ? parentLastMaxWithdraw.maxWithdraw + req.body.amount : req.body.amount,
        cash: parentLastMaxWithdraw?.cash || 0 ,
        credit: parentLastMaxWithdraw ? parentLastMaxWithdraw.credit + req.body.amount : req.body.amount,
        creditRemaining: parentLastMaxWithdraw ? parentLastMaxWithdraw.creditRemaining + req.body.amount : req.body.amount,
        cashOrCredit: 'Credit',
      });

      await parentCash.save();

    } 

    else {
      return res.status(400).send({ message: 'Invalid Request!' });
    }

    await userToUpdate.save();
    await currentUserParent.save();

    return res.send({
      success: true,
      message: 'Credit withdrawl added successfully',
      results: null,
    });
  } catch (err) {
    console.error(err);
    return res.status(404).send({ message: 'server error', err });
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
