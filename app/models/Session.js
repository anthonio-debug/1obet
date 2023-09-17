let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', false);
let Global = require('../global/settings');

let sessionSchema = new Schema({
  sessionNo: { type: Number },
  Id: { type: String},
  eventId: { type: Number },
  score: { type: Number, default: 0 },
  updatedAt: { type: Number },
  createdAt: { type: Number },
  manuelSave: { type: Boolean, default: false },

});

sessionSchema.plugin(Global.aggregatePaginate);
sessionSchema.plugin(Global.paginate);
sessionSchema.pre('save', function (next) {
  var now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
    this.updatedAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const Session = mongoose.model('sessions', sessionSchema);
module.exports = Session;
