#!/usr/bin/env node

const axios = require('axios');

async function monitorDeployment() {
  console.log('🚀 Monitoring Render deployment...\n');
  
  const renderUrl = 'https://vee-otto-api.onrender.com';
  const maxAttempts = 20;
  const interval = 15000; // 15 seconds
  
  console.log('Waiting for Render to deploy your SMS webhook...');
  console.log('This typically takes 2-3 minutes.\n');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxAttempts}: Testing ${renderUrl}/api/2fa/latest`);
      
      const response = await axios.get(`${renderUrl}/api/2fa/latest`);
      
      if (response.status === 404 && response.data.error === 'No 2FA code received yet') {
        console.log('✅ SMS webhook system is now live!');
        console.log('🎉 Deployment successful!\n');
        
        // Test the webhook endpoint
        console.log('Testing SMS webhook endpoint...');
        try {
          await axios.post(`${renderUrl}/webhooks/twilio/sms`, 
            'From=%2B15551234567&To=%2B13137658345&Body=Test&MessageSid=test123',
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
          );
        } catch (webhookError) {
          if (webhookError.response && webhookError.response.data === 'Invalid signature') {
            console.log('✅ SMS webhook endpoint is working correctly\n');
            
            console.log('🔧 System Status: READY FOR TESTING');
            console.log('\nNext steps:');
            console.log('1. Go to VAuto and trigger phone verification');
            console.log('2. Check for SMS codes: node get-sms-code.js');
            console.log(`3. Or check directly: curl ${renderUrl}/api/2fa/latest`);
            console.log('\nTwilio webhook is configured to send to:');
            console.log(`   ${renderUrl}/webhooks/twilio/sms`);
            return;
          }
        }
        return;
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`   ⏳ Still deploying... (${error.response.status})`);
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.log('   ⏳ Still deploying... (service unavailable)');
      } else {
        console.log(`   ⏳ Still deploying... (${error.message})`);
      }
    }
    
    if (attempt < maxAttempts) {
      console.log(`   Waiting ${interval/1000} seconds before next check...\n`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  console.log('⚠️  Deployment taking longer than expected.');
  console.log('Check Render dashboard for deployment status.');
  console.log('The SMS webhook should be available shortly.');
}

monitorDeployment().catch(console.error);