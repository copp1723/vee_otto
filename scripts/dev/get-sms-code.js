#!/usr/bin/env node

const axios = require('axios');

async function getSMSCode() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('📱 Checking for SMS verification code...\n');
  
  try {
    const response = await axios.get(`${baseUrl}/api/2fa/latest`);
    
    if (response.data && response.data.code) {
      console.log('✅ SMS Code Received!');
      console.log(`📋 Code: ${response.data.code}`);
      console.log(`⏰ Received: ${response.data.timestamp}`);
      console.log('\n🎯 Copy this code and paste it into VAuto verification field');
    }
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('⏳ No SMS code received yet...');
      console.log('💡 Make sure you\'ve requested the code in VAuto first');
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

// Check if user wants to watch for codes
const args = process.argv.slice(2);
if (args.includes('--watch') || args.includes('-w')) {
  console.log('👀 Watching for SMS codes (press Ctrl+C to stop)...\n');
  
  const poll = () => {
    getSMSCode().then(() => {
      setTimeout(poll, 3000); // Check every 3 seconds
    }).catch(() => {
      setTimeout(poll, 3000);
    });
  };
  
  poll();
} else {
  getSMSCode();
}