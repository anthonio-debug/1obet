const { body } = require('express-validator');

module.exports.validate = (method) => {
  switch (method) {
    case 'addAllowedMarketTypes': {
      return [
        body('blocked', 'blocked object is required and must be an object')
          .exists()
          .isObject()
      ];
    }
  }
};
