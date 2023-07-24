const io = require('socket.io-client');

// Connect to the socket server
const socket = io('https://server.1obet.net:4000');

// Listen for 'connect' event
socket.on('connect', () => {
  console.log('Connected to socket server');

// setInterval(() => {
  // Emit 'event1' with timestamp as data
  socket.emit('listOdds', '1107231737');
  console.log('Emitted event1:', 1107231737);
// }, interval);

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

