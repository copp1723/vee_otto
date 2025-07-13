#!/usr/bin/env node

// Test SMS webhook system
const axios = require('axios');

async function testSMSWebhook() {
  const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
  
  console.log('🧪 Testing SMS Webhook System...\n');
  
  // Test 1: Health check
  try {
    const healthResponse = await axios.post(`${baseUrl}/webhooks/twilio/health`);
    console.log('✅ Health Check:', healthResponse.data);
  } catch (error) {
    console.log('❌ Health Check Failed:', error.message);
    return;
  }
  
  // Test 2: Check if server is receiving codes
  try {
    const codeResponse = await axios.get(`${baseUrl}/api/2fa/latest`);
    console.log('✅ Latest Code API:', codeResponse.data);
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('ℹ️  No SMS codes received yet (this is normal)');
    } else {
      console.log('❌ Code API Failed:', error.message);
    }
  }
  
  console.log('\n📱 Send a test SMS to your Twilio number to verify the webhook is working');
  console.log('Then check GET /api/2fa/latest to see if it appears');
}

testSMSWebhook().catch(console.error);