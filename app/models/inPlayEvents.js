const mongoose = require('mongoose');

// Define the schema
const inPlayEventsSchema = new mongoose.Schema({
  sportsId:{ type: String },
  sport: { type: String },
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
  isPremium:{type: Boolean }
});

// Create the model
const inPlayEvents = mongoose.model('inPlayEventsCopy1', inPlayEventsSchema);

module.exports = inPlayEvents;
