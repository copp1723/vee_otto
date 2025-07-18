#!/usr/bin/env node

import { chromium, Browser, Page } from 'playwright';
import { Logger } from './core/utils/Logger';
import { vAutoSelectors } from './platforms/vauto/vautoSelectors';

const logger = new Logger('FixVehicleClicking');

async function fixVehicleClicking() {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    logger.info('🛠️ Starting vehicle clicking fix...');
    
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 500,
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    
    page = await context.newPage();
    
    // Navigate to inventory
    await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/Vehicles.aspx');
    
    // Robust waiting strategy
    logger.info('⏳ Waiting for page to be fully loaded...');
    
    // Wait for network idle
    await page.waitForLoadState('networkidle');
    
    // Wait for any loading masks to disappear
    await page.waitForSelector('//div[contains(@class, "ext-el-mask")]', { 
      state: 'hidden', 
      timeout: 15000 
    }).catch(() => {});
    
    // Wait for grid to be ready
    await page.waitForSelector(vAutoSelectors.inventory.vehicleRows, { 
      state: 'visible', 
      timeout: 10000 
    });
    
    logger.info('✅ Page loaded successfully');
    
    // Get all vehicle rows
    const rows = await page.$$(vAutoSelectors.inventory.vehicleRows);
    logger.info(`📊 Found ${rows.length} vehicles`);
    
    if (rows.length === 0) {
      throw new Error('No vehicles found');
    }
    
    // Find the first vehicle with a proper link
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      const row = rows[i];
      
      // Look for vehicle links in this row
      const links = await row.$$('a');
      
      for (const link of links) {
        const text = await link.textContent();
        
        // Check if this is a vehicle link (contains year/make/model)
        if (text && text.match(/\d{4}\s+[A-Za-z]/)) {
          logger.info(`🎯 Found vehicle: "${text.trim()}"`);
          
          // Ensure element is ready for interaction
          await link.waitForElementState('stable');
          
          // Scroll into view
          await link.scrollIntoViewIfNeeded();
          
          // Wait a moment for any animations
          await page.waitForTimeout(1000);
          
          // Try multiple click strategies
          const clickStrategies = [
            // Standard click
            async () => {
              await link.click({ timeout: 5000 });
              return 'standard click';
            },
            // Force click
            async () => {
              await link.click({ force: true, timeout: 5000 });
              return 'force click';
            },
            // JavaScript click
            async () => {
              if (!page) throw new Error('Page not available');
              await page.evaluate(el => {
                (el as HTMLElement).click();
              }, link);
              return 'JavaScript click';
            },
            // Double click
            async () => {
              await link.dblclick();
              return 'double click';
            }
          ];
          
          for (const strategy of clickStrategies) {
            try {
              logger.info(`🖱️ Trying ${await strategy()}...`);
              
              // Wait for navigation
              await Promise.race([
                page.waitForURL('**/VehicleDetails.aspx**', { timeout: 10000 }),
                page.waitForURL('**/Vehicle/**', { timeout: 10000 }),
                page.waitForLoadState('networkidle', { timeout: 5000 })
              ]);
              
              logger.info('✅ Navigation successful!');
              
              // Verify we're on a different page
              const newUrl = page.url();
              if (!newUrl.includes('Vehicles.aspx')) {
                logger.info(`✅ Successfully navigated to: ${newUrl}`);
                
                // Take success screenshot
                await page.screenshot({ path: 'fix-success.png', fullPage: true });
                
                return; // Success!
              }
              
            } catch (error) {
              logger.warn(`❌ Strategy failed: ${error}`);
            }
          }
          
          // If we get here, all strategies failed for this link
          logger.error(`❌ All click strategies failed for: "${text}"`);
          
        }
      }
    }
    
    // If no vehicle links found, try clicking the first cell
    logger.info('🔄 Trying first cell click as fallback...');
    
    const firstRow = rows[0];
    const firstCell = await firstRow.$('td');
    
    if (firstCell) {
      try {
        await firstCell.scrollIntoViewIfNeeded();
        await firstCell.click({ force: true });
        
        await Promise.race([
          page.waitForURL('**/VehicleDetails.aspx**', { timeout: 10000 }),
          page.waitForURL('**/Vehicle/**', { timeout: 10000 }),
          page.waitForLoadState('networkidle', { timeout: 5000 })
        ]);
        
        logger.info('✅ Cell click successful!');
        
      } catch (error) {
        logger.error(`❌ Cell click also failed: ${error}`);
      }
    }
    
    // Final state
    const finalUrl = page.url();
    logger.info(`📍 Final URL: ${finalUrl}`);
    
    if (finalUrl.includes('Vehicles.aspx')) {
      logger.error('❌ Still on inventory page - click failed');
      await page.screenshot({ path: 'fix-failed.png', fullPage: true });
    } else {
      logger.info('✅ Successfully navigated away from inventory');
    }
    
  } catch (error) {
    logger.error('❌ Fix failed:', error);
    if (page) await page.screenshot({ path: 'fix-error.png', fullPage: true });
  } finally {
    if (browser) await browser.close();
  }
}

fixVehicleClicking().catch(console.error);