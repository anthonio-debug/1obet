const express = require('express');
const loginRouter = express.Router();
const axios = require('axios')

async function sportsBook(req, res) {
  try {
    // 
    const response = await axios.post("https://em-api.thegameprovider.com/api/seamless/provider", {
        api_password: config.api_password,
        api_login: config.api_username,
        method: 'getGameList',
        show_additional: true,
        show_systems: 1,
        currency: 'PKR',
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
