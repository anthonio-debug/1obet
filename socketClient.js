const io = require('socket.io-client');

// Connect to the socket server
const socket = io('http://localhost:3000');

// Listen for 'connect' event
socket.on('connect', () => {
  console.log('Connected to socket server');

  // Time interval in milliseconds
const interval = 2000;

// Emit events at the specified time interval
setInterval(() => {
  // Emit 'event1' with timestamp as data
  socket.emit('listOdds', '1107161856');
  console.log('Emitted event1:', 1);
}, interval);

  // // Emit 'event2' with data
  // socket.emit('event2', 'Data for event2');
});

// Listen for 'event1_response' event
socket.on('listOdds_response', (response) => {
  console.log('Received event1 response:', response);
});

// Listen for 'event2_response' event
socket.on('racesMarketOdds_response', (response) => {
  console.log('Received event2 response:', response);
});

// Listen for 'disconnect' event
socket.on('disconnect', () => {
  console.log('Disconnected from socket server');
});

