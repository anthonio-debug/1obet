const express = require('express');
const User = require('../models/user');
const Deposits = require('../models/deposits');
const MarketType = require('../models/marketTypes');
const Bets = require('../models/bets');
const loginRouter = express.Router();

// Define the API endpoint
function getCurrentPosition(req, res) {
    Bets.find({})
      .exec()
      .then((bets) => {
        if (!bets || bets.length === 0) {
          return res.status(404).send({ message: 'No bet records found' });
        }
  
        const formattedData = {};
  
        for (const bet of bets) {
          const { sport, event, loosingAmount } = bet;
  console.log('bet.sport',bet.sport);
          if (!formattedData[sport]) {
            formattedData[sport] = [];
          }
  
          formattedData[sport].push({
            match: event,
            amount: loosingAmount
          });
        }
  
        const response = {
          success: true,
          message: 'current position found',
          results: [formattedData]
        };
  
        return res.send(response);
      })
      .catch((err) => {
        return res.status(404).send({ message: 'Error retrieving bet records' });
      });
  }
  
  

loginRouter.get('/getCurrentPosition', getCurrentPosition);

module.exports = { loginRouter };
