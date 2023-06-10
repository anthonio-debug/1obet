const fs = require('fs');

// const option = {
//   key: fs.readFileSync(__dirname + "/private.pem"),
//   cert: fs.readFileSync(__dirname + "/certificate.pem"),
//   chain1: fs.readFileSync(__dirname + "/chain1.pem"),
//   fullchain1: fs.readFileSync(__dirname + "/fullchain1.pem"),
// };
const option = {
  key: fs.readFileSync("/etc/letsencrypt/archive/1obet.com/privkey1.pem"),
  cert: fs.readFileSync("/etc/letsencrypt/archive/1obet.com/cert1.pem"),
  chain1: fs.readFileSync("/etc/letsencrypt/archive/1obet.com/chain1.pem"),
  fullchain1: fs.readFileSync(
    "/etc/letsencrypt/archive/1obet.com/fullchain1.pem"
  ),
};

module.exports = option;
