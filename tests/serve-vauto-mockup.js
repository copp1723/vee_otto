const express = require('express');
const path = require('path');
const app = express();
const PORT = 3001;

// Serve static files from the vauto-mockup directory
app.use(express.static(path.join(__dirname, 'fixtures/vauto-mockup')));

// Serve the main mockup page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'fixtures/vauto-mockup/index.html'));
});

// Handle dashboard iframe request
app.get('/test-mockup/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'fixtures/vauto-mockup/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`vAuto Mockup Server running at http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  process.exit(0);
}); 