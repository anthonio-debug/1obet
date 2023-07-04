const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  sport: { type: String, required: true },
  competitionId: { type: String, required: true },
  competitionName: { type: String, required: true },
  Id: { type: String, required: true },
  name: { type: String, required: true },
  countryCode: { type: String, required: false },
  timezone: { type: String, required: true },
  openDate: { type: Date, required: true },
  inplay: { type: Boolean, required: true },
  hasFancy: { type: Boolean, required: true },
  status: { type: String, required: true },
  isPremium: { type: Boolean, required: true },
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
