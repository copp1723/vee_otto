#!/usr/bin/env node

/**
 * Simple 2FA Code Monitor
 * Polls the webhook endpoint to get the latest 2FA code
 */

const WEBHOOK_URL = 'https://vee-otto-api.onrender.com/api/2fa/latest';
const POLL_INTERVAL = 2000; // 2 seconds
const MAX_ATTEMPTS = 150; // 5 minutes total

async function monitor2FA() {
  console.log('🔐 2FA Code Monitor Started');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Waiting for 2FA code from SMS...');
  console.log(`Polling: ${WEBHOOK_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let attempts = 0;
  let lastCode: string | null = null;

  const interval = setInterval(async () => {
    attempts++;
    
    try {
      const response = await fetch(WEBHOOK_URL);
      const data = await response.json();
      
      if (response.status === 200 && data.code) {
        if (data.code !== lastCode) {
          console.clear();
          console.log('\n🎉 2FA CODE RECEIVED!');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`\n   📱 CODE: ${data.code}\n`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('Enter this code in your browser now!');
          console.log(`Received at: ${new Date(data.timestamp).toLocaleTimeString()}`);
          lastCode = data.code;
        }
      } else if (attempts % 10 === 0) {
        // Show progress every 20 seconds
        process.stdout.write(`\rWaiting for SMS... (${attempts * 2}s elapsed)`);
      }
      
    } catch (error) {
      // Silently continue polling
    }
    
    if (attempts >= MAX_ATTEMPTS) {
      clearInterval(interval);
      console.log('\n\n❌ Timeout: No 2FA code received after 5 minutes');
      process.exit(1);
    }
  }, POLL_INTERVAL);

  // Handle cleanup
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n\n👋 Monitor stopped');
    process.exit(0);
  });
}

// Run the monitor
monitor2FA().catch(console.error);