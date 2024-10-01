const mongoose = require('mongoose');

const casinoCallsPayloadSchema = new mongoose.Schema({
 
 
  remote_id: { type: String, required: false },
  jsonData: { type: String },
  action :{type:String}

});

casinoCallsPayloadSchema.pre('save', function (next) {
  let now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});
const CasinoCallsPAyload = mongoose.model('CasinoCallsPayload', casinoCallsPayloadSchema);

module.exports = CasinoCallsPAyload;
