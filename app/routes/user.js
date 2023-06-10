const express = require('express');
var jwt = require('jsonwebtoken');
const userValidation = require('../validators/user');
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
let config = require('config');
const User = require('../models/user');
const LoginActivity = require('../models/loginActivity');
const Settings = require('../models/settings');
const BetLimits = require('../models/betLimits');
const UserBetSizes = require('../models/userBetSizes');
const axios = require('axios');

var getIP = require('ipware')().get_ip;

const router = express.Router();
const loginRouter = express.Router();
const app = express();

async function registerUser(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  if (req.decoded.role == '5') {
    return res.status(404).send({ message: 'you are not allowed to do this ' });
  }
  if (req.body.role !== '5') {
    if (!req.body.downLineShare) {
      return res.status(404).send({ message: 'downLineShare is required' });
    }
  }
  User.findOne()
    .sort({ userId: -1 })
    .exec(async (err, data) => {
      if (err) return res.status(404).send({ message: 'user not found', err });

      const user = new User(req.body);
      // Check if the user's role is 5, and if so, set downLineShare to null Ignore downLineShare field if role is 5
      if (req.body.role == '5') {
        req.body.downLineShare = undefined;
      }
      // Check if the downline share is greater than the parent's downline share
      const parentUser = await User.findOne({ userId: req.decoded.userId });
      if (
        (parentUser.role !== '0' &&
          parentUser.downLineShare < req.body.downLineShare) ||
        req.body.downLineShare >= 100
      ) {
        return res.status(404).send({
          message: `Max allowed downline share is 0 - ${parentUser.downLineShare}`,
        });
      }
      // Update their isDeleted field to true using updateMany()
      await User.updateMany(
        { userName: req.body.userName },
        { isDeleted: true }
      );

      user.userId = data.userId + 1;
      if (req.body.isActive == true) {
        user.status = 1;
      } else {
        user.status = 0;
      }

      user.downLineShare = req.body.downLineShare;
      var token = getNonExpiringToken(
        user.userId,
        req.decoded.userId,
        req.body.role
      );
      user.token = token;
      user.createdBy = req.decoded.userId;

      BetLimits.find({}, (err, betLimits) => {
        console.log('betLimits.amount', betLimits.maxAmount);
        if (err || !betLimits) {
          return res.status(404).send({ message: 'bet limits not found' });
        }
        user.save((err, user) => {
          if (err || !user)
            return res
              .status(404)
              .send({ message: 'user not registered', err });

          const userbetSizesData = betLimits.map((betLimit) => ({
            userId: user.userId,
            betLimitId: betLimit._id,
            amount: betLimit.maxAmount,
            name: betLimit.name,
            // marketId: betLimit.marketId
          }));

          UserBetSizes.insertMany(
            userbetSizesData,
            async (err, insertedDocs) => {
              if (err) return res.send({ message: err });

              let user_username = 'user_' + user.userId;
              console.log('user_username', user_username);

              // try {
              //   const response = await axios.post(config.apiUrl, {
              //     api_password: config.api_password,
              //     api_login: config.api_login,
              //     method: 'playerExists',
              //     user_username,
              //     currency: config.currency,
              //   });
              //   let data = response.data.response;
              //   console.log('API Response:', response.data);
              // } catch (error) {
              //   console.error(error);
              //   res.status(404).send({
              //     success: false,
              //     message: 'Failed to get already exist player',
              //     results: error,
              //   });
              // }

              if (req.body.role == '5') {
                try {
                  const response = await axios.post(config.apiUrl, {
                    api_password: config.api_password,
                    api_login: config.api_login,
                    method: 'createPlayer',
                    user_username,
                    user_password: user_username,
                    user_nickname: user_username,
                    currency: config.currency,
                  });
                  let data = response.data.response;
                  console.log('API Response:', response.data);
                  user.remoteId = data.id;
                  user.save();
                } catch (error) {
                  console.error(error);
                  res.status(404).send({
                    success: false,
                    message: 'Failed to create player',
                    results: error,
                  });
                }
              }
              return res.send({
                message: 'Register Success',
                success: true,
                results: user,
              });
            }
          );
        });
      });
    });
}

function login(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  User.findOne(
    {
      userName: req.body.userName,
      isDeleted: false,
    },
    (err, user) => {
      if (err || !user)
        return res.status(404).send({ message: 'user not found' });
      if (user.isActive == false || user.status == 0)
        return res.status(404).send({ message: 'Account Inactive' });
      // check if user password is matched or not.
      bcrypt.compare(req.body.password, user.password, function (err, result) {
        if (err) return res.status(404).send({ message: 'incorrect password' });
        if (!result)
          return res.status(404).send({ message: 'incorrect password' });
        var token = getNonExpiringToken(
          user.userId,
          user.createdBy,
          user.role
        );
        user.token = token;
        var ipInfo = getIP(req);

        // Retrieve the user's default theme from the database
        Settings.find({}, (err, setting) => {
          console.log('setting', setting[1]);
          if (err || !setting) {
            return res.status(404).send({ message: 'setting not found' });
          }

          var userDetailsForLoginActivity = {
            userName: user.userName,
            userId: user.userId,
            balance: user.balance,
            status: user.status,
            phone: user.phone,
            role: user.role,
            token: user.token,
            isActive: user.isActive,
            createdBy: user.createdBy,
            ipAddress: ipInfo.clientIp,
            createdAt: new Date().getTime(),
            updatedAt: new Date().getTime(),
          };
          // console.log("userDetailsForLoginActivity", userDetailsForLoginActivity);
          saveLoginActivity(userDetailsForLoginActivity, (err, data) => {
            if (err)
              return res
                .status(404)
                .send({ message: 'login activity not saved' });
            return res.send({
              success: true,
              message: 'User Login Successfully',
              userName: user.userName,
              token: user.token,
              role: user.role,
              userId: user.userId,
              balance: user.balance,
              defaultTheme: setting[1].defaultThemeName,
              defaultLoginPage: setting[0].defaultLoginPage,
            });
          });
        });
      });
    }
  );
}

function saveLoginActivity(detailsForLoginActivity, _callback) {
  LoginActivity.findOneAndUpdate(
    {
      userId: detailsForLoginActivity.userId,
    },
    detailsForLoginActivity,
    { upsert: true, new: true },
    (err, user) => {
      if (err) return _callback({ message: 'login activity not saved' });
      return _callback(null, {
        success: true,
        message: 'Login Successfully',
        userName: user.userName,
        token: user.token,
        role: user.role,
      });
    }
  );
}

function getNonExpiringToken(
  userId,
  createdBy,
  role,
) {
  const payload = {
    userId: userId,
    createdBy: createdBy,
    role: role,
    };
  var token = jwt.sign(payload, config.secret, {});
  return token;
}

app.set('secret', config.secret);

function getAllUsers(req, res) {
  // Initialize variables with default values
  let query = {};

  let page = 1;
  let sort = -1;
  let sortValue = 'createdAt';
  var limit = config.pageSize;
  if (req.query.numRecords) {
    if (isNaN(req.query.numRecords))
      return res.status(404).send({ message: 'NUMBER_RECORDS_IS_NOT_PROPER' });
    if (req.query.numRecords < 0)
      return res.status(404).send({ message: 'NUMBER_RECORDS_IS_NOT_PROPER' });
    if (req.query.numRecords > 100)
      return res.status(404).send({
        message: 'NUMBER_RECORDS_NEED_TO_LESS_THAN_100',
      });
    limit = Number(req.query.numRecords);
  }
  if (req.query.sortValue) sortValue = req.query.sortValue;
  if (req.query.sort) {
    sort = Number(req.query.sort);
  }
  if (req.query.page) {
    page = Number(req.query.page);
  }

  if (req.query.userId) {
    const userId = parseInt(req.query.userId);
    query.createdBy = userId;
  } else if (req.decoded.login.role !== '5') {
    query.createdBy = req.decoded.userId;
  } else if (req.decoded.login.role == '5') {
    query.userId = null;
  }
  if (req.query.userName) {
    query.userName = req.query.userName;
  }
  query.isDeleted = false;
  User.paginate(
    query,
    { page: page, sort: { [sortValue]: sort }, limit: limit },
    (err, results) => {
      if (results.total == 0) {
        return res.status(404).send({ message: 'No records found' });
      }
      if (err)
        return res.status(404).send({ message: 'USERS_PAGINATION_FAILED' });
      return res.send({
        success: true,
        message: 'Users Record Found',
        total: results.total,
        results: results,
      });
    }
  );
}

function changePassword(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  User.findOne({ userId: req.decoded.userId }, (err, user) => {
    if (err || !user)
      return res.status(404).send({ message: 'User not found' });
    user.password = req.body.password;
    user.passwordChanged = true;
    user.hashPass(function (err) {
      if (err) return res.status(404).send({ message: 'NEW_PASS_HASH_FAIL' });
      user.save((err, results) => {
        if (err) {
          return res.status(404).send({ message: 'USER_NOT_FOUND' });
        }
        return res.send({
          success: true,
          message: 'USER_PASSWORD_UPDATED',
          results: results,
        });
      });
    });
  });
}

function updateUser(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  User.findOne({ userId: req.body.id }, (err, user) => {
    if (err || !user) {
      return res.status(404).send({ message: 'User not found' });
    }

    let updateData = {
      isActive: req.body.isActive,
      canSettlePL: req.body.canSettlePL,
      bettingAllowed: req.body.bettingAllowed,
      phone: req.body.phone,
      reference: req.body.reference,
      notes: req.body.notes,
      updatedBy: req.decoded.userId,
      password: user.password,
    };

    if (req.body.password && req.body.password !== '') {
      bcrypt.hash(req.body.password, config.saltRounds, (err, hash) => {
        if (err) {
          return res.status(404).send({ message: 'NEW_PASS_HASH_FAIL' });
        }
        updateData.password = hash;

        User.updateOne(
          { userId: req.body.id },
          { $set: updateData },
          { new: true },
          (err, updatedUser) => {
            if (err) {
              return res.status(404).send({ message: 'User not updated' });
            }
            return res.send({
              success: true,
              message: 'User updated successfully',
              results: null,
            });
          }
        );
      });
    } else if (
      req.body.password == null ||
      req.body.password == '' ||
      req.body.password == undefined
    ) {
      User.updateOne(
        { userId: req.body.id },
        { $set: updateData },
        { new: true },
        (err, updatedUser) => {
          if (err) {
            return res.status(404).send({ message: 'User not updated' });
          }
          return res.send({
            success: true,
            message: 'User updated successfully',
            results: null,
          });
        }
      );
    }
  });
}

function searchUsers(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  var page = 1;
  var sort = -1;
  var sortValue = 'createdAt';
  var limit = config.pageSize;
  if (req.body.numRecords) {
    if (isNaN(req.body.numRecords))
      return res.status(404).send({ message: 'NUMBER_RECORDS_IS_NOT_PROPER' });
    if (req.body.numRecords < 0)
      return res.status(404).send({ message: 'NUMBER_RECORDS_IS_NOT_PROPER' });
    if (req.body.numRecords > 100)
      return res.status(404).send({
        message: 'NUMBER_RECORDS_NEED_TO_LESS_THAN_100',
      });
    limit = Number(req.body.numRecords);
  }
  if (req.body.page) {
    page = req.body.page;
  }
  let query = {};
  query.userName = { $regex: req.body.userName, $options: 'i' };
  User.paginate(
    query,
    { page: page, sort: { [sortValue]: sort }, limit: limit },
    (err, results) => {
      if (err)
        return res
          .status(404)
          .send({ message: 'search users pagination failed' });
      return res.send({
        success: true,
        message: 'users record found',
        results,
      });
    }
  );
}

function getCurrentUser(req, res) {
  //to do show status of marketplaces for that specific user
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  User.findOne({ userId: req.decoded.userId }, (err, user) => {
    if (err || !user)
      return res.status(404).send({ message: 'user not found' });
    return res.send({
      success: true,
      message: 'users record found',
      results: user,
    });
  });
}

function getSingleUser(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  User.findOne({ _id: req.body.id }, { password: 0 }, (err, result) => {
    if (err || !result)
      return res.status(404).send({ message: 'user not found' });
    return res.send({
      success: true,
      message: 'users record found',
      results: result,
    });
  });
}

function activeUser(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  User.findOne({ _id: req.body.id }, (err, result) => {
    if (err || !result)
      return res.status(404).send({ message: 'user not found' });
    if (result.isActive == true) {
      return res.status(404).send({ message: 'user is already active' });
    }
    result.isActive = true;
    result.status = 1;
    result.save((err, user) => {
      if (err || !user)
        return res.status(404).send({ message: 'user not saved' });
      return res.send({
        success: true,
        message: 'user activated successfully',
        results: user,
      });
    });
  });
}

function deactiveUser(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  User.findOne({ _id: req.body.id }, (err, user) => {
    if (err || !user)
      return res.status(404).send({ message: 'user not found' });
    if (user.isActive == false)
      return res.status(404).send({ message: 'user is already deactivated' });
    user.isActive = false;
    user.status = 0;
    user.save((err, user) => {
      if (err || !user)
        return res.status(404).send({ message: 'user not saved' });
      return res.send({
        success: true,
        message: 'user deactivated successfully',
        results: user,
      });
    });
  });
}

// function settlePLAccount(req, res) {
//   const errors = validationResult(req);
//   if (errors.errors.length !== 0) {
//     return res.status(400).send({ errors: errors.errors });
//   }
//   User.findOne({ _id: req.body.id }, (err, result) => {
//     if (err || !result)
//       return res.status(404).send({ message: "user not found" });
//     if(result.isActive == false ) { return res.status(404).send({message:"user is already deactivated"})}
//       result.isActive = false
//     return res.send({
//       success: true,
//       message: "user deactivated successfully",
//       results: result
//     });
//   });
// }
function checkValidation(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(200).send({ errors: errors.errors });
  }
}
router.post('/login', userValidation.validate('login'), login);
loginRouter.post(
  '/register',
  userValidation.validate('registerUser'),
  registerUser
);

loginRouter.get('/getAllUsers', getAllUsers);
loginRouter.post(
  '/changePassword',
  userValidation.validate('changePassword'),
  changePassword
);
loginRouter.post(
  '/updateUser',
  userValidation.validate('updateUser'),
  updateUser
);

loginRouter.post(
  '/searchUsers',
  userValidation.validate('searchUsers'),
  searchUsers
);

loginRouter.get('/getCurrentUser', getCurrentUser);
router.post(
  '/getSingleUser',
  userValidation.validate('getSingleUser'),
  getSingleUser
);
router.post('/activeUser', userValidation.validate('activeUser'), activeUser);
router.post(
  '/deactiveUser',
  userValidation.validate('deactiveUser'),
  deactiveUser
);
router.post(
  '/checkValidation',
  userValidation.validate('checkValidation'),
  checkValidation
);

module.exports = { router, loginRouter };
