const mongoose = require('mongoose');

const CricketSchema = new mongoose.Schema({
  timestamp: { type:Number, default: new Date().getTime() / 1000}
}, {strict: false});

const Crickets = mongoose.model('crickets', CricketSchema);
module.exports = Crickets;
