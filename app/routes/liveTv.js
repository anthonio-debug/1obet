const express = require("express");
let config = require("config");
const axios = require("axios");
const loginRouter = express.Router();

async function liveTv(req, res) {
  const eventId = req.params.eventId;
  const url = `${config.liveTvUrl}/get_live_tv_url/${eventId}`;
  // console.log('url', url);
  try {
    const response = await axios.get(url);
    // console.log('response', response.data);
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

async function liveDrateTp20(req, res) {
  const url = `${config.liveBetTvUrl}/d_rate/teen20`;
  try {
    const response = await axios.get(url);
    const liveTp20Data = response.data;
    res.status(200).json({
      success: true,
      message: "Live Tv Streaming for teen20 dRate",
      liveTp20Data: liveTp20Data,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get live Tv Streaming for teen20 dRate",
      error: err.message,
    });
  }
}

// Define the route for the API
loginRouter.get("/liveTv/:eventId", liveTv);
loginRouter.get("/liveTv/d_rate/teen20", liveDrateTp20);

module.exports = { loginRouter };
