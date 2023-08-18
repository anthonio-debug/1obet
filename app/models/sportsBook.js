let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', false);
let SportsBookSchema = new Schema({
  name: { type: String, required: true },
  maxAmount: { type: Number, required: true },
  updatedAt: { type: Number },
  createdAt: { type: Number },
  sportsId: { type: String }
});

betLimitsSchema.pre('save', function (next) {
  var now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const SportsBook = mongoose.model('SportsBook', SportsBookSchema);

module.exports = SportsBook;
