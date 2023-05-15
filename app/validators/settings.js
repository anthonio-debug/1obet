const { body } = require('express-validator');
const messages = require('../messages/messages');

module.exports.validate = (method) => {
  switch (method) {
    case 'updateDefaultTheme': {
      return [
        body('oldThemeName', 'please enter oldThemeName')
          .exists()
          .isString()
          .withMessage('oldThemeName must be string'),
        body('newThemeName', 'please enter newThemeName')
          .exists()
          .isString()
          .withMessage('newThemeName must be string'),
      ];
    }
    case 'updateDefaultLoginPage': {
      return [
        body('oldLoginPage', 'please enter oldLoginPage')
          .exists()
          .isString()
          .withMessage('oldLoginPage must be string'),
        body('newLoginPage', 'please enter newLoginPage')
          .exists()
          .isString()
          .withMessage('newLoginPage must be string'),
      ];
    }
    case 'addTermsAndConditions': {
      return [
        body(
          'termAndConditionsContent',
          'please enter termAndConditionsContent'
        )
          .exists()
          .isString()
          .withMessage('termAndConditionsContent must be string'),
      ];
    }
    case 'addPrivacyPolicy': {
      return [
        body('privacyPolicyContent', 'please enter privacyPolicyContent')
          .exists()
          .isString()
          .withMessage('privacyPolicyContent must be string'),
      ];
    }
    case 'updateDefaultExchange': {
      return [
        body('currency', 'please enter currency')
          .exists()
          .isString()
          .withMessage('currency must be string'),
        body('exchangeAmount', 'please enter exchangeAmount')
          .exists()
          .isInt()
          .withMessage('exchangeAmount must be Number'),
      ];
    }
    case 'updateDefaultBetSizes': {
      return [
        body('soccer', 'please enter valid soccer amount')
          .exists()
          .isInt({ min: 0 })
          .withMessage('soccer must be a positive integer'),
        body('tennis', 'please enter valid tennis amount')
          .exists()
          .isInt({ min: 0 })
          .withMessage('tennis must be a positive integer'),
        body('cricket', 'please enter valid cricket amount')
          .exists()
          .isInt({ min: 0 })
          .withMessage('cricket must be a positive integer'),
        body('fancy', 'please enter valid fancy amount')
          .exists()
          .isInt({ min: 0 })
          .withMessage('fancy must be a positive integer'),
        body('races', 'please enter valid races amount')
          .exists()
          .isInt({ min: 0 })
          .withMessage('races must be a positive integer'),
        body('casino', 'please enter valid casino amount')
          .exists()
          .isInt({ min: 0 })
          .withMessage('casino must be a positive integer'),
        body('greyHound', 'please enter valid greyHound amount')
          .exists()
          .isInt({ min: 0 })
          .withMessage('greyHound must be a positive integer'),
        body('bookMaker', 'please enter valid bookMaker amount')
          .exists()
          .isInt({ min: 0 })
          .withMessage('bookMaker must be a positive integer'),
        body('iceHockey', 'please enter valid iceHockey amount')
          .exists()
          .isInt({ min: 0 })
          .withMessage('iceHockey must be a positive integer'),
        body('snooker', 'please enter valid snooker amount')
          .exists()
          .isInt({ min: 0 })
          .withMessage('snooker must be a positive integer'),
        body('kabbadi', 'please enter valid kabbadi amount')
          .exists()
          .isInt({ min: 0 })
          .withMessage('kabbadi must be a positive integer'),
      ];
    }
  }
};
