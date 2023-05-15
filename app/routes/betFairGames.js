const express = require('express');
const { validationResult } = require('express-validator');
const betFairGameValidator = require('../validators/betFairGames');
const BetFairGames = require('../models/betFairGames');
const loginRouter = express.Router();

function addBetFairGame(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  let betFairGames = new BetFairGames(req.body);
  betFairGames.save((err, results) => {
    if (err || !results)
      return res.status(404).send({ message: 'Betfair Game Not Saved' });
    return res.send({ message: 'BetFair Game Added Successfully' });
  });
}

function GetAllBetFairGames(req, res) {
  BetFairGames.find({}, (err, success) => {
    if (err || !success)
      return res.status(404).send({ message: 'BetFair Games Not Found' });
    else
      return res.send({
        message: 'BetFair Games Record Found',
        results: success,
      });
  });
}

loginRouter.post(
  '/addBetFairGame',
  betFairGameValidator.validate('addBetFairGame'),
  addBetFairGame
);

loginRouter.get('/GetAllBetFairGames', GetAllBetFairGames);

module.exports = { loginRouter };
