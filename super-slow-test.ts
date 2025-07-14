#!/usr/bin/env ts-node

import { chromium, Browser, Page } from 'playwright';
import { spawn } from 'child_process';

class SuperSlowAutomationDemo {
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
    console.log('🎬 Launching browser with SUPER SLOW automation...');
    console.log('   Each action will be very slow so you can see it clearly');
    
    this.browser = await chromium.launch({
      headless: false,
      slowMo: 4000,  // 4 seconds between each action!
      args: ['--start-maximized']
    });
    
    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 1400, height: 900 });
    
    console.log('🎯 Navigating to mockup...');
    await this.page.goto('http://localhost:3001');
    await this.page.waitForLoadState('networkidle');
    
    console.log('⏳ Waiting 5 seconds before starting...');
    await this.page.waitForTimeout(5000);
  }

  async demonstrateTyping(selector: string, text: string, description: string) {
    console.log(`\n⌨️  ${description}`);
    console.log(`   Clicking on field: ${selector}`);
    
    // Click on the field
    await this.page!.click(selector);
    await this.page!.waitForTimeout(2000);
    
    console.log(`   Typing: "${text}"`);
    
    // Type each character slowly
    for (let i = 0; i < text.length; i++) {
      await this.page!.keyboard.type(text[i]);
      await this.page!.waitForTimeout(300); // 300ms between each character
    }
    
    console.log(`   ✅ Finished typing: "${text}"`);
    await this.page!.waitForTimeout(2000);
  }

  async demonstrateClick(selector: string, description: string) {
    console.log(`\n🖱️  ${description}`);
    console.log(`   Clicking: ${selector}`);
    
    // Highlight the element we're about to click
    await this.page!.evaluate((sel) => {
      const element = document.querySelector(sel) as HTMLElement;
      if (element) {
        element.style.border = '3px solid red';
        element.style.backgroundColor = 'yellow';
      }
    }, selector);
    
    await this.page!.waitForTimeout(2000);
    
    // Click it
    await this.page!.click(selector);
    
    // Remove highlight
    await this.page!.evaluate((sel) => {
      const element = document.querySelector(sel) as HTMLElement;
      if (element) {
        element.style.border = '';
        element.style.backgroundColor = '';
      }
    }, selector);
    
    console.log(`   ✅ Clicked successfully`);
    await this.page!.waitForTimeout(2000);
  }

  async demonstrateSelect(selector: string, value: string, description: string) {
    console.log(`\n📋 ${description}`);
    console.log(`   Selecting "${value}" from dropdown: ${selector}`);
    
        // Highlight the dropdown
    await this.page!.evaluate((sel) => {
      const element = document.querySelector(sel) as HTMLElement;
      if (element) {
        element.style.border = '3px solid blue';
      }
    }, selector);

    await this.page!.waitForTimeout(2000);
    
    // Select the option
    await this.page!.selectOption(selector, value);
    
    // Remove highlight
    await this.page!.evaluate((sel) => {
      const element = document.querySelector(sel) as HTMLElement;
      if (element) {
        element.style.border = '';
      }
    }, selector);
    
    console.log(`   ✅ Selected: "${value}"`);
    await this.page!.waitForTimeout(2000);
  }

  async runSuperSlowDemo() {
    console.log('🐌 SUPER SLOW AUTOMATION DEMO');
    console.log('===============================');
    console.log('Each action will be VERY slow so you can see exactly what happens');
    console.log('Press Ctrl+C to stop at any time\n');
    
    try {
      await this.startMockupServer();
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await this.initialize();
      
      // Login Flow
      console.log('\n🔐 STARTING LOGIN FLOW');
      console.log('========================');
      
      await this.demonstrateTyping('#username', 'demo_user', 'Entering username');
      await this.demonstrateClick('button[onclick="goToPassword()"]', 'Clicking Enter button');
      
      await this.page!.waitForSelector('#password-page:not(.hidden)');
      console.log('✅ Password page loaded');
      
      await this.demonstrateTyping('#password', 'demo_pass', 'Entering password');
      await this.demonstrateClick('button[onclick="goToSelector()"]', 'Clicking Enter button');
      
      await this.page!.waitForSelector('#selector-page:not(.hidden)');
      console.log('✅ Dealership selection page loaded');
      
      await this.demonstrateSelect('#dealership', 'Cox Automotive - Main', 'Selecting dealership');
      await this.demonstrateClick('button[onclick="goToHomepage()"]', 'Clicking Select button');
      
      await this.page!.waitForSelector('#homepage:not(.hidden)');
      console.log('✅ Homepage loaded');
      
      // Navigation
      console.log('\n📋 STARTING INVENTORY NAVIGATION');
      console.log('=================================');
      
      console.log('\n🖱️  Hovering over Pricing menu...');
      await this.page!.evaluate(() => {
        const menu = document.querySelector('.group button:has-text("Pricing")') as HTMLElement;
        if (menu) {
          menu.style.border = '3px solid orange';
        }
      });
      
      await this.page!.hover('.group button:has-text("Pricing")');
      await this.page!.waitForTimeout(4000); // Show dropdown for 4 seconds
      
      await this.demonstrateClick('a[onclick="goToInventory()"]', 'Clicking View Inventory');
      
      await this.page!.waitForSelector('#inventory-page:not(.hidden)');
      console.log('✅ Inventory page loaded');
      
      await this.demonstrateSelect('#days-filter', '0-1 day (new inventory)', 'Applying inventory filter');
      await this.demonstrateClick('button[onclick="applyFilter()"]', 'Clicking Apply Filter');
      
      // Vehicle Processing
      console.log('\n🚗 STARTING VEHICLE PROCESSING');
      console.log('===============================');
      
      console.log('\n📋 Available vehicles:');
      console.log('   - VIN123ABC (has window sticker)');
      console.log('   - VIN456DEF (has window sticker)');
      console.log('   - VIN789GHI (no sticker - error scenario)');
      
      await this.demonstrateClick('text=VIN123ABC', 'Clicking on first vehicle');
      
      // Wait for window sticker popup
      await this.page!.waitForSelector('#window-sticker-popup:not(.hidden)');
      console.log('✅ Window sticker popup displayed');
      
      console.log('\n🖼️  Window sticker contains:');
      console.log('   - Standard features (ABS, Air Conditioning)');
      console.log('   - Optional features (Leather Seats $500, Navigation $800, etc.)');
      
      await this.page!.waitForTimeout(5000); // Let user read the sticker
      
      await this.demonstrateClick('text=Edit Description', 'Opening description editor');
      
      await this.page!.waitForSelector('#description-page:not(.hidden)');
      console.log('✅ Description editor loaded');
      
      // Show checkbox updates
      console.log('\n☑️  Updating feature checkboxes based on window sticker...');
      const checkboxes = await this.page!.$$('#description-checkboxes input[type="checkbox"]:not(:checked)');
      
      for (let i = 0; i < Math.min(3, checkboxes.length); i++) {
        console.log(`   Checking feature checkbox ${i + 1}...`);
        
        // Highlight checkbox
        await checkboxes[i].evaluate((el) => {
          el.parentElement!.style.border = '2px solid green';
          el.parentElement!.style.backgroundColor = 'lightgreen';
        });
        
        await this.page!.waitForTimeout(2000);
        await checkboxes[i].click();
        
        // Remove highlight
        await checkboxes[i].evaluate((el) => {
          el.parentElement!.style.border = '';
          el.parentElement!.style.backgroundColor = '';
        });
        
        console.log(`   ✅ Feature ${i + 1} checked`);
        await this.page!.waitForTimeout(1000);
      }
      
      await this.demonstrateClick('text=Save & Sync Book Values', 'Saving changes and syncing book values');
      
      // Handle alert
      await this.page!.waitForSelector('.custom-alert-overlay.active');
      console.log('📢 Alert appeared - clicking OK');
      await this.page!.waitForTimeout(3000);
      await this.page!.click('.custom-alert-box button');
      
      await this.page!.waitForSelector('#book-value-page:not(.hidden)');
      console.log('✅ Book value sync page loaded');
      
      // Test book value tabs
      console.log('\n📊 Testing book value providers...');
      const tabs = ['KBB', 'Black Book', 'J.D. Power'];
      
      for (const tab of tabs) {
        console.log(`   Switching to ${tab} tab...`);
        
        // Highlight tab
        await this.page!.evaluate((tabName) => {
          const tabButton = document.querySelector(`text=${tabName}`) as HTMLElement;
          if (tabButton) {
            tabButton.style.border = '2px solid purple';
          }
        }, tab);
        
        await this.page!.waitForTimeout(2000);
        await this.page!.click(`text=${tab}`);
        
        console.log(`   ✅ ${tab} tab active`);
        await this.page!.waitForTimeout(3000);
      }
      
      await this.demonstrateClick('text=Confirm Values & Generate Report', 'Generating final report');
      
      await this.page!.waitForSelector('text=Report Generated Successfully');
      console.log('✅ Report generated successfully!');
      
      const reportVin = await this.page!.textContent('#report-vin');
      const reportFeatures = await this.page!.textContent('#report-features');
      
      console.log('\n📄 FINAL REPORT:');
      console.log(`   VIN: ${reportVin}`);
      console.log(`   Features Updated: ${reportFeatures}`);
      console.log(`   Status: Success`);
      
      console.log('\n🎉 DEMO COMPLETED SUCCESSFULLY!');
      console.log('================================');
      console.log('You just watched the automation:');
      console.log('✅ Log in with username and password');
      console.log('✅ Navigate to inventory management');
      console.log('✅ Filter vehicles by age (0-1 days)');
      console.log('✅ Process a vehicle by clicking on it');
      console.log('✅ Extract features from window sticker');
      console.log('✅ Update feature checkboxes automatically');
      console.log('✅ Sync book values across providers');
      console.log('✅ Generate a completion report');
      
      await this.page!.waitForTimeout(5000);
      
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
  console.log('\n\n👋 Stopping super slow demo...');
  process.exit(0);
});

// Run the super slow demo
async function main() {
  const demo = new SuperSlowAutomationDemo();
  await demo.runSuperSlowDemo();
}

if (require.main === module) {
  main();
} 