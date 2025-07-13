#!/usr/bin/env node

const twilio = require('twilio');

async function checkTwilioLogs() {
  console.log('📋 Checking Twilio message logs...\n');
  
  require('dotenv').config();
  
  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    console.log('Fetching recent SMS messages...');
    
    // Get messages from the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const messages = await client.messages.list({
      to: process.env.TWILIO_PHONE_NUMBER,
      dateSentAfter: oneHourAgo,
      limit: 20
    });
    
    console.log(`Found ${messages.length} SMS messages in the last hour:\n`);
    
    if (messages.length === 0) {
      console.log('❌ No SMS messages received by Twilio in the last hour');
      console.log('\nThis means either:');
      console.log('1. VAuto hasn\'t sent any verification codes yet');
      console.log('2. VAuto is using a different SMS service (not Twilio)');
      console.log('3. VAuto is sending to a different phone number');
      console.log('\n💡 Try requesting a new verification code from VAuto');
    } else {
      messages.forEach((message, index) => {
        console.log(`Message ${index + 1}:`);
        console.log(`  From: ${message.from}`);
        console.log(`  To: ${message.to}`);
        console.log(`  Body: ${message.body}`);
        console.log(`  Status: ${message.status}`);
        console.log(`  Date: ${message.dateSent}`);
        console.log(`  SID: ${message.sid}`);
        console.log('');
      });
    }
    
    // Also check outbound messages (messages we sent)
    const outboundMessages = await client.messages.list({
      from: process.env.TWILIO_PHONE_NUMBER,
      dateSentAfter: oneHourAgo,
      limit: 10
    });
    
    if (outboundMessages.length > 0) {
      console.log(`\nOutbound messages (sent from your Twilio number): ${outboundMessages.length}`);
      outboundMessages.forEach((message, index) => {
        console.log(`  ${index + 1}. To: ${message.to}, Body: ${message.body}, Status: ${message.status}`);
      });
    }
    
  } catch (error) {
    console.log('❌ Failed to check Twilio logs:', error.message);
  }
}

checkTwilioLogs().catch(console.error);