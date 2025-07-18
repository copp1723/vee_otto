#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { chromium } from 'playwright';
import { Logger } from '../core/utils/Logger';

dotenv.config();

const logger = new Logger('HybridTest');

/**
 * Quick test to verify the hybrid script can be imported and basic functionality works
 */
async function testHybridScript() {
  logger.info('🧪 Testing Hybrid Vehicle Processing Script');
  
  try {
    // Test 1: Import the hybrid script
    logger.info('📦 Testing script import...');
    const hybridScript = require('./run-hybrid-vehicle-processing.ts');
    logger.info('✅ Hybrid script imported successfully');
    
    // Test 2: Verify environment variables
    logger.info('🔧 Testing environment configuration...');
    const hasUsername = !!process.env.VAUTO_USERNAME;
    const hasPassword = !!process.env.VAUTO_PASSWORD;
    
    logger.info(`  Username configured: ${hasUsername ? '✅' : '❌'}`);
    logger.info(`  Password configured: ${hasPassword ? '✅' : '❌'}`);
    
    if (!hasUsername || !hasPassword) {
      logger.warn('⚠️  Missing credentials - full test cannot run');
      logger.info('💡 Set VAUTO_USERNAME and VAUTO_PASSWORD environment variables');
    }
    
    // Test 3: Browser initialization test
    logger.info('🌐 Testing browser initialization...');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    logger.info('✅ Browser initialized successfully');
    
    // Test 4: Basic navigation test
    logger.info('🔍 Testing basic navigation...');
    await page.goto('https://www.google.com');
    const title = await page.title();
    logger.info(`✅ Navigation successful - Page title: ${title}`);
    
    await browser.close();
    
    // Test 5: Task import test
    logger.info('📋 Testing task imports...');
    try {
      const { basicLoginTask, twoFactorAuthTask, navigateToInventoryTask, applyInventoryFiltersTask } = require('../platforms/vauto/tasks/VAutoTasks');
      const { enhancedVehicleProcessingTask } = require('../platforms/vauto/tasks/EnhancedVehicleProcessingTask');
      
      logger.info('✅ All required tasks imported successfully');
      logger.info(`  - basicLoginTask: ${basicLoginTask.name}`);
      logger.info(`  - twoFactorAuthTask: ${twoFactorAuthTask.name}`);
      logger.info(`  - navigateToInventoryTask: ${navigateToInventoryTask.name}`);
      logger.info(`  - applyInventoryFiltersTask: ${applyInventoryFiltersTask.name}`);
      logger.info(`  - enhancedVehicleProcessingTask: ${enhancedVehicleProcessingTask.name}`);
      
    } catch (taskError) {
      logger.error('❌ Task import failed:', taskError);
      throw taskError;
    }
    
    logger.info('\n🎉 All hybrid script tests passed!');
    logger.info('💡 Ready to run: npm run vauto:hybrid-manual');
    
  } catch (error) {
    logger.error('❌ Hybrid script test failed:', error);
    process.exit(1);
  }
}

// Run the test
testHybridScript().catch(error => {
  logger.error('Fatal test error:', error);
  process.exit(1);
});