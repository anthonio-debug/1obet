const express = require('express');
const loginRouter = express.Router();

async function sportsBook(req, res) {
  try {
    // https://em-api.thegameprovider.com/api/seamless/provider
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
