#!/usr/bin/env node

import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import { Logger } from '../core/utils/Logger';

// Load MVP environment
dotenv.config({ path: '.env.mvp' });

const logger = new Logger('Test-Login');

async function testLogin() {
  const username = process.env.VAUTO_USERNAME || '';
  const password = process.env.VAUTO_PASSWORD || '';
  
  logger.info(`🧪 Testing VAuto Login`);
  logger.info(`Username: ${username}`);
  logger.info(`Password: ${password.substring(0, 3)}...`);
  
  if (!username || !password) {
    logger.error('Missing credentials');
    return;
  }
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000
  });
  
  try {
    const page = await browser.newPage();
    
    // Try login.vauto.com first
    logger.info('📋 Attempting login at login.vauto.com...');
    await page.goto('https://login.vauto.com/');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/login-page.png' });
    
    // Check what fields are available
    const fields = {
      username1: await page.locator('input[name="username"]').count(),
      username2: await page.locator('input[type="email"]').count(),
      username3: await page.locator('#username').count(),
      password1: await page.locator('input[name="password"]').count(),
      password2: await page.locator('input[type="password"]').count(),
      password3: await page.locator('#password').count(),
      submit1: await page.locator('button[type="submit"]').count(),
      submit2: await page.locator('input[type="submit"]').count()
    };
    
    logger.info('Field counts:', fields);
    
    // If no fields found, try Cox signin
    if (Object.values(fields).every(count => count === 0)) {
      logger.info('📋 No fields at login.vauto.com, trying signin.coxautoinc.com...');
      await page.goto('https://signin.coxautoinc.com');
      await page.waitForLoadState('networkidle');
      
      // Recheck fields
      fields.username1 = await page.locator('input[name="username"]').count();
      fields.username2 = await page.locator('input[type="email"]').count();
      fields.username3 = await page.locator('#username').count();
      fields.password1 = await page.locator('input[name="password"]').count();
      fields.password2 = await page.locator('input[type="password"]').count();
      fields.password3 = await page.locator('#password').count();
      
      logger.info('Cox signin field counts:', fields);
    }
    
    // Try to fill username
    const usernameSelectors = [
      'input[name="username"]',
      'input[type="email"]',
      '#username',
      'input[placeholder*="username" i]',
      'input[placeholder*="email" i]'
    ];
    
    let usernameFilled = false;
    for (const selector of usernameSelectors) {
      try {
        const field = page.locator(selector).first();
        if (await field.isVisible({ timeout: 1000 })) {
          await field.fill(username);
          logger.info(`✅ Username filled using: ${selector}`);
          usernameFilled = true;
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (!usernameFilled) {
      logger.error('❌ Could not find username field');
      return;
    }
    
    // Try to fill password
    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      '#password'
    ];
    
    let passwordFilled = false;
    for (const selector of passwordSelectors) {
      try {
        const field = page.locator(selector).first();
        if (await field.isVisible({ timeout: 1000 })) {
          await field.fill(password);
          logger.info(`✅ Password filled using: ${selector}`);
          passwordFilled = true;
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    if (!passwordFilled) {
      logger.error('❌ Could not find password field');
      return;
    }
    
    // Take screenshot before submit
    await page.screenshot({ path: 'screenshots/login-filled.png' });
    
    logger.info('✅ Credentials entered');
    logger.info('⏸️ Check the browser and press Enter to submit...');
    await new Promise(resolve => process.stdin.once('data', resolve));
    
    // Submit
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Sign In")',
      'button:has-text("Log In")',
      'button:has-text("Login")'
    ];
    
    for (const selector of submitSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 1000 })) {
          await button.click();
          logger.info(`✅ Submitted using: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue
      }
    }
    
    // Wait for navigation
    await page.waitForTimeout(5000);
    
    // Check for 2FA
    const has2FA = await page.locator('input[name*="code"], input[placeholder*="code" i]').isVisible({ timeout: 5000 }).catch(() => false);
    
    if (has2FA) {
      logger.info('🔐 2FA required');
      logger.info('Enter 2FA code in the browser or via terminal:');
      process.stdout.write('2FA Code: ');
      
      const code = await new Promise<string>(resolve => {
        process.stdin.once('data', data => resolve(data.toString().trim()));
      });
      
      await page.fill('input[name*="code"], input[placeholder*="code" i]', code);
      await page.click('button[type="submit"], button:has-text("Verify"), button:has-text("Submit")');
    }
    
    // Wait and check final URL
    await page.waitForTimeout(5000);
    const finalUrl = page.url();
    logger.info(`📍 Final URL: ${finalUrl}`);
    
    if (finalUrl.includes('vauto') || finalUrl.includes('dashboard')) {
      logger.info('✅ Login successful!');
    } else {
      logger.warn('⚠️ Login may have failed - check the browser');
    }
    
    logger.info('⏸️ Press Enter to close browser...');
    await new Promise(resolve => process.stdin.once('data', resolve));
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

testLogin().catch(console.error);