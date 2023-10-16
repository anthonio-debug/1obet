const express = require("express");
const { validationResult } = require("express-validator");
let config = require("config");
const User = require("../models/user");

const reportValidator = require("../validators/reports");
const Bets = require("../models/bets");
const loginRouter = express.Router();

const getMarketPositions = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }

  const userId = req.body.userId;

  const resp = [];
  const users = await User.distinct("userId", { createdBy: userId });
  const currentUser = await User.findOne({ userId: userId });
  if (currentUser.role == 0) {
    resp.push(
      {
        _id: currentUser.userId,
        name: "cash",
        amount: currentUser.cash,
      },
      {
        _id: currentUser.userId,
        name: currentUser.userName,
        amount: currentUser.balance,
      }
    );
  } else {
    const parentUser = await User.findOne({ userId: currentUser.createdBy });
    console.log(
      " ================== parentUser ================  ",
      parentUser
    );
    resp.push(
      {
        _id: currentUser.userId,
        name: "cash",
        amount: currentUser.cash,
      },
      {
        _id: currentUser.userId,
        name: currentUser.userName,
        amount: currentUser.balance,
      },
      {
        _id: parentUser.userId,
        name: parentUser.userName,
        amount: currentUser.clientPL * -1,
      }
    );
  }

  console.log(
    " ================== currentUser ================  ",
    currentUser
  );

  const response = await User.aggregate([
    {
      $match: {
        userId: {
          $in: users,
        },
      },
    },
    {
      $group: {
        _id: "$userId",
        name: { $first: "$userName" },
        amount: { $sum: "$clientPL" },
        role: { $first: "$role" },
      },
    },
  ]);

  return res.send({
    success: true,
    message: "Market Positions Reports !",
    results: response,
  });
};

loginRouter.post("/marketPositions", getMarketPositions);

module.exports = { loginRouter };
