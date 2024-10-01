const mongoose = require('mongoose');

const casinoCallsPayloadSchema = new mongoose.Schema({
  remote_id: { type: String, required: false },
  jsonData: { type: String },
  action: { type: String },

});



const CasinoCallsPayload = mongoose.model('CasinoCallsPayload', casinoCallsPayloadSchema);

module.exports = CasinoCallsPayload;
