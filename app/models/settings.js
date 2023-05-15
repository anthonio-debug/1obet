/* eslint no-unused-vars: "off" */
let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', true);
let Global = require('../global/settings');

let settingsSchema = new Schema({
  defaultThemeName: { type: String, required: false },
  defaultLoginPage: { type: String, required: false },
  updatedAt: { type: Number },
  createdAt: { type: Number },
});

settingsSchema.plugin(Global.aggregatePaginate);
settingsSchema.plugin(Global.paginate);

settingsSchema.pre('save', function (next) {
  var now = new Date().getTime() / 1000;
  if (!this.createdAt) {
    this.createdAt = now;
    this.updatedAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const Settings = mongoose.model('settings', settingsSchema);

module.exports = Settings;
