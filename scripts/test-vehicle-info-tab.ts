#!/usr/bin/env node

import { chromium } from 'playwright';
import { Logger } from '../core/utils/Logger';

const logger = new Logger('Test-Vehicle-Info-Tab');

async function testVehicleInfoTab() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const contexts = browser.contexts();
  const page = contexts[0]?.pages()[0];
  
  if (!page) {
    throw new Error('No page found');
  }

  try {
    logger.info('🧪 Testing Vehicle Info tab click');
    
    // Log current URL
    logger.info(`Current URL: ${page.url()}`);
    
    // Check if modal is visible
    const modalVisible = await page.locator('.x-window').isVisible().catch(() => false);
    logger.info(`Modal visible: ${modalVisible}`);
    
    // Try to find and click Vehicle Info tab
    const selectors = [
      'button:has-text("Vehicle Info")',
      'span:has-text("Vehicle Info")',
      '.x-tab-strip-text:has-text("Vehicle Info")',
      '//span[contains(text(), "Vehicle Info")]',
      'text=Vehicle Info'
    ];
    
    for (const selector of selectors) {
      try {
        const element = page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 1000 }).catch(() => false);
        
        if (isVisible) {
          logger.info(`✅ Found Vehicle Info tab with selector: ${selector}`);
          
          // Get element details
          const text = await element.textContent().catch(() => 'N/A');
          const classes = await element.getAttribute('class').catch(() => 'N/A');
          logger.info(`   Text: ${text}`);
          logger.info(`   Classes: ${classes}`);
          
          // Click it
          logger.info('🖱️ Clicking Vehicle Info tab...');
          await element.click();
          await page.waitForTimeout(2000);
          
          logger.info('✅ Clicked! Waiting for content to load...');
          
          // Check if we can see VIN label (indicator of Vehicle Info tab)
          const vinVisible = await page.frameLocator('#GaugePageIFrame')
            .locator('label:has-text("VIN")')
            .isVisible({ timeout: 3000 })
            .catch(() => false);
            
          if (vinVisible) {
            logger.info('✅ SUCCESS! Vehicle Info tab is now active (VIN label visible)');
          } else {
            logger.info('⚠️  Tab clicked but VIN label not visible yet');
          }
          
          return;
        }
      } catch (error) {
        continue;
      }
    }
    
    logger.error('❌ Could not find Vehicle Info tab');
    
    // Log all visible tabs for debugging
    logger.info('\n🔍 Looking for all tabs...');
    const tabs = await page.locator('.x-tab-strip-text').all();
    logger.info(`Found ${tabs.length} tabs:`);
    
    for (let i = 0; i < tabs.length; i++) {
      const text = await tabs[i].textContent().catch(() => '');
      logger.info(`   ${i + 1}. "${text?.trim() || ''}"`);
    }
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
  }
}

testVehicleInfoTab().catch(console.error);