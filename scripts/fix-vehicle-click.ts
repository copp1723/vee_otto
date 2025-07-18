// Simple fix for vehicle clicking in VAuto

export async function clickVehicleLink(page: any, logger: any) {
  logger.info('🎯 Attempting to click vehicle...');
  
  // Wait a bit for page to settle
  await page.waitForTimeout(3000);
  
  // Find first vehicle row
  const firstRow = page.locator('tr.x-grid3-row').first();
  
  // Look for the anchor tag with year pattern (like "2016 Dodge...")
  const vehicleLink = firstRow.locator('a').filter({ hasText: /^\d{4}\s+/ }).first();
  
  try {
    // Check if we found it
    if (await vehicleLink.isVisible()) {
      const text = await vehicleLink.textContent();
      logger.info(`✅ Found vehicle link: "${text}"`);
      
      // Click it
      await vehicleLink.click();
      logger.info('✅ Clicked vehicle link');
      
      // Wait for navigation
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      return true;
    }
  } catch (e) {
    logger.error('Failed with Playwright click, trying JavaScript click...');
  }
  
  // Fallback: JavaScript click
  const clicked = await page.evaluate(() => {
    const rows = document.querySelectorAll('tr.x-grid3-row');
    if (rows.length === 0) return false;
    
    const firstRow = rows[0];
    const links = firstRow.querySelectorAll('a');
    
    for (const link of links) {
      const text = link.textContent || '';
      if (text.match(/^\d{4}\s+/)) {
        (link as HTMLElement).click();
        return true;
      }
    }
    return false;
  });
  
  if (clicked) {
    logger.info('✅ JavaScript click successful');
    await page.waitForTimeout(5000);
    return true;
  }
  
  logger.error('❌ Could not click vehicle');
  return false;
} 