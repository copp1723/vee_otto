#!/usr/bin/env node

async function test2FAEndpoint() {
  const webhookUrl = 'https://vee-otto-api.onrender.com/api/2fa/latest';
  
  console.log('🔍 Testing 2FA endpoint...');
  console.log(`URL: ${webhookUrl}`);
  
  try {
    const response = await fetch(webhookUrl);
    const data = await response.json();
    
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    if (response.status === 404 && data.error === 'No 2FA code received yet') {
      console.log('✅ Endpoint is working - waiting for SMS');
    } else {
      console.log('❌ Unexpected response');
    }
  } catch (error) {
    console.error('❌ Endpoint failed:', error);
  }
}

test2FAEndpoint();