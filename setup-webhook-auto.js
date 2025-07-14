#!/usr/bin/env node

const twilio = require('twilio');
require('dotenv').config();

async function setupWebhook() {
  const ngrokUrl = 'https://9257d25ed5ca.ngrok-free.app';
  const webhookUrl = `${ngrokUrl}/webhooks/twilio/sms`;
  
  console.log('🔧 Setting up Twilio Webhook for Local Testing...\n');
  console.log(`Using ngrok URL: ${ngrokUrl}`);
  console.log(`Webhook URL: ${webhookUrl}\n`);
  
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // Find the phone number
    console.log('1. Finding your Twilio phone number...');
    const phoneNumbers = await client.incomingPhoneNumbers.list({
      phoneNumber: process.env.TWILIO_PHONE_NUMBER
    });
    
    if (phoneNumbers.length === 0) {
      console.log('❌ Phone number not found:', process.env.TWILIO_PHONE_NUMBER);
      return;
    }
    
    const phoneNumber = phoneNumbers[0];
    console.log('✅ Found phone number:', phoneNumber.phoneNumber);
    console.log('   Current SMS URL:', phoneNumber.smsUrl || 'NOT SET');
    
    // Update the webhook URL
    console.log('\n2. Updating webhook URL for local testing...');
    await client.incomingPhoneNumbers(phoneNumber.sid).update({
      smsUrl: webhookUrl,
      smsMethod: 'POST'
    });
    
    console.log('✅ Webhook URL updated successfully!');
    console.log(`   New SMS URL: ${webhookUrl}`);
    console.log('   Method: POST');
    
    console.log('\n📱 Your local server is now ready to receive SMS!');
    
    // Test the webhook
    console.log('\n3. Testing webhook connection...');
    try {
      const fetch = require('node-fetch');
      const response = await fetch(`${ngrokUrl}/api/2fa/latest`);
      const data = await response.json();
      
      console.log(`✅ Webhook endpoint is accessible! Status: ${response.status}`);
      if (data.code) {
        console.log(`   Found existing code: ${data.code}`);
      } else if (data.error) {
        console.log(`   Response: ${data.error}`);
      }
    } catch (err) {
      console.log('⚠️  Could not reach webhook endpoint:', err.message);
    }
    
    console.log('\n⚠️  IMPORTANT: When done testing, restore the production webhook:');
    console.log('   Run: node update-twilio-webhook.js');
    
  } catch (error) {
    console.error('❌ Error updating webhook:', error.message);
  }
}

setupWebhook().catch(console.error);