const express = require('express');
const loginRouter = express.Router();
const axios = require('axios')

async function sportsBook(req, res) {
  try {
    // 
    const response = await axios.post("https://em-api.thegameprovider.com/api/seamless/provider", {
        {
            "api_login": "1obet_mc_s",
            "api_password": "b16gWs7e0QAASLTne0",
            "method": "getGameDirect",
            "show_systems": 1,
            "show_additional": true,
            "currency": "PKR"
        }
      );

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
