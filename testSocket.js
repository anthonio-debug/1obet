const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Add event listeners for Socket.IO connections
io.on('connection', (socket) => {
  console.log('A client connected!');
});

const port = 3001;
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});