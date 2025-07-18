#!/usr/bin/env node

import { chromium, Browser, Page } from 'playwright';
import { Logger } from './core/utils/Logger';
import { vAutoSelectors } from './platforms/vauto/vautoSelectors';

const logger = new Logger('SimpleVehicleClickingDebug');

async function debugVehicleClicking() {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    logger.info('🚀 Starting simple vehicle clicking debug...');
    
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 1000,
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    
    page = await context.newPage();
    
    // Navigate to inventory
    await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/Vehicles.aspx');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    logger.info(`📍 Current URL: ${currentUrl}`);
    
    // Wait for any loading to complete
    await page.waitForSelector('//div[contains(@class, "ext-el-mask")]', { state: 'hidden', timeout: 10000 }).catch(() => {});
    
    // Take initial screenshot
    await page.screenshot({ path: 'debug-simple-initial.png', fullPage: true });
    
    // Find vehicle rows
    const rows = await page.$$(vAutoSelectors.inventory.vehicleRows);
    logger.info(`📊 Found ${rows.length} vehicle rows`);
    
    if (rows.length === 0) {
      logger.error('❌ No vehicle rows found');
      return;
    }
    
    // Focus on first row
    const firstRow = rows[0];
    
    // Get row details
    const rowText = await firstRow.textContent();
    logger.info(`📋 First row text: "${rowText?.substring(0, 200)}..."`);
    
    // Find all links in first row
    const links = await firstRow.$$('a');
    logger.info(`🔗 Found ${links.length} links in first row`);
    
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const text = await link.textContent();
      const href = await link.getAttribute('href');
      const onclick = await link.getAttribute('onclick');
      
      logger.info(`  Link ${i}: "${text}" | href: "${href}" | onclick: ${onclick ? 'YES' : 'NO'}`);
      
      // Check if this looks like a vehicle link
      if (text && text.match(/\d{4}\s+[A-Za-z]/)) {
        logger.info(`🎯 VEHICLE LINK FOUND: "${text}"`);
        
        // Check element state
        const isVisible = await link.isVisible();
        const isEnabled = await link.isEnabled();
        const boundingBox = await link.boundingBox();
        
        logger.info(`  State: visible=${isVisible}, enabled=${isEnabled}`);
        logger.info(`  Position: ${JSON.stringify(boundingBox)}`);
        
        // Scroll into view
        await link.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);
        
        // Highlight
        await page.evaluate(el => {
          el.style.border = '3px solid red';
          el.style.backgroundColor = 'yellow';
        }, link);
        
        await page.waitForTimeout(2000);
        
        // Try clicking
        try {
          logger.info('🖱️ Attempting click...');
          await link.click({ timeout: 5000 });
          logger.info('✅ Click successful!');
          
          // Wait for navigation
          await page.waitForTimeout(5000);
          const newUrl = page.url();
          
          if (newUrl !== currentUrl) {
            logger.info(`✅ Navigation successful! New URL: ${newUrl}`);
          } else {
            logger.warn('⚠️ No navigation detected');
          }
          
          break;
          
        } catch (error) {
          logger.error(`❌ Click failed: ${error}`);
          
          // Try JavaScript click
          try {
            logger.info('🔄 Trying JavaScript click...');
            await page.evaluate(el => (el as HTMLElement).click(), link);
            logger.info('✅ JavaScript click executed');
            
            await page.waitForTimeout(5000);
            const newUrl = page.url();
            if (newUrl !== currentUrl) {
              logger.info(`✅ Navigation successful! New URL: ${newUrl}`);
            }
            
          } catch (jsError) {
            logger.error(`❌ JavaScript click also failed: ${jsError}`);
          }
        }
        
        break;
      }
    }
    
    // Final screenshot
    await page.screenshot({ path: 'debug-simple-final.png', fullPage: true });
    
    logger.info('🔍 Debug complete - check screenshots');
    
    // Keep browser open
    await new Promise(() => {});
    
  } catch (error) {
    logger.error('❌ Debug failed:', error);
    if (page) await page.screenshot({ path: 'debug-simple-error.png', fullPage: true });
  } finally {
    if (browser) await browser.close();
  }
}

debugVehicleClicking().catch(console.error);