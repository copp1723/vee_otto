#!/usr/bin/env ts-node

import { Auth2FAService, Auth2FAConfig } from './core/services/Auth2FAService';

/**
 * Simple 2FA Code Monitor
 * Watches for incoming 2FA codes and displays them
 */
async function watch2FACode() {
  console.log('🔐 Starting 2FA Code Monitor...');
  console.log('Watching for incoming 2FA codes...');
  
  const config: Auth2FAConfig = {
    webhookUrl: process.env.WEBHOOK_URL || 'https://vee-otto-api.onrender.com/api/2fa/latest',
    timeout: 300000, // 5 minutes
    codeInputSelector: '',
    submitSelector: '',
    phoneSelectButton: '',
    twoFactorTitle: ''
  };
  
  const auth2FAService = new Auth2FAService(config);
  
  try {
    console.log('📱 Polling for 2FA code...');
    const code = await auth2FAService.getLatest2FACode();
    
    if (code) {
      console.log('✅ 2FA CODE RECEIVED:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🔢 CODE: ${code}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Enter this code in your browser now!');
    } else {
      console.log('❌ No 2FA code received within timeout period');
    }
  } catch (error) {
    console.error('❌ Error watching for 2FA code:', error);
  }
}

// Run if called directly
if (require.main === module) {
  watch2FACode().catch(console.error);
}

export { watch2FACode };