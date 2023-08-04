let config = require('config');
const mongoose = require('mongoose');

let options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    connectTimeoutMS: 30000, // 30 seconds
  };

mongoose.set('strictQuery', false);
mongoose.set({ debug: false });
mongoose
  .connect(config.DBHost, options)
  .then(() => {
    console.log('Database connected');
  })
  .catch((err) => {
    console.log(` Database did not connect because ${err}`);
  });