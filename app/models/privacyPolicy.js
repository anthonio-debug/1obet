const mongoose = require('mongoose');
mongoose.set('debug', true);

let Global = require('../global/settings');
const privacyPolicySchema = new mongoose.Schema({
  privacyPolicyContent: { type: String, required: false },
  createdAt: { type: Number },
  updatedAt: { type: Number },
});
privacyPolicySchema.pre('save', function (next) {
  var now = new Date().getTime() / 1000;
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

privacyPolicySchema.plugin(Global.paginate);
privacyPolicySchema.plugin(Global.aggregatePaginate);

module.exports = mongoose.model('privacyPolicy', privacyPolicySchema);
