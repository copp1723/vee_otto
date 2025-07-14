#!/usr/bin/env node

/**
 * Helper script to inject a test 2FA code into the local server
 * Use this for testing the 2FA flow without needing actual SMS
 */

const fetch = require('node-fetch');

async function injectCode(code) {
  const serverUrl = process.env.PUBLIC_URL || 'http://localhost:3000';
  const testEndpoint = `${serverUrl}/api/2fa/test`;
  
  try {
    console.log(`Injecting test code: ${code}`);
    const response = await fetch(testEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Code injected successfully:', data);
    } else {
      console.error('❌ Failed to inject code:', response.status, await response.text());
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Get code from command line or use default
const code = process.argv[2] || '123456';

if (!/^\d{6}$/.test(code)) {
  console.error('❌ Code must be exactly 6 digits');
  process.exit(1);
}

injectCode(code);