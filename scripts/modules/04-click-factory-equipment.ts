#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { chromium, Browser, Page } from 'playwright';
import { Logger } from '../../core/utils/Logger';
import { vAutoSelectors } from '../../platforms/vauto/vautoSelectors';
import * as fs from 'fs-extra';

dotenv.config();

const logger = new Logger('Module-04-FactoryEquipment');

async function main() {
  logger.info('🏭 MODULE 04: Click Factory Equipment Tab');
  
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    // Load saved session
    const sessionFile = 'session/state-vehicle-selected.json';
    if (!await fs.pathExists(sessionFile)) {
      throw new Error('No vehicle selected session found. Run module 03 first!');
    }
    
    browser = await chromium.launch({
      headless: false,
      slowMo: 1000,
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    const context = await browser.newContext({
      storageState: sessionFile,
      viewport: { width: 1920, height: 1080 }
    });
    
    page = await context.newPage();
    
    // Navigate to last URL if needed
    const state = await fs.readJson(sessionFile);
    if (state.origins && state.origins.length > 0) {
      const lastOrigin = state.origins[state.origins.length - 1];
      logger.info(`Loading last URL from session...`);
      await page.goto(lastOrigin.origin);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }
    
    logger.info('📸 Taking screenshot of vehicle details page...');
    await page.screenshot({ path: 'screenshots/module-04-vehicle-details.png', fullPage: true });
    
    // Try multiple selectors for Factory Equipment tab
    const factoryEquipmentSelectors = [
      'text=Factory Equipment',
      '//div[contains(@class, "x-tab") and contains(text(), "Factory Equipment")]',
      '//a[contains(text(), "Factory Equipment")]',
      '//span[contains(text(), "Factory Equipment")]',
      '#ext-gen175',  // Direct ID from user
      '#ext-gen201'   // Alternative ID
    ];
    
    let tabClicked = false;
    
    for (const selector of factoryEquipmentSelectors) {
      logger.info(`Trying selector: ${selector}`);
      
      try {
        const element = page.locator(selector).first();
        
        if (await element.isVisible({ timeout: 3000 })) {
          logger.info(`✅ Found Factory Equipment tab with selector: ${selector}`);
          
          // Get element info
          const text = await element.textContent();
          logger.info(`Tab text: "${text}"`);
          
          // Highlight the tab
          await page.evaluate(el => {
            if (el) {
              el.style.border = '3px solid green';
              el.style.backgroundColor = 'lightgreen';
            }
          }, await element.elementHandle());
          
          await page.waitForTimeout(1000);
          
          // Click the tab
          await element.scrollIntoViewIfNeeded();
          await element.click({ timeout: 5000 });
          
          logger.info('✅ Clicked Factory Equipment tab!');
          tabClicked = true;
          
          // Wait for content to load (e.g., a common content panel)
          await page.waitForSelector('.x-panel-body', { state: 'visible', timeout: 10000 });
          
          break;
        }
      } catch (error) {
        logger.warn(`Selector ${selector} failed: ${error}`);
      }
    }
    
    if (!tabClicked) {
      // Try iframe approach
      logger.info('🔍 Checking for iframes...');
      const iframes = page.frames();
      logger.info(`Found ${iframes.length} frames`);
      
      for (const frame of iframes) {
        const frameUrl = frame.url();
        logger.info(`Frame URL: ${frameUrl}`);
        
        // Look for Factory Equipment in iframe
        try {
          const factoryTab = frame.locator('text=Factory Equipment').first();
          if (await factoryTab.isVisible({ timeout: 2000 })) {
            logger.info('✅ Found Factory Equipment tab in iframe!');
            await factoryTab.click();
            tabClicked = true;
            // Intelligent wait after click in iframe
            await page.waitForSelector('.x-panel-body', { state: 'visible', timeout: 10000 });
            break;
          }
        } catch (e) {
          // Continue checking other frames
        }
      }
    }
    
    if (!tabClicked) {
      throw new Error('Could not find or click Factory Equipment tab');
    }
    
    // Take screenshot after clicking
    await page.screenshot({ path: 'screenshots/module-04-factory-equipment.png', fullPage: true });
    
    // Check for window sticker popup or new content
    logger.info('🔍 Checking for window sticker content...');
    
    // Save state
    await context.storageState({ path: 'session/state-factory-equipment.json' });
    logger.info('💾 State saved to session/state-factory-equipment.json');
    
    logger.info('✅ MODULE 04 COMPLETE - Factory Equipment tab opened!');
    
    // Keep browser open
    logger.info('Browser staying open. Press Ctrl+C to close.');
    await new Promise(() => {});
    
  } catch (error) {
    logger.error('Module 04 failed:', error);
    if (page) await page.screenshot({ path: 'screenshots/module-04-error.png', fullPage: true });
    if (browser) await browser.close();
    process.exit(1);
  }
}

main().catch(console.error); 