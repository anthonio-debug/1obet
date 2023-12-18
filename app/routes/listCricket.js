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
    {
      page: page,
      limit: limit,
      sort: {
        state: 1,
        timestamp: -1
      },
    },
    (err, results) => {
      if (err) return res.status(404).send({ message: 'Something went wrong' });
      console.log(results);
      return res.send({
        success: true,
        message: 'Crickets list',
        total: results.total,
        results: results.docs, // Access the documents array within results
      });
    }
  );
}

async function editCricket(req, res) {
  const { _id, eventId } = req.body;

  try {
    const result = await Crickets.updateOne(
      { _id: _id }, 
      { $set: { eventId: eventId } },
    );

    // Check if the update was successful
    res.status(200).json({ success: true, message: 'Cricket updated successfully' });
  } catch (error) {
    console.error('Error updating cricket:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}


router.get("/listCricket", listCricket);
router.post("/editCricket", editCricket);

module.exports = { router };