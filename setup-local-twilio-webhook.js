#!/usr/bin/env node

const twilio = require('twilio');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function setupLocalWebhook() {
  console.log('🔧 Setting up Twilio Webhook for Local Testing...\n');
  
  // Load environment variables
  require('dotenv').config();
  
  // Check environment variables
  const requiredVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.log('❌ Missing environment variables:', missing);
    process.exit(1);
  }
  
  console.log('For local testing, you need to expose your local server to the internet.');
  console.log('Options:');
  console.log('1. Use ngrok (recommended): ngrok http 3000');
  console.log('2. Use localtunnel: lt --port 3000');
  console.log('3. Manual entry of public URL\n');
  
  rl.question('Enter your public URL (e.g., https://abc123.ngrok.io): ', async (publicUrl) => {
    if (!publicUrl.startsWith('http')) {
      console.log('❌ URL must start with http:// or https://');
      rl.close();
      return;
    }
    
    const webhookUrl = `${publicUrl}/webhooks/twilio/sms`;
    
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      
      // Find the phone number
      console.log('\n1. Finding your Twilio phone number...');
      const phoneNumbers = await client.incomingPhoneNumbers.list({
        phoneNumber: process.env.TWILIO_PHONE_NUMBER
      });
      
      if (phoneNumbers.length === 0) {
        console.log('❌ Phone number not found:', process.env.TWILIO_PHONE_NUMBER);
        rl.close();
        return;
      }
      
      const phoneNumber = phoneNumbers[0];
      console.log('✅ Found phone number:', phoneNumber.phoneNumber);
      console.log('   Current SMS URL:', phoneNumber.smsUrl || 'NOT SET');
      
      // Store the current URL for restoration later
      const originalUrl = phoneNumber.smsUrl;
      
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
      console.log('\n⚠️  IMPORTANT: When done testing, restore the original webhook:');
      console.log(`   Original URL: ${originalUrl || 'https://vee-otto-api.onrender.com/webhooks/twilio/sms'}`);
      console.log('\n   Run: node update-twilio-webhook.js');
      
      // Test the webhook
      console.log('\n3. Testing webhook connection...');
      try {
        const response = await fetch(`${publicUrl}/api/2fa/latest`);
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Webhook endpoint is accessible!');
          if (data.code) {
            console.log(`   Found existing code: ${data.code}`);
          }
        } else {
          console.log('⚠️  Webhook endpoint returned:', response.status);
        }
      } catch (err) {
        console.log('⚠️  Could not reach webhook endpoint:', err.message);
      }
      
    } catch (error) {
      console.error('❌ Error updating webhook:', error.message);
    }
    
    rl.close();
  });
}

setupLocalWebhook().catch(console.error);