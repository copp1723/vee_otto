#!/usr/bin/env ts-node

import { chromium, Browser, Page } from 'playwright';
import { spawn } from 'child_process';

class VisualAutomationWatcher {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private mockupServer: any = null;

  async startMockupServer(): Promise<void> {
    console.log('🚀 Starting mockup server...');
    
    return new Promise((resolve, reject) => {
      this.mockupServer = spawn('node', ['tests/serve-vauto-mockup.js'], {
        cwd: process.cwd()
      });
      
      this.mockupServer.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('vAuto Mockup Server running')) {
          console.log('✅ Mockup server started at http://localhost:3001');
          resolve();
        }
      });
      
      this.mockupServer.stderr.on('data', (data: Buffer) => {
        console.error('Server error:', data.toString());
      });
      
      setTimeout(() => reject(new Error('Server startup timeout')), 5000);
    });
  }

  async initialize() {
    console.log('🎬 Launching browser for visual automation...');
    
    this.browser = await chromium.launch({
      headless: false,        // Keep browser visible
      slowMo: 3000,          // Much slower actions for better visibility
      args: ['--start-maximized'] // Start maximized
    });
    
    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 1400, height: 900 });
    
    // Log what's happening
    this.page.on('console', msg => {
      console.log(`📱 Browser: ${msg.text()}`);
    });
    
    console.log('🎯 Navigating to mockup...');
    await this.page.goto('http://localhost:3001');
    await this.page.waitForLoadState('networkidle');
  }

  async watchLoginFlow() {
    console.log('\n🔐 WATCHING: Login Flow');
    console.log('   The automation will now log in automatically...');
    
    // Username step
    console.log('   ⌨️  Entering username...');
    await this.page!.waitForTimeout(2000); // Pause before action
    await this.page!.fill('#username', 'demo_user');
    await this.page!.waitForTimeout(2000); // Pause after typing
    await this.page!.click('button[onclick="goToPassword()"]');
    await this.page!.waitForSelector('#password-page:not(.hidden)');
    
    // Password step
    console.log('   🔒 Entering password...');
    await this.page!.waitForTimeout(2000); // Pause before action
    await this.page!.fill('#password', 'demo_pass');
    await this.page!.waitForTimeout(2000); // Pause after typing
    await this.page!.click('button[onclick="goToSelector()"]');
    await this.page!.waitForSelector('#selector-page:not(.hidden)');
    
    // Dealership selection
    console.log('   🏢 Selecting dealership...');
    await this.page!.waitForTimeout(2000); // Pause before action
    await this.page!.selectOption('#dealership', 'Cox Automotive - Main');
    await this.page!.waitForTimeout(2000); // Pause after selection
    await this.page!.click('button[onclick="goToHomepage()"]');
    await this.page!.waitForSelector('#homepage:not(.hidden)');
    
    console.log('   ✅ Login completed automatically!');
  }

  async watchInventoryNavigation() {
    console.log('\n📋 WATCHING: Inventory Navigation');
    console.log('   The automation will navigate to inventory...');
    
    // Hover over Pricing menu
    console.log('   🖱️  Hovering over Pricing menu...');
    await this.page!.waitForTimeout(2000); // Pause before action
    await this.page!.hover('.group button:has-text("Pricing")');
    await this.page!.waitForTimeout(3000); // Let user see the dropdown longer
    
    // Click View Inventory
    console.log('   📦 Clicking View Inventory...');
    await this.page!.click('a[onclick="goToInventory()"]');
    await this.page!.waitForSelector('#inventory-page:not(.hidden)');
    await this.page!.waitForTimeout(2000); // Pause after navigation
    
    // Apply filter
    console.log('   🔍 Applying inventory filter...');
    await this.page!.selectOption('#days-filter', '0-1 day (new inventory)');
    await this.page!.waitForTimeout(2000); // Pause after selection
    await this.page!.click('button[onclick="applyFilter()"]');
    await this.page!.waitForTimeout(2000); // Pause after filter
    
    console.log('   ✅ Inventory navigation completed!');
  }

  async watchVehicleProcessing(vin: string) {
    console.log(`\n🚗 WATCHING: Vehicle Processing (${vin})`);
    console.log('   The automation will process this vehicle...');
    
    // Click on vehicle
    console.log('   🖱️  Clicking on vehicle...');
    await this.page!.click(`text=${vin}`);
    
    // Check for alert (no sticker scenario)
    const alertVisible = await this.page!.isVisible('.custom-alert-overlay.active', { timeout: 2000 }).catch(() => false);
    
    if (alertVisible) {
      console.log('   ⚠️  Vehicle has no sticker - handling error...');
      const alertText = await this.page!.textContent('.custom-alert-box p');
      console.log(`   📝 Alert message: ${alertText}`);
      await this.page!.click('.custom-alert-box button');
      console.log('   ✅ Error handled automatically!');
      return;
    }
    
    // Handle window sticker
    console.log('   🖼️  Window sticker displayed - extracting features...');
    await this.page!.waitForSelector('#window-sticker-popup:not(.hidden)');
    await this.page!.waitForTimeout(2000); // Let user see the sticker
    
    // Go to description editing
    console.log('   ✏️  Opening description editor...');
    await this.page!.click('text=Edit Description');
    await this.page!.waitForSelector('#description-page:not(.hidden)');
    
    // Update checkboxes
    console.log('   ☑️  Updating feature checkboxes...');
    const checkboxes = await this.page!.$$('#description-checkboxes input[type="checkbox"]:not(:checked)');
    for (let i = 0; i < Math.min(3, checkboxes.length); i++) {
      console.log(`   ✓ Checking feature ${i + 1}...`);
      await checkboxes[i].click();
      await this.page!.waitForTimeout(500); // Show each checkbox update
    }
    
    // Save and sync
    console.log('   💾 Saving and syncing book values...');
    await this.page!.click('text=Save & Sync Book Values');
    
    // Handle sync alert
    await this.page!.waitForSelector('.custom-alert-overlay.active');
    await this.page!.click('.custom-alert-box button');
    await this.page!.waitForSelector('#book-value-page:not(.hidden)');
    
    // Test book value tabs
    console.log('   📊 Testing book value providers...');
    const tabs = ['KBB', 'Black Book', 'J.D. Power'];
    for (const tab of tabs) {
      console.log(`   📈 Switching to ${tab}...`);
      await this.page!.click(`text=${tab}`);
      await this.page!.waitForTimeout(1000);
    }
    
    // Confirm values
    console.log('   ✅ Confirming book values...');
    await this.page!.click('text=Confirm Values & Generate Report');
    
    // Show report
    await this.page!.waitForSelector('text=Report Generated Successfully');
    const reportVin = await this.page!.textContent('#report-vin');
    const reportFeatures = await this.page!.textContent('#report-features');
    
    console.log(`   📄 Report generated for ${reportVin}`);
    console.log(`   🔧 Features updated: ${reportFeatures}`);
    console.log('   ✅ Vehicle processing completed!');
    
    // Wait before next vehicle
    await this.page!.waitForTimeout(2000);
  }

  async watchAllVehicles() {
    const vehicles = ['VIN123ABC', 'VIN456DEF', 'VIN789GHI'];
    
    for (const vin of vehicles) {
      // Reset to inventory for each vehicle
      if (vin !== 'VIN123ABC') {
        console.log('\n🔄 Resetting to login for next vehicle...');
        await this.page!.click('text=Back to Login');
        await this.watchLoginFlow();
        await this.watchInventoryNavigation();
      }
      
      await this.watchVehicleProcessing(vin);
    }
  }

  async runVisualDemo() {
    console.log('🎬 VISUAL AUTOMATION DEMO STARTING');
    console.log('=====================================');
    console.log('Watch the browser - automation will run automatically!');
    console.log('Press Ctrl+C to stop at any time\n');
    
    try {
      await this.startMockupServer();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await this.initialize();
      await this.watchLoginFlow();
      await this.watchInventoryNavigation();
      await this.watchAllVehicles();
      
      console.log('\n🎉 DEMO COMPLETED!');
      console.log('================');
      console.log('The automation successfully:');
      console.log('✅ Logged in automatically');
      console.log('✅ Navigated to inventory');
      console.log('✅ Processed all test vehicles');
      console.log('✅ Handled error scenarios');
      console.log('✅ Generated reports');
      
    } catch (error) {
      console.error('❌ Demo failed:', error);
    } finally {
      await this.cleanup();
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    if (this.browser) {
      await this.browser.close();
    }
    
    if (this.mockupServer) {
      this.mockupServer.kill();
    }
    
    console.log('✅ Cleanup completed');
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopping visual demo...');
  process.exit(0);
});

// Run the visual demo
async function main() {
  const watcher = new VisualAutomationWatcher();
  await watcher.runVisualDemo();
}

if (require.main === module) {
  main();
} 