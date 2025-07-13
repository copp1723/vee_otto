#!/usr/bin/env node

const twilio = require('twilio');

async function updateTwilioWebhook() {
  console.log('🔧 Updating Twilio Webhook URL...\n');
  
  // Load environment variables
  require('dotenv').config();
  
  const renderUrl = 'https://vee-otto-api.onrender.com';
  const webhookUrl = `${renderUrl}/webhooks/twilio/sms`;
  
  // Check environment variables
  const requiredVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.log('❌ Missing environment variables:', missing);
    return;
  }
  
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // First, get the current phone number configuration
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
    console.log('\n2. Updating webhook URL...');
    await client.incomingPhoneNumbers(phoneNumber.sid).update({
      smsUrl: webhookUrl,
      smsMethod: 'POST'
    });
    
    console.log('✅ Webhook URL updated successfully!');
    console.log(`   New SMS URL: ${webhookUrl}`);
    console.log('   Method: POST');
    
    // Verify the update
    console.log('\n3. Verifying update...');
    const updatedPhone = await client.incomingPhoneNumbers(phoneNumber.sid).fetch();
    console.log('✅ Verification successful:');
    console.log(`   SMS URL: ${updatedPhone.smsUrl}`);
    console.log(`   SMS Method: ${updatedPhone.smsMethod}`);
    
    console.log('\n🎉 Twilio webhook is now configured for your Render deployment!');
    console.log('\nNext steps:');
    console.log('1. Make sure your Render deployment is live and accessible');
    console.log('2. Test VAuto phone verification');
    console.log('3. Check for SMS codes using: node get-sms-code.js');
    
  } catch (error) {
    console.log('❌ Failed to update webhook:', error.message);
    if (error.code) {
      console.log('   Error code:', error.code);
    }
  }
}

updateTwilioWebhook().catch(console.error);