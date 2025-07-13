#!/usr/bin/env node

const twilio = require('twilio');

async function sendTestSMS() {
  console.log('📨 Sending test SMS to verify webhook is working...\n');
  
  require('dotenv').config();
  
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    console.log('Sending test SMS from your Twilio number to itself...');
    console.log(`From: ${process.env.TWILIO_PHONE_NUMBER}`);
    console.log(`To: ${process.env.TWILIO_PHONE_NUMBER}`);
    console.log('Message: TEST123');
    
    const message = await client.messages.create({
      body: 'TEST123',
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.TWILIO_PHONE_NUMBER
    });
    
    console.log('✅ Test SMS sent successfully!');
    console.log(`Message SID: ${message.sid}`);
    console.log('\nWaiting 5 seconds for webhook to receive...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if webhook received the message
    const axios = require('axios');
    const response = await axios.get('https://vee-otto-api.onrender.com/api/2fa/latest');
    
    if (response.data.code) {
      console.log('🎉 SUCCESS! Webhook received the code:');
      console.log(`Code: ${response.data.code}`);
      console.log(`Timestamp: ${response.data.timestamp}`);
      console.log('\n✅ Your SMS webhook system is working perfectly!');
      console.log('🔄 Now request a NEW verification code from VAuto');
    } else {
      console.log('❌ Webhook did not receive the SMS');
      console.log('Response:', response.data);
    }
    
  } catch (error) {
    console.log('❌ Failed to send test SMS:', error.message);
    if (error.response) {
      console.log('Response:', error.response.data);
    }
  }
}

sendTestSMS().catch(console.error);