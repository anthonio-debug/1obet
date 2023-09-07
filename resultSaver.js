
const mongoose = require('mongoose');

const ToolForResults = require('./result-saver-src/toolStart.js')();

const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 30000
};

mongoose.set('strictQuery', false);
mongoose.set({ debug: false });
mongoose
  .connect('mongodb://127.0.0.1/Bet99', mongooseOptions)
  .then(async () => {
    console.log('Database connected');
    await ToolForResults.init();
  })
  .catch(err => {
    console.error(`Failed to connect to the database: ${err}`);
  });


