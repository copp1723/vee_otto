#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { Auth2FAService } from './core/services/Auth2FAService';
import { vAutoSelectors } from './platforms/vauto/vautoSelectors';

dotenv.config();

async function test2FAFlow() {
  console.log('🔧 Testing 2FA Flow...');
  
  const auth2FAService = new Auth2FAService({
    webhookUrl: 'https://vee-otto-api.onrender.com/api/2fa/latest',
    timeout: 30000, // 30 seconds for testing
    codeInputSelector: vAutoSelectors.login.otpInput,
    submitSelector: vAutoSelectors.login.otpSubmit,
    phoneSelectButton: vAutoSelectors.login.phoneSelectButton,
    twoFactorTitle: vAutoSelectors.login.twoFactorTitle
  });
  
  // Test just the code retrieval part
  console.log('📱 Testing code retrieval...');
  
  try {
    // Use reflection to access private method for testing
    const retrieveSMSCode = (auth2FAService as any).retrieveSMSCode.bind(auth2FAService);
    const code = await retrieveSMSCode();
    
    if (code) {
      console.log(`✅ Successfully retrieved code: ${code}`);
    } else {
      console.log('❌ No code retrieved');
    }
  } catch (error) {
    console.error('❌ Code retrieval failed:', error);
  }
}

test2FAFlow();