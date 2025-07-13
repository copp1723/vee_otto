#!/usr/bin/env node

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { vAutoMockupConfig } from './fixtures/vauto-mockup/config';
import { spawn } from 'child_process';
import { Logger } from '../core/utils/Logger';

const logger = new Logger('vAuto-Mockup-Test');

class VAutoMockupTest {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private mockupServer: any = null;
  
  async startMockupServer(): Promise<void> {
    // Check if server is already running
    try {
      const response = await fetch('http://localhost:3001');
      if (response.ok) {
        logger.info('Mockup server already running on port 3001');
        return;
      }
    } catch (error) {
      // Server not running, start it
    }
    
    return new Promise((resolve, reject) => {
      logger.info('Starting vAuto mockup server...');
      
      this.mockupServer = spawn('node', ['tests/serve-vauto-mockup.js'], {
        cwd: process.cwd()
      });
      
      this.mockupServer.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('vAuto Mockup Server running')) {
          logger.info('Mockup server started successfully');
          resolve();
        }
      });
      
      this.mockupServer.stderr.on('data', (data: Buffer) => {
        logger.error('Server error:', data.toString());
      });
      
      this.mockupServer.on('error', reject);
      
      // Timeout if server doesn't start
      setTimeout(() => reject(new Error('Server startup timeout')), 5000);
    });
  }
  
  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: false,
      slowMo: 500 // Slow down for visual inspection
    });
    
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    
    this.page = await this.context.newPage();
    
    // Log console messages from the page
    this.page.on('console', msg => {
      logger.info(`Browser console: ${msg.text()}`);
    });
  }
  
  async testLoginFlow(): Promise<boolean> {
    logger.info('Testing login flow...');
    
    try {
      await this.page!.goto(vAutoMockupConfig.baseUrl);
      await this.page!.waitForLoadState('networkidle');
      
      // Enter username
      await this.page!.fill(vAutoMockupConfig.selectors.login.username, vAutoMockupConfig.testData.credentials.username);
      await this.page!.click(vAutoMockupConfig.selectors.login.submitButton);
      
      // Enter password
      await this.page!.waitForSelector(vAutoMockupConfig.selectors.login.password);
      await this.page!.fill(vAutoMockupConfig.selectors.login.password, vAutoMockupConfig.testData.credentials.password);
      await this.page!.click(vAutoMockupConfig.selectors.login.passwordSubmit);
      
      // Select dealership
      await this.page!.waitForSelector(vAutoMockupConfig.selectors.dealershipSelector.dropdown);
      await this.page!.selectOption(vAutoMockupConfig.selectors.dealershipSelector.dropdown, vAutoMockupConfig.testData.dealership);
      await this.page!.click(vAutoMockupConfig.selectors.dealershipSelector.submitButton);
      
      // Verify we're on homepage
      await this.page!.waitForSelector('text=Homepage Dashboard');
      logger.info('✓ Login flow completed successfully');
      return true;
      
    } catch (error) {
      logger.error('Login flow failed:', error);
      return false;
    }
  }
  
  async testInventoryNavigation(): Promise<boolean> {
    logger.info('Testing inventory navigation...');
    
    try {
      // Hover over pricing menu
      await this.page!.hover('text=Pricing');
      
      // Click inventory link
      await this.page!.click('text=View Inventory');
      
      // Verify we're on inventory page
      await this.page!.waitForSelector('text=Inventory Management');
      logger.info('✓ Navigation to inventory successful');
      return true;
      
    } catch (error) {
      logger.error('Inventory navigation failed:', error);
      return false;
    }
  }
  
  async testVehicleWorkflow(vin: string): Promise<boolean> {
    logger.info(`Testing vehicle workflow for ${vin}...`);
    
    try {
      // Click on vehicle
      await this.page!.click(`text=${vin}`);
      
      // Check if alert appears (for vehicles without sticker)
      const alertVisible = await this.page!.isVisible('.custom-alert-overlay.active', { timeout: 2000 }).catch(() => false);
      
      if (alertVisible) {
        logger.info(`Vehicle ${vin} has no sticker - alert shown as expected`);
        await this.page!.click('.custom-alert-box button');
        return true;
      }
      
      // Handle window sticker popup
      await this.page!.waitForSelector('#window-sticker-popup:not(.hidden)');
      logger.info('Window sticker displayed');
      
      // Click edit description
      await this.page!.click('text=Edit Description');
      
      // Toggle some checkboxes
      const checkboxes = await this.page!.$$('#description-checkboxes input[type="checkbox"]:not(:checked)');
      for (let i = 0; i < Math.min(2, checkboxes.length); i++) {
        await checkboxes[i].click();
      }
      
      // Save and go to book values
      await this.page!.click('text=Save & Sync Book Values');
      
      // Wait for alert and close it
      await this.page!.waitForSelector('.custom-alert-overlay.active');
      await this.page!.click('.custom-alert-box button');
      
      // Switch between tabs
      await this.page!.click('text=KBB');
      await this.page!.waitForTimeout(500);
      await this.page!.click('text=Black Book');
      await this.page!.waitForTimeout(500);
      
      // Confirm values
      await this.page!.click('text=Confirm Values & Generate Report');
      
      // Verify report
      await this.page!.waitForSelector('text=Report Generated Successfully');
      const reportVin = await this.page!.textContent('#report-vin');
      logger.info(`✓ Vehicle workflow completed for ${reportVin}`);
      
      // Reset for next test
      await this.page!.click('text=Back to Login');
      
      return true;
      
    } catch (error) {
      logger.error(`Vehicle workflow failed for ${vin}:`, error);
      await this.page!.screenshot({ path: `error-${vin}.png` });
      return false;
    }
  }
  
  async runAllTests(): Promise<void> {
    logger.info('Starting comprehensive vAuto mockup tests...\n');
    
    const results = {
      login: false,
      navigation: false,
      vehicles: {} as Record<string, boolean>
    };
    
    try {
      // Start server
      await this.startMockupServer();
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for server to be ready
      
      // Initialize browser
      await this.initialize();
      
      // Test login
      results.login = await this.testLoginFlow();
      
      if (results.login) {
        // Test navigation
        results.navigation = await this.testInventoryNavigation();
        
        if (results.navigation) {
          // Test each vehicle
          for (const vehicle of vAutoMockupConfig.testData.vehicles) {
            // Need to re-login for each vehicle test
            await this.testLoginFlow();
            await this.testInventoryNavigation();
            results.vehicles[vehicle.vin] = await this.testVehicleWorkflow(vehicle.vin);
          }
        }
      }
      
      // Print results
      logger.info('\n=== TEST RESULTS ===');
      logger.info(`Login Flow: ${results.login ? '✓ PASSED' : '✗ FAILED'}`);
      logger.info(`Navigation: ${results.navigation ? '✓ PASSED' : '✗ FAILED'}`);
      logger.info('Vehicle Tests:');
      for (const [vin, passed] of Object.entries(results.vehicles)) {
        logger.info(`  ${vin}: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
      }
      
    } catch (error) {
      logger.error('Test suite failed:', error);
    }
  }
  
  async cleanup(): Promise<void> {
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    
    if (this.mockupServer) {
      logger.info('Stopping mockup server...');
      this.mockupServer.kill();
    }
  }
}

async function main() {
  const tester = new VAutoMockupTest();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    logger.error('Fatal error:', error);
  } finally {
    await tester.cleanup();
  }
}

// Handle process termination
process.on('SIGINT', () => {
  logger.info('\nTest interrupted by user');
  process.exit(0);
});

main();