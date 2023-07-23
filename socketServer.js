// Import required modules
const express = require('express');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
let cors = require('cors');
const { listOdds , racesMarketOdds } = require('./app/routes/socketHelper')

// Create Express app
const app = express();
const server = app.listen(4001, () => {
  console.log('Server listening on port 4001');
});

// Connect to MongoDB using Mongoose
mongoose.connect('mongodb://127.0.0.1:27017/Bet99', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
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



// Socket.io event handlers
io.on('connection', (socket) => {
  console.log('New client connected');

  // LISTEN FOR EVENT 1
  socket.on('listOdds', async (data) => {
    console.log('Received event1:', data);
    // Perform some function with data
    // Emit 'event1_response' with the result
    setInterval(async () => {
      const result = await listOdds(data);
      console.log("Interval Running");
      socket.emit('listOdds_response', result);
    }, 1000);
  });



  // LISTEN FOR EVENT 2
  socket.on('racesMarketOdds', async (data) => {
    console.log('Received event2:', data);

    // Perform some function with data
    const result = await racesMarketOdds(data);

    // Emit 'event2_response' with the result
    socket.emit('racesMarketOdds_response', result);
  });


  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});
