#!/usr/bin/env node

const twilio = require('twilio');

async function monitorTwilioLive() {
  console.log('🔍 Starting live Twilio message monitor...\n');
  
  require('dotenv').config();
  
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  
  let lastMessageSid = null;
  
  // Get the current latest message to establish a baseline
  try {
    const messages = await client.messages.list({
      to: process.env.TWILIO_PHONE_NUMBER,
      limit: 1
    });
    
    if (messages.length > 0) {
      lastMessageSid = messages[0].sid;
      console.log(`📍 Baseline set - latest message: ${messages[0].body}`);
      console.log(`📅 Sent at: ${messages[0].dateSent}\n`);
    }
  } catch (error) {
    console.log('❌ Error getting baseline:', error.message);
  }
  
  console.log('⏳ Monitoring for new messages... (Press Ctrl+C to stop)\n');
  
  const checkInterval = setInterval(async () => {
    try {
      const messages = await client.messages.list({
        to: process.env.TWILIO_PHONE_NUMBER,
        limit: 5
      });
      
      // Check if there's a new message
      if (messages.length > 0 && messages[0].sid !== lastMessageSid) {
        const newMessage = messages[0];
        lastMessageSid = newMessage.sid;
        
        console.log('🆕 NEW MESSAGE RECEIVED!');
        console.log(`📨 From: ${newMessage.from}`);
        console.log(`📱 To: ${newMessage.to}`);
        console.log(`💬 Body: ${newMessage.body}`);
        console.log(`📅 Date: ${newMessage.dateSent}`);
        console.log(`🔗 SID: ${newMessage.sid}\n`);
        
        // Extract code if it looks like a verification code
        const codeMatch = newMessage.body.match(/code:\s*(\d{6})/i);
        if (codeMatch) {
          const code = codeMatch[1];
          console.log(`🔐 EXTRACTED CODE: ${code}`);
          console.log(`🚀 Ready to inject with: curl -X POST http://localhost:3000/api/2fa/test -H "Content-Type: application/json" -d '{"code":"${code}"}'\n`);
        }
      }
    } catch (error) {
      console.log(`❌ Error checking messages: ${error.message}`);
    }
  }, 2000); // Check every 2 seconds
  
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping monitor...');
    clearInterval(checkInterval);
    process.exit(0);
  });
}

monitorTwilioLive().catch(console.error);