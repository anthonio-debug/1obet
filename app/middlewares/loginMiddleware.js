const LoginActivity = require('../models/loginActivity')
const jwt = require('jsonwebtoken')
const config = require('config')
// const geoHash = require('ngeohash')

function verifySecureLogin(req, res, next) {
  const authHeader = req.headers.authorization
  if (authHeader) {
    const token = authHeader.split(' ')[1]
    check(req, res, next, token)
  } else {
    return res.status(404).send({ message: 'Authorization token is missing' })
  }
}

function check(req, res, next, token) {
  LoginActivity.findOneAndUpdate(
    {
      token: token,
      isActive: true
    },
    // {
    //   lastSeen: new Date().getTime(),
    //   location: req.location ? {
    //     type: 'Point',
    //     coordinates: geoHash.decode(req.location),
    //   } : null,
    //   region: req.region ? req.region : null,
    // },
    { upsert: false, new: false },
    (err, userObj) => {
      if (err) return res.status(404).send({ message: 'Failed to verify authorization token', err })
      if (!userObj) return res.status(404).send({ message: 'Invalid or expired authorization token' })

      jwt.verify(token, config.secret, function (err, decoded) {
        if (err) return res.status(404).send({ message: 'Failed to verify authorization token', err })
        // if everything is good, save to request for use in other routes
        req.decoded = decoded
        req.decoded.login = userObj
        if (decoded.user !== userObj.email) return res.status(404).send({ message: 'Invalid authorization token' })
        next()
      })
    }
  )
}

module.exports = verifySecureLogin

