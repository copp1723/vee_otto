#!/usr/bin/env node
const express = require('express');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const winston = require('winston');

// Load environment variables
dotenv.config();

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/dashboard-server.log' })
  ]
});

// Initialize Express app
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the dashboard build
app.use(express.static(path.join(__dirname, '../../dist/dashboard')));

// API routes (proxy to main server if needed)
app.use('/api', (req, res) => {
  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  const fullUrl = `${apiUrl}${req.originalUrl}`;
  
  // Forward the request to the main API server
  const proxyReq = require('axios').create();
  proxyReq({
    method: req.method,
    url: fullUrl,
    headers: req.headers,
    data: req.body
  })
    .then(response => res.json(response.data))
    .catch(error => {
      logger.error('API proxy error:', error);
      res.status(error.response?.status || 500).json(error.response?.data || { error: 'Proxy error' });
    });
});

// Serve the dashboard for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/dashboard/index.html'));
});

// WebSocket connection handling (proxy events from main server)
io.on('connection', (socket) => {
  logger.info('Dashboard client connected:', socket.id);
  
  socket.on('disconnect', () => {
    logger.info('Dashboard client disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.DASHBOARD_PORT || 8080;
httpServer.listen(PORT, () => {
  logger.info(`Dashboard server running on port ${PORT}`);
  logger.info(`Dashboard available at http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
});

module.exports = { app, httpServer, io };
