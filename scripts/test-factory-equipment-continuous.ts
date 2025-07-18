import { chromium } from 'playwright';
import { Logger } from '../core/utils/Logger';

const logger = new Logger('FactoryEquipmentContinuousTest');

// Updated selectors based on the actual Factory Equipment link structure
const FACTORY_EQUIPMENT_SELECTORS = [
  // Primary selector - exact ID and text match
  'a#ui-id-9:has-text("Factory Equipment")',
  
  // ID-based selectors
  'a#ui-id-9',
  '#ui-id-9',
  
  // Text-based selectors for the link
  'a:has-text("Factory Equipment")',
  'a[role="tab"]:has-text("Factory Equipment")',
  
  // Aria-based selectors
  'a[aria-controls="tabs-5"]',
  
  // Combined selectors
  'a#ui-id-9[aria-controls="tabs-5"]',
  'a#ui-id-9[role="tab"]',
  
  // Parent-based selectors
  'ul[role="tablist"] a:has-text("Factory Equipment")',
  '.ui-tabs-nav a:has-text("Factory Equipment")',
  
  // Fallback generic selectors
  'text="Factory Equipment"',
  ':text("Factory Equipment")',
  
  // XPath as last resort
  '//a[@id="ui-id-9" and contains(text(), "Factory Equipment")]'
];

async function connectAndTest() {
  try {
    logger.info('🔌 Attempting to connect to existing browser at http://localhost:9222...');
    
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const contexts = browser.contexts();
    
    if (contexts.length === 0) {
      logger.error('❌ No browser contexts found. Make sure the debug script is running.');
      return false;
    }
    
    const context = contexts[0];
    const pages = context.pages();
    
    if (pages.length === 0) {
      logger.error('❌ No pages found in the context.');
      return false;
    }
    
    const page = pages[0];
    const currentUrl = page.url();
    logger.info(`✅ Connected to page: ${await page.title()}`);
    logger.info(`📍 Current URL: ${currentUrl}`);
    
    // Check if we're on a vehicle details page
    if (!currentUrl.includes('vehicle_id=')) {
      logger.warn('⚠️ Not on a vehicle details page. Navigate to a vehicle first.');
      return false;
    }
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      logger.info('⏳ Page load timeout - continuing anyway');
    });
    
    // First, check if Vehicle Info tab needs to be clicked
    logger.info('🔍 Checking if Vehicle Info tab needs to be clicked first...');
    
    const vehicleInfoTab = await page.$('a#ui-id-1:has-text("Vehicle Info")');
    if (vehicleInfoTab) {
      const isActive = await vehicleInfoTab.evaluate(el => el.classList.contains('ui-state-active'));
      if (!isActive) {
        logger.info('📋 Clicking Vehicle Info tab first...');
        await vehicleInfoTab.click();
        await page.waitForTimeout(1000);
      }
    }
    
    // Try each selector to find Factory Equipment
    logger.info('🔍 Looking for Factory Equipment link/button...');
    
    for (const selector of FACTORY_EQUIPMENT_SELECTORS) {
      try {
        logger.info(`  → Trying selector: ${selector}`);
        
        const element = await page.$(selector);
        if (element) {
          // Check if element is visible
          const isVisible = await element.isVisible();
          if (!isVisible) {
            logger.info(`    ❌ Element found but not visible`);
            continue;
          }
          
          // Get element details
          const tagName = await element.evaluate(el => el.tagName);
          const text = await element.textContent();
          const id = await element.getAttribute('id');
          const classes = await element.getAttribute('class');
          
          logger.info(`    ✅ Found element!`);
          logger.info(`       Tag: ${tagName}`);
          logger.info(`       ID: ${id}`);
          logger.info(`       Text: ${text}`);
          logger.info(`       Classes: ${classes}`);
          
          // Click the element
          logger.info('    🖱️ Clicking Factory Equipment...');
          await element.click();
          
          // Wait for response
          await page.waitForTimeout(2000);
          
          // Check if tab content loaded
          const tabContent = await page.$('#tabs-5');
          if (tabContent) {
            const isVisible = await tabContent.isVisible();
            logger.info(`    ✅ Factory Equipment tab content ${isVisible ? 'is visible' : 'exists but not visible'}`);
            
            // Try to find some content in the tab
            const contentText = await tabContent.textContent();
            logger.info(`    📄 Tab content preview: ${contentText?.substring(0, 100)}...`);
          }
          
          return true;
        }
      } catch (error) {
        logger.info(`    ❌ Error with selector: ${error.message}`);
      }
    }
    
    // If we couldn't find it with selectors, let's inspect what's on the page
    logger.info('\n🔍 Inspecting page structure to find Factory Equipment...');
    
    // Find all links in the tab navigation
    const tabLinks = await page.$$('ul[role="tablist"] a');
    logger.info(`Found ${tabLinks.length} tab links:`);
    
    for (const link of tabLinks) {
      const text = await link.textContent();
      const id = await link.getAttribute('id');
      const href = await link.getAttribute('href');
      logger.info(`  - "${text}" (id: ${id}, href: ${href})`);
    }
    
    return false;
    
  } catch (error) {
    logger.error('❌ Connection error:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function runContinuousTest() {
  logger.info('🚀 Starting continuous Factory Equipment testing...');
  logger.info('📌 Press Ctrl+C to stop\n');
  
  let testCount = 0;
  let successCount = 0;
  
  // Run test every 30 seconds
  const interval = setInterval(async () => {
    testCount++;
    logger.info(`\n========== Test Run #${testCount} ==========`);
    
    const success = await connectAndTest();
    if (success) {
      successCount++;
      logger.info(`✅ Test passed! (${successCount}/${testCount} successful)`);
    } else {
      logger.error(`❌ Test failed! (${successCount}/${testCount} successful)`);
    }
    
    logger.info('⏳ Waiting 30 seconds before next test...\n');
  }, 30000);
  
  // Run first test immediately
  testCount++;
  logger.info(`\n========== Test Run #${testCount} ==========`);
  const firstSuccess = await connectAndTest();
  if (firstSuccess) {
    successCount++;
    logger.info(`✅ Test passed! (${successCount}/${testCount} successful)`);
  } else {
    logger.error(`❌ Test failed! (${successCount}/${testCount} successful)`);
  }
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('\n\n🛑 Stopping continuous test...');
    logger.info(`📊 Final results: ${successCount}/${testCount} tests successful`);
    clearInterval(interval);
    process.exit(0);
  });
}

// Run the continuous test
runContinuousTest();