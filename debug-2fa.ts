#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { chromium } from 'playwright';
import { vAutoSelectors } from './platforms/vauto/vautoSelectors';

dotenv.config();

async function debug2FA() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Login first
    await page.goto(vAutoSelectors.login.url);
    await page.fill(vAutoSelectors.login.username, process.env.VAUTO_USERNAME!);
    await page.click(vAutoSelectors.login.nextButton);
    await page.fill(vAutoSelectors.login.password, process.env.VAUTO_PASSWORD!);
    await page.click(vAutoSelectors.login.submit);
    await page.waitForLoadState('networkidle');
    
    console.log('Current URL:', page.url());
    
    // Check if we're on 2FA page
    if (page.url().includes('signin') || page.url().includes('verify')) {
      console.log('🔐 On 2FA page');
      
      // Take screenshot
      await page.screenshot({ path: 'debug-2fa-page.png' });
      
      // Find all input fields
      const inputs = await page.$$('input');
      console.log(`Found ${inputs.length} input fields:`);
      
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const type = await input.getAttribute('type');
        const name = await input.getAttribute('name');
        const id = await input.getAttribute('id');
        const placeholder = await input.getAttribute('placeholder');
        console.log(`  Input ${i}: type="${type}" name="${name}" id="${id}" placeholder="${placeholder}"`);
      }
      
      // Find all buttons
      const buttons = await page.$$('button');
      console.log(`Found ${buttons.length} buttons:`);
      
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        const text = await button.textContent();
        const type = await button.getAttribute('type');
        console.log(`  Button ${i}: text="${text}" type="${type}"`);
      }
      
      // Get 2FA code
      console.log('Fetching 2FA code...');
      const response = await fetch('https://vee-otto-api.onrender.com/api/2fa/latest');
      const data = await response.json();
      
      if (data.code) {
        console.log(`Got code: ${data.code}`);
        
        // Try to enter it
        const codeInput = inputs.find(async (input) => {
          const type = await input.getAttribute('type');
          return type === 'text' || type === 'number' || type === 'tel';
        });
        
        if (codeInput) {
          await codeInput.fill(data.code);
          console.log('Code entered');
          
          // Try to submit
          const submitBtn = buttons.find(async (btn) => {
            const text = await btn.textContent();
            const type = await btn.getAttribute('type');
            return type === 'submit' || text?.includes('Verify') || text?.includes('Submit');
          });
          
          if (submitBtn) {
            await submitBtn.click();
            console.log('Submit clicked');
          } else {
            console.log('No submit button found, pressing Enter');
            await codeInput.press('Enter');
          }
        }
      }
    }
    
    await page.waitForTimeout(10000); // Wait to see result
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debug2FA();