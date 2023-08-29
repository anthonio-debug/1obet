
const inPlayEvents = require('./app/models/events');

const ToolForResults = require('./src/tools_for_results.js')();




const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 30000
};

mongoose.set('strictQuery', false);
mongoose.set({ debug: false });
mongoose
  .connect('mongodb://127.0.0.1/Bet99', mongooseOptions)
  .then(() => {
    console.log('Database connected');
  })
  .catch(err => {
    console.error(`Failed to connect to the database: ${err}`);
  });



async function main() {
  ToolForResults.init();
}

main();
