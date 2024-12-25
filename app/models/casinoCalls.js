const mongoose = require('mongoose');

const casinoCallsSchema = new mongoose.Schema({
  action: { type: String, required: false },
  callerId: { type: String, required: false },
  callerPassword: { type: String, required: false },
  callerPrefix: { type: String, required: false },
  username: { type: String, required: false },
  remote_id: { type: Number, required: false },
  amount: { type: String, required: false },
  provider: { type: String, required: false },
  game_id: { type: String, required: false },
  transaction_id: { type: String, unique: true, required: false },
  gameplay_final: { type: Number, required: false },
  round_id: { type: String, required: false },
  session_id: { type: String, required: false },
  key: { type: String, required: false },
  gamesession_id: { type: String, required: false },
  fee: { type: Number, required: false },
  tip_in_amount: { type: Number, required: false },
  is_freeround_bet: { type: Boolean, required: false },
  freeround_id: { type: String, required: false },
  odd_factor: { type: Number, required: false },
  jackpot_contribution_in_amount: { type: Number, required: false },
  jackpot_contribution_ids: { type: Array, required: false },
  jackpot_contribution_per_id: { type: Array, required: false },
  game_id_hash: { type: String, required: false },
  is_freeround_win: { type: Number, required: false },
  freeround_spins_remaining: { type: Number, required: false },
  freeround_completed: { type: Number, required: false },
  is_promo_win: { type: Number, required: false },
  is_jackpot_win: { type: Number, required: false },
  jackpot_win_ids: { type: Array, required: false },
  jackpot_win_in_amount: { type: Number, required: false },
  createdAt: { type: Number },
  lastCheckedTime: { type: Number, default: 0 },
  updatedAt: { type: Number },
  userPrevExposure: { type: Number },
  comingFrom: { type: String, required: false },
  AddedExposure: { type: Number },
  userUpdatedExposure: { type: Number },
  isUsed: { type: Boolean, default: false },
  isProcessing: { type: Boolean, default: true },
});

// Adding Indexes
casinoCallsSchema.index({ transaction_id: 1 }, { unique: true }); // Unique index on transaction_id
casinoCallsSchema.index({ username: 1 }); // Index for faster querying by username
casinoCallsSchema.index({ provider: 1 }); // Index for provider
casinoCallsSchema.index({ game_id: 1 }); // Index for game_id
casinoCallsSchema.index({ round_id: 1, session_id: 1 }); // Compound index for round_id and session_id
casinoCallsSchema.index({ createdAt: 1 }); // Index for sorting/queries on createdAt
casinoCallsSchema.index({ isProcessing: 1, isUsed: 1 }); // Compound index for processing and usage status

casinoCallsSchema.pre('save', function (next) {
  let now = new Date().getTime();
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

const CasinoCalls = mongoose.model('CasinoCalls', casinoCallsSchema);

module.exports = CasinoCalls;
