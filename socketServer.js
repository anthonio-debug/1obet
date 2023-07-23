const express = require('express');
const app = express();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
let config = require('config');
let fs = require('fs');
let cors = require('cors');
var morgan = require('morgan');
const https = require('https');
const option = require('./option');
const apisMiddleware = require('./app/middlewares/apisMiddleware');
const loginMiddleWare = require('./app/middlewares/loginMiddleware');
const aclMiddleware = require('./app/middlewares/aclMiddleware');
const accessMiddleware = require('./app/middlewares/accessMiddleware');
const checkRoleMiddleware = require('./app/middlewares/checkRoleMiddleware');

// CONNECT THE DATABASE
let options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 30000, // 30 seconds
};

mongoose.set('strictQuery', false);
mongoose.set({ debug: true });
mongoose
  .connect(config.DBHost, options)
  .then(() => {
    console.log('Database connected');
  })
  .catch((err) => {
    console.log(` Database did not connect because ${err}`);
  });


// READ FORM DATA

var corsOptions = {
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));
app.get('/', (req, res) => {
  res.send(
    '<body style="background: #000; color: #fff"><h2> This is the homepage of 1obet.com </h2></body>'
  );
});

var server = https.createServer(option, app);
server.listen(config.PORT, (err) => {
  if (err) throw new Error(err);
  console.log(`Server is listening on port ${config.PORT}`);
});
