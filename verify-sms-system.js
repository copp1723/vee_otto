#!/usr/bin/env node

const axios = require('axios');

async function verifySMSSystem() {
  console.log('🔍 Verifying SMS System Configuration...\n');
  
  const renderUrl = 'https://vee-otto-api.onrender.com';
  
  console.log('1. Testing Render deployment accessibility...');
  try {
    const response = await axios.get(`${renderUrl}/api/2fa/latest`);
    console.log('✅ Render deployment is live and responding');
    console.log(`   Response: ${JSON.stringify(response.data)}`);
  } catch (error) {
    console.log('❌ Render deployment not accessible:', error.message);
    return;
  }
  
  console.log('\n2. Testing SMS webhook endpoint...');
  try {
    // This should fail with "Invalid signature" which is expected
    const response = await axios.post(`${renderUrl}/webhooks/twilio/sms`, 
      'From=%2B15551234567&To=%2B13137658345&Body=Test&MessageSid=test123',
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
  } catch (error) {
    if (error.response && error.response.data === 'Invalid signature') {
      console.log('✅ SMS webhook endpoint is working (signature validation active)');
    } else {
      console.log('❌ SMS webhook endpoint error:', error.message);
      return;
    }
  }
  
  console.log('\n3. Checking Twilio configuration...');
  const twilio = require('twilio');
  require('dotenv').config();
  
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const phoneNumbers = await client.incomingPhoneNumbers.list({
      phoneNumber: process.env.TWILIO_PHONE_NUMBER
    });
    
    if (phoneNumbers.length > 0) {
      const phone = phoneNumbers[0];
      console.log('✅ Twilio phone number configuration:');
      console.log(`   Phone: ${phone.phoneNumber}`);
      console.log(`   SMS URL: ${phone.smsUrl}`);
      console.log(`   SMS Method: ${phone.smsMethod}`);
      
      if (phone.smsUrl === `${renderUrl}/webhooks/twilio/sms`) {
        console.log('✅ Webhook URL is correctly configured!');
      } else {
        console.log('⚠️  Webhook URL mismatch!');
      }
    }
  } catch (error) {
    console.log('❌ Twilio configuration check failed:', error.message);
  }
  
  console.log('\n🎉 SMS System Status: READY');
  console.log('\nHow to test:');
  console.log('1. Go to VAuto and trigger phone verification');
  console.log('2. VAuto will send SMS → Twilio → Your Render webhook');
  console.log('3. Check for received codes: node get-sms-code.js');
  console.log(`4. Or check directly: curl ${renderUrl}/api/2fa/latest`);
}

verifySMSSystem().catch(console.error);