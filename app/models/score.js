const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const scoreSchema = new Schema({
  eventId: {
    type: Number,
    required: true,
    index: true, // Bu alanın bir indeks olmasını sağlar
  },
  data: {
    type: Schema.Types.Mixed, // Farklı yapıda verileri kabul eden bir alan
    required: true,
  },
});

const Score = mongoose.model('Score', scoreSchema);

module.exports = Score;