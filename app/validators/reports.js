const { body } = require('express-validator');
const messages = require('../messages/messages');

module.exports.validate = (method) => {
  switch (method) {
    case 'cashDepositLedger': {
      return [
        body('startDate', 'startDate is required')
          .optional()
          .isString()
          .withMessage(' startDate must be string'),
        body('endDate', 'endDate is required')
          .optional()
          .isString()
          .withMessage('endDate must be string'),
        body('userId', 'userId is required')
          .exists()
          .isInt()
          .withMessage('userId must be a number'),
      ];
    }
  }
};
