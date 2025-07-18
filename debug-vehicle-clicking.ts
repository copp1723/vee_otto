import { chromium, Browser, Page } from 'playwright';
import { Logger } from './core/utils/Logger';
import { vAutoSelectors } from './platforms/vauto/vautoSelectors';

const logger = new Logger('VehicleClickingDebug');

async function debugVehicleClicking() {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    logger.info('🚀 Starting vehicle clicking debug...');
    
    // Launch browser and connect to existing session
    browser = await chromium.launch({ 
      headless: false,
      args: ['--remote-debugging-port=9222']
    });
    
    // Connect to existing browser session if available
    const contexts = browser.contexts();
    if (contexts.length > 0) {
      page = contexts[0].pages()[0];
      logger.info('✅ Connected to existing browser session');
    } else {
      page = await browser.newPage();
      logger.info('📄 Created new page');
    }
    
    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    logger.info(`📍 Current URL: ${currentUrl}`);
    
    // Take screenshot of current state
    await page.screenshot({ path: 'debug-vehicle-clicking-current.png', fullPage: true });
    
    // Debug: Check for vehicle rows
    logger.info('🔍 Checking for vehicle rows...');
    
    const vehicleRowSelectors = [
      vAutoSelectors.inventory.vehicleRows,
      '//tr[contains(@class, "x-grid3-row")]',
      '//div[contains(@class, "x-grid3-row")]',
      '//table//tr',
      '//div[contains(@class, "vehicle-row")]'
    ];
    
    for (const selector of vehicleRowSelectors) {
      try {
        const elements = await page.$$(selector);
        logger.info(`🔍 Selector "${selector}": Found ${elements.length} elements`);
        
        if (elements.length > 0) {
          // Get details of first few elements
          for (let i = 0; i < Math.min(3, elements.length); i++) {
            const element = elements[i];
            const text = await element.textContent();
            const tagName = await element.evaluate(el => el.tagName);
            const className = await element.getAttribute('class');
            const isVisible = await element.isVisible();
            
            logger.info(`  Element ${i}: tag=${tagName}, class="${className}", visible=${isVisible}, text="${text?.substring(0, 100)}..."`);
          }
        }
      } catch (e) {
        logger.warn(`❌ Selector "${selector}" failed: ${e}`);
      }
    }
    
    // Debug: Check for vehicle links specifically
    logger.info('🔍 Checking for vehicle links...');
    
    const vehicleLinkSelectors = [
      vAutoSelectors.inventory.vehicleLink,
      vAutoSelectors.inventory.vehicleNameLink,
      vAutoSelectors.inventory.vehicleLinkInGrid,
      '//a[contains(@href, "javascript")]',
      '//a[contains(@onclick, "javascript")]',
      '//tr//a',
      '//td//a'
    ];
    
    for (const selector of vehicleLinkSelectors) {
      try {
        const elements = await page.$$(selector);
        logger.info(`🔍 Link selector "${selector}": Found ${elements.length} elements`);
        
        if (elements.length > 0) {
          // Get details of first few links
          for (let i = 0; i < Math.min(3, elements.length); i++) {
            const element = elements[i];
            const text = await element.textContent();
            const href = await element.getAttribute('href');
            const onclick = await element.getAttribute('onclick');
            const isVisible = await element.isVisible();
            const isEnabled = await element.isEnabled();
            
            logger.info(`  Link ${i}: text="${text?.trim()}", href="${href}", onclick="${onclick}", visible=${isVisible}, enabled=${isEnabled}`);
          }
        }
      } catch (e) {
        logger.warn(`❌ Link selector "${selector}" failed: ${e}`);
      }
    }
    
    // Debug: Try to click the first vehicle link if found
    logger.info('🔍 Attempting to click first vehicle link...');
    
    const firstVehicleRow = await page.$(vAutoSelectors.inventory.vehicleRows);
    if (firstVehicleRow) {
      logger.info('✅ Found first vehicle row, attempting to click...');
      
      // Try multiple click strategies
      const clickStrategies = [
        // Strategy 1: Click the link inside the row
        async () => {
          const link = await firstVehicleRow.$('a');
          if (link) {
            await link.click();
            logger.info('✅ Clicked link inside row');
            return true;
          }
          return false;
        },
        
        // Strategy 2: Click the entire row
        async () => {
          await firstVehicleRow.click();
          logger.info('✅ Clicked entire row');
          return true;
        },
        
        // Strategy 3: Use JavaScript click
        async () => {
          await page!.evaluate((el) => {
            const link = el.querySelector('a');
            if (link) (link as HTMLElement).click();
          }, firstVehicleRow);
          logger.info('✅ Used JavaScript click');
          return true;
        },
        
        // Strategy 4: Click first column
        async () => {
          const firstCell = await firstVehicleRow.$('td:first-child');
          if (firstCell) {
            await firstCell.click();
            logger.info('✅ Clicked first cell');
            return true;
          }
          return false;
        }
      ];
      
      for (const strategy of clickStrategies) {
        try {
          const success = await strategy();
          if (success) {
            logger.info('🎯 Vehicle click successful!');
            break;
          }
        } catch (e) {
          logger.warn(`❌ Click strategy failed: ${e}`);
        }
      }
      
      // Wait to see if navigation happened
      await page.waitForTimeout(3000);
      const newUrl = page.url();
      logger.info(`📍 URL after click attempt: ${newUrl}`);
      
      if (newUrl !== currentUrl) {
        logger.info('✅ Navigation successful!');
      } else {
        logger.warn('⚠️ No navigation detected');
      }
      
    } else {
      logger.error('❌ No vehicle rows found');
    }
    
    // Take screenshot after attempts
    await page.screenshot({ path: 'debug-vehicle-clicking-after.png', fullPage: true });
    
    logger.info('🔍 Debug complete - check screenshots for visual analysis');
    
    // Keep browser open for manual inspection
    logger.info('⏳ Keeping browser open for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    logger.error('❌ Debug failed:', error);
  } finally {
    if (browser) await browser.close();
  }
}

// Run the debug
debugVehicleClicking().catch(console.error); 