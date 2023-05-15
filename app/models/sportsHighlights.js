const mongoose = require('mongoose');

const highlightSchema = new mongoose.Schema({
  match: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
});

const sportSchema = new mongoose.Schema({
  sport: {
    type: String,
    required: true,
  },
  highlights: [highlightSchema],
});

const SportHighlight = mongoose.model('sportsHighlights', sportSchema);

module.exports = SportHighlight;
