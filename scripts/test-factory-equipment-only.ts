import { chromium } from 'playwright';
import { VehicleModalNavigationService } from '../platforms/vauto/services/VehicleModalNavigationService';
import { Logger } from '../core/utils/Logger';

const logger = new Logger('FactoryEquipmentTest');

async function testFactoryEquipmentClick() {
  logger.info('🧪 Testing Factory Equipment click with updated selectors...');
  
  // Connect to existing browser instance (if running)
  try {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const contexts = browser.contexts();
    
    if (contexts.length === 0) {
      logger.error('❌ No browser contexts found. Please run the debug script first.');
      return;
    }
    
    const context = contexts[0];
    const pages = context.pages();
    
    if (pages.length === 0) {
      logger.error('❌ No pages found. Please run the debug script first.');
      return;
    }
    
    const page = pages[0];
    logger.info(`📄 Connected to page: ${await page.title()}`);
    
    // Create navigation service and test Factory Equipment click
    const navigationService = new VehicleModalNavigationService(page, logger);
    
    logger.info('🏭 Testing Factory Equipment click...');
    const result = await navigationService.clickFactoryEquipmentWithTabVerification();
    
    if (result) {
      logger.info('✅ Factory Equipment click succeeded!');
    } else {
      logger.error('❌ Factory Equipment click failed.');
    }
    
    // Keep browser open
    logger.info('🛑 Test complete. Browser remains open for inspection.');
    
  } catch (error) {
    logger.error('❌ Failed to connect to browser:', error);
    logger.info('💡 Make sure the debug script is running with the browser open.');
  }
}

testFactoryEquipmentClick();