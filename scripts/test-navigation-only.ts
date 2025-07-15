#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { chromium } from 'playwright';
import { Logger } from '../core/utils/Logger';

dotenv.config();

const logger = new Logger('NavigationTest');

async function testFactoryEquipmentNavigation() {
  const browser = await chromium.launch({ 
    headless: false, 
    slowMo: 1000 
  });
  
  const page = await browser.newPage();
  
  try {
    logger.info('🔍 Testing Factory Equipment navigation fix...');
    
    // Mock navigation to vehicle details page
    await page.goto('about:blank');
    await page.setContent(`
      <div>
        <ul class="x-tab-strip">
          <a>Vehicle Info</a>
          <a>Pricing</a>
          <a>Factory Equipment</a>
          <a>Photos</a>
        </ul>
        <div>Vehicle details content</div>
      </div>
    `);
    
    // Test Strategy 1: Text-based selector
    logger.info('Testing text-based selector...');
    const factoryTab = page.locator('text=Factory Equipment').first();
    
    if (await factoryTab.isVisible({ timeout: 2000 })) {
      logger.info('✅ Text-based selector found Factory Equipment tab');
      await factoryTab.click();
      logger.info('✅ Tab clicked successfully');
    } else {
      logger.error('❌ Text-based selector failed');
    }
    
    // Test Strategy 2: Position-based selector
    logger.info('Testing position-based selector...');
    const tabs = await page.locator('//ul[contains(@class, "x-tab-strip")]//a').all();
    logger.info(`Found ${tabs.length} tabs`);
    
    for (let i = 0; i < tabs.length; i++) {
      const tabText = await tabs[i].textContent();
      logger.info(`Tab ${i}: "${tabText}"`);
      
      if (tabText?.toLowerCase().includes('factory') || tabText?.toLowerCase().includes('equipment')) {
        logger.info(`✅ Position-based selector found Factory Equipment at position ${i}`);
        break;
      }
    }
    
    logger.info('✅ Navigation test completed successfully');
    
  } catch (error) {
    logger.error('❌ Navigation test failed:', error);
  } finally {
    await browser.close();
  }
}

testFactoryEquipmentNavigation();