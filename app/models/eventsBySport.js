const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  sport: { type: String, required: false },
  sport: { type: String, required: false },
  sportsId: { type: String },
  competitionId: { type: String, required: false },
  competitionName: { type: String, required: false },
  Id: { type: String, required: false },
  name: { type: String, required: false },
  countryCode: { type: String, required: false },
  timezone: { type: String, required: false },
  openDate: { type: Date, required: false },
  inplay: { type: Boolean, required: false },
  hasFancy: { type: Boolean, required: false },
  status: { type: String, required: false },
  isPremium: { type: Boolean, required: false },
  meetingId:{ type: Number },
  venue: { type: String },
  eventTypeId:{ type: Number },
  countryCode: { type: String },
  races: [{
    movember:{ type: String } ,
    marketName: { type: String },
    marketId: { type: String },
    marketType: { type: String },
    eventId: { type: Number },
    startTime:{ type: Date },
    open: { type: Number },
    inplay: { type: Number },
    port: {type: Number },
  }],
});

const Event = mongoose.model('eventsBySport', eventSchema);

module.exports = Event;
