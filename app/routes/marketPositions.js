const express = require('express');
const { validationResult } = require('express-validator');
let config = require('config');
const User = require('../models/user');

const reportValidator = require('../validators/reports');
const Bets = require('../models/bets');
const loginRouter = express.Router();

const getMarketPositions = async (req, res) => {
  const errors = validationResult(req);
  if (errors.errors.length !== 0) {
    return res.status(400).send({ errors: errors.errors });
  }
  const Id = Number(req.body.userId);
  const page = Number(req.body.page) || 1; // Get the page number from the request or default to 1
  const pageSize = Number(req.body.pageSize) || 10; // Set the page size or default to 10
  const searchTerm = req.query.searchTerm || ''; // Get the search term from the request or default to an empty string
  const response = await Bets.aggregate([
    {
      $match: {
        userId: Id,
        // $and: [
        //   {
        //     createdAt: { $gte: req.query.startDate },
        //   },
        //   {
        //     createdAt: { $lte: req.query.endDate },
        //   },
        // ],
        $or: [
          { runnerName: { $regex: searchTerm, $options: 'i' } }, // Case-insensitive regex match on runnerName
          // Add additional fields for search as needed
        ],
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: 'userId',
        as: 'user_info',
      },
    },
    {
      $group: {
        _id: '$marketId',
        userId: { $first: '$userId' },
        runnerName: { $first: '$runnerName' },
        positions: { $sum: '$position' },
        availableBalance: {
          $first: { $arrayElemAt: ['$user_info.availableBalance', 0] },
        },
        createdAt: { $first: '$createdAt' },
      },
    },
    {
      $sort: { createdAt: -1 }, // Optionally sort the results by createdAt in descending order
    },
    {
      $skip: (page - 1) * pageSize, // Skip documents based on the page number and page size
    },
    {
      $limit: pageSize, // Limit the number of documents returned to the page size
    },
  ]);
  return res.send({
    success: true,
    message: 'Market Positions Reports !',
    results: response,
  });
};

loginRouter.post('/marketPositions', getMarketPositions);

module.exports = { loginRouter };
