const mongoose = require('mongoose');
require('dotenv').config();
const ToolForResults = require('./result-saver-src/toolStart.js')();
const DBNAME = process.env.DB_NAME;
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 30000
};

mongoose.set('strictQuery', false);
mongoose.set({debug: false});
mongoose
  .connect(`mongodb://127.0.0.1/${DBNAME}`, mongooseOptions)
  .then(async () => {
    console.log('Database connected');
    await ToolForResults.init();
  })
  .catch(err => {
    console.error(`Failed to connect to the database: ${err}`);
  });
