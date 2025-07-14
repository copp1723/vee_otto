#!/usr/bin/env node

const twilio = require('twilio');

async function updateTwilioWebhookLocal() {
  console.log('🔧 Configuring Twilio webhook for local testing...\n');
  
  // Load environment variables
  require('dotenv').config();
  
  const localUrl = 'http://localhost:3000';
  const webhookUrl = `${localUrl}/webhooks/twilio/sms`;
  
  // Check environment variables
  const requiredVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.log('❌ Missing environment variables:', missing);
    process.exit(1);
  }
  
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // Find the phone number
    console.log('1. Finding your Twilio phone number...');
    const phoneNumbers = await client.incomingPhoneNumbers.list({
      phoneNumber: process.env.TWILIO_PHONE_NUMBER
    });
    
    if (phoneNumbers.length === 0) {
      console.log('❌ Phone number not found:', process.env.TWILIO_PHONE_NUMBER);
      process.exit(1);
    }
    
    const phoneNumber = phoneNumbers[0];
    console.log('✅ Found phone number:', phoneNumber.phoneNumber);
    console.log('   Current SMS URL:', phoneNumber.smsUrl || 'NOT SET');
    
    // Update the webhook URL for local testing
    console.log('\n2. Updating webhook URL for local testing...');
    await client.incomingPhoneNumbers(phoneNumber.sid).update({
      smsUrl: webhookUrl,
      smsMethod: 'POST'
    });
    
    console.log('✅ Webhook URL updated for local testing!');
    console.log(`   New SMS URL: ${webhookUrl}`);
    console.log('   Method: POST');
    
    // Test the local endpoint
    console.log('\n3. Testing local endpoint...');
    try {
      const fetch = require('node-fetch');
      const response = await fetch(`${localUrl}/health`);
      
      if (response.ok) {
        console.log('✅ Local server is accessible!');
      } else {
        console.log('⚠️  Local server returned:', response.status);
      }
    } catch (err) {
      console.log('⚠️  Could not reach local server:', err.message);
    }
    
    console.log('\n🎉 Twilio webhook is now configured for local testing!');
    console.log('\n⚠️  REMEMBER: After testing, restore production webhook with:');
    console.log('   node update-twilio-webhook.js');
    
  } catch (error) {
    console.log('❌ Failed to update webhook:', error.message);
    if (error.code) {
      console.log('   Error code:', error.code);
    }
    process.exit(1);
  }
}

updateTwilioWebhookLocal().catch(console.error);