#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { chromium, Browser, Page, Locator } from 'playwright';
import { Logger } from '../../core/utils/Logger';
import { vAutoSelectors } from '../../platforms/vauto/vautoSelectors';
import * as fs from 'fs-extra';

dotenv.config();

const logger = new Logger('Module-03-ClickVehicle');

async function main() {
  logger.info('🎯 MODULE 03: Click Vehicle URL ONLY');
  
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    // Load saved session
    const sessionFile = 'session/state-after-nav.json';
    if (!await fs.pathExists(sessionFile)) {
      logger.warn('No state-after-nav.json found, trying original session...');
      if (!await fs.pathExists('session/state.json')) {
        throw new Error('No session found. Run modules 01 and 02 first!');
      }
    }
    
    browser = await chromium.launch({
      headless: false,
      slowMo: 1000,
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    const context = await browser.newContext({
      storageState: await fs.pathExists(sessionFile) ? sessionFile : 'session/state.json',
      viewport: { width: 1920, height: 1080 }
    });
    
    page = await context.newPage();
    
    // Navigate to inventory if not already there
    const currentUrl = page.url();
    if (!currentUrl.includes('Inventory')) {
      logger.info('📍 Navigating to inventory page...');
      await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/Vehicles.aspx');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }
    
    // Take before screenshot
    await page.screenshot({ path: 'screenshots/module-03-before-click.png', fullPage: true });
    
    // Get all vehicle rows
    const vehicleRows = page.locator(vAutoSelectors.inventory.vehicleRows);
    const rowCount = await vehicleRows.count();
    logger.info(`📊 Found ${rowCount} vehicle rows`);
    
    if (rowCount === 0) {
      throw new Error('No vehicles found in inventory');
    }
    
    // Try multiple strategies to find and click vehicle link
    logger.info('🔍 Attempting to click first vehicle...');
    
    // STRATEGY 1: Look for anchor tags in the first row
    logger.info('Strategy 1: Looking for anchor tags in first row...');
    const firstRow = vehicleRows.first();
    const anchorsInRow = firstRow.locator('a');
    const anchorCount = await anchorsInRow.count();
    logger.info(`Found ${anchorCount} anchor tags in first row`);
    
    if (anchorCount > 0) {
      // Log all anchor texts
      for (let i = 0; i < anchorCount; i++) {
        const anchor = anchorsInRow.nth(i);
        const text = await anchor.textContent();
        const href = await anchor.getAttribute('href');
        const onclick = await anchor.getAttribute('onclick');
        logger.info(`  Anchor ${i}: text="${text}", href="${href}", onclick="${onclick}"`);
      }
      
      // Try to click the first anchor that looks like a vehicle link
      for (let i = 0; i < anchorCount; i++) {
        const anchor = anchorsInRow.nth(i);
        const text = await anchor.textContent();
        const onclick = await anchor.getAttribute('onclick');
        
        // Look for vehicle-like text (year/make/model pattern)
        if (text && text.match(/\d{4}\s+\w+/)) {
          logger.info(`✅ Found vehicle link: "${text}"`);
          
          // Highlight before clicking
          await page.evaluate(el => {
            if (el) {
              el.style.border = '3px solid red';
              el.style.backgroundColor = 'yellow';
            }
          }, await anchor.elementHandle());
          
          await page.waitForTimeout(1000); // Let user see what we're about to click
          
          try {
            await anchor.scrollIntoViewIfNeeded();
            await anchor.click({ timeout: 5000 });
            logger.info('✅ Clicked vehicle link!');
            
            // Wait for navigation
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(3000);
            
            // Verify we navigated
            const newUrl = page.url();
            if (newUrl !== currentUrl) {
              logger.info(`✅ Navigation successful! New URL: ${newUrl}`);
              await page.screenshot({ path: 'screenshots/module-03-after-click.png', fullPage: true });
              
              // Save state
              await context.storageState({ path: 'session/state-vehicle-selected.json' });
              logger.info('💾 State saved to session/state-vehicle-selected.json');
              logger.info('✅ MODULE 03 COMPLETE - Vehicle selected!');
              
              // Keep browser open
              logger.info('Browser staying open. Press Ctrl+C to close.');
              await new Promise(() => {});
              return;
            }
          } catch (clickError) {
            logger.warn(`Failed to click anchor ${i}: ${clickError}`);
          }
        }
      }
    }
    
    // STRATEGY 2: Try clicking the row itself
    logger.info('Strategy 2: Trying to click the row itself...');
    const beforeUrl = page.url();
    await firstRow.click();
    await page.waitForTimeout(3000);
    
    if (page.url() !== beforeUrl) {
      logger.info('✅ Row click worked!');
      await page.screenshot({ path: 'screenshots/module-03-after-click.png', fullPage: true });
      await context.storageState({ path: 'session/state-vehicle-selected.json' });
      logger.info('✅ MODULE 03 COMPLETE');
      await new Promise(() => {});
      return;
    }
    
    // STRATEGY 3: Use JavaScript to find and click
    logger.info('Strategy 3: Using JavaScript to find clickable elements...');
    const clicked = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr.x-grid3-row');
      if (rows.length === 0) return false;
      
      const firstRow = rows[0];
      const links = firstRow.querySelectorAll('a');
      
      for (const link of links) {
        const text = link.textContent || '';
        // Look for year pattern
        if (text.match(/\d{4}\s+\w+/)) {
          (link as HTMLElement).click();
          return true;
        }
      }
      
      // Try any link with onclick
      for (const link of links) {
        if (link.getAttribute('onclick')) {
          (link as HTMLElement).click();
          return true;
        }
      }
      
      return false;
    });
    
    if (clicked) {
      await page.waitForTimeout(3000);
      logger.info('✅ JavaScript click executed');
      await page.screenshot({ path: 'screenshots/module-03-after-click.png', fullPage: true });
      await context.storageState({ path: 'session/state-vehicle-selected.json' });
      logger.info('✅ MODULE 03 COMPLETE');
      await new Promise(() => {});
      return;
    }
    
    throw new Error('Failed to click any vehicle after trying all strategies');
    
  } catch (error) {
    logger.error('Module 03 failed:', error);
    if (page) await page.screenshot({ path: 'screenshots/module-03-error.png', fullPage: true });
    if (browser) await browser.close();
    process.exit(1);
  }
}

main().catch(console.error); 