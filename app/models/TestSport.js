const mongoose = require('mongoose');

const testSportOddSchema = new mongoose.Schema({
  eventId: { type: String },
  marketId: { type: String },
  runners: { type: Array },
});

const TestSportOdd = mongoose.model('testsport', testSportOddSchema);
module.exports = TestSportOdd;
