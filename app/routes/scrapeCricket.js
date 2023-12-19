const express = require('express');
let config = require('config');
const cricketRouter = express.Router();
const Crickets = require('../models/Crickets')
const inPlayEvents = require("../models/events");

const convertSchema = (entity) => {
  const overs = entity.overs || [];
  const lastOver = overs.at(-1);
  if (!lastOver) return undefined;

  const getTeamRate = (rateType, activeTeamNo) => {
    const activeTeam = activeTeamNo === 1 ? entity.team1SName : entity.team2SName;
    return lastOver.team === activeTeam ? `${rateType} ${entity[rateType]}` : "";
  };

  const getScore = (score) => {
    const regex = /-?\d+(\.\d+)?/g;
    const matches = score.match(regex) || [0, 0, '0.0'];
    return `${matches[0]}-${matches[1]} (${matches[2]})`;
  };

  return {
    eventId: 0,
    seriesKey: entity.seriesKey,
    score: {
      activenation1: 1,
      activenation2: 0,
      balls: lastOver.info,
      overScore: lastOver.total,
      team1Flag: entity.team1Flag,
      team2Flag: entity.team2Flag,
      dayno: "",
      isfinished: "0",
      score1: getScore(entity.score1),
      score2: getScore(entity.score2),
      spnballrunningstatus: entity.result,
      spnmessage: "",
      spnnation1: entity.team1SName,
      spnnation2: entity.team2SName,
      spnreqrate1: getTeamRate("RRR", 1),
      spnreqrate2: getTeamRate("RRR", 2),
      spnrunrate1: getTeamRate("CRR", 1),
      spnrunrate2: getTeamRate("CRR", 2),
    }
  };
}

async function updateCricketData(req, res) {
  const {type, entities} = req.body;
  const io = req.io
  io.on('connected', () => {
    console.log('connected')
  })

  if (type === 'live') {
    const socketData = convertSchema(entities)
    if (socketData) {
      // console.log('cricket live socket', socketData)
      io.emit('score', socketData)
    }
  }

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
    } else {
      res.status(200).json({
        success: false,
        message: 'incorrect filed',
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
