const express = require("express");
let config = require("config");
const axios = require("axios");
const loginRouter = express.Router();
const router = express.Router();
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

async function getAllTables(req, res) {
  try {
    const allAsianTables = await AsianTable.find({ status: "1" });

    res.status(200).json({
      success: true,
      message: "All Asian Tables",
      allAsianTables: allAsianTables,
    });
  } catch (error) {
    res.status(200).json({
      success: false,
      message: "Failed to get all asian tables",
      error: error.message,
    });
  }
}



// Define the route for the API
loginRouter.get("/liveTv/:eventId", liveTv);

module.exports = { loginRouter, router };
