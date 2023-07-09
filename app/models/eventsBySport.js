const mongoose = require('mongoose');

const raceSchema = new mongoose.Schema({
  update: String,
  marketId: String,
  raceId: String,
  marketName: String,
  marketType: String,
  numberOfWinners: Number,
  numberOfRunners: Number,
  numberOfActiveRunners: Number,
  startTime: Date,
  result: Boolean,
  raceNumber: String,
  inplay: Boolean,
  status: String
});

const meetingSchema = new mongoose.Schema({
  meetingId: Number,
  name: String,
  openDate: Date,
  venue: String,
  eventTypeId: Number,
  countryCode: String,
  meetingGoing: String,
  races: [raceSchema]
});

const eventSchema = new mongoose.Schema({
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
  countryCodes: [String],
  meetings: [meetingSchema]
});

const Event = mongoose.model('eventsBySport', eventSchema);

module.exports = Event;
