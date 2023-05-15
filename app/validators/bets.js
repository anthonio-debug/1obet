const { body } = require('express-validator');
const messages = require('../messages/messages');

module.exports.validate = (method) => {
  switch (method) {
    case 'placeBet': {
      return [
        body('sportsId', 'sportsId is required')
          .exists()
          .isString()
          .withMessage('sportsId must be string'),
        body('selectedTeam', 'selectedTeam is required')
          .exists()
          .isString()
          .withMessage('selectedTeam must be string'),
        body('selectedTeam', 'selectedTeam is required')
          .exists()
          .isString()
          .withMessage('selectedTeam must be string'),
        body('betAmount', 'betAmount is required')
          .exists()
          .isInt()
          .withMessage('betAmount must be number'),
        body('betRate', 'betRate is required')
          .exists()
          .isFloat()
          .withMessage('betRate must be float'),
        body('matchId', 'matchId is required')
          .exists()
          .isString()
          .withMessage('matchId must be string'),
        body('subMarketId', 'subMarketId is required')
          .exists()
          .isString()
          .withMessage('subMarketId must be string'),
      ];
    }
  }
};
