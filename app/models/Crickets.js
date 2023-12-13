const mongoose = require('mongoose');

const CricketSchema = new mongoose.Schema({
  seriesKey: { type: String, required: false },
  eventId: { type: String },
  Title: { type: String, required: false },
  __v: { type: Number, required: false },
  day: { type: String, required: false },
  matchEnglishTitle: { type: String, required: false },
  matchNo: { type: Number, required: false },
  matchTitle: { type: String, required: false },
  meta: { type: Object, required: false },
  over1: { type: String, required: false },
  over2: { type: String, required: false },
  rateTeam: { type: String, required: false },
  res: { type: String, required: false },
  score1: { type: String, required: false },
  score2: { type: String, required: false },
  seriesFullName: { type: String, required: false },
  seriesName: { type: String, required: false },
  seriesTitle: { type: String, required: false },
  state: { type: String, required: false },
  team1Flag: { type: String, required: false },
  team1Name: { type: String, required: false },
  team1Score: { type: String, required: false },
  team1ShortName: { type: String, required: false },
  team2Flag: { type: String, required: false },
  team2Name: { type: String, required: false },
  time: { type: String, required: false },
  timestamp: { type: String, required: false },
  type: { type: String, required: false },
  venueName: { type: String, required: false },
  timestamp: { type:Number, default: new Date().getTime() / 1000}
}, {strict: false});

const Crickets = mongoose.model('crickets', CricketSchema);
module.exports = Crickets;
