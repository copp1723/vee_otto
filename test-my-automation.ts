#!/usr/bin/env ts-node

import { chromium, Browser, Page } from 'playwright';

class MyVAutoAutomation {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize() {
    this.browser = await chromium.launch({
      headless: false,  // Keep visible to see what's happening
      slowMo: 500      // Slow down for observation
    });
    
    this.page = await this.browser.newPage();
    await this.page.goto('http://localhost:3001');
  }

  async testLoginFlow() {
    console.log('Testing login flow...');
    
    // Enter username
    await this.page!.fill('#username', 'test_user');
    await this.page!.click('button[onclick="goToPassword()"]');
    
    // Enter password
    await this.page!.fill('#password', 'test_pass');
    await this.page!.click('button[onclick="goToSelector()"]');
    
    // Select dealership
    await this.page!.selectOption('#dealership', 'Cox Automotive - Main');
    await this.page!.click('button[onclick="goToHomepage()"]');
    
    console.log('✓ Login completed');
  }

  async testVehicleProcessing() {
    console.log('Testing vehicle processing...');
    
    // Navigate to inventory
    await this.page!.hover('.group button:has-text("Pricing")');
    await this.page!.click('a[onclick="goToInventory()"]');
    
    // Apply filter
    await this.page!.selectOption('#days-filter', '0-1 day (new inventory)');
    await this.page!.click('button[onclick="applyFilter()"]');
    
    // Process first vehicle
    await this.page!.click('text=VIN123ABC');
    
    // Handle window sticker
    await this.page!.waitForSelector('#window-sticker-popup:not(.hidden)');
    await this.page!.click('text=Edit Description');
    
    // Update checkboxes (this is where your feature extraction logic would go)
    const checkboxes = await this.page!.$$('#description-checkboxes input[type="checkbox"]:not(:checked)');
    for (let i = 0; i < 2; i++) {
      if (checkboxes[i]) {
        await checkboxes[i].click();
        console.log(`✓ Updated checkbox ${i + 1}`);
      }
    }
    
    // Save and sync book values
    await this.page!.click('text=Save & Sync Book Values');
    
    // Handle alert
    await this.page!.waitForSelector('.custom-alert-overlay.active');
    await this.page!.click('.custom-alert-box button');
    
    // Test book value tabs
    await this.page!.click('text=KBB');
    await this.page!.click('text=Black Book');
    await this.page!.click('text=J.D. Power');
    
    // Confirm values
    await this.page!.click('text=Confirm Values & Generate Report');
    
    // Verify completion
    await this.page!.waitForSelector('text=Report Generated Successfully');
    const reportVin = await this.page!.textContent('#report-vin');
    console.log(`✓ Vehicle processing completed for ${reportVin}`);
  }

  async testErrorScenario() {
    console.log('Testing error scenario...');
    
    // Reset and test vehicle without sticker
    await this.page!.click('text=Back to Login');
    await this.testLoginFlow();
    
    // Navigate to inventory again
    await this.page!.hover('.group button:has-text("Pricing")');
    await this.page!.click('a[onclick="goToInventory()"]');
    
    // Try vehicle without sticker
    await this.page!.click('text=VIN789GHI');
    
    // Should show alert
    await this.page!.waitForSelector('.custom-alert-overlay.active');
    const alertText = await this.page!.textContent('.custom-alert-box p');
    console.log(`✓ Error handled correctly: ${alertText}`);
    
    await this.page!.click('.custom-alert-box button');
  }

  async runAllTests() {
    try {
      await this.initialize();
      await this.testLoginFlow();
      await this.testVehicleProcessing();
      await this.testErrorScenario();
      
      console.log('\n✅ All tests completed successfully!');
      
    } catch (error) {
      console.error('❌ Test failed:', error);
    } finally {
      await this.cleanup();
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Usage
async function main() {
  // First, start the mockup server
  console.log('Starting mockup server...');
  console.log('Run: npm run vauto:mockup-manual');
  console.log('Then run this script in another terminal');
  
  const automation = new MyVAutoAutomation();
  await automation.runAllTests();
}

if (require.main === module) {
  main();
} 