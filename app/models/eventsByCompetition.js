const mongoose = require('mongoose');

// Define the schema
const eventByCompetitionSchema = new mongoose.Schema({
  sport: { type: String },
  sportsId: { type: String },
  competitionId: { type: String },
  competitionName: { type: String },
  Id: { type: String },
  name: { type: String },
  countryCode: { type: String },
  timezone: { type: String },
  openDate: { type: String },
  inplay: { type: Boolean },
  hasFancy: { type: Boolean },
  status: { type: String },
  isPremium: { type: Boolean }
});

// Create the model
const eventByCompetition = mongoose.model('eventByCompetitions', eventByCompetitionSchema);

module.exports = eventByCompetition;
