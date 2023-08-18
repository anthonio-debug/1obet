const express = require('express');
const loginRouter = express.Router();
const axios = require('axios');
const User = require('../models/user');
async function sportsBook(req, res) {
  try {
    const user_username = `user_${req.decoded.userId}`
    const response = await axios.post("https://em-api.thegameprovider.com/api/seamless/provider",{
        "api_password": "b16gWs7e0QAASLTne0",
        "api_login": "1obet_mc_s",
        "method": "getGame",
        "lang": "en",
        "user_username": user_username,
        "user_password": user_username,
        "homeurl": "https://1obet.com",
        "gameid": "di#di-sportsbook",
        "play_for_fun": false,
        "currency": "PKR"
    });

    return res.send({
    success: true,
    message: 'Markets updated successfully',
    data: response
    });

  } catch (err) {
    console.error(err);
    res.status(404).send({ message: 'betlock not saved' });
  }
}

loginRouter.get(
  '/sportsBook',
  sportsBook
);

module.exports = { loginRouter };
