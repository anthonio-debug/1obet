const mongoose = require('mongoose');

const liveStreamSchema = new mongoose.Schema({
    liveUrl : {type: String, required: true},
    type: {type: String, required: true},
    sportsId: {type: Number}
});

const LiveStream = mongoose.model('livestream', liveStreamSchema);

module.exports = LiveStream;
