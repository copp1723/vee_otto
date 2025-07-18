#!/usr/bin/env node

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as dotenv from 'dotenv';
import { Logger } from '../core/utils/Logger';
import * as readline from 'readline';

dotenv.config();

const logger = new Logger('MVP-Step-Test');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

async function waitForEnter(message: string = 'Press Enter to continue...') {
  await askQuestion(`\n${message}`);
}

async function testStepByStep() {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  
  try {
    logger.info('🧪 MVP Step-by-Step Test');
    logger.info('This will test each phase interactively\n');
    
    // Initialize browser
    logger.info('🌐 Launching browser...');
    browser = await chromium.launch({
      headless: false,
      slowMo: 1000
    });
    
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    
    page = await context.newPage();
    logger.info('✅ Browser launched');
    
    // Test 1: Login page
    logger.info('\n📋 Test 1: Navigate to login page');
    await page.goto('https://login.vauto.com/');
    await page.waitForLoadState('networkidle');
    
    const hasUsernameField = await page.locator('input[name="username"], input[type="email"]').isVisible();
    const hasPasswordField = await page.locator('input[name="password"], input[type="password"]').isVisible();
    
    if (hasUsernameField && hasPasswordField) {
      logger.info('✅ Login fields found');
    } else {
      logger.error('❌ Login fields not found');
    }
    
    await waitForEnter('Check the login page, then press Enter...');
    
    // Test 2: Enter credentials
    logger.info('\n📋 Test 2: Enter credentials');
    const username = process.env.VAUTO_USERNAME || '';
    const password = process.env.VAUTO_PASSWORD || '';
    
    if (!username || !password) {
      logger.error('❌ Missing credentials in environment');
      return;
    }
    
    await page.fill('input[name="username"], input[type="email"]', username);
    await page.fill('input[name="password"], input[type="password"]', password);
    logger.info('✅ Credentials entered');
    
    await waitForEnter('Verify credentials are filled, then press Enter to submit...');
    
    await page.click('button[type="submit"], input[type="submit"]');
    logger.info('✅ Login submitted');
    
    // Test 3: 2FA
    logger.info('\n📋 Test 3: Handle 2FA');
    try {
      await page.waitForSelector('input[type="text"][name*="code"], input[type="text"][aria-label*="code"]', { timeout: 30000 });
      logger.info('✅ 2FA field found');
      
      const code = await askQuestion('Enter 2FA code: ');
      await page.fill('input[type="text"][name*="code"], input[type="text"][aria-label*="code"]', code);
      await page.click('button[type="submit"], input[type="submit"]');
      logger.info('✅ 2FA submitted');
    } catch (error) {
      logger.info('ℹ️ No 2FA required or already authenticated');
    }
    
    await page.waitForLoadState('networkidle', { timeout: 60000 });
    await waitForEnter('Wait for dashboard to load, then press Enter...');
    
    // Test 4: Navigate to inventory
    logger.info('\n📋 Test 4: Navigate to inventory');
    await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/Vehicles.aspx');
    await page.waitForLoadState('networkidle');
    
    const hasInventoryGrid = await page.locator('.x-grid3-row, #ext-gen25').isVisible({ timeout: 10000 }).catch(() => false);
    if (hasInventoryGrid) {
      logger.info('✅ Inventory grid found');
    } else {
      logger.error('❌ Inventory grid not found');
    }
    
    await waitForEnter('Verify inventory page loaded, then press Enter...');
    
    // Test 5: Apply filter
    logger.info('\n📋 Test 5: Apply age filter');
    const filterTab = page.locator('#ext-gen73, text=Filter, button:has-text("Filter")').first();
    
    if (await filterTab.isVisible()) {
      await filterTab.click();
      logger.info('✅ Filter tab clicked');
      
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/mvp/test-filter-tab.png' });
      logger.info('📸 Screenshot saved: test-filter-tab.png');
    } else {
      logger.error('❌ Filter tab not found');
    }
    
    await waitForEnter('Check if filter options appeared, then press Enter...');
    
    // Test 6: Click vehicle
    logger.info('\n📋 Test 6: Test vehicle clicking');
    const vehicleRows = await page.locator('.x-grid3-row').count();
    logger.info(`📊 Found ${vehicleRows} vehicle rows`);
    
    if (vehicleRows > 0) {
      const firstRow = page.locator('.x-grid3-row').first();
      const vehicleLink = firstRow.locator('a').first();
      
      if (await vehicleLink.isVisible()) {
        const vehicleText = await vehicleLink.textContent();
        logger.info(`🚗 First vehicle: ${vehicleText}`);
        
        await waitForEnter('Press Enter to click the first vehicle...');
        
        await vehicleLink.click();
        await page.waitForTimeout(3000);
        
        const modalFound = await page.locator('.x-window, #GaugePageIFrame').isVisible({ timeout: 5000 }).catch(() => false);
        if (modalFound) {
          logger.info('✅ Vehicle modal opened');
          await page.screenshot({ path: 'screenshots/mvp/test-vehicle-modal.png' });
          logger.info('📸 Screenshot saved: test-vehicle-modal.png');
        } else {
          logger.error('❌ Vehicle modal not found');
        }
      } else {
        logger.error('❌ No vehicle link found');
      }
    } else {
      logger.error('❌ No vehicles in inventory');
    }
    
    await waitForEnter('Check the vehicle modal, then press Enter to finish...');
    
    logger.info('\n✅ Step-by-step test complete!');
    logger.info('Review the results above to identify any issues');
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
    if (page) {
      await page.screenshot({ path: 'screenshots/mvp/test-error.png' });
      logger.info('📸 Error screenshot saved');
    }
  } finally {
    rl.close();
    if (browser) {
      await waitForEnter('Press Enter to close browser...');
      await browser.close();
    }
  }
}

// Run test
testStepByStep().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});