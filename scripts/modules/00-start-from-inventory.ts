#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { chromium, Browser, Page } from 'playwright';
import { Logger } from '../../core/utils/Logger';
import { vAutoSelectors } from '../../platforms/vauto/vautoSelectors';
import * as fs from 'fs-extra';

dotenv.config();

const logger = new Logger('Module-00-StartFromInventory');

async function main() {
  logger.info('🚀 MODULE 00: Start from existing browser session');
  logger.info('⚠️  IMPORTANT: This assumes you already have vAuto open and logged in!');
  logger.info('📋 Instructions:');
  logger.info('   1. Run your normal vAuto login with 2FA');
  logger.info('   2. Once logged in, keep browser open');
  logger.info('   3. Run this script to test vehicle clicking');
  
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    // Connect to existing browser or start new one
    browser = await chromium.launch({
      headless: false,
      slowMo: 1000,
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    
    page = await context.newPage();
    
    // Go directly to inventory - assumes we're already authenticated
    logger.info('📍 Navigating directly to inventory page...');
    await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/Vehicles.aspx');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/module-00-inventory.png', fullPage: true });
    
    // Apply saved filter if needed
    const vehicleRows = await page.locator(vAutoSelectors.inventory.vehicleRows).count();
    logger.info(`📊 Found ${vehicleRows} vehicles initially`);
    
    if (vehicleRows === 0) {
      logger.info('📋 No vehicles found, applying saved filter...');
      
      // Click Saved Filters
      const savedFiltersButton = page.locator('#ext-gen77').first();
      if (await savedFiltersButton.isVisible()) {
        await savedFiltersButton.click();
        await page.waitForTimeout(2000);
        
        // Click Recent Inventory
        const recentInventoryOption = page.locator('#ext-gen514').first();
        if (await recentInventoryOption.isVisible()) {
          await recentInventoryOption.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(3000);
        }
      }
    }
    
    // NOW THE IMPORTANT PART - Click a vehicle
    logger.info('🎯 Now attempting to click a vehicle...');
    
    const rows = page.locator(vAutoSelectors.inventory.vehicleRows);
    const rowCount = await rows.count();
    logger.info(`📊 Found ${rowCount} vehicle rows after filter`);
    
    if (rowCount > 0) {
      const firstRow = rows.first();
      
      // Look for ALL clickable elements in the first row
      logger.info('🔍 Analyzing first row for clickable elements...');
      
      // Get all elements that might be clickable
      const clickableSelectors = [
        'a',                    // Any anchor
        'span[onclick]',        // Spans with onclick
        'div[onclick]',         // Divs with onclick
        'td[onclick]',          // Table cells with onclick
        '[role="link"]',        // Anything marked as link
        '[style*="cursor: pointer"]'  // Anything with pointer cursor
      ];
      
      for (const selector of clickableSelectors) {
        const elements = firstRow.locator(selector);
        const count = await elements.count();
        
        if (count > 0) {
          logger.info(`Found ${count} ${selector} elements in first row`);
          
          for (let i = 0; i < count; i++) {
            const element = elements.nth(i);
            const text = await element.textContent();
            const onclick = await element.getAttribute('onclick');
            const href = await element.getAttribute('href');
            const style = await element.getAttribute('style');
            
            logger.info(`  ${selector}[${i}]:`);
            logger.info(`    Text: "${text}"`);
            logger.info(`    onclick: ${onclick}`);
            logger.info(`    href: ${href}`);
            logger.info(`    style: ${style}`);
            
            // If this looks like a vehicle link, try clicking it
            if (text && text.match(/\d{4}\s+\w+/)) {  // Year pattern
              logger.info(`  ✅ This looks like a vehicle link!`);
              
              // Highlight it
              await page.evaluate(el => {
                if (el) {
                  el.style.border = '3px solid red';
                  el.style.backgroundColor = 'yellow';
                }
              }, await element.elementHandle());
              
              await page.waitForTimeout(2000);
              
              try {
                await element.click();
                logger.info('✅ CLICKED! Waiting for navigation...');
                await page.waitForTimeout(5000);
                
                const newUrl = page.url();
                logger.info(`📍 New URL: ${newUrl}`);
                
                await page.screenshot({ path: 'screenshots/module-00-after-click.png' });
                
                logger.info('✅ SUCCESS! Vehicle clicked and loaded!');
                logger.info('Browser staying open for inspection...');
                await new Promise(() => {});
                return;
              } catch (e) {
                logger.warn(`Click failed: ${e}`);
              }
            }
          }
        }
      }
    }
    
    logger.error('❌ Could not find or click any vehicle link');
    
  } catch (error) {
    logger.error('Module failed:', error);
    if (page) await page.screenshot({ path: 'screenshots/module-00-error.png' });
  } finally {
    // Keep browser open for debugging
    logger.info('Browser staying open. Press Ctrl+C to close.');
    await new Promise(() => {});
  }
}

main().catch(console.error); 