import { chromium } from 'playwright';
import { Logger } from '../core/utils/Logger';

const logger = new Logger('VehicleClickTest');

async function testVehicleClick() {
  try {
    logger.info('🔌 Connecting to existing browser at http://localhost:9222...');
    
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const contexts = browser.contexts();
    
    if (contexts.length === 0) {
      logger.error('❌ No browser contexts found');
      return;
    }
    
    const page = contexts[0].pages()[0];
    logger.info(`✅ Connected to page: ${await page.title()}`);
    logger.info(`📍 Current URL: ${page.url()}`);
    
    // Check if we're on inventory page
    if (!page.url().includes('/Inventory/')) {
      logger.error('❌ Not on inventory page');
      return;
    }
    
    logger.info('🔍 Looking for vehicle links...');
    
    // The bulletproof selector from the logs
    const vehicleSelector = '//a[contains(@class, "YearMakeModel") and @onclick]';
    
    // Wait for the grid to be loaded
    await page.waitForTimeout(2000);
    
    // Find all vehicle links
    const vehicleLinks = await page.locator(vehicleSelector).all();
    logger.info(`Found ${vehicleLinks.length} vehicle links`);
    
    if (vehicleLinks.length === 0) {
      logger.error('❌ No vehicle links found');
      
      // Debug: Look for any links in the grid
      const allLinks = await page.locator('table a').all();
      logger.info(`Total links in table: ${allLinks.length}`);
      
      for (let i = 0; i < Math.min(5, allLinks.length); i++) {
        const text = await allLinks[i].textContent();
        const classes = await allLinks[i].getAttribute('class');
        logger.info(`  Link ${i}: "${text}" (class: ${classes})`);
      }
      return;
    }
    
    // Get details about the first vehicle link
    const firstLink = vehicleLinks[0];
    const linkText = await firstLink.textContent();
    const linkClasses = await firstLink.getAttribute('class');
    const linkOnclick = await firstLink.getAttribute('onclick');
    
    logger.info(`\n🚗 First vehicle link details:`);
    logger.info(`  Text: "${linkText}"`);
    logger.info(`  Classes: ${linkClasses}`);
    logger.info(`  Onclick: ${linkOnclick}`);
    
    logger.info('\n🖱️ Attempting to click first vehicle...');
    
    // Store current state
    const beforeClickUrl = page.url();
    const beforeModalCount = await page.locator('.x-window').count();
    
    // Try different click methods
    try {
      // Method 1: Normal click
      logger.info('Trying normal click...');
      await firstLink.click({ timeout: 3000 });
    } catch (e) {
      logger.warn('Normal click failed, trying force click...');
      try {
        // Method 2: Force click
        await firstLink.click({ force: true, timeout: 3000 });
      } catch (e2) {
        logger.warn('Force click failed, trying JavaScript click...');
        // Method 3: JavaScript click
        await firstLink.evaluate((el) => (el as HTMLElement).click());
      }
    }
    
    logger.info('✅ Click executed, waiting for response...');
    await page.waitForTimeout(3000);
    
    // Check what happened
    const afterClickUrl = page.url();
    const afterModalCount = await page.locator('.x-window').count();
    
    logger.info('\n📊 Results:');
    logger.info(`  URL changed: ${beforeClickUrl !== afterClickUrl} (${afterClickUrl})`);
    logger.info(`  Modals before: ${beforeModalCount}, after: ${afterModalCount}`);
    
    // Check for vehicle modal
    const modalSelectors = [
      '.x-window',
      '#GaugePageIFrame',
      '//div[contains(@class, "x-window")]',
      '//div[@role="dialog"]',
      '//iframe[@id="GaugePageIFrame"]'
    ];
    
    logger.info('\n🔍 Checking for vehicle modal...');
    for (const selector of modalSelectors) {
      const isVisible = await page.locator(selector).isVisible({ timeout: 1000 }).catch(() => false);
      logger.info(`  ${selector}: ${isVisible ? '✅ VISIBLE' : '❌ Not visible'}`);
    }
    
    // If modal opened, check for Factory Equipment
    if (afterModalCount > beforeModalCount || await page.locator('#GaugePageIFrame').isVisible()) {
      logger.info('\n🎉 Vehicle modal detected! Looking for Factory Equipment link...');
      
      const factoryEquipmentSelectors = [
        'a:has-text("Factory Equipment")',
        '//a[contains(text(), "Factory Equipment")]',
        'text="Factory Equipment"'
      ];
      
      for (const selector of factoryEquipmentSelectors) {
        const element = page.locator(selector);
        if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
          logger.info(`✅ Found Factory Equipment link with selector: ${selector}`);
          
          // Try to click it
          logger.info('🖱️ Clicking Factory Equipment...');
          await element.click();
          await page.waitForTimeout(2000);
          
          // Check for new window
          const pages = page.context().pages();
          logger.info(`📊 Total pages after Factory Equipment click: ${pages.length}`);
          
          for (const p of pages) {
            const title = await p.title();
            const url = p.url();
            logger.info(`  Page: "${title}" - ${url}`);
          }
          
          break;
        }
      }
    }
    
  } catch (error) {
    logger.error('❌ Error:', error instanceof Error ? error.message : String(error));
  }
}

// Run the test
testVehicleClick();