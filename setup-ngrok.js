#!/usr/bin/env node

console.log('🚀 Setting up ngrok for SMS webhooks...\n');

console.log('Step 1: Sign up for ngrok (free)');
console.log('   Go to: https://dashboard.ngrok.com/signup\n');

console.log('Step 2: Get your auth token');
console.log('   Go to: https://dashboard.ngrok.com/get-started/your-authtoken\n');

console.log('Step 3: Install auth token');
console.log('   Run: ngrok config add-authtoken YOUR_TOKEN_HERE\n');

console.log('Step 4: Expose your local server');
console.log('   Run: ngrok http 3000\n');

console.log('Step 5: Update Twilio webhook');
console.log('   Copy the HTTPS URL from ngrok');
console.log('   Go to Twilio Console → Phone Numbers → +13137658345');
console.log('   Update SMS Webhook URL to: https://your-ngrok-url.ngrok.io/webhooks/twilio/sms');

console.log('\n⚡ FASTER SOLUTION:');
console.log('   Since your webhook is already pointing to https://veeotto.ai/webhooks/twilio/sms');
console.log('   Can you access that server? Is it running your webhook handler?');