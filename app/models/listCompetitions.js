const mongoose = require('mongoose');

const competitionSchema = new mongoose.Schema({
  Id: { type: String, required: true },
  Name: { type: String, required: true },
  Status: { type: Number },
});

const Competition = mongoose.model('Competition', competitionSchema);

module.exports = Competition;
