#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { chromium } from 'playwright';
import { Auth2FAService } from './core/services/Auth2FAService';
import { vAutoSelectors } from './platforms/vauto/vautoSelectors';

dotenv.config();

async function quickTest() {
  console.log('🔧 Quick 2FA Integration Test');
  
  if (!process.env.VAUTO_USERNAME || !process.env.VAUTO_PASSWORD) {
    console.error('❌ Missing VAUTO credentials');
    process.exit(1);
  }
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Test basic login
    console.log('🔐 Testing basic login...');
    await page.goto(vAutoSelectors.login.url);
    await page.fill(vAutoSelectors.login.username, process.env.VAUTO_USERNAME);
    await page.click(vAutoSelectors.login.nextButton);
    await page.fill(vAutoSelectors.login.password, process.env.VAUTO_PASSWORD);
    await page.click(vAutoSelectors.login.submit);
    
    await page.waitForLoadState('networkidle');
    console.log('✅ Basic login completed');
    
    // Check if 2FA is required
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    if (currentUrl.includes('signin') || currentUrl.includes('2fa') || currentUrl.includes('verify')) {
      console.log('🔐 2FA required, testing service...');
      
      const auth2FAService = new Auth2FAService({
        webhookUrl: 'http://localhost:3000/api/2fa/latest',
        timeout: 60000,
        codeInputSelector: vAutoSelectors.login.otpInput,
        submitSelector: vAutoSelectors.login.otpSubmit,
        phoneSelectButton: vAutoSelectors.login.phoneSelectButton,
        twoFactorTitle: vAutoSelectors.login.twoFactorTitle
      });
      
      console.log('📱 Please send SMS code now...');
      const result = await auth2FAService.authenticate(page);
      
      if (result.success) {
        console.log('✅ 2FA authentication successful!');
      } else {
        console.log('❌ 2FA authentication failed:', result.error);
      }
    } else {
      console.log('✅ No 2FA required - login successful');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

quickTest();