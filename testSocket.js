const express     = require('express');
const mongoose    = require('mongoose');
const { Server }  = require('socket.io');
const https       = require('https');
let cors          = require('cors');
const option      = require('./option');
const PORT        = 4000;
const { 
  listOdds, 
  racesMarketOdds 
}                 = require('./app/routes/socketHelper')

const app = express();
var corsOptions = {
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};
app.use(cors(corsOptions));

mongoose.set('strictQuery', false);
mongoose.set({ debug: true });
mongoose.connect('mongodb://127.0.0.1:27017/Bet99', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});


var server = https.createServer(option, app);
server.listen(PORT, (err) => {
  if (err) throw new Error(err);
  console.log(`Server is listening on port ${PORT}`);
});

// Create Socket.io instance
const io = new Server(server,  {
  pingInterval: 5000,
  pingTimeout: 60000,
  cookie: false,
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: '*/*',
    credentials: true
  },
  transports: ['polling'] // Enable WebSocket transport

});

let interval; 
// Socket.io event handlers
io.on('connection', (socket) => {
  console.log(`New client connected ${socket.id}`);
  socket.on('listOdds', async (data) => {
    // let result = await listOdds(data);
    // socket.emit('listOdds_response', result);
    interval = setInterval(async () => {
      // result = await listOdds(data);
      // console.log("result-->>", result);
      socket.emit('listOdds_response', result);
    }, 900);
  });



  // LISTEN FOR EVENT 2
  socket.on('racesMarketOdds', async (data) => {
    let result2 = await racesMarketOdds(data);
    socket.emit('racesMarketOdds_response', result2);
    // interval = setInterval(async () => {
    //   console.log("result", result2);
    //   result2 = await racesMarketOdds(data);
    //   socket.emit('racesMarketOdds_response', result2);
    // }, 900);
  });


  // Handle disconnection
  socket.on('disconnect', () => {
    clearInterval(interval)
    console.log('Client disconnected');
  });
});