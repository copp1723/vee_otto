#!/usr/bin/env node

import { chromium } from 'playwright';
import * as fs from 'fs-extra';

async function testFactoryEquipment() {
  console.log('🚀 Starting Factory Equipment Test...');

  try {
    // Check for session file
    const wsEndpointFile = './session/browser-ws-endpoint.txt';
    
    if (!await fs.pathExists(wsEndpointFile)) {
      console.error('❌ No active session found. Run "npm run vauto:session" first.');
      process.exit(1);
    }

    // Connect to existing browser
    const wsEndpoint = (await fs.readFile(wsEndpointFile, 'utf-8')).trim();
    console.log('🔌 Connecting to browser...');
    
    const browser = await chromium.connectOverCDP(wsEndpoint);
    console.log('✅ Connected to browser');
    
    // Get existing page
    const contexts = browser.contexts();
    console.log(`📊 Found ${contexts.length} contexts`);
    
    if (contexts.length === 0) {
      throw new Error('No browser contexts found');
    }
    
    const pages = contexts[0].pages();
    console.log(`📊 Found ${pages.length} pages`);
    
    if (pages.length === 0) {
      throw new Error('No pages found');
    }
    
    // Use the first page
    const page = pages[0];
    console.log(`📄 Using page: ${page.url()}`);
    
    // Check if modal is visible
    try {
      await page.waitForSelector('.x-window', { state: 'visible', timeout: 5000 });
      console.log('✅ Modal is visible');
    } catch (e) {
      console.log('❌ Modal not visible. Please open a vehicle modal first.');
      return;
    }
    
    // Step 1: Check if we're on Vehicle Info tab
    console.log('\n📋 Step 1: Checking current tab...');
    
    const factoryButton = page.locator('#ext-gen199');
    const isOnVehicleInfo = await factoryButton.isVisible({ timeout: 1000 }).catch(() => false);
    
    if (isOnVehicleInfo) {
      console.log('✅ Already on Vehicle Info tab (Factory Equipment button visible)');
    } else {
      console.log('📑 Not on Vehicle Info tab, need to navigate...');
      
      // Step 2: Click Vehicle Info tab
      console.log('\n📋 Step 2: Clicking Vehicle Info tab...');
      
      try {
        await page.click('text="Vehicle Info"', { timeout: 5000 });
        console.log('✅ Clicked Vehicle Info tab');
        await page.waitForTimeout(1500);
      } catch (e) {
        console.log('❌ Failed to click Vehicle Info tab:', e instanceof Error ? e.message : String(e));
        return;
      }
    }
    
    // Step 3: Click Factory Equipment button
    console.log('\n🏭 Step 3: Clicking Factory Equipment button...');
    
    try {
      await page.click('#ext-gen199', { timeout: 5000 });
      console.log('✅ Clicked Factory Equipment button');
      
      // Wait a moment
      await page.waitForTimeout(2000);
      
      // Check for new window
      const allPages = contexts[0].pages();
      if (allPages.length > pages.length) {
        console.log('✅ New window opened!');
        const newPage = allPages[allPages.length - 1];
        console.log(`📄 New window URL: ${newPage.url()}`);
        console.log(`📄 New window title: ${await newPage.title()}`);
      } else {
        console.log('⚠️ No new window detected, content might be inline');
      }
      
    } catch (e) {
      console.log('❌ Failed to click Factory Equipment:', e instanceof Error ? e.message : String(e));
      
      // Try text selector as fallback
      try {
        await page.click('text="Factory Equipment"', { timeout: 3000 });
        console.log('✅ Clicked Factory Equipment using text selector');
      } catch (e2) {
        console.log('❌ Text selector also failed:', e2 instanceof Error ? e2.message : String(e2));
      }
    }
    
    // Take screenshot
    await page.screenshot({ path: `factory-equipment-test-${Date.now()}.png` });
    console.log('📸 Screenshot saved');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testFactoryEquipment();