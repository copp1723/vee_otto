#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { VAutoAgent } from './src/agents/VAutoAgent';
import { Logger } from './src/utils/Logger';
import { chromium } from 'playwright';
import { vAutoSelectors } from './src/config/vautoSelectors';

// Load environment variables
dotenv.config();

const logger = new Logger('vAuto-Test');

async function testSelectors() {
  logger.info('Testing vAuto selectors and workflow');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000 // Slow down for visual inspection
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // Test 1: Navigate to login page
    logger.info('Test 1: Navigating to login page');
    await page.goto(vAutoSelectors.login.url);
    await page.waitForLoadState('networkidle');
    
    // Test 2: Check if login elements exist
    logger.info('Test 2: Checking login elements');
    const usernameField = await page.$(vAutoSelectors.login.username);
    const passwordField = await page.$(vAutoSelectors.login.password);
    
    if (usernameField) {
      logger.info('✓ Username field found');
    } else {
      logger.error('✗ Username field NOT found');
    }
    
    if (passwordField) {
      logger.info('✓ Password field found');
    } else {
      logger.error('✗ Password field NOT found');
    }
    
    // Pause for manual inspection
    logger.info('Pausing for manual inspection... Press Enter to continue');
    await new Promise(resolve => process.stdin.once('data', resolve));
    
  } catch (error) {
    logger.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

async function testFullWorkflow() {
  logger.info('Testing full vAuto workflow');
  
  const agent = new VAutoAgent({
    username: process.env.VAUTO_USERNAME || '',
    password: process.env.VAUTO_PASSWORD || '',
    headless: false,
    slowMo: 500,
    screenshotOnError: true
  });
  
  try {
    await agent.initialize();
    
    // Test login
    logger.info('Testing login...');
    const loginSuccess = await agent.login();
    logger.info(`Login result: ${loginSuccess ? 'SUCCESS' : 'FAILED'}`);
    
    if (loginSuccess) {
      // Test navigation to inventory
      logger.info('Testing inventory navigation...');
      await agent.navigateToInventory();
      
      // Pause for inspection
      logger.info('Pausing at inventory page... Press Enter to continue');
      await new Promise(resolve => process.stdin.once('data', resolve));
      
      // Test filter application
      logger.info('Testing filter application...');
      await agent.applyInventoryFilters();
      
      logger.info('Test completed successfully!');
    }
    
  } catch (error) {
    logger.error('Workflow test failed:', error);
  } finally {
    await agent.cleanup();
  }
}

async function main() {
  const testType = process.argv[2];
  
  console.log(`
vAuto Test Tool
==============

This tool helps test vAuto selectors and workflows.

Options:
  --selectors    Test individual selectors
  --workflow     Test full workflow (requires credentials)
  --help         Show this help message
`);
  
  if (testType === '--selectors') {
    await testSelectors();
  } else if (testType === '--workflow') {
    if (!process.env.VAUTO_USERNAME || !process.env.VAUTO_PASSWORD) {
      logger.error('Please set VAUTO_USERNAME and VAUTO_PASSWORD environment variables');
      process.exit(1);
    }
    await testFullWorkflow();
  } else {
    console.log('Please specify --selectors or --workflow');
  }
}

main().catch(error => {
  logger.error('Test failed:', error);
  process.exit(1);
});
