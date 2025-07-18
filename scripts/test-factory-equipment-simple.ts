#!/usr/bin/env node

import { chromium, Browser, Page } from 'playwright';
import { clickFactoryEquipmentWithTabCheck } from '../fix-vehicle-info-tab-click';

// Simple logger
const log = (...args: any[]) => console.log('[FactoryTest]', ...args);

async function testFactoryEquipmentAutomation() {
  let browser: Browser | null = null;
  
  try {
    log('🚀 Testing Factory Equipment Automation');
    log('💡 This will connect to your existing browser session');
    
    // Try to connect to existing browser on common debugging ports
    const ports = [9222, 9223, 9224];
    let connected = false;
    
    for (const port of ports) {
      try {
        log(`Trying to connect to browser on port ${port}...`);
        browser = await chromium.connectOverCDP(`http://localhost:${port}`);
        log(`✅ Connected to browser on port ${port}`);
        connected = true;
        break;
      } catch (error) {
        log(`❌ Port ${port} not available`);
      }
    }
    
    if (!connected) {
      log('🌐 No existing browser found, launching new one...');
      browser = await chromium.launch({
        headless: false,
        slowMo: 1000,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--remote-debugging-port=9222'
        ]
      });
      
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
      });
      
      const page = await context.newPage();
      await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/');
      
      log('⚠️  Please manually log in and navigate to a vehicle modal, then run this script again');
      
      // Keep browser open for manual login
      log('🔓 Browser will stay open for 5 minutes for manual login...');
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
      return;
    }
    
    // Get all pages from all contexts
    const contexts = browser!.contexts();
    const allPages: Page[] = [];
    
    for (const context of contexts) {
      allPages.push(...context.pages());
    }
    
    if (allPages.length === 0) {
      log('❌ No pages found in browser session');
      return;
    }
    
    // Find a VAuto page
    let targetPage: Page | undefined = allPages.find(page => {
      const url = page.url();
      return url.includes('vauto') || url.includes('provision') || url.includes('inventory');
    });
    
    if (!targetPage) {
      log('⚠️  No VAuto page found, using first available page');
      targetPage = allPages[0];
    }
    
    log(`📍 Using page: ${targetPage.url()}`);
    
    // Check if we're on a vehicle modal
    try {
      const modalVisible = await targetPage.locator('.x-window').isVisible({ timeout: 2000 });
      if (!modalVisible) {
        log('⚠️  No vehicle modal detected. Please:');
        log('   1. Navigate to VAuto inventory');
        log('   2. Click on a vehicle to open the modal');
        log('   3. Run this script again');
        return;
      }
      log('✅ Vehicle modal detected!');
    } catch (error) {
      log('⚠️  Could not detect vehicle modal, proceeding anyway...');
    }
    
    // Test the factory equipment automation
    log('🏭 Testing Factory Equipment automation...');
    
    try {
      const result = await clickFactoryEquipmentWithTabCheck(targetPage, log);
      
      if (result) {
        log('🎉 SUCCESS: Factory Equipment automation completed!');
        log('✅ Your test harness is working correctly');
      } else {
        log('❌ FAILED: Factory Equipment automation did not complete');
        log('💡 This might be expected if no Factory Equipment button exists on this vehicle');
      }
    } catch (error) {
      log('❌ ERROR during Factory Equipment automation:', error);
    }
    
  } catch (error) {
    log('❌ Test failed:', error);
  } finally {
    // Don't close the browser - leave it for the user
    log('🔓 Leaving browser open for continued testing');
    log('✅ Test complete');
  }
}

// Run the test
testFactoryEquipmentAutomation().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});