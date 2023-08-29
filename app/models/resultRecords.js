const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const scoreSchema = new Schema({
    eventId: {
        type: String,
        required: true,
        index: true, 
    },
    marketData: {
        type: String,
        required: true,
        index: true, 
    },
    resultData: {
        type: Schema.Types.Mixed, 
        required: true,
    },
});

const Score = mongoose.model('Score', scoreSchema);

module.exports = Score;