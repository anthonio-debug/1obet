const express = require("express");
const router = express.Router();
const Crickets = require("../models/Crickets");
let config = require('config');

async function listCricket(req, res) {
  let query = {};
  let page = 1;
  let sort = -1;
  var limit = config.pageSize;

  if (
    req.query.numRecords &&
    !isNaN(req.query.numRecords) &&
    req.query.numRecords > 0
  )
    limit = Number(req.query.numRecords);
  if (req.query.sort) sort = Number(req.query.sort);
  if (req.query.page) page = Number(req.query.page);
  Crickets.paginate(
    query,
    { page: page, limit: limit },
    (err, results) => {
      console.log("err: --->", err)
      console.log("results: --->", results)
      if (err) return res.status(404).send({ message: 'Something went wrong' });
      return res.send({
        success: true,
        message: 'Crickets list',
        total: results.total,
        results: results,
      });
    }
  );
}

router.get("/listCricket", listCricket);

module.exports = { router };