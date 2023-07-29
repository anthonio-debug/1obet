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

// const server = app.listen(4001, () => {
//   console.log('Server listening on port 4001');
// });

// Create HTTPs server.
var server = https.createServer(option, app);
server.listen(PORT, (err) => {
  if (err) throw new Error(err);
  console.log(`Server is listening on port ${PORT}`);
});

// Connect to MongoDB using Mongoose
mongoose.set('strictQuery', false);
mongoose.set({ debug: true });
mongoose.connect('mongodb://127.0.0.1:27017/Bet99', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});


app.get('/', (req, res) => {
  res.send(
    '<body style="background: #000; color: #fff"><h2> This is the homepage of 1obet.com </h2></body>'
  );
});


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



let interval; 
// Socket.io event handlers
io.on('connection', (socket) => {
  console.log('New client connected');
  socket.on('listOdds', async (data) => {
    console.log('Received event1:', data);
    let result = await listOdds(data);
    console.log(`Outer Console  ${data} `);
    socket.emit('listOdds_response', result);
    interval = setInterval(async () => {
      result = await listOdds(data);
      console.log("result", result);
      console.log(`Interval ${data} `);
      socket.emit('listOdds_response', result);
    }, 900);
  });



  // LISTEN FOR EVENT 2
  socket.on('racesMarketOdds', async (data) => {
    console.log('Received event2:', data);

    // Perform some function with data
    let result2 = await racesMarketOdds(data);
    // Emit 'event2_response' with the result
    socket.emit('racesMarketOdds_response', result);
    
    interval = setInterval(async () => {
      console.log("result", result2);
      // Perform some function with data
      result2 = await racesMarketOdds(data);
      socket.emit('racesMarketOdds_response', result2);
    }, 900);
  });


  // Handle disconnection
  socket.on('disconnect', () => {
    clearInterval(interval)
    console.log('Client disconnected');
  });
});
