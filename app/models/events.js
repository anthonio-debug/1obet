const mongoose = require('mongoose');

/*
 [Type]
  1. InPlayEvent
  2. Events Competations
*/


// Define the schema
const inPlayEventsSchema = new mongoose.Schema({
  sportsId:{ type: String, index: true },
  sport: { type: String },
  competitionId: { type: String },
  competitionName: { type: String },
  Id: { type: String, index: true },
  name: { type: String },
  countryCode: { type: String },
  timezone: { type: String },
  openDate: { type: String },
  inplay: { type: Boolean, index: true },
  hasFancy: { type: Boolean },
  status: { type: String },
  isPremium:{type: Boolean },
  marketIds:{type: Array, default: [] },
  type: { type: Number, default: 0 },
  matchType: { type: String, default: '' },
  islocked: { type: Boolean , default: false, index: true },
  iconStatus: { type: Boolean, default: false },
  
  //required fields for gray and horse raiding
  meetingId: { type: Number },
  venue: { type: String },
  countryCodes: [String],
  meetingGoing: { type: String },
  races: { type: Array },
  matchStoppedReason: { type: String },
  matchStopStatus: { type: Boolean, default: false },
  matchCanceledStatus: { type: Boolean },
  matchResumedStatus:{ type: Boolean }
});

// Create the model
inPlayEventsSchema.index({ inplay: 1, sportsId: 1 })

const inPlayEvents = mongoose.model('inplayevents', inPlayEventsSchema);

inPlayEvents.createIndexes();
module.exports = inPlayEvents;
