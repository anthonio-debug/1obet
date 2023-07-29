const { body } = require('express-validator');
const messages = require('../messages/messages');

module.exports.validate = (method) => {
  switch (method) {
    case 'placeBet': {
      return [
        body('selectionId', 'selectionId is required')
          .exists()
          .isInt()
          .withMessage('selectionId must be number'),
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
        body('subMarketName', 'subMarketName is required')
          .exists()
          .isString()
          .withMessage('subMarketName must be string'),
      ];
    }
  }
};
