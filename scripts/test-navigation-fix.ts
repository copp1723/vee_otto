#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { chromium } from 'playwright';
import { Logger } from '../core/utils/Logger';
import { FactoryEquipmentNavigator } from '../core/services/FactoryEquipmentNavigator';

dotenv.config();

const logger = new Logger('NavigationTest');

async function testNavigation() {
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const page = await browser.newPage();
  
  try {
    // Navigate to VAuto (replace with actual login flow)
    logger.info('🔍 Testing Factory Equipment navigation...');
    
    const navigator = new FactoryEquipmentNavigator(page, logger);
    const result = await navigator.navigateToFactoryEquipment();
    
    if (result.success) {
      logger.info(`✅ Navigation successful using method: ${result.method}`);
      
      if (result.contentPage) {
        const content = await result.contentPage.textContent('body');
        logger.info(`📄 Content length: ${content?.length || 0} characters`);
        
        // Close the content page
        await result.contentPage.close();
      }
    } else {
      logger.error(`❌ Navigation failed: ${result.error}`);
    }
    
  } catch (error) {
    logger.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

testNavigation();