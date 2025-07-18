import { Page } from 'playwright';
import { Logger } from './core/utils/Logger';

const logger = new Logger('VehicleClickHelper');

/**
 * Enhanced vehicle clicking helper function
 * Tries multiple strategies to click on vehicle links
 */
export async function clickVehicleLink(page: Page, vehicleIndex: number = 0): Promise<boolean> {
  try {
    logger.info(`🎯 Attempting to click vehicle ${vehicleIndex + 1}...`);
    
    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Strategy: Iterate over all <a> links in the target row
    const vehicleRows = await page.$$('//tr[contains(@class, "x-grid3-row")]');
    
    if (vehicleRows.length === 0) {
      logger.warn('❌ No vehicle rows found with primary selector');
      return false;
    }
    
    if (vehicleIndex >= vehicleRows.length) {
      logger.warn(`❌ Vehicle index ${vehicleIndex} out of range (${vehicleRows.length} vehicles found)`);
      return false;
    }
    
    const targetRow = vehicleRows[vehicleIndex];
    const currentUrl = page.url();
    
    logger.info(`✅ Found vehicle row ${vehicleIndex + 1} of ${vehicleRows.length}`);
    
    const links = await targetRow.$$('a');
    if (links.length === 0) {
      logger.warn('❌ No links found inside the target row');
      return false;
    }
    
    for (const link of links) {
      try {
        const visible = await link.isVisible();
        const enabled = await link.isEnabled();
        const box = await link.boundingBox();
        const href = await link.getAttribute('href');
        const linkText = (await link.textContent())?.trim() || '';
        
        if (!visible || !enabled || !box || box.width === 0 || box.height === 0 || !href) {
          continue;
        }
        
        logger.info(`🔗 Trying link: text="${linkText}", href="${href}", boundingBox=${JSON.stringify(box)}`);
        
        // Try .click()
        try {
          await link.scrollIntoViewIfNeeded();
          await link.click({ timeout: 5000 });
        } catch {
          // Fallback to JS click
          try {
            await page.evaluate((el) => { (el as HTMLElement).click(); }, link);
          } catch {
            // Fallback to mouse click at center of bounding box
            try {
              await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
              await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            } catch (e) {
              logger.debug(`Fallback mouse click failed: ${e}`);
              continue;
            }
          }
        }
        
        // Wait a bit for navigation
        await page.waitForTimeout(2000);
        const newUrl = page.url();
        
        if (newUrl !== currentUrl) {
          logger.info(`✅ Navigation successful after clicking link! URL changed to: ${newUrl}`);
          return true;
        } else {
          logger.warn('⚠️ Click succeeded but no navigation detected, trying next link if any');
        }
      } catch (e) {
        logger.debug(`Error clicking link: ${e}`);
        // Try next link
      }
    }
    
    logger.error('❌ All links in target row failed to navigate');
    return false;
    
  } catch (error) {
    logger.error('❌ Vehicle click failed:', error);
    return false;
  }
}

/**
 * Get vehicle count on current page
 */
export async function getVehicleCount(page: Page): Promise<number> {
  try {
    const vehicleRows = await page.$$('//tr[contains(@class, "x-grid3-row")]');
    return vehicleRows.length;
  } catch (error) {
    logger.error('Failed to get vehicle count:', error);
    return 0;
  }
}

/**
 * Get vehicle details for debugging
 */
export async function getVehicleDetails(page: Page, vehicleIndex: number = 0): Promise<any> {
  try {
    const vehicleRows = await page.$$('//tr[contains(@class, "x-grid3-row")]');
    
    if (vehicleIndex >= vehicleRows.length) {
      return null;
    }
    
    const row = vehicleRows[vehicleIndex];
    const text = await row.textContent();
    const tagName = await row.evaluate(el => el.tagName);
    const className = await row.getAttribute('class');
    const isVisible = await row.isVisible();
    
    // Get link details
    const link = await row.$('a');
    let linkDetails: any = null;
    if (link) {
      const linkText = await link.textContent();
      const href = await link.getAttribute('href');
      const onclick = await link.getAttribute('onclick');
      const linkVisible = await link.isVisible();
      const linkEnabled = await link.isEnabled();
      
      linkDetails = {
        text: linkText?.trim(),
        href,
        onclick,
        visible: linkVisible,
        enabled: linkEnabled
      };
    }
    
    return {
      index: vehicleIndex,
      text: text?.substring(0, 200),
      tagName,
      className,
      visible: isVisible,
      link: linkDetails
    };
  } catch (error) {
    logger.error('Failed to get vehicle details:', error);
    return null;
  }
}