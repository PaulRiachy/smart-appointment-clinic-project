//run using node socket-test.cjs
const { io } = require('socket.io-client');

const token = 'Staff or Admin JWT Token';

const socket = io('http://localhost:5000', {
  auth: {
    token: token,
  },
});

socket.on('connect', () => {
  console.log('Connected to Socket.IO:', socket.id);
});

socket.on('queue:connected', (data) => {
  console.log('Queue connection confirmed:', data);
});

socket.on('queue:update', (data) => {
  console.log('Queue updated:', data);
});

socket.on('queue:call', (data) => {
  console.log('Customer called:', data);
});

socket.on('queue:complete', (data) => {
  console.log('Queue entry completed:', data);
});

socket.on('connect_error', (error) => {
  console.error('Socket connection failed:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});