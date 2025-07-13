#!/usr/bin/env node

const axios = require('axios');
const twilio = require('twilio');

async function debugSMSSystem() {
  console.log('🔍 Debugging SMS Webhook System...\n');
  
  const baseUrl = 'http://localhost:3000';
  
  // Test 1: Check if our server is running
  console.log('1. Testing local server...');
  try {
    const healthResponse = await axios.post(`${baseUrl}/webhooks/twilio/health`);
    console.log('✅ Server is running:', healthResponse.data);
  } catch (error) {
    console.log('❌ Server not responding:', error.message);
    console.log('   Make sure: npm run server:dev is running');
    return;
  }
  
  // Test 2: Check environment variables
  console.log('\n2. Checking environment variables...');
  const requiredVars = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN', 
    'TWILIO_PHONE_NUMBER'
  ];
  
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.log('❌ Missing environment variables:', missing);
    return;
  }
  console.log('✅ All Twilio environment variables present');
  
  // Test 3: Check Twilio connection
  console.log('\n3. Testing Twilio connection...');
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    console.log('✅ Twilio connection successful');
    console.log(`   Account: ${account.friendlyName}`);
    console.log(`   Status: ${account.status}`);
  } catch (error) {
    console.log('❌ Twilio connection failed:', error.message);
    console.log('   Check your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
    return;
  }
  
  // Test 4: Check phone number configuration
  console.log('\n4. Checking phone number configuration...');
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const phoneNumber = await client.incomingPhoneNumbers.list({
      phoneNumber: process.env.TWILIO_PHONE_NUMBER
    });
    
    if (phoneNumber.length > 0) {
      const phone = phoneNumber[0];
      console.log('✅ Phone number found:', phone.phoneNumber);
      console.log(`   SMS URL: ${phone.smsUrl || 'NOT SET'}`);
      console.log(`   SMS Method: ${phone.smsMethod || 'NOT SET'}`);
      
      if (!phone.smsUrl) {
        console.log('⚠️  SMS webhook URL is not configured in Twilio!');
        console.log('   You need to set this in Twilio Console:');
        console.log(`   SMS URL: ${baseUrl}/webhooks/twilio/sms`);
        console.log('   Method: POST');
      } else if (!phone.smsUrl.includes('/webhooks/twilio/sms')) {
        console.log('⚠️  SMS webhook URL is wrong in Twilio:');
        console.log(`   Current: ${phone.smsUrl}`);
        console.log(`   Should be: ${baseUrl}/webhooks/twilio/sms`);
      }
    } else {
      console.log('❌ Phone number not found in your Twilio account');
      console.log(`   Looking for: ${process.env.TWILIO_PHONE_NUMBER}`);
    }
  } catch (error) {
    console.log('❌ Failed to check phone configuration:', error.message);
  }
  
  // Test 5: Public accessibility issue
  console.log('\n5. Checking public accessibility...');
  console.log('⚠️  MAJOR ISSUE: Your webhook URL is localhost:3000');
  console.log('   Twilio cannot reach localhost from the internet!');
  console.log('\n   Solutions:');
  console.log('   A) Use ngrok: npm install -g ngrok && ngrok http 3000');
  console.log('   B) Deploy to a public server');
  console.log('   C) Use Twilio Studio for testing');
  
  console.log('\n6. Quick Test Solution:');
  console.log('   Run this in another terminal:');
  console.log('   ngrok http 3000');
  console.log('   Then update your Twilio webhook URL to the ngrok HTTPS URL');
}

// Load environment
require('dotenv').config();
debugSMSSystem().catch(console.error);