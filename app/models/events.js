const mongoose = require('mongoose');

const raceSchema = new mongoose.Schema({
  marketName: { type: String },
  marketId: { type: String },
  marketType: { type: String },
  startTime: { type: Date },
  inplay: { type: Number },
});
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
  isPremium:{type: Boolean },
  type: { type: Number },
  matchType: { type: String, default:'' },
  iconStatus: { type: Boolean, default: false },
  //fancy data
  t1: { type: Array },
  t2: { type: Array },
  t3: { type: Array },
  t4: { type: Array },
  status: { type: String, required: false },
  updatetime: { type: String, required: false },
  eventTypeId: { type: String, required: false },
  eventTypeName: { type: String, required: false },
  eventName: { type: String, required: false },
  eventDate: { type: String, required: false },
  gameId: { type: String, required: false },
  eventId:{ type: String },

  //racing schema
  meetingId: { type: Number },
  venue: { type: String },
  countryCodes: [String],
  meetingGoing: { type: String },
  races: [raceSchema],
});

// Create the model
const inPlayEvents = mongoose.model('inPlayEvents', inPlayEventsSchema);

module.exports = inPlayEvents;
