#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { startServer } from './src/server';

dotenv.config();

async function test2FASystem() {
  console.log('🔧 Testing 2FA System...');
  
  // Check environment variables
  const requiredVars = ['TWILIO_AUTH_TOKEN', 'VAUTO_USERNAME', 'VAUTO_PASSWORD'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing);
    process.exit(1);
  }
  
  console.log('✅ Environment variables configured');
  
  try {
    // Start the server
    console.log('🚀 Starting webhook server...');
    await startServer(3000);
    
    console.log('✅ Server started successfully');
    console.log('📡 2FA webhook endpoint: http://localhost:3000/webhooks/twilio/sms');
    console.log('🔍 2FA code retrieval: http://localhost:3000/api/2fa/latest');
    
    console.log('\n🧪 Test Instructions:');
    console.log('1. Configure your Twilio webhook URL to: http://localhost:3000/webhooks/twilio/sms');
    console.log('2. Send a test SMS with a 6-digit code');
    console.log('3. Check http://localhost:3000/api/2fa/latest to retrieve the code');
    console.log('\nPress Ctrl+C to stop the server');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

test2FASystem();