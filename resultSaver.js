const mongoose = require('mongoose');
require('dotenv').config();
const ToolForResults = require('./result-saver-src/toolStart.js')();
const DBHost = process.env.DBHost;
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 30000
};

mongoose.set('strictQuery', false);
mongoose.set({ debug: false });
mongoose
  .connect(`${DBHost}?directConnection=true`, mongooseOptions)
  .then(async () => {
    console.log('Database connected');
    await ToolForResults.init();
  })
  .catch(err => {
    console.error(`Failed to connect to the database: ${err}`);
  });
