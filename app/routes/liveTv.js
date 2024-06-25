const express = require("express");
let config = require("config");
const axios = require("axios");
const loginRouter = express.Router();
const router = express.Router();
const LiveStream = require('../models/liveStream');

const {LIVE_BET_TV_URL} = require("../global/constants");

async function liveTv(req, res) {
  const eventId = req.params.eventId;
  const url = `${config.liveTvUrl}/get_live_tv_url/${eventId}`;
  // //console.log('url', url);
  try {
    const response = await axios.get(url);
    // //console.log('response', response.data);
    const fancyData = response.data;

    res.status(200).json({
      success: true,
      message: "Live Tv Streaming",
      fancyData: fancyData,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: "Failed to get live tv streaming",
      error: error.message,
    });
  }
}

async function liveStream(req, res) {
  try {
    const liveStreams = await LiveStream.find()

    res.status(200).json({
      success: true,
      message: "Live Tv Streaming Urls",
      liveStreamUrls: liveStreams,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: "Failed to get live tv streaming",
      error: error.message,
    });
  }
}




// Define the route for the API
loginRouter.get("/liveTv/:eventId", liveTv);
loginRouter.get("/liveStream", liveStream);

module.exports = { loginRouter, router };
