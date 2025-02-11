/* eslint no-unused-vars: "off" */
let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', false);


let auraGamesSchema = new Schema({
  name:      { type: String, default:'' },
  gameId: { type: String, default:'' },
  LaunchID: { type: String, default: '' },
  CategoryName: { type: String, default: '' },
  CategoryID:{type:String,default:''},
  sortBy:  { type: Number },
  status:  { type: Number,default:0 },
  updatedAt: { type: Number },
  createdAt: { type: Number }
});

auraGamesSchema.pre('save', function (next) {
  var now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const auraGames = mongoose.model('auraGames', auraGamesSchema);

module.exports = auraGames;
