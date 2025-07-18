#!/usr/bin/env node

import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import { Logger } from '../core/utils/Logger';
import * as fs from 'fs-extra';

dotenv.config();

const logger = new Logger('MVP-Test');

async function testBasics() {
  logger.info('🧪 Testing MVP basic functionality...');
  
  // Test 1: Environment variables
  logger.info('\n📋 Test 1: Environment Variables');
  const username = process.env.VAUTO_USERNAME;
  const password = process.env.VAUTO_PASSWORD;
  
  if (!username || !password) {
    logger.error('❌ Missing VAUTO_USERNAME or VAUTO_PASSWORD');
    return false;
  }
  logger.info('✅ Environment variables are set');
  
  // Test 2: Directory creation
  logger.info('\n📋 Test 2: Directory Creation');
  try {
    await fs.ensureDir('screenshots/mvp');
    await fs.ensureDir('reports/mvp');
    await fs.ensureDir('session');
    logger.info('✅ Directories created successfully');
  } catch (error) {
    logger.error('❌ Failed to create directories:', error);
    return false;
  }
  
  // Test 3: Browser launch
  logger.info('\n📋 Test 3: Browser Launch');
  let browser = null;
  try {
    browser = await chromium.launch({
      headless: false,
      slowMo: 1000
    });
    const page = await browser.newPage();
    await page.goto('https://www.google.com');
    logger.info('✅ Browser launched and navigated successfully');
    await browser.close();
  } catch (error) {
    logger.error('❌ Browser launch failed:', error);
    if (browser) await browser.close();
    return false;
  }
  
  // Test 4: Service imports
  logger.info('\n📋 Test 4: Service Imports');
  try {
    const { WindowStickerService } = await import('../core/services/WindowStickerService');
    const { VAutoCheckboxMappingService } = await import('../core/services/VAutoCheckboxMappingService');
    const { VehicleModalNavigationService } = await import('../platforms/vauto/services/VehicleModalNavigationService');
    logger.info('✅ All services imported successfully');
  } catch (error) {
    logger.error('❌ Service import failed:', error);
    return false;
  }
  
  logger.info('\n✅ All basic tests passed!');
  logger.info('📋 Ready to run the full MVP');
  return true;
}

// Run tests
testBasics()
  .then(success => {
    if (success) {
      logger.info('\n🎯 You can now run: ./scripts/run-mvp.sh');
    } else {
      logger.error('\n❌ Please fix the issues before running the MVP');
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  });