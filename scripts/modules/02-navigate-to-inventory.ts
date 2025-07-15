#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { chromium, Browser, Page } from 'playwright';
import { Logger } from '../../core/utils/Logger';
import { vAutoSelectors } from '../../platforms/vauto/vautoSelectors';
import * as fs from 'fs-extra';

dotenv.config();

const logger = new Logger('Module-02-Navigate');

async function main() {
  logger.info('🧭 MODULE 02: Navigate to Inventory with Saved Filter');
  
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    // Load saved session
    const sessionFile = 'session/state.json';
    if (!await fs.pathExists(sessionFile)) {
      throw new Error('No session found. Run module 01 first!');
    }
    
    logger.info('📂 Loading saved session...');
    
    browser = await chromium.launch({
      headless: false,
      slowMo: 1000,
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    // Create context with saved state
    const context = await browser.newContext({
      storageState: sessionFile,
      viewport: { width: 1920, height: 1080 }
    });
    
    page = await context.newPage();
    
    // Go directly to inventory page
    logger.info('🚗 Navigating to inventory page...');
    await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/Vehicles.aspx');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/module-02-inventory-page.png', fullPage: true });
    
    // Click on Saved Filters dropdown
    logger.info('📋 Clicking Saved Filters dropdown...');
    const savedFiltersButton = page.locator('#ext-gen77').first();
    
    if (await savedFiltersButton.isVisible()) {
      await savedFiltersButton.click();
      await page.waitForTimeout(2000);
      logger.info('✅ Saved Filters dropdown opened');
      
      // Click Recent Inventory
      logger.info('🎯 Selecting Recent Inventory filter...');
      const recentInventoryOption = page.locator('#ext-gen514').first();
      
      if (await recentInventoryOption.isVisible()) {
        await recentInventoryOption.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        logger.info('✅ Recent Inventory filter applied');
      } else {
        logger.warn('Recent Inventory option not visible, trying alternative selectors...');
        // Try clicking by text
        await page.click('text=recent inventory', { timeout: 5000 }).catch(() => {});
      }
    } else {
      logger.error('Saved Filters button not found!');
    }
    
    // Verify we have vehicles
    await page.screenshot({ path: 'screenshots/module-02-filtered-inventory.png', fullPage: true });
    
    const vehicleRows = await page.locator(vAutoSelectors.inventory.vehicleRows).count();
    logger.info(`📊 Found ${vehicleRows} vehicles in filtered inventory`);
    
    if (vehicleRows === 0) {
      throw new Error('No vehicles found after applying filter');
    }
    
    // Save page state for next module
    await context.storageState({ path: 'session/state-after-nav.json' });
    
    logger.info('✅ MODULE 02 COMPLETE - Ready for vehicle selection');
    logger.info(`💾 State saved. Found ${vehicleRows} vehicles to process`);
    
    // Keep browser open
    logger.info('Browser staying open. Press Ctrl+C to close.');
    await new Promise(() => {}); // Keep process alive
    
  } catch (error) {
    logger.error('Module 02 failed:', error);
    if (page) await page.screenshot({ path: 'screenshots/module-02-error.png', fullPage: true });
    if (browser) await browser.close();
    process.exit(1);
  }
}

main().catch(console.error); 