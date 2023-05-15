const { body } = require('express-validator');

module.exports.validate = (method) => {
  switch (method) {
    case 'addAllowedMarketTypes': {
      return [
        body('status', 'status is required and must be an object')
          .exists()
          .isObject(),

        // Validate each property of the "status" object
        body('status.*', 'status must be a boolean').isIn([0, 1]),

        body('marketId', 'marketId is required and must be an array')
          .exists()
          .isArray(),
      ];
    }
  }
};
