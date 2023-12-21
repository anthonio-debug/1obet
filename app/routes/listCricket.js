const express = require("express");
const router = express.Router();
const Crickets = require("../models/Crickets");
const InPlayEvents = require("../models/events")
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

  Crickets.find(query)
  .sort({ timestamp: -1 })
  .exec((err, allRecords) => {
    if (err) return res.status(404).send({ message: 'Something went wrong' });

    // Apply custom sorting logic
    const sortedRecords = allRecords.sort((a, b) => {
      if (a.state === 'live' && b.state !== 'live') {
        return -1;
      } else if (a.state !== 'live' && b.state === 'live') {
        return 1;
      } else {
        // If states are the same or both not 'live', sort by timestamp
        return b.timestamp - a.timestamp;
      }
    });

    // Implement your own pagination logic
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedRecords = sortedRecords.slice(startIndex, endIndex);

    return res.send({
      success: true,
      message: 'Paginated and sorted Crickets list',
      total: allRecords.length,
      results: paginatedRecords,
    });
  });
}

async function editCricket(req, res) {
  const { _id, eventId } = req.body;

  try {
    await Crickets.updateOne(
      { _id: _id }, 
      { $set: { eventId: eventId } },
    );

    const cricketInfo = await Crickets.findOne({ _id: _id })

    const seriesKey = cricketInfo.seriesKey;

    await InPlayEvents.updateOne(
      { Id: eventId }, 
      { $set: { seriesKey: seriesKey, matchType:type } },
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