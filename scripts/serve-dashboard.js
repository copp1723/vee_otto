#!/usr/bin/env node
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Check if dist/dashboard exists
const dashboardPath = path.join(__dirname, '../dist/dashboard');
if (!fs.existsSync(dashboardPath)) {
  console.error('Dashboard build not found at:', dashboardPath);
  console.error('Please run: npm run dashboard:build');
  process.exit(1);
}

// Serve static files
app.use(express.static(dashboardPath));

// Serve index.html for all routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(dashboardPath, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Dashboard server running!`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${dashboardPath}`);
  console.log(`\nPress Ctrl+C to stop the server\n`);
});

// Handle errors
app.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.error('Try: lsof -i :8080 to find the process');
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});