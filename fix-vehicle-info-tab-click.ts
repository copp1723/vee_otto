import { Page } from 'playwright';

/**
 * Ensure we're on the Vehicle Info tab before proceeding
 */
export async function ensureVehicleInfoTab(page: Page, logger: any): Promise<boolean> {
  logger.info('🔍 Checking if we need to click Vehicle Info tab...');
  
  try {
    // Check if we're already on Vehicle Info tab (look for active state)
    const activeTab = await page.locator('//div[contains(@class, "x-tab-strip-active")]//span[contains(text(), "Vehicle Info")]').first();
    if (await activeTab.isVisible({ timeout: 2000 })) {
      logger.info('✅ Already on Vehicle Info tab');
      return true;
    }
  } catch (e) {
    logger.debug('Not currently on Vehicle Info tab');
  }
  
  // Click Vehicle Info tab
  logger.info('📋 Need to click Vehicle Info tab first...');
  
  const tabSelectors = [
    // Try text-based selectors first
    'text="Vehicle Info"',
    'text="VEHICLE INFO"',
    '//span[contains(text(), "Vehicle Info")]',
    '//span[contains(text(), "VEHICLE INFO")]',
    '//a[contains(text(), "Vehicle Info")]',
    '//div[contains(@class, "x-tab")]//span[contains(text(), "Vehicle Info")]',
    // Try position-based (usually first tab)
    '//ul[contains(@class, "x-tab-strip")]//li[1]//a',
    '//ul[contains(@class, "x-tab-strip")]//li[1]//span'
  ];
  
  for (const selector of tabSelectors) {
    try {
      logger.info(`Trying selector: ${selector}`);
      const tab = page.locator(selector).first();
      
      if (await tab.isVisible({ timeout: 2000 })) {
        const tabText = await tab.textContent();
        logger.info(`Found tab with text: "${tabText?.trim()}"`);
        
        if (tabText?.toLowerCase().includes('vehicle info')) {
          await tab.click();
          logger.info('✅ Clicked Vehicle Info tab');
          await page.waitForTimeout(2000); // Wait for tab content to load
          
          // Verify we're now on Vehicle Info tab
          const nowActive = await page.locator('//div[contains(@class, "x-tab-strip-active")]//span[contains(text(), "Vehicle Info")]').first();
          if (await nowActive.isVisible({ timeout: 3000 })) {
            logger.info('✅ Successfully switched to Vehicle Info tab');
            return true;
          }
        }
      }
    } catch (e) {
      logger.debug(`Selector ${selector} failed:`, e);
    }
  }
  
  // Last resort: Click first tab
  try {
    logger.info('Trying to click first tab as last resort...');
    const firstTab = page.locator('//ul[contains(@class, "x-tab-strip")]//li[1]').first();
    await firstTab.click();
    await page.waitForTimeout(2000);
    logger.info('Clicked first tab');
    return true;
  } catch (e) {
    logger.error('Failed to click any tab');
  }
  
  return false;
}

/**
 * Complete flow: Ensure Vehicle Info tab is active, then click Factory Equipment
 */
export async function clickFactoryEquipmentWithTabCheck(page: Page, logger: any): Promise<boolean> {
  // First ensure we're on Vehicle Info tab
  const onVehicleInfo = await ensureVehicleInfoTab(page, logger);
  
  if (!onVehicleInfo) {
    logger.error('❌ Failed to navigate to Vehicle Info tab');
    return false;
  }
  
  // Now click Factory Equipment
  logger.info('🏭 Now clicking Factory Equipment button...');
  
  // Use the exact selectors from the HTML provided
  const factorySelectors = [
    '#ext-gen199', // Exact button ID confirmed by user
    '#factory-equipment', // Table ID
    '#ext-gen191', // Alternative Button ID
    '//button[@id="ext-gen199"]',
    'text="Factory Equipment"',
    '//table[@id="factory-equipment"]//button',
    '//button[@id="ext-gen191"]',
    '//button[contains(text(), "Factory Equipment")]',
    '//table[@id="factory-equipment"]'
  ];
  
  for (const selector of factorySelectors) {
    try {
      logger.info(`Trying Factory Equipment selector: ${selector}`);
      const element = page.locator(selector).first();
      
      if (await element.isVisible({ timeout: 3000 })) {
        await element.scrollIntoViewIfNeeded();
        await element.click();
        logger.info(`✅ Clicked Factory Equipment using selector: ${selector}`);
        await page.waitForTimeout(3000);
        
        // Check for new window
        const pages = page.context().pages();
        logger.info(`Context now has ${pages.length} pages`);
        
        for (const p of pages) {
          const title = await p.title();
          if (title === 'factory-equipment-details' || title.includes('factory')) {
            logger.info('✅ Factory Equipment window opened!');
            return true;
          }
        }
        
        return true;
      }
    } catch (e) {
      logger.debug(`Selector ${selector} failed:`, e);
    }
  }
  
  logger.error('❌ Failed to click Factory Equipment button');
  return false;
}

export default clickFactoryEquipmentWithTabCheck; 