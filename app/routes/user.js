const express = require('express');
var jwt = require('jsonwebtoken');
const userValidation = require('../validators/user');
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
let config = require('config');
const User = require('../models/user');
const Deposits = require('../models/deposits');
const Markets = require('../models/marketTypes');
const Bet = require('../models/bets');
const { getParents } = require('./bets');

require('dotenv').config();
const secret = process.env.secret;
const api_username = process.env.api_username;
const api_password = process.env.api_password;

// const Bets = require('../models/bets');

//ip location
const { IP2Location } = require('ip2location-nodejs');
let ip2location = new IP2Location();
ip2location.open('/var/www/html/one-o-bet-backend/IP2LOCATION-LITE-DB11.BIN');
//

const LoginActivity = require('../models/loginActivity');
const Settings = require('../models/settings');
const BetLimits = require('../models/betLimits');
const UserBetSizes = require('../models/userBetSizes');
const loginRecord = require('../models/loginRecord');
const axios = require('axios');
const userBetSizes = require('../models/userBetSizes');
const Bets = require('../models/bets');
const loginActivity = require('../models/loginActivity');

const router = express.Router();
const loginRouter = express.Router();
const app = express();

async function registerUser(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  //console.log(' User Is creatting   ');
  const userNameLowerNext = req.body.userName.toLowerCase()
  const checkDuplicateuser = await User.findOne({ userName: userNameLowerNext })
  if (checkDuplicateuser) {
    res.status(400).send({ message: "Username is already taken." })
  }
  if (req.decoded.role == '5') {
    return res.status(404).send({ message: 'you are not allowed to do this ' });
  }

  if (req.body.role != '5') {
    if (!req.body.downLineShare) {
      return res.status(404).send({ message: 'downLineShare is required' });
    }
  }

  const userToDelete = await User.findOne({ userName: userNameLowerNext });
  // if (userToDelete && userToDelete.createdBy != req.decoded.userId) {
  if (userToDelete?.userName) {
    return res.status(404).send({ message: 'username not available', status: 2 });
  }

  User.findOne()
    .sort({ userId: -1 })
    .exec(async (err, data) => {
      if (err) return res.status(404).send({ message: 'user not found', err });

      const user = new User(req.body);
      const userNameLower = user.userName.toLowerCase()
      user.userName = userNameLower

      if (req.body.role !== '5') {
        try {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(req.body.password, salt);
        } catch (err) {
          return res.status(500).send({ message: 'Error encrypting password', err });
        }
      }

      // Check if the user's role is 5, and if so, set downLineShare to null Ignore downLineShare field if role is 5
      if (req.body.role == '5') {
        req.body.downLineShare = 0;
      }
      // Check if the downline share is greater than the parent's downline share
      const parentUser = await User.findOne({ userId: req.decoded.userId });
      if ((parentUser.role != 0 && parentUser.downLineShare <= req.body.downLineShare) || req.body.downLineShare >= 100) {
        return res.status(404).send({
          message: `Max allowed downline share is 1 - ${parentUser.downLineShare - 1}`
        });
      }
      // Update their isDeleted field to true using updateMany()
      await User.updateMany({ userName: userNameLowerNext }, { isDeleted: true });

      var lastUserID = data.userId + 17000;
      console.log("lastUserID--------------------------------",lastUserID);
      if (lastUserID < 1000) {
        lastUserID = 1000;
      }

      user.userId = lastUserID;
      
      console.log("user.userId--------------------------------",user.userId);
      
      
      if (req.body.isActive == true) {
        user.status = 1;
      } else {
        user.status = 0;
      }

      user.downLineShare = +req.body.downLineShare;
      user.casinoAllowed = req.body.casinoAllowed;
      // var token = getNonExpiringToken(
      //   user.userId,
      //   req.decoded.userId,
      //   req.body.role,
      //   user.isActive
      // );
      // user.token = token;
      user.createdBy = req.decoded.userId;

      // Add the if condition back here to save the betLimits if parentUser.userId is '0'
      if (parentUser.role == 0) {
        let betLimits = await BetLimits.find({});
        // //console.log(' betLimits ======= ', betLimits);
        console.log(`before Save ============${user}`)

        user.save(async (err, user) => {
          if (err || !user) {
            return res.status(404).send({ message: 'user not registered', err });
          }
          const findduser = await User.findOne({ userName: req.body.userName })
          console.log(`check Save ============${findduser}`)

          const userbetSizesData = betLimits.map((betLimit) => ({
            userId: user.userId,
            betLimitId: betLimit._id,
            amount: betLimit.maxAmount,
            name: betLimit.name,
            sportsId: betLimit.sportsId,
            subarket: betLimit.subarket,
            minAmount: betLimit.minAmount,
            ExpAmount: betLimit.ExpAmount
          }));

          // //console.log(' userbetSizesData ============ ', userbetSizesData);

          UserBetSizes.insertMany(userbetSizesData, async (err, insertedDocs) => {
            if (err) return res.send({ message: err });
            // //console.log(' insertedDocs =========== ', insertedDocs);
            let user_username = 'user_' + user.userId;

            //console.log('user_username', user_username);
            if (req.body.role == '5') {
              //console.log('in casino bettor user');
              try {
                const response = await axios.post(config.apiUrl, {
                  api_password: api_password,
                  api_login: api_username,
                  method: 'createPlayer',
                  user_username,
                  user_password: user_username,
                  user_nickname: user_username,
                  currency: req.body.baseCurrency
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
                  results: error
                });
              }
            }
            return res.send({
              message: 'Register Success',
              success: true,
              results: user
            });
          });
        });
      } else {
        // For other users, run the userBetSizes query
        let betLimits = await userBetSizes.find({ userId: parentUser.userId });
        user.save((err, user) => {
          if (err || !user) {
            return res.status(404).send({ message: 'user not registered', err });
          }

          const userbetSizesData = betLimits.map((betLimit) => ({
            userId: user.userId,
            betLimitId: betLimit.betLimitId,
            amount: betLimit.amount,
            name: betLimit.name,
            sportsId: betLimit.sportsId,
            subarket: betLimit.subarket
          }));

          UserBetSizes.insertMany(userbetSizesData, async (err, insertedDocs) => {
            if (err) return res.send({ message: err });

            let user_username = 'user_' + user.userId;
            //console.log('user_username', user_username);

            if (req.body.role == '5') {
              //console.log('in casino bettor user');
              try {
                const response = await axios.post(config.apiUrl, {
                  api_password: api_password,
                  api_login: api_username,
                  method: 'createPlayer',
                  user_username,
                  user_password: user_username,
                  user_nickname: user_username,
                  currency: req.body.baseCurrency
                });
                let data = response.data.response;
                // //console.log('API Response:', response.data);
                if(data)
                user.remoteId = data.id;

                user.save();
              } catch (error) {
                console.error(error);
                res.status(404).send({
                  success: false,
                  message: 'Failed to create player',
                  results: error
                });
              }
            }

            return res.send({
              message: 'Register Success',
              success: true,
              results: user
            });
          });
        });
      }
    });
}


function login(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const userNameLower = req.body.NUsrNme.toLowerCase()
  User.findOne(
    {
      userName: userNameLower,
      isDeleted: false
    },
    (err, user) => {
      if (err || !user) return res.status(404).send({ message: 'Invalid username or password' });
      // check if user password is matched or not.
      bcrypt.compare(req.body.PaswrdUsr, user.password, function (err, result) {
        if (err) return res.status(404).send({ message: 'Invalid username or password ' });
        if (!result) return res.status(404).send({ message: 'Invalid username or password' });
        if (user.isActive == false || user.status == 0) return res.status(404).send({ message: 'Your account is inactive' });
        // if ((req.body.isAdmin && user.role == 5) || (!req.body.isAdmin && user.role != 5)) return res.status(404).send({ message: 'Invalid username or password' });

        if (!user.token) {
          //console.log(' =========================  Missing token =====================  ');
          var token = getNonExpiringToken(user.userId, user.createdBy, user.role);
          user.token = token;
          user.save();
        } else if (user.token) {
          jwt.verify(user.token, secret, function (err, decoded) {
            if (err || decoded.expr < new Date().getTime()) {
              //console.log(' =========================  Expired token =====================  ');
              // //console.log(' ================== decoded ', decoded);
              // //console.log(' ================== err ', err);

              var token = getNonExpiringToken(user.userId, user.createdBy, user.role);
              user.token = token;
              user.save();
            }
          });
        }

        var ipInfo = req.headers['x-real-ip'] || req.connection.remoteAddress;

        // Retrieve the user's default theme from the database
        Settings.find({}, (err, setting) => {
          // //console.log('setting', setting[1]);
          if (err || !setting) {
            return res.status(404).send({ message: 'setting not found' });
          }

          var geo = {
            latitude: 0,
            longitude: 0,
            region: null,
            city: null,
            zipCode: null,
            country: null
          };

          try {
            const geoChecking = ip2location.getAll(ipInfo);

            if (geoChecking) {
              geo.latitude = geoChecking.latitude;
              geo.longitude = geoChecking.longitude;
              geo.region = geoChecking.region;
              geo.city = geoChecking.city;
              geo.zipCode = geoChecking.zipCode;
              geo.country = geoChecking.countryLong;
            }
          } catch (error) {
            //console.log(err);
          }

          var loginRecordData = new loginRecord({
            userName: user.userName,
            userId: user.userId,
            locationData: geo,
            ipAddress: ipInfo,
            createdAt: new Date().getTime()
          });

          loginRecordData.save();

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
            ipAddress: ipInfo,
            createdAt: new Date().getTime(),
            updatedAt: new Date().getTime()
          };
          // //console.log("userDetailsForLoginActivity", userDetailsForLoginActivity);
          saveLoginActivity(userDetailsForLoginActivity, (err, data) => {
            if (err) return res.status(404).send({ message: 'login activity not saved' });
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
              user,
              isAdmin: user.role < 5 ? true : false
            });
          });
        });
      });
    }
  );
}

async function logout(req, res) {
  try {
    const userId = req.body.userId;

   var token = await jwt.sign({}, secret, {
      expiresIn: new Date().getTime()
    });

    await LoginActivity.updateOne({ userId: userId }, { $set: { token: "" } });

    res.status(200).send({ message: "User Logout Successfully." });

  } catch (error) {
    res.status(500).send({ message: "Error during logout", error: error.message });
  }
}

function saveLoginActivity(detailsForLoginActivity, _callback) {
  LoginActivity.findOneAndUpdate(
    {
      userId: detailsForLoginActivity.userId
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
        role: user.role
      });
    }
  );
}

function getNonExpiringToken(userId, createdBy, role, isActive) {
  const payload = {
    userId: userId,
    createdBy: createdBy,
    role: role,
    isActive: isActive,
    expr: new Date().getTime() + 12 * 60 * 60 * 1000
  };
  var token = jwt.sign(payload, secret, {
    expiresIn: new Date().getTime() + 12 * 60 * 60 * 1000
  });
  return token;
}

function getAllUsers(req, res) {
  // Initialize variables with default values
  if (req.decoded.role == '5') {
    return res.status(404).send({ message: 'you are not allowed to do this' });
  }
  // //console.log('role', req.decoded.role);
  // //console.log('role2', req.decoded.login.role);
  let query = {};
  let page = 1;
  let sort = 1;
  let sortValue = 'username';
  var limit = config.pageSize;
  query.role = { $ne: '0' };
  if (req.query.numRecords && !isNaN(req.query.numRecords) && req.query.numRecords > 0) limit = Number(req.query.numRecords);
  if (req.query.sortValue) sortValue = req.query.sortValue;
  if (req.query.sort) sort = Number(req.query.sort);
  if (req.query.page) page = Number(req.query.page);

  if (req.query.userId) {
    const userId = parseInt(req.query.userId);
    query.createdBy = userId;
  } else if (req.decoded.login.role != '0') {
    query.createdBy = req.decoded.userId;
  } else if (req.decoded.login.role == '5') {
    query.userId = null;
  } else if (req.decoded.login.role == '0') {
  }
  if (req.query.username) query.userName = { $regex: req.query.username, $options: 'i' };

  query.isDeleted = false;
  // Exclude the currently logged-in user from the results
  query.userId = { $ne: req.decoded.userId };
  User.aggregate([
    { $match: query },
    {
      $addFields: {
        [`__${sortValue}`]: { $toLower: `$${sortValue}` }
      }
    },
    { $sort: { [`__${sortValue}`]: sort } },
    { $skip: (page - 1) * limit },
    { $limit: limit }
  ])
    .then(async (results) => {
      const total = await User.count(query);
      return res.send({
        success: true,
        message: 'Users list',
        total,
        results: {
          docs: results,
          page,
          limit,
          pages: Math.ceil(total / limit),
          total
        }
      });
    })
    .catch((error) => {
      console.log('Users list error', error);
      return res.status(404).send({ message: 'Something went wrong' });
    });
}

app.set('secret', secret);

function changePassword(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  User.findOne({ userId: req.decoded.userId }, (err, user) => {
    if (err || !user) return res.status(404).send({ message: 'User not found' });
    user.password = req.body.password;
    user.passwordChanged = true;
    console.log(user.password)
    user.hashPass(function (err) {
      if (err) return res.status(404).send({ message: 'NEW_PASS_HASH_FAIL' });
      user.save((err, results) => {
        if (err) {
          return res.status(404).send({ message: 'USER_NOT_FOUND' });
        }
        return res.send({
          success: true,
          message: 'USER_PASSWORD_UPDATED',
          results: results
        });
      });
    });
    console.log(user)
  });
}

function getNonExpiringTokenfourDigit(userId, createdBy, role, isActive) {
  const payload = {
    userId: userId,
    createdBy: createdBy,
    role: role,
    isActive: isActive,
    expr: new Date().getTime() + 5 * 60 * 1000
  };
  var token = jwt.sign(payload, secret, {
    expiresIn: new Date().getTime() + 5 * 60 * 1000
  });
  return token;
}

async function updateUser(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findOne({ userId: req.body.id }).exec();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let parentIdss = await getParents(user.userId);
    const parentId = await User.findOne({ createdBy: { $in: parentIdss } });

    const status = req.body.isActive ? 1 : 0;
    const updateData = {
      casinoAllowed: req.body.casinoAllowed,
      isActive: req.body.isActive,
      canSettlePL: req.body.canSettlePL,
      bettingAllowed: req.body.bettingAllowed,
      phone: req.body.phone,
      reference: req.body.reference,
      notes: req.body.notes,
      updatedBy: req.decoded.userId,
      limitAmount: req.body.limitAmount,
      status
    };

    if (req.body.password) {
      try {
        updateData.password = await bcrypt.hash(req.body.password, config.saltRounds);
      } catch (error) {
        return res.status(500).json({ message: 'NEW_PASSWORD_HASH_FAIL' });
      }
    }

    if (req.body.parentDigit) {
      updateData.digitVerification = await bcrypt.hash(req.body.parentDigit, config.saltRounds);
      updateUserData(user, updateData, res, true);
    }

    if (req.body.digit && !user.digitVerification) {
      try {
        updateData.digitVerification = await bcrypt.hash(req.body.digit, config.saltRounds);
        updateUserData(user, updateData, res, true);
        return;
      } catch (error) {
        return res.status(500).json({ message: 'NEW_4-DIGIT_HASH_FAIL' });
      }
    }

    const { oldDigitVerification, newDigitVerification } = req.body;
    if (user.digitVerification && oldDigitVerification) {
      console.log('Stored digit hash:', user.digitVerification); // Added logging
      console.log('Provided old digit:', oldDigitVerification); // Added logging

      try {
        const checkfourdigitcode = await bcrypt.compare(oldDigitVerification, user.digitVerification);
        console.log('Comparison result:', checkfourdigitcode); // Added logging
        if (!checkfourdigitcode) {
          return res.status(400).send({ message: 'Incorrect Old 4-digit code' });
        }

        try {
          updateData.digitVerification = await bcrypt.hash(newDigitVerification, config.saltRounds);
          updateUserData(user, updateData, res, true);
          return;
        } catch (error) {
          return res.status(500).json({ message: 'NEW_4-DIGIT_HASH_FAIL' });
        }
      } catch (error) {
        return res.status(500).json({ message: '4-DIGIT_COMPARE_FAIL' });
      }
    }

    updateUserData(user, updateData, res);
  } catch (error) {
    return res.status(500).json({ message: 'An error occurred', error: error.message });
  }
}

function updateUserData(user, updateData, res, isDigitUpdate = false) {
  User.updateOne({ userId: user.userId }, { $set: updateData }, { new: true }, (err) => {
    if (err) {
      return res.status(500).json({ message: 'User not updated' });
    }

    const userDetailsForActivity = {
      userName: user.userName,
      userId: user.userId,
      balance: user.balance,
      status: updateData.status,
      phone: updateData.phone,
      role: user.role,
      token: getNonExpiringToken(user.userId, user.createdBy, user.role, updateData.isActive),
      fourToken: isDigitUpdate ? getNonExpiringTokenfourDigit(user.userId, user.createdBy, user.role, updateData.isActive) : null,
      isActive: updateData.isActive,
      createdBy: user.createdBy,
      limitAmount: updateData.limitAmount,
      updatedAt: new Date().getTime()
    };

    LoginActivity.findOneAndUpdate({ userId: user.userId }, userDetailsForActivity, { upsert: true, new: true }, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Login activity not updated' });
      }
      res.json({ success: true, message: 'User updated successfully', results: null });
    });
  });
}

async function blockCashWithdraw(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { blockCashWithdraw, userId } = req.query
  if (!userId) {
    return res.status(403).send({ message: " User id Required " });
  }

  try {
    if (req.decoded.role != 0) {
      return res.status(403).send({ message: "you can't block cash withdraw" });
    }
    const user = await User.findOneAndUpdate(
      { userId: userId },
      { $set: { blockCashWithdraw: blockCashWithdraw } },
      { upsert: true }

    )
    if (!user) {
      return res.status(404).send({ message: 'User not Found' });
    }

    return res.status(200).json({ message: 'Cash Withdraw Updated Successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Something went Wrong', error: error.message });
  }
}

async function checkfourdigitcode(req, res) {
  try {
    const { fourDigitCode } = req.body;
    const { userId } = req.decoded;
    console.log(fourDigitCode);
    if (!userId || !fourDigitCode) {
      return res.status(400).send({ message: ' 4-Digit Code are required' });
    }

    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    if (!user.digitVerification) {
      return res.status(400).send({ message: 'User does not have a 4-digit code set' });
    }

    const isMatch = await bcrypt.compare(fourDigitCode, user.digitVerification);
    if (!isMatch) {
      return res.status(400).send({ message: 'Invalid four-digit code' });
    }

    return res.send({ success: true, message: '4-digit code is verified' });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send({ message: 'Server error' });
  }
}

function searchUsers(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  let page = 1;
  let sort = -1;
  const sortValue = 'createdAt';
  let limit = config.pageSize;

  if (req.body.numRecords) {
    if (isNaN(req.body.numRecords)) return res.status(404).send({ message: 'NUMBER_RECORDS_IS_NOT_PROPER' });
    if (req.body.numRecords < 0) return res.status(404).send({ message: 'NUMBER_RECORDS_IS_NOT_PROPER' });
    if (req.body.numRecords > 100) return res.status(404).send({ message: 'NUMBER_RECORDS_NEED_TO_LESS_THAN_100' });
    limit = Number(req.body.numRecords);
  }

  if (req.body.page) {
    page = req.body.page;
  }
  const userNameLower = req.body.userName
  const query = {};
  query.userName = { $regex: userNameLower, $options: 'i' };

  User.aggregate([
    { $match: query },
    { $sort: { [sortValue]: sort } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'createdBy',
        foreignField: 'userId',
        as: 'masterDetails'
      }
    },
    {
      $project: {
        _id: 1,
        userName: 1,
        userId: 1,
        baseCurrency: 1,
        master: {
          $cond: [
            { $eq: [{ $size: '$masterDetails' }, 0] },
            'Unknown', // If masterDetails array is empty, set the master name as 'Unknown'
            { $arrayElemAt: ['$masterDetails.userName', 0] } // Get the first element from the masterDetails array
          ]
        }
      }
    }
  ]).exec((err, results) => {
    if (err || !results || results.length === 0) {
      return res.status(404).send({ message: 'No records found' });
    }
    return res.send({
      success: true,
      message: 'Users record found',
      results: {
        docs: results,
        total: results.length,
        limit,
        page,
        pages: Math.ceil(results.length / limit)
      }
    });
  });
}

async function getCurrentUser(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  if (!req.decoded || !req.decoded.userId) {
    return res.status(400).json({ message: 'Invalid request: User ID missing' });
  }

  const userId = req.decoded.userId;

  try {
    const users = await User.aggregate([
      {
        $match: {
          userId: userId
        }
      },
      {
        $lookup: {
          from: "deposits",
          let: { userId: "$userId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$userId", "$$userId"] } } },
            { $sort: { date: -1 } },
            { $limit: 1 }
          ],
          as: "depositInfo"
        }
      },
      {
        $unwind: {
          path: "$depositInfo",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          userId: 1,
          userName: 1,
          downLineShare: 1,
          digitVerification: 1,
          exposure: 1,
          isActive: 1,
          status: 1,
          role: 1,
          balance: 1,
          availableBalance: 1,
          depositBalance: "$depositInfo.balance",
          depositAvailableBalance: "$depositInfo.availableBalance",
          depositMaxWithdraw: "$depositInfo.maxWithdraw",
          depositAmount: "$depositInfo.amount",
        }
      }
    ]);

    if (users.length === 0) {
      console.log("User not found");
      return res.status(404).json({ message: 'User not found' });
    }

    return res.send({
      success: true,
      message: 'User record found',
      results: users[0],
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).send({ message: 'Server error', error: err.message });
  }
}

function getSingleUser(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  User.findOne({ _id: req.body.id }, { password: 0 }, (err, result) => {
    if (err || !result) return res.status(404).send({ message: 'user not found' });
    return res.send({
      success: true,
      message: 'users record found',
      results: result
    });
  });
}

function activeUser(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  User.findOne({ _id: req.body.id }, (err, result) => {
    if (err || !result) return res.status(404).send({ message: 'user not found' });
    if (result.isActive == true) {
      return res.status(404).send({ message: 'user is already active' });
    }
    result.isActive = true;
    result.status = 1;
    result.save((err, user) => {
      if (err || !user) return res.status(404).send({ message: 'user not saved' });
      return res.send({
        success: true,
        message: 'user activated successfully',
        results: user
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
    if (err || !user) return res.status(404).send({ message: 'user not found' });
    if (user.isActive == false) return res.status(404).send({ message: 'user is already deactivated' });
    user.isActive = false;
    user.status = 0;
    user.save((err, user) => {
      if (err || !user) return res.status(404).send({ message: 'user not saved' });
      return res.send({
        success: true,
        message: 'user deactivated successfully',
        results: user
      });
    });
  });
}




function settlePLAccount(req, res) {
  console.log("api called")
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  User.findOne(
    {
      _id: req.body.id
    },
    (err, result) => {
      if (err || !result) {
        return res.status(404).send({ message: 'user not found' });
      }
      const amount = Math.abs(req.body.amount);
      if (amount > Math.abs(result.availableBalance)) {
        return res.status(404).send(`Max amount to transfer: ${result.availableBalance}`);
      }
      if (result.availableBalance < 0) {
        result.availableBalance += amount;
        result.balance += amount;

      } else {
        result.availableBalance -= amount;
        result.balance -= amount;
      }
      if(result.balance < 0){
        result.cash -= amount;
      }else{
        result.cash += amount;
      }
      result.save();

      if (result.availableBalance < 0) {
        Deposits.create({
          userId: result.userId,
          balance: result.balance,
          availableBalance: result.availableBalance,
          amount: -amount,
          cashOrCredit:"settledAmount",
          description:"P/L to Cash transfer",
          cash:result.cash

        })
      } else {
        Deposits.create({
          userId: result.userId,
          balance: result.balance,
          availableBalance: result.availableBalance,
          amount: amount,
          cashOrCredit:"settledAmount",
          description:"P/L to Cash transfer",
          cash:result.cash

        })
      }

      return res.send({
        success: true,
        message: 'user account settled successfully',
        results: result
      });
    }
  );
}
function getSettlement(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  User.findOne({ _id: req.query.id }, (err, result) => {
    if (err || !result) return res.status(404).send({ message: 'user not found' });
    return res.send({
      success: true,
      message: 'user settlement getting successfully',
      results: result.availableBalance
    });
  });
}

function checkValidation(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(200).send({ errors: errors.errors });
  }
}

function searchSingleUser(req, res) {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const userNameLower = req.body.userName
  const query = {};
  query.userName = userNameLower;
  query.isDeleted = false;
  User.aggregate([
    { $match: query },
    {
      $lookup: {
        from: 'users',
        localField: 'createdBy',
        foreignField: 'userId',
        as: 'masterDetails'
      }
    },
    {
      $project: {
        _id: 1,
        userId: 1,
        userName: 1,
        baseCurrency: 1,
        master: {
          $cond: [
            { $eq: [{ $size: '$masterDetails' }, 0] },
            '', // If masterDetails array is empty, set the master name as ''
            { $arrayElemAt: ['$masterDetails.userName', 0] }
          ]
        }
      }
    }
  ]).exec((err, results) => {
    if (err || !results || results.length === 0) {
      return res.status(404).send({ message: 'No records found' });
    }

    return res.send({
      success: true,
      message: 'User record found',
      user: results
    });
  });
}

const battorsList = async (req, res) => {
  try {
    //console.log(" lastBet ================================================= ");
    if (req.decoded.role != 0) {
      return res.status(404).send({ message: '-----' });
    }
    /*old version start*/
    // let usersQuery = {};
    // let page = 1;
    // let sort = -1;
    // let limit = config.pageSize;
    // let {numRecords, sortValue, } = req.query
    // sortValue = sortValue || '_id';
    // usersQuery.role = 5;
    // if (numRecords && !isNaN(numRecords) && numRecords > 0) {
    //   limit = Number(numRecords);
    // }
    // if (req.query.sort) sort = Number(req.query.sort);
    // if (req.query.page) page = Number(req.query.page);
    //
    // if (req.query.username) {
    //   usersQuery.userName = { $regex: req.query.username, $options: 'i' };
    // }
    // usersQuery.isDeleted = false;
    // User.paginate(
    //   usersQuery,
    //   { page: page, sort: { [sortValue]: sort }, limit: limit },
    //   async (err, results) => {
    //     if (err) return res.status(404).send({ message: 'Something went wrong' });
    //     if(results && results.docs.length > 0){
    //       for(let i = 0; i<results.docs.length; i++){
    //         const totalExp = await Bets.aggregate([
    //           {
    //             $match:{
    //               $and: [
    //                 {userId: results.docs[i].userId},
    //                 {calculateExp: true}
    //               ]
    //             }
    //           },
    //           {
    //             $group:{
    //               _id: '$sportsId',
    //               sum: {$sum: '$exposureAmount'}
    //             }
    //           }
    //         ])
    //
    //         let settlementArray = [];
    //
    //         if(totalExp && totalExp.length > 0){
    //           for(let j=0; j < totalExp.length; j++) {
    //             const sportName = await Markets.findOne({Id: Number(totalExp[j]._id)})
    //
    //             const newSettlement = {
    //               sportName: sportName?.name,
    //               totalExposure: totalExp[j]?.sum
    //             }
    //
    //             settlementArray.push(newSettlement);
    //           }
    //         }
    //         results.docs[i].settlements = settlementArray;
    //
    //         const lastBet      = await Bet.find({ userId: results.docs[i].userId }).sort({ _id: -1 }).limit(1);
    //         const lastDeposit  = await Deposits.find({ userId: results.docs[i].userId }).sort({ _id: -1 }).limit(1);
    //         const activeBets   = await Bets.countDocuments({ userId: results.docs[i].userId, status: 1  });
    //         const canceledBets = await Bets.countDocuments({ userId: results.docs[i].userId, status: 2  });
    //         //console.log("lastBet ======= ", lastBet);
    //         //console.log("lastDeposit ======= ", lastDeposit);
    //         //console.log("activeBets ======= ", activeBets);
    //         //console.log("canceledBets ======= ", canceledBets);
    //
    //         const data  = {
    //           lastBetTime : lastBet[0]?.betTime || 0,
    //           availableBalance : lastDeposit[0]?.availableBalance || 0,
    //           activeBets  : activeBets,
    //           canceledBets: canceledBets
    //         }
    //         results.docs[i].data = data
    //       }
    //     }
    //     return res.send({
    //       success: true,
    //       message: 'Users list',
    //       total: results.total,
    //       results: results,
    //     });
    //   }
    // );
    /*old version end*/
    async function aggregateBetsInfo(userIds) {
      const betsAggregation = await Bets.aggregate([
        {
          $match: {
            userId: { $in: userIds },
            calculateExp: true
          }
        },
        {
          $group: {
            _id: { userId: '$userId', sportsId: '$sportsId' },
            sum: { $sum: '$exposureAmount' }
          }
        },
        {
          $lookup: {
            from: 'markets', // Assuming 'markets' is the collection name
            localField: '_id.sportsId',
            foreignField: 'Id',
            as: 'marketInfo'
          }
        },
        {
          $unwind: '$marketInfo'
        },
        {
          $group: {
            _id: '$_id.userId',
            settlements: {
              $push: {
                sportName: '$marketInfo.name',
                totalExposure: '$sum'
              }
            }
          }
        }
      ]);

      // Transform the array into a map for easy access
      return betsAggregation.reduce((acc, item) => {
        acc[item._id] = item.settlements;
        return acc;
      }, {});
    }

    async function fetchLastItems(model, userIds, sortField) {
      const items = await model.aggregate([
        {
          $match: {
            userId: { $in: userIds }
          }
        },
        {
          $sort: { [sortField]: -1 }
        },
        {
          $group: {
            _id: '$userId',
            lastItem: { $first: '$$ROOT' }
          }
        }
      ]);

      // Transform the array into a map for easy access
      return items.reduce((acc, item) => {
        acc[item._id] = item.lastItem;
        return acc;
      }, {});
    }

    async function fetchParent(parentIds) {
      const parents = await User.find({
        userId: { $in: parentIds }
      });

      // Transform the array into a map for easy access
      return parents.reduce((acc, item) => {
        acc[item.userId] = item.userName;
        return acc;
      }, {});
    }

    async function countBetsByStatus(userIds, status) {
      const counts = await Bets.aggregate([
        {
          $match: {
            userId: { $in: userIds },
            status: status
          }
        },
        {
          $group: {
            _id: '$userId',
            count: { $sum: 1 }
          }
        }
      ]);

      // Transform the array into a map for easy access
      return counts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});
    }

    let page = Number(req.query.page) || 1;
    let sortValue = req.query.sortValue || '_id';
    let sort = Number(req.query.sort) || -1;
    let limit = req.query.numRecords && !isNaN(req.query.numRecords) && req.query.numRecords > 0 ? Number(req.query.numRecords) : config.pageSize;
    let usersQuery = { role: 5, isDeleted: false };

    if (req.query.username) {
      usersQuery.userName = { $regex: req.query.username, $options: 'i' };
    }

    const options = { page: page, sort: { [sortValue]: sort }, limit: limit };
    const results = await User.paginate(usersQuery, options);
    const userIds = results.docs.map((doc) => doc.userId);
    const parentIds = results.docs.map((doc) => doc.createdBy);

    // Fetch data concurrently using Promise.all
    const [betsInfo, parents, lastBets, lastDeposits, activeBetsCount, canceledBetsCount] = await Promise.all([
      aggregateBetsInfo(userIds),
      fetchParent(parentIds),
      fetchLastItems(Bet, userIds, 'betTime'),
      fetchLastItems(Deposits, userIds, '_id'),
      countBetsByStatus(userIds, 1),
      countBetsByStatus(userIds, 2)
    ]);

    // Process the fetched data to attach to results.docs
    results.docs.forEach((doc) => {
      doc.settlements = betsInfo[doc.userId] || [];
      doc.data = {
        parent: parents[doc.createdBy] || '',
        lastBetTime: lastBets[doc.userId]?.betTime || 0,
        availableBalance: lastDeposits[doc.userId]?.availableBalance || 0,
        activeBets: activeBetsCount[doc.userId] || 0,
        canceledBets: canceledBetsCount[doc.userId] || 0
      };
    });

    return res.send({
      success: true,
      message: 'Users list',
      total: results.total,
      results: results
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: 'Failed to get bettors list' });
  }
};

const userSingleLedger = async (req, res) => {
  if (req.decoded.role != 0) {
    return res.status(404).send({ message: '-----' });
  }
  const lastDeposit = await Deposits.find({ userId: req.query.userId }).sort({ _id: -1 }).limit(10);
  return res.send({
    success: true,
    message: 'user ledger last record',
    result: lastDeposit
  });
};

const deleteUser = async (req, res) => {
  if (req.decoded.role != 0) {
    return res.status(404).send({ message: '-----' });
  }
  const userId = req.query.id;
  let userIds = [userId];
  const finalUsers = [userId];
  do {
    const dealers = await User.distinct('userId', {
      createdBy: { $in: userIds },
      role: { $ne: '5' }
    });
    const battors = await User.distinct('userId', {
      createdBy: { $in: userIds },
      role: '5'
    });
    finalUsers.push(...dealers, ...battors);
    // //console.log('dealers list ========== ', dealers);
    // //console.log('battors list ========== ', battors);
    userIds = dealers;
    if (dealers.length == 0) {
      break;
    }
  } while (true);
  // //console.log('All Users list ========== ', finalUsers);
  const respone = await User.deleteMany({ userId: { $in: finalUsers } });
  const depositDelete = await Deposits.deleteMany({
    userId: { $in: finalUsers }
  });
  const betsDelete = await Bets.deleteMany({ userId: { $in: finalUsers } });

  return res.send({
    success: true,
    message: 'user deleted succesfully !',
    results: null
  });
};

const userAccountSattlement = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length != 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  try {
    const payload = req.body;
    await User.findOneAndUpdate(
      { userId: Number(payload.userId) },
      {
        $set: {
          exposure: Number(Number(payload.exposure).toFixed(3)),
          availableBalance: Number(Number(payload.availableBalance).toFixed(3)),
          balance: Number(Number(payload.balance).toFixed(3)),
          clientPL: Number(Number(payload.clientPL).toFixed(3))
        }
      }
    );

    const lastDeposit = await Deposits.find({ userId: Number(payload.userId) })
      .sort({ _id: -1 })
      .limit(1);
    if (lastDeposit.length) {
      await Deposits.updateOne(
        { _id: lastDeposit[0]?._id },
        {
          // exposure: Number(Number(payload.exposure).toFixed(3)),
          availableBalance: Number(Number(payload.availableBalance).toFixed(3)),
          maxWithdraw: Number(Number(payload.availableBalance).toFixed(3)),
          balance: Number(Number(payload.balance).toFixed(3)),
          // clientPL: Number(Number(payload.clientPL).toFixed(3)),
          description: `${lastDeposit.description} ...`
        }
      );
    }

    return res.status(200).send({
      success: true,
      message: 'User Updated Successfully !'
    });
  } catch (error) {
    //console.log("Catched", error);
    return res.status(404).send({
      success: false,
      message: 'Something Went Wrong!'
    });
  }
};

router.post('/login', userValidation.validate('login'), login);
router.post('/logout', logout);
loginRouter.post('/register', userValidation.validate('registerUser'), registerUser);

loginRouter.get('/getAllUsers', getAllUsers);
loginRouter.post('/changePassword', userValidation.validate('changePassword'), changePassword);
loginRouter.post('/updateUser', userValidation.validate('updateUser'), updateUser);
loginRouter.post('/checkfourdigitcode', checkfourdigitcode);
loginRouter.get('/blockCashWithdraw', blockCashWithdraw);
loginRouter.post('/searchUsers', userValidation.validate('searchUsers'), searchUsers);

loginRouter.get('/getCurrentUser', getCurrentUser);
router.post('/getSingleUser', userValidation.validate('getSingleUser'), getSingleUser);
loginRouter.post('/activeUser', userValidation.validate('activeUser'), activeUser);
loginRouter.post('/deactiveUser', userValidation.validate('deactiveUser'), deactiveUser);
loginRouter.post('/checkValidation', userValidation.validate('checkValidation'), checkValidation);

loginRouter.get('/getSettlement', getSettlement);
loginRouter.post('/settlePLAccount', userValidation.validate('settlePLAccount'), settlePLAccount);

loginRouter.post('/searchSingleUser', searchSingleUser);
loginRouter.get('/battors-list', battorsList);
loginRouter.get('/user-latest-ledger', userSingleLedger);

loginRouter.get('/delete-user', deleteUser);

loginRouter.post('/userAccountSettlement', userValidation.validate('userAccountSattlement'), userAccountSattlement);

module.exports = { router, loginRouter };
