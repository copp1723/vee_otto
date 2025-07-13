#!/usr/bin/env ts-node

import { BrowserAutomation } from '../core/utils/BrowserAutomation';
import { Logger } from '../core/utils/Logger';

async function testVisibleBrowser() {
  const logger = new Logger('BrowserTest');
  
  try {
    logger.info('Testing visible browser automation...');
    
    const browser = new BrowserAutomation({
      headless: false,
      slowMo: 2000,
      timeout: 30000
    });
    
    logger.info('Initializing browser...');
    await browser.initialize();
    
    logger.info('Navigating to Google...');
    const page = browser.currentPage;
    await page.goto('https://www.google.com');
    await page.waitForLoadState('networkidle');
    
    logger.info('Taking screenshot...');
    await browser.takeScreenshot('google-test');
    
    logger.info('Waiting 10 seconds for you to see the browser...');
    await page.waitForTimeout(10000);
    
    logger.info('Closing browser...');
    await browser.cleanup();
    
    logger.info('Test completed successfully!');
    
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

testVisibleBrowser();