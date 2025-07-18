import { chromium } from 'playwright';
import * as fs from 'fs-extra';
import { Logger } from '../core/utils/Logger';
import { clickFactoryEquipmentWithTabCheck } from '../fix-vehicle-info-tab-click';

async function testFactoryEquipmentWithSession() {
  const logger = new Logger('TestFactoryEquipment');
  logger.info('🚀 Starting Factory Equipment Test with Session...');

  try {
    // Connect to existing session
    const wsEndpointFile = './session/browser-ws-endpoint.txt';
    
    if (!await fs.pathExists(wsEndpointFile)) {
      throw new Error('No active session found. Run "npm run vauto:session" first.');
    }

    const wsEndpoint = await fs.readFile(wsEndpointFile, 'utf-8');
    const browser = await chromium.connectOverCDP(wsEndpoint);
    
    // Get the first page from existing context
    const contexts = browser.contexts();
    if (contexts.length === 0) {
      throw new Error('No browser contexts found');
    }
    
    const pages = contexts[0].pages();
    if (pages.length === 0) {
      throw new Error('No pages found in browser context');
    }
    
    const page = pages[0]; // Use the first page (your current modal)
    logger.info('✅ Connected to existing session');

    // Wait for modal to be visible
    await page.waitForSelector('.x-window', { state: 'visible', timeout: 10000 });
    logger.info('✅ Modal is visible');

    // Use the working solution from fix-vehicle-info-tab-click.ts
    const success = await clickFactoryEquipmentWithTabCheck(page, logger);

    if (success) {
      logger.info('✅ Successfully completed Factory Equipment flow!');
      
      // Check for new windows
      const pages = page.context().pages();
      logger.info(`📊 Browser now has ${pages.length} page(s)`);
      
      if (pages.length > 1) {
        const newPage = pages[pages.length - 1];
        const title = await newPage.title();
        const url = newPage.url();
        logger.info(`📄 New window opened:`);
        logger.info(`   Title: ${title}`);
        logger.info(`   URL: ${url}`);
        
        // Take screenshot of factory equipment window
        await newPage.screenshot({ path: `factory-equipment-window-${Date.now()}.png` });
        logger.info('📸 Screenshot of factory equipment window saved');
      }
    } else {
      logger.error('❌ Failed to complete Factory Equipment flow');
      
      // Take debug screenshot
      await page.screenshot({ path: `factory-equipment-debug-${Date.now()}.png` });
      logger.info('📸 Debug screenshot saved');
    }

  } catch (error) {
    logger.error('❌ Error in Factory Equipment test:', error);
    if (error instanceof Error) {
      logger.error('Error message:', error.message);
      logger.error('Stack trace:', error.stack);
    }
  }
}

// Run the test
testFactoryEquipmentWithSession().catch(console.error);