/* eslint no-unused-vars: "off" */
let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', false);
let Global = require('../global/settings');

let settlementLog = new Schema({
    matchId: String,
    marketId: String,
    type: { type: String, enum: ["SETTLE", "ROLLBACK"] },
    settledBy: String,
    SettledAt: Date,
    affectedBets: [mongoose.Schema.Types.Mixed],
    balanceChanges: [mongoose.Schema.Types.Mixed],
}, { timestamps: true });

settlementLog.plugin(Global.aggregatePaginate);
settlementLog.plugin(Global.paginate);

const Settings = mongoose.model('ettlementlogs', settlementLog);

module.exports = Settings;
