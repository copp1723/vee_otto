import { chromium } from 'playwright';
import { vAutoSelectors } from './platforms/vauto/vautoSelectors';
import { Logger } from './core/utils/Logger';

async function debugVehicleCount() {
  const logger = new Logger('VehicleCountDebug');
  logger.info('🔍 Debugging Vehicle Count Issue...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 
  });
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    logger.info('📋 Instructions:');
    logger.info('1. Navigate to the VAuto inventory page with vehicles shown');
    logger.info('2. Press Enter in this terminal to analyze the page\n');
    
    logger.info('Waiting for you to set up the page...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
    logger.info('\n🔍 Analyzing vehicle grid structure...\n');
    
    // Try the current selector
    const currentSelector = vAutoSelectors.inventory.vehicleRows;
    const vehicleCount = await page.locator(currentSelector).count();
    logger.info(`Current selector: ${currentSelector}`);
    logger.info(`Vehicle count: ${vehicleCount}`);
    
    // Try alternative selectors
    const alternativeSelectors = [
      '//tr[contains(@class, "x-grid3-row")]',
      '//tr[contains(@class, "x-grid-row")]',
      '//tr[@class="x-grid3-row"]',
      '//div[contains(@class, "x-grid3-row")]',
      '//div[contains(@class, "x-grid-row")]',
      '//table//tbody//tr[position() > 1]', // Skip header row
      '//div[@id="ext-gen52"]//tr[contains(@class, "row")]',
      '//div[contains(@class, "x-grid3")]//tr[contains(@class, "row")]',
      '//tr[contains(@id, "ext-gen")]',
      '//tr[contains(@class, "x-grid3-row-body")]',
      '//div[contains(@class, "x-grid3-scroller")]//tr'
    ];
    
    logger.info('\n🔍 Trying alternative selectors...');
    for (const selector of alternativeSelectors) {
      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          logger.info(`✅ ${selector} => ${count} items`);
        } else {
          logger.info(`❌ ${selector} => 0 items`);
        }
      } catch (e) {
        logger.info(`❌ ${selector} => Error`);
      }
    }
    
    // Try to find all table rows
    logger.info('\n🔍 Analyzing all table rows...');
    const allRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      return rows.map((row, index) => ({
        index,
        className: row.className,
        id: row.id,
        text: row.textContent?.substring(0, 50) + '...',
        childCount: row.children.length,
        hasVehicleData: row.textContent?.includes('Volvo') || row.textContent?.includes('Chevrolet') || row.textContent?.includes('Ford')
      })).filter(r => r.childCount > 3); // Filter rows with multiple cells
    });
    
    logger.info(`Found ${allRows.length} table rows with multiple cells:`);
    allRows.slice(0, 10).forEach(row => {
      if (row.hasVehicleData) {
        logger.info(`  Row ${row.index}: class="${row.className}" id="${row.id}" - LIKELY VEHICLE ROW`);
      } else {
        logger.info(`  Row ${row.index}: class="${row.className}" id="${row.id}"`);
      }
    });
    
    // Check for ExtJS grid structure
    logger.info('\n🔍 Checking for ExtJS grid components...');
    const gridInfo = await page.evaluate(() => {
      const grids = Array.from(document.querySelectorAll('[class*="x-grid"]'));
      return grids.map(grid => ({
        tagName: grid.tagName,
        className: grid.className,
        id: grid.id,
        childCount: grid.children.length
      }));
    });
    
    logger.info(`Found ${gridInfo.length} grid components:`);
    gridInfo.forEach(grid => {
      logger.info(`  ${grid.tagName}: class="${grid.className}" id="${grid.id}" children=${grid.childCount}`);
    });
    
    // Look for the specific vehicle data
    logger.info('\n🔍 Looking for vehicle-specific elements...');
    const vehicleElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements
        .filter(el => el.textContent?.includes('2025 Volvo XC40') || el.textContent?.includes('VIN:'))
        .slice(0, 5)
        .map(el => ({
          tagName: el.tagName,
          className: el.className,
          parentClass: el.parentElement?.className,
          grandParentClass: el.parentElement?.parentElement?.className
        }));
    });
    
    logger.info('Elements containing vehicle data:');
    vehicleElements.forEach(el => {
      logger.info(`  ${el.tagName}: class="${el.className}"`);
      logger.info(`    Parent: ${el.parentClass}`);
      logger.info(`    GrandParent: ${el.grandParentClass}`);
    });
    
    logger.info('\n✅ Debug analysis complete!');
    logger.info('Press Enter to close browser...');
    
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
  } catch (error) {
    logger.error('Debug failed:', error);
  } finally {
    await browser.close();
  }
}

debugVehicleCount().catch(console.error); 