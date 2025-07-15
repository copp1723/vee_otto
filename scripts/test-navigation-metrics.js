#!/usr/bin/env node

/**
 * Test Navigation Metrics API
 * 
 * This script tests the navigation metrics endpoint to ensure it's working properly
 */

const http = require('http');

// Test the metrics endpoint
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/metrics/navigation',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
    
    if (res.statusCode === 200) {
      try {
        const metrics = JSON.parse(data);
        console.log('\n✅ Navigation Metrics API is working!');
        console.log('Success Rate:', metrics.data?.report?.successRate || 0, '%');
        console.log('Total Attempts:', metrics.data?.report?.totalAttempts || 0);
      } catch (e) {
        console.error('Failed to parse JSON response');
      }
    } else {
      console.error('❌ API returned error status');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error calling API:', error.message);
  console.log('Make sure the server is running on port 3000');
});

req.end();
