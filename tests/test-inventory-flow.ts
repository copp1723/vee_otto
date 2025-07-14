#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { VAutoAgent } from '../platforms/vauto/VAutoAgent';
import { Logger } from '../core/utils/Logger';
import { chromium } from 'playwright';
import { vAutoSelectors } from '../platforms/vauto/vautoSelectors';
import { reliableClick, waitForLoadingToComplete } from '../core/utils/reliabilityUtils';

// Load environment variables
dotenv.config();

const logger = new Logger('InventoryFlowTest');

interface TestStep {
  name: string;
  description: string;
  action: () => Promise<void>;
  verification?: () => Promise<boolean>;
}

class InventoryFlowTester {
  private agent: VAutoAgent | null = null;
  private currentStep = 0;
  private testResults: { step: string; success: boolean; error?: string }[] = [];

  constructor() {
    this.agent = new VAutoAgent({
      username: process.env.VAUTO_USERNAME || '',
      password: process.env.VAUTO_PASSWORD || '',
      headless: false,
      slowMo: 1000,
      screenshotOnError: true
    });
  }

  async runInteractiveTest(): Promise<void> {
    logger.info('Starting Interactive Inventory Flow Test');
    logger.info('This test will walk through each step with pauses for verification');
    
    const testSteps: TestStep[] = [
      {
        name: 'Initialize and Login',
        description: 'Initialize browser and login to VAuto',
        action: async () => {
          await this.agent!.initialize();
          const loginSuccess = await this.agent!.login();
          if (!loginSuccess) throw new Error('Login failed');
        }
      },
      {
        name: 'Navigate to Inventory',
        description: 'Navigate to the inventory page',
        action: async () => {
          await this.agent!.navigateToInventory();
        },
        verification: async () => {
          const page = (this.agent as any).page;
          const url = page.url();
          return url.includes('inventory') || url.includes('Inventory');
        }
      },
      {
        name: 'Apply Inventory Filters',
        description: 'Apply filters to limit inventory (age 0-1 days)',
        action: async () => {
          await this.agent!.applyInventoryFilters();
        }
      },
      {
        name: 'Select First Vehicle',
        description: 'Click on the first vehicle in the inventory list',
        action: async () => {
          await this.selectFirstVehicle();
        }
      },
      {
        name: 'Open Factory Equipment Tab',
        description: 'Click on the Factory Equipment tab',
        action: async () => {
          await this.openFactoryEquipmentTab();
        }
      },
      {
        name: 'Test Checkbox Interactions',
        description: 'Test clicking and unchecking various checkboxes',
        action: async () => {
          await this.testCheckboxInteractions();
        }
      }
    ];

    for (let i = 0; i < testSteps.length; i++) {
      const step = testSteps[i];
      this.currentStep = i + 1;
      
      logger.info(`\n🔄 Step ${this.currentStep}/${testSteps.length}: ${step.name}`);
      logger.info(`📝 ${step.description}`);
      
      try {
        await step.action();
        
        // Take screenshot after each step
        await this.takeScreenshot(`step-${this.currentStep}-${step.name.toLowerCase().replace(/\s+/g, '-')}`);
        
        // Run verification if provided
        if (step.verification) {
          const verified = await step.verification();
          if (!verified) {
            throw new Error(`Verification failed for step: ${step.name}`);
          }
          logger.info('✅ Step verification passed');
        }
        
        logger.info(`✅ Step ${this.currentStep} completed successfully`);
        this.testResults.push({ step: step.name, success: true });
        
        // Pause for manual inspection
        if (i < testSteps.length - 1) {
          logger.info('⏸️  Pausing for manual inspection...');
          logger.info('👁️  Please verify the current state looks correct');
          logger.info('⌨️  Press Enter to continue to next step...');
          await this.waitForUserInput();
        }
        
      } catch (error) {
        logger.error(`❌ Step ${this.currentStep} failed:`, error);
        this.testResults.push({ 
          step: step.name, 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        });
        
        await this.takeScreenshot(`step-${this.currentStep}-error`);
        
        // Ask user if they want to continue
        logger.info('❓ Step failed. Do you want to continue to the next step? (y/n)');
        const response = await this.getUserInput();
        if (response.toLowerCase() !== 'y' && response.toLowerCase() !== 'yes') {
          break;
        }
      }
    }
    
    await this.generateTestReport();
  }

  private async selectFirstVehicle(): Promise<void> {
    const page = (this.agent as any).page;
    
    logger.info('Looking for vehicles in inventory...');
    
    // Wait for vehicles to load
    await page.waitForSelector(vAutoSelectors.inventory.vehicleRows, { timeout: 10000 });
    
    // Get all vehicle elements
    const vehicleElements = await page.$$(vAutoSelectors.inventory.vehicleRows);
    
    if (vehicleElements.length === 0) {
      throw new Error('No vehicles found in inventory');
    }
    
    logger.info(`Found ${vehicleElements.length} vehicles. Selecting first vehicle...`);
    
    // Click on the first vehicle
    await vehicleElements[0].click();
    await waitForLoadingToComplete(page, Object.values(vAutoSelectors.loading));
    
    logger.info('First vehicle selected and loaded');
  }

  private async openFactoryEquipmentTab(): Promise<void> {
    const page = (this.agent as any).page;
    
    logger.info('Looking for Factory Equipment tab...');
    
    // Wait for the tab to be available
    await page.waitForSelector(vAutoSelectors.vehicleDetails.factoryEquipmentTab, { timeout: 10000 });
    
    // Click on Factory Equipment tab
    await reliableClick(page, vAutoSelectors.vehicleDetails.factoryEquipmentTab, 'Factory Equipment Tab');
    await waitForLoadingToComplete(page, Object.values(vAutoSelectors.loading));
    
    logger.info('Factory Equipment tab opened');
  }

  private async testCheckboxInteractions(): Promise<void> {
    const page = (this.agent as any).page;
    
    logger.info('Testing checkbox interactions...');
    
    // Get all checkboxes on the page
    const checkboxes = await page.$$('input[type="checkbox"]');
    const labels = await page.$$('label');
    
    logger.info(`Found ${checkboxes.length} checkboxes and ${labels.length} labels`);
    
    if (checkboxes.length === 0) {
      throw new Error('No checkboxes found on Factory Equipment page');
    }
    
    // Test interactions with first few checkboxes
    const testCount = Math.min(5, checkboxes.length);
    const checkboxResults: { label: string; initialState: boolean; afterClick: boolean }[] = [];
    
    for (let i = 0; i < testCount; i++) {
      try {
        const checkbox = checkboxes[i];
        
        // Get associated label
        const labelText = await this.getCheckboxLabel(page, checkbox);
        
        // Get initial state
        const initialState = await checkbox.isChecked();
        
        logger.info(`Testing checkbox ${i + 1}: "${labelText}" (initially ${initialState ? 'checked' : 'unchecked'})`);
        
        // Click the checkbox
        await checkbox.click();
        await page.waitForTimeout(500); // Small delay to see the change
        
        // Get new state
        const afterClick = await checkbox.isChecked();
        
        checkboxResults.push({
          label: labelText,
          initialState,
          afterClick
        });
        
        logger.info(`Checkbox "${labelText}": ${initialState ? 'checked' : 'unchecked'} → ${afterClick ? 'checked' : 'unchecked'}`);
        
        // Take screenshot showing the change
        await this.takeScreenshot(`checkbox-test-${i + 1}-${labelText.replace(/[^a-zA-Z0-9]/g, '_')}`);
        
      } catch (error) {
        logger.warn(`Failed to test checkbox ${i + 1}:`, error);
      }
    }
    
    // Log summary
    logger.info('\n📊 Checkbox Test Summary:');
    checkboxResults.forEach((result, index) => {
      const changed = result.initialState !== result.afterClick;
      logger.info(`${index + 1}. "${result.label}": ${changed ? '✅ Changed' : '❌ No change'}`);
    });
    
    // Test unchecking - click the same checkboxes again
    logger.info('\n🔄 Testing unchecking (clicking same checkboxes again)...');
    
    for (let i = 0; i < testCount; i++) {
      try {
        const checkbox = checkboxes[i];
        const labelText = checkboxResults[i]?.label || `Checkbox ${i + 1}`;
        
        const beforeUncheck = await checkbox.isChecked();
        await checkbox.click();
        await page.waitForTimeout(500);
        const afterUncheck = await checkbox.isChecked();
        
        logger.info(`Uncheck test "${labelText}": ${beforeUncheck ? 'checked' : 'unchecked'} → ${afterUncheck ? 'checked' : 'unchecked'}`);
        
      } catch (error) {
        logger.warn(`Failed to uncheck checkbox ${i + 1}:`, error);
      }
    }
  }

  private async getCheckboxLabel(page: any, checkbox: any): Promise<string> {
    try {
      // Try to find associated label by 'for' attribute
      const checkboxId = await checkbox.getAttribute('id');
      if (checkboxId) {
        const label = await page.$(`label[for="${checkboxId}"]`);
        if (label) {
          const text = await label.textContent();
          if (text) return text.trim();
        }
      }
      
      // Try to find parent label
      const parentLabel = await checkbox.evaluateHandle((el: Element) => {
        let parent = el.parentElement;
        while (parent && parent.tagName !== 'LABEL') {
          parent = parent.parentElement;
        }
        return parent;
      });
      
      if (parentLabel) {
        const text = await parentLabel.evaluate((el: Element) => el.textContent);
        if (text) return text.trim();
      }
      
      // Try to find nearby text
      const nearbyText = await checkbox.evaluateHandle((el: Element) => {
        const next = el.nextSibling;
        if (next && next.nodeType === Node.TEXT_NODE) {
          return next.textContent;
        }
        const nextElement = el.nextElementSibling;
        if (nextElement) {
          return nextElement.textContent;
        }
        return null;
      });
      
      if (nearbyText) {
        const text = await nearbyText.evaluate((node: any) => node);
        if (text) return String(text).trim();
      }
      
      return 'Unknown Label';
    } catch {
      return 'Unknown Label';
    }
  }

  private async takeScreenshot(name: string): Promise<void> {
    try {
      const page = (this.agent as any).page;
      await page.screenshot({ 
        path: `screenshots/inventory-test-${name}.png`,
        fullPage: true 
      });
      logger.debug(`Screenshot saved: inventory-test-${name}.png`);
    } catch (error) {
      logger.warn('Failed to take screenshot:', error);
    }
  }

  private async waitForUserInput(): Promise<void> {
    return new Promise<void>((resolve) => {
      process.stdin.once('data', () => {
        resolve();
      });
    });
  }

  private async getUserInput(): Promise<string> {
    return new Promise<string>((resolve) => {
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim());
      });
    });
  }

  private async generateTestReport(): Promise<void> {
    logger.info('\n📊 TEST REPORT');
    logger.info('================');
    
    const totalSteps = this.testResults.length;
    const successfulSteps = this.testResults.filter(r => r.success).length;
    const failedSteps = totalSteps - successfulSteps;
    
    logger.info(`Total Steps: ${totalSteps}`);
    logger.info(`Successful: ${successfulSteps}`);
    logger.info(`Failed: ${failedSteps}`);
    logger.info(`Success Rate: ${totalSteps > 0 ? ((successfulSteps / totalSteps) * 100).toFixed(1) : 0}%`);
    
    logger.info('\nStep Details:');
    this.testResults.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      logger.info(`${index + 1}. ${status} ${result.step}`);
      if (result.error) {
        logger.info(`   Error: ${result.error}`);
      }
    });
    
    logger.info('\n📸 Screenshots saved in screenshots/ directory');
    logger.info('🎯 Test completed!');
  }

  async cleanup(): Promise<void> {
    if (this.agent) {
      await this.agent.cleanup();
    }
  }
}

async function main() {
  // Check credentials
  if (!process.env.VAUTO_USERNAME || !process.env.VAUTO_PASSWORD) {
    logger.error('❌ VAuto credentials not found');
    logger.error('Please set VAUTO_USERNAME and VAUTO_PASSWORD environment variables');
    process.exit(1);
  }

  const tester = new InventoryFlowTester();
  
  try {
    await tester.runInteractiveTest();
  } catch (error) {
    logger.error('Test failed:', error);
  } finally {
    await tester.cleanup();
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, cleaning up...');
  process.exit(0);
});

main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});