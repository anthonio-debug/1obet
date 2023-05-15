const { body } = require("express-validator");
const messages = require("../messages/messages");

module.exports.validate = (method) => {
  switch (method) {
    case "addModulePermissions": {
      return [
        body("module", "module is required")
          .exists()
          .isString()
          .withMessage(" module must be string"),
      ];
    }
  }
};
