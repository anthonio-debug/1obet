const express = require('express');
let config = require('config');
const cricketRouter = express.Router();
const Crickets = require('../models/Crickets')
const inPlayEvents = require("../models/events");

async function updateCricketData(req, res) {
  const {type, entities} = req.body;
  // console.log('update', entities)
  try {
    if (type === 'matches') {
      for (const item of entities) {
        await Crickets.findOneAndUpdate(
          {seriesKey: item.seriesKey},
          item,
          {upsert: true, new: false, setDefaultsOnInsert: true}
        );
      }
      res.status(200).json({
        success: true,
        message: 'updated matches ',
      });
    } else if (type === 'live') {
      // const entities = {
      //   seriesKey: 'key',
      //   overs: [{key: 1, value: 234}, {key: 2, value: 2324}, {key: 3, value: 2314}]
      // }
      // const overs = JSON.parse(JSON.stringify(entities)).overs
      // delete entities.overs
      await Crickets.findOneAndUpdate(
        {seriesKey: entities.seriesKey},
        entities,
        {upsert: true, new: true, setDefaultsOnInsert: true}
      );

      // async function updateOrAppendOvers(seriesKey, newOver) {
      //   const doc = await Crickets.findOne({ seriesKey: seriesKey });
      //   if (doc) {
      //     const overIndex = doc.overs.findIndex(over => {return (over.team === newOver.team && over.over === newOver.over)});
      //
      //     if (overIndex > -1) {
      //       // Order exists, update it
      //       const update = { [`overs.${overIndex}`]: newOver };
      //       return Crickets.findOneAndUpdate(
      //         { seriesKey: seriesKey, [`overs.${overIndex}.team`]: newOver.team, [`overs.${overIndex}.over`]: newOver.over },
      //         { $set: update },
      //         { new: true }
      //       );
      //     } else {
      //       // Order doesn't exist, append it
      //       return Crickets.findOneAndUpdate(
      //         { seriesKey: seriesKey },
      //         { $push: { overs: newOver } },
      //         { new: true }
      //       );
      //     }
      //   }
      // }
      // for (const over of overs) {
      //   await updateOrAppendOvers(entities.seriesKey, over)
      // }

      res.status(200).json({
        success: true,
        message: 'updated matches ',
      });
    }

  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: 'Failed to update cricket data ',
      error: error.message,
    });
  }
}

cricketRouter.post('/update_cricket', updateCricketData);

module.exports = {cricketRouter};
