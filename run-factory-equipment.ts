#!/usr/bin/env node

import { chromium } from 'playwright';
import { clickFactoryEquipmentWithTabCheck } from './fix-vehicle-info-tab-click';
import { Logger } from './core/utils/Logger';

async function runFactoryEquipment() {
  const logger = new Logger('FactoryEquipment');
  
  logger.info('🚀 Starting Factory Equipment Navigation');
  logger.info('This script will:');
  logger.info('1. Launch a new browser');
  logger.info('2. Log into VAuto');
  logger.info('3. Navigate to a vehicle');
  logger.info('4. Click Vehicle Info tab if needed');
  logger.info('5. Click Factory Equipment button\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    logger.info('📋 Step 1: Logging in...');
    await page.goto('https://signin.coxautoinc.com');
    await page.fill('#okta-signin-username', process.env.VAUTO_USERNAME || '');
    await page.fill('#okta-signin-password', process.env.VAUTO_PASSWORD || '');
    await page.click('#okta-signin-submit');

    logger.info('⏳ Waiting for 2FA or login...');
    logger.info('💡 Run "ts-node monitor-2fa.ts" in another terminal to see the code');
    
    // Wait for navigation to VAuto
    await page.waitForURL(/vauto|provision/, { timeout: 300000 });
    logger.info('✅ Logged in successfully');

    // Go to inventory
    logger.info('📋 Step 2: Navigating to inventory...');
    await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/');
    await page.waitForLoadState('networkidle');

    // Click first vehicle
    logger.info('📋 Step 3: Opening first vehicle...');
    await page.click('//tr[contains(@class, "x-grid3-row")]//a', { timeout: 30000 });
    
    // Wait for modal
    await page.waitForSelector('.x-window', { state: 'visible', timeout: 10000 });
    logger.info('✅ Vehicle modal opened');

    // Run the Factory Equipment navigation
    logger.info('📋 Step 4: Running Factory Equipment navigation...');
    const success = await clickFactoryEquipmentWithTabCheck(page, logger);

    if (success) {
      logger.info('✅ SUCCESS! Factory Equipment navigation completed');
      
      // Check for new windows
      const pages = context.pages();
      if (pages.length > 1) {
        logger.info(`📄 New window opened: ${pages[pages.length - 1].url()}`);
      }
    } else {
      logger.error('❌ Factory Equipment navigation failed');
    }

    logger.info('\n🔄 Keeping browser open for inspection...');
    logger.info('Press Ctrl+C to close');
    
    // Keep alive
    await new Promise(() => {});

  } catch (error) {
    logger.error('Error:', error);
    await page.screenshot({ path: `error-${Date.now()}.png` });
  }
}

// Load environment
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.mvp' });

// Run
runFactoryEquipment().catch(console.error);