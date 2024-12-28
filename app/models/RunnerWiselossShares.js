let mongoose = require('mongoose');
let Schema = mongoose.Schema;
mongoose.set('debug', false);
// let Global = require('../global/settings');

let RunnerWiselossSharesSchema = new Schema({
    userId: { type: Number, index: true },
    betId: { type: String,default:'0',index: true },
    dealerId: { type: Number,index: true },
    marketId: { type: String,default: '0' ,index:true},
    amount: { type: Number, default: 0 },
    runner: { type: String , default: '0' },
    subMarketId: { type: String , default: '0' },
    betSession: { type: String , default: '0' }, 		
    updatedAt: { type: String },
    createdAt: { type: String }
  });
  

const RunnerWiselossShares = mongoose.model('RunnerWiselossShares', RunnerWiselossSharesSchema);
module.exports = RunnerWiselossShares;
