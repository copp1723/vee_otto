#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { chromium } from 'playwright';
import { Logger } from '../core/utils/Logger';
import { VisualDebugger } from '../core/utils/VisualDebugger';

// Load Render environment but force visual mode
dotenv.config({ path: '.env.render' });

const logger = new Logger('VisualRenderTest');

async function testWithVisualDebugging() {
  // Force visual mode regardless of environment
  const isLocal = !process.env.RENDER;
  
  const browser = await chromium.launch({
    headless: !isLocal, // Visual if local, headless if on Render
    slowMo: 1000,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  const debugger = new VisualDebugger(page);

  try {
    logger.info(`🎬 Starting visual test (${isLocal ? 'LOCAL' : 'RENDER'} mode)`);

    // Test login
    await page.goto('https://vauto.signin.coxautoinc.com/?solutionID=VAT_prod&clientId=68e5c360aa114799a67e94c4d587ff65');
    await debugger.captureStep('login-page');

    await page.fill('//input[@id="username"]', process.env.VAUTO_USERNAME || '');
    await debugger.captureStep('username-entered');

    await page.click('//button[contains(text(), "Next")]');
    await page.waitForTimeout(2000);
    await debugger.captureStep('after-next-click');

    await page.fill('//input[@type="password"]', process.env.VAUTO_PASSWORD || '');
    await debugger.captureStep('password-entered');

    await page.click('//button[@type="submit"]');
    await page.waitForTimeout(5000);
    await debugger.captureStep('after-login-submit');

    // Test Factory Equipment navigation
    if (page.url().includes('inventory') || page.url().includes('dashboard')) {
      logger.info('✅ Login successful, testing navigation...');
      
      // Navigate to a vehicle (mock for now)
      await debugger.captureStep('inventory-page');
      
      // Look for Factory Equipment tab
      await debugger.captureElement('text=Factory Equipment', 'factory-equipment-tab');
      
      const factoryTab = page.locator('text=Factory Equipment').first();
      if (await factoryTab.isVisible({ timeout: 5000 })) {
        logger.info('✅ Factory Equipment tab found!');
        await factoryTab.click();
        await debugger.captureStep('after-factory-tab-click');
      } else {
        logger.warn('❌ Factory Equipment tab not found');
        await debugger.captureStep('factory-tab-not-found');
      }
    }

    logger.info('✅ Visual test completed');

  } catch (error) {
    logger.error('❌ Visual test failed:', error);
    await debugger.captureStep('error-state');
  } finally {
    await browser.close();
  }
}

testWithVisualDebugging();