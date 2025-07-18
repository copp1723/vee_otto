#!/usr/bin/env node

import { Page } from 'playwright';
import { Logger } from '../core/utils/Logger';

const logger = new Logger('Test-Factory-Equipment');

async function testFactoryEquipment() {
  // Get the page from global context (set by test-with-session.ts)
  const page = (global as any).testPage as Page;
  
  if (!page) {
    throw new Error('No page available. This script must be run with test-with-session.ts');
  }

  try {
    logger.info('🧪 Testing Factory Equipment Button Click');
    
    // Make sure we're on the inventory page
    const currentUrl = page.url();
    if (!currentUrl.includes('inventory')) {
      logger.info('📋 Navigating to inventory...');
      await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/');
      await page.waitForLoadState('networkidle');
    }

    // Wait for grid to load
    logger.info('⏳ Waiting for inventory grid...');
    await page.waitForSelector('.x-grid3-row', { timeout: 30000 });
    
    // Get first vehicle
    const vehicles = await page.locator('.x-grid3-row').all();
    logger.info(`📋 Found ${vehicles.length} vehicles`);
    
    if (vehicles.length === 0) {
      throw new Error('No vehicles found in inventory');
    }

    // Click first vehicle
    logger.info('🚗 Clicking first vehicle...');
    await vehicles[0].click();
    await page.waitForTimeout(3000);

    // Try different Factory Equipment selectors
    const selectors = [
      '#ext-gen199', // Known working ID from user
      'button:has-text("Factory Equipment")',
      'span:has-text("Factory Equipment")',
      '//button[contains(text(), "Factory Equipment")]',
      '//span[contains(text(), "Factory Equipment")]',
      '[id*="button"][id*="factory"]',
      '[id*="button"][id*="equipment"]'
    ];

    logger.info('🔍 Looking for Factory Equipment button...');
    
    for (const selector of selectors) {
      try {
        const element = page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (isVisible) {
          logger.info(`✅ Found with selector: ${selector}`);
          
          // Get button details
          const text = await element.textContent().catch(() => 'N/A');
          const id = await element.getAttribute('id').catch(() => 'N/A');
          const classes = await element.getAttribute('class').catch(() => 'N/A');
          
          logger.info(`   Text: ${text}`);
          logger.info(`   ID: ${id}`);
          logger.info(`   Classes: ${classes}`);
          
          // Try to click
          logger.info('🖱️ Attempting to click...');
          await element.click();
          await page.waitForTimeout(2000);
          
          // Check if window sticker appeared
          const stickerVisible = await page.locator('iframe[src*="window"], iframe[title*="window"], iframe[title*="sticker"]')
            .isVisible({ timeout: 5000 })
            .catch(() => false);
          
          if (stickerVisible) {
            logger.info('✅ SUCCESS! Window sticker iframe appeared');
            return;
          } else {
            logger.info('⚠️  Button clicked but no window sticker appeared');
          }
        }
      } catch (error) {
        // Continue to next selector
      }
    }

    // If we get here, no working selector was found
    logger.error('❌ Could not find or click Factory Equipment button');
    
    // Take a screenshot for debugging
    await page.screenshot({ 
      path: `debug-factory-equipment-${Date.now()}.png`, 
      fullPage: true 
    });
    logger.info('📸 Screenshot saved for debugging');

    // Log all visible buttons for analysis
    logger.info('\n🔍 All visible buttons on page:');
    const allButtons = await page.locator('button:visible, [role="button"]:visible').all();
    
    for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
      const btn = allButtons[i];
      const text = await btn.textContent().catch(() => '');
      const id = await btn.getAttribute('id').catch(() => '');
      if (text || id) {
        logger.info(`   ${i + 1}. Text: "${text?.trim()}", ID: "${id}"`);
      }
    }

  } catch (error) {
    logger.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testFactoryEquipment().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});