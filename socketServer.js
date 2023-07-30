// Import required modules
const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const https = require('https');
let cors = require('cors');
const option = require('./option');
const { listOdds , racesMarketOdds } = require('./app/routes/socketHelper')
const PORT = 4001;

// Create Express app
const app = express();
var corsOptions = {
  origin: true,
  credentials: true,
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};
app.use(cors());
var server = https.createServer(option, app);
server.listen(PORT, (err) => {
  if (err) throw new Error(err);
  console.log(`Server is listening on port ${PORT}`);
});

// Connect to MongoDB using Mongoose
mongoose.set('strictQuery', false);
// mongoose.set({ debug: true });
mongoose.connect('mongodb://127.0.0.1:27017/Bet99', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});


// app.get('/', (req, res) => {
//   res.send(
//     '<body style="background: #000; color: #fff"><h2> This is the homepage of 1obet.com </h2></body>'
//   );
// });


// Create Socket.io instance
const io = new Server(server,  {
  pingInterval: 5000,
  pingTimeout: 60000,
  cookie: false,
  cors: {
    origin: "https://1obet.com",
    methods: ["GET", "POST"],
    allowedHeaders: '*/*',
    credentials: true
  },
  transports: ['polling'] // Enable WebSocket transport

});


let intervals = {}; 
io.on('connection', (socket) => {
  console.log(`New client connected:  ${socket.id}`);
  socket.on('listOdds', async (data) => {
    let result = await listOdds(data);
    io.to(socket.id).emit('listOdds_response', result);
    intervals[socket.id] = setInterval(async () => {
      result = await listOdds(data);
      io.to(socket.id).emit('listOdds_response', result);
    }, 1000);
  });

  socket.on('racesMarketOdds', async (data) => {
    let result2 = await racesMarketOdds(data);
    io.to(socket.id).emit('racesMarketOdds_response', result2);
    intervals[socket.id] = setInterval(async () => {
      result2 = await racesMarketOdds(data);
      io.to(socket.id).emit('racesMarketOdds_response', result2);
    }, 1000);
  });
  socket.on('disconnect', () => {
    clearInterval(intervals[socket.id])
    console.log(`Client disconnected ${socket.id}`);
  });

});
