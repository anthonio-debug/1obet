const mongoose = require('mongoose');

const casinoCallsPayloadSchema = new mongoose.Schema({
  remote_id: { type: String, required: false },
  jsonData: { type: String },
  action: { type: String },
  createdAt: { type: Date, default: Date.now }, // Automatically set createdAt
  updatedAt: { type: Date, default: Date.now }  // Automatically set updatedAt
});

// Middleware to update the updatedAt field on save
casinoCallsPayloadSchema.pre('save', function (next) {
  this.updatedAt = Date.now(); // Always update updatedAt
  next();
});

const CasinoCallsPayload = mongoose.model('CasinoCallsPayload', casinoCallsPayloadSchema);

module.exports = CasinoCallsPayload;
