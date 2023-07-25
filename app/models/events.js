const mongoose = require('mongoose');

/*
 [Type]
  1. InPlayEvent
  2. Events Competations
*/


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
  marketIds:{type: Array, default: [] },
  type: { type: Number, default: 0 },
  matchType: { type: String, default: '' },
  islocked: { type: Boolean , default: false },
  iconStatus: { type: Boolean, default: false },
  
  //required fields for gray and horse raiding
  meetingId: { type: Number },
  venue: { type: String },
  countryCodes: [String],
  meetingGoing: { type: String },
  races: { type: Array },
});

// Create the model
const inPlayEvents = mongoose.model('inplayevents', inPlayEventsSchema);

module.exports = inPlayEvents;
