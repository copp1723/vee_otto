#!/usr/bin/env node

/**
 * Auto-inject 2FA codes for testing
 * This script monitors Twilio for incoming SMS and injects them into the local server
 */

const twilio = require('twilio');
const fetch = require('node-fetch');
require('dotenv').config();

const CHECK_INTERVAL = 3000; // Check every 3 seconds
const CODE_REGEX = /\b(\d{6})\b/;

let lastCheckedTime = new Date();
let isRunning = true;

async function injectCode(code) {
  const serverUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
  const testEndpoint = `${serverUrl}/api/2fa/test`;
  
  try {
    const response = await fetch(testEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Code ${code} injected successfully at ${data.timestamp}`);
      return true;
    }
  } catch (error) {
    console.error('❌ Failed to inject code:', error.message);
  }
  return false;
}

async function checkForNewSMS() {
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // Get messages received after last check
    const messages = await client.messages.list({
      to: process.env.TWILIO_PHONE_NUMBER,
      dateSentAfter: lastCheckedTime,
      limit: 10
    });
    
    for (const message of messages) {
      const match = message.body.match(CODE_REGEX);
      if (match) {
        const code = match[1];
        console.log(`\n📱 New SMS received from ${message.from}`);
        console.log(`   Body: ${message.body}`);
        console.log(`   Extracted code: ${code}`);
        
        // Inject the code into local server
        const injected = await injectCode(code);
        if (injected) {
          console.log(`   ✅ Code injected into local server`);
        }
      }
    }
    
    // Update last checked time
    if (messages.length > 0) {
      lastCheckedTime = new Date(messages[0].dateCreated);
    }
  } catch (error) {
    console.error('Error checking SMS:', error.message);
  }
}

async function monitor() {
  console.log('🔍 Auto-inject 2FA Monitor Started');
  console.log('This script will automatically inject SMS codes into your local server');
  console.log(`Monitoring phone: ${process.env.TWILIO_PHONE_NUMBER}`);
  console.log(`Server URL: ${process.env.PUBLIC_URL || 'http://localhost:3000'}`);
  console.log('\nPress Ctrl+C to stop\n');
  
  // Initial check for recent messages
  lastCheckedTime = new Date(Date.now() - 60000); // Check last minute
  await checkForNewSMS();
  
  // Set up interval
  const interval = setInterval(async () => {
    if (isRunning) {
      await checkForNewSMS();
    }
  }, CHECK_INTERVAL);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nStopping monitor...');
    isRunning = false;
    clearInterval(interval);
    process.exit(0);
  });
}

// Check if required environment variables are set
const requiredVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];
const missing = requiredVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error('❌ Missing environment variables:', missing);
  process.exit(1);
}

// Start monitoring
monitor().catch(console.error);