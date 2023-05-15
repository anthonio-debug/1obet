const { body } = require('express-validator');
const messages = require('../messages/messages');

module.exports.validate = (method) => {
  switch (method) {
    case 'addBetFairGame': {
      return [
        body('title', 'title is required')
          .exists()
          .withMessage('title must be string '),
        body('type', 'type is required')
          .exists()
          .isInt()
          .withMessage('type must be integer'),
      ];
    }
  }
};
