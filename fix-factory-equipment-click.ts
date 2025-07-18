import { Page } from 'playwright';

/**
 * Enhanced Factory Equipment click handler with multiple fallback strategies
 */
export async function clickFactoryEquipment(page: Page, logger: any): Promise<boolean> {
  logger.info('🏭 Attempting to click Factory Equipment tab...');
  
  // Strategy 1: Try the exact table ID first (most reliable)
  try {
    logger.info('Strategy 1: Direct table ID selector #factory-equipment');
    const tableSelector = page.locator('#factory-equipment');
    if (await tableSelector.isVisible({ timeout: 3000 })) {
      await tableSelector.click();
      logger.info('✅ Clicked using table ID selector');
      await page.waitForTimeout(2000);
      return true;
    }
  } catch (e) {
    logger.debug('Table ID selector failed:', e);
  }
  
  // Strategy 1b: Try clicking the button inside the table
  try {
    logger.info('Strategy 1b: Button inside table selector');
    const buttonSelector = page.locator('#factory-equipment button');
    if (await buttonSelector.isVisible({ timeout: 3000 })) {
      await buttonSelector.click();
      logger.info('✅ Clicked button inside table');
      await page.waitForTimeout(2000);
      return true;
    }
  } catch (e) {
    logger.debug('Button in table selector failed:', e);
  }
  
  // Strategy 2: Try iframe approach
  try {
    logger.info('Strategy 2: Checking iframe');
    const iframe = page.frameLocator('#GaugePageIFrame');
    const tabInFrame = iframe.locator('text="Factory Equipment"').first();
    
    if (await tabInFrame.isVisible({ timeout: 3000 })) {
      await tabInFrame.click();
      logger.info('✅ Clicked Factory Equipment in iframe');
      await page.waitForTimeout(2000);
      return true;
    }
  } catch (e) {
    logger.debug('Iframe approach failed:', e);
  }
  
  // Strategy 3: Try by tab position (usually 3rd or 4th tab)
  try {
    logger.info('Strategy 3: Position-based click');
    const tabs = await page.locator('//ul[contains(@class, "x-tab-strip")]//a').all();
    logger.info(`Found ${tabs.length} tabs`);
    
    for (let i = 2; i < Math.min(tabs.length, 5); i++) {
      const tabText = await tabs[i].textContent();
      logger.info(`Tab ${i}: "${tabText?.trim()}"`);
      
      if (tabText?.toLowerCase().includes('factory')) {
        await tabs[i].click();
        logger.info(`✅ Clicked Factory Equipment at position ${i}`);
        await page.waitForTimeout(2000);
        return true;
      }
    }
  } catch (e) {
    logger.debug('Position-based approach failed:', e);
  }
  
  // Strategy 4: Try ExtJS-specific selectors  
  try {
    logger.info('Strategy 4: ExtJS selectors (using exact IDs from HTML)');
    const extJsSelectors = [
      '#factory-equipment', // The table ID from HTML
      '#ext-gen191', // The exact button ID from HTML
      '//table[@id="factory-equipment"]',
      '//button[@id="ext-gen191"]',
      '//table[@id="factory-equipment"]//button[@id="ext-gen191"]',
      'button.x-btn-text'
    ];
    
    for (const selector of extJsSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          await element.click();
          logger.info(`✅ Clicked using ExtJS selector: ${selector}`);
          await page.waitForTimeout(2000);
          return true;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
  } catch (e) {
    logger.debug('ExtJS selectors failed:', e);
  }
  
  // Strategy 5: JavaScript click with fuzzy text matching
  try {
    logger.info('Strategy 5: JavaScript fuzzy click');
    const clicked = await page.evaluate(() => {
      // Find any element containing "Factory" and "Equipment"
      const elements = Array.from(document.querySelectorAll('*'));
      for (const el of elements) {
        const text = el.textContent || '';
        if (text.includes('Factory') && text.includes('Equipment') && 
            !text.includes('View Factory') && // Avoid buttons
            el.children.length === 0) { // Leaf nodes only
          (el as HTMLElement).click();
          return true;
        }
      }
      return false;
    });
    
    if (clicked) {
      logger.info('✅ Clicked using JavaScript fuzzy match');
      await page.waitForTimeout(2000);
      return true;
    }
  } catch (e) {
    logger.debug('JavaScript click failed:', e);
  }
  
  // Strategy 6: Look for any clickable element with Factory Equipment
  try {
    logger.info('Strategy 6: Any clickable element');
    const clickableSelectors = [
      '//a[contains(., "Factory Equipment")]',
      '//button[contains(., "Factory Equipment")]',
      '//div[@role="button" and contains(., "Factory Equipment")]',
      '//span[contains(., "Factory Equipment")]/parent::*[@onclick]',
      '//*[@onclick and contains(., "Factory Equipment")]'
    ];
    
    for (const selector of clickableSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          await element.click();
          logger.info(`✅ Clicked using selector: ${selector}`);
          await page.waitForTimeout(2000);
          return true;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
  } catch (e) {
    logger.debug('Clickable element search failed:', e);
  }
  
  logger.error('❌ All Factory Equipment click strategies failed');
  return false;
}

// Export for use in VAutoTasks
export default clickFactoryEquipment; 