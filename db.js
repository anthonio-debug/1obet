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
  .connect(`mongodb://127.0.0.1/${config.database_name}`, options)
  .then(() => {
    console.log('Database connected');
  })
  .catch((err) => {
    console.log(` Database did not connect because ${err}`);
  });