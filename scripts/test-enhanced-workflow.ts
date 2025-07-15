#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { chromium, Browser, Page } from 'playwright';
import { Logger } from '../core/utils/Logger';
import { TaskOrchestrator } from '../core/services/TaskOrchestrator';
import { 
  basicLoginTask, 
  twoFactorAuthTask, 
  navigateToInventoryTask, 
  applyInventoryFiltersTask 
} from '../platforms/vauto/tasks/VAutoTasks';
import { fixedVehicleProcessingTask } from '../platforms/vauto/tasks/FixedVehicleProcessingTask';

// Load environment variables
dotenv.config();

const logger = new Logger('EnhancedWorkflowTest');

interface TestConfig {
  username: string;
  password: string;
  webhookUrl?: string;
  headless?: boolean;
  slowMo?: number;
  maxVehiclesToProcess?: number;
  readOnlyMode?: boolean;
}

/**
 * Test the enhanced workflow with new services
 */
async function testEnhancedWorkflow() {
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    logger.info('🚀 Starting Enhanced Workflow Test');
    
    // Configuration
    const config: TestConfig = {
      username: process.env.VAUTO_USERNAME || '',
      password: process.env.VAUTO_PASSWORD || '',
      webhookUrl: process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/api/2fa/latest` : 'http://localhost:3000/api/2fa/latest',
      headless: process.env.HEADLESS === 'true',
      slowMo: parseInt(process.env.SLOW_MO || '1000'),
      maxVehiclesToProcess: parseInt(process.env.MAX_VEHICLES_TO_PROCESS || '2'), // Test with 2 vehicles
      readOnlyMode: process.env.READ_ONLY_MODE === 'true'
    };
    
    // Validate configuration
    if (!config.username || !config.password) {
      throw new Error('Missing required environment variables: VAUTO_USERNAME and VAUTO_PASSWORD');
    }
    
    logger.info('📋 Test Configuration:');
    logger.info(`  Username: ${config.username}`);
    logger.info(`  Headless: ${config.headless}`);
    logger.info(`  Slow Motion: ${config.slowMo}ms`);
    logger.info(`  Max Vehicles: ${config.maxVehiclesToProcess}`);
    logger.info(`  Read Only: ${config.readOnlyMode}`);
    logger.info(`  Webhook URL: ${config.webhookUrl}`);
    
    // Initialize browser
    logger.info('🌐 Initializing browser...');
    browser = await chromium.launch({
      headless: config.headless,
      slowMo: config.slowMo,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    
    page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Create task orchestrator
    const orchestrator = new TaskOrchestrator('Enhanced-Workflow-Test');
    
    // Register tasks in order
    const tasks = [
      basicLoginTask,
      twoFactorAuthTask,
      navigateToInventoryTask,
      applyInventoryFiltersTask,
fixedVehicleProcessingTask // Use the fixed navigation task
    ];
    
    logger.info(`📚 Registering ${tasks.length} tasks...`);
    
    for (const task of tasks) {
      orchestrator.registerTask(task);
      logger.info(`  ✅ ${task.id}: ${task.name}`);
    }
    
    // Execute tasks
    logger.info('🎯 Starting enhanced workflow execution...');
    
    const startTime = Date.now();
    const results = await orchestrator.executeAll(page, config);
    const totalTime = Date.now() - startTime;
    
    // Generate and display summary
    const summary = orchestrator.generateSummary();
    logger.info(summary);
    
    // Check for critical failures
    const failedCriticalTasks = Array.from(results.values())
      .filter(result => !result.success && tasks.find(t => t.id === result.taskId)?.critical);
    
    if (failedCriticalTasks.length > 0) {
      logger.error(`❌ Critical tasks failed: ${failedCriticalTasks.map(t => t.taskId).join(', ')}`);
      process.exit(1);
    }
    
    // Success metrics
    const successful = Array.from(results.values()).filter(r => r.success).length;
    const total = results.size;
    
    logger.info(`✅ Enhanced workflow test completed!`);
    logger.info(`📊 Results: ${successful}/${total} tasks completed in ${(totalTime/1000).toFixed(1)}s`);
    
    // Fixed vehicle processing results
    const vehicleProcessingResult = results.get('fixed-process-vehicles');
    if (vehicleProcessingResult && vehicleProcessingResult.success && vehicleProcessingResult.data) {
      const vehicleData = vehicleProcessingResult.data;
      logger.info(`🚗 Enhanced Vehicle Processing Results:`);
      logger.info(`  Total Vehicles: ${vehicleData.totalVehicles}`);
      logger.info(`  Processed: ${vehicleData.processedVehicles}`);
      logger.info(`  Failed: ${vehicleData.failedVehicles}`);
      logger.info(`  Window Stickers Scraped: ${vehicleData.windowStickersScraped}`);
      logger.info(`  Features Found: ${vehicleData.totalFeaturesFound}`);
      logger.info(`  Checkboxes Updated: ${vehicleData.totalCheckboxesUpdated}`);
      
      if (vehicleData.reportPaths) {
        logger.info(`  Reports Generated: ${Object.keys(vehicleData.reportPaths).join(', ')}`);
      }
    }
    
  } catch (error) {
    logger.error('❌ Enhanced workflow test failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Test specific service in isolation
 */
async function testSpecificService(serviceName: string) {
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    logger.info(`🧪 Testing specific service: ${serviceName}`);
    
    // Initialize browser
    browser = await chromium.launch({
      headless: false, // Always visible for service testing
      slowMo: 1000,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    
    page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    switch (serviceName) {
      case 'window-sticker-access':
        await testWindowStickerAccessService(page);
        break;
      case 'checkbox-mapping':
        await testCheckboxMappingService(page);
        break;
      case 'recovery':
        await testRecoveryService(page);
        break;
      default:
        throw new Error(`Unknown service: ${serviceName}`);
    }
    
  } catch (error) {
    logger.error(`❌ Service test failed:`, error);
    process.exit(1);
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

async function testWindowStickerAccessService(page: Page) {
  logger.info('🧪 Testing WindowStickerAccessService...');
  
  // Navigate to a test page or mock
  await page.goto('http://localhost:3001'); // Assuming mockup server
  
  const { WindowStickerAccessService } = await import('../core/services/WindowStickerAccessService');
  const service = new WindowStickerAccessService(page, logger);
  
  const result = await service.accessWindowSticker();
  
  logger.info(`Result: ${JSON.stringify(result, null, 2)}`);
}

async function testCheckboxMappingService(page: Page) {
  logger.info('🧪 Testing VAutoCheckboxMappingService...');
  
  // Navigate to a test page with checkboxes
  await page.goto('http://localhost:3001'); // Assuming mockup server
  
  const { VAutoCheckboxMappingService } = await import('../core/services/VAutoCheckboxMappingService');
  const service = new VAutoCheckboxMappingService(page, logger);
  
  const testFeatures = ['Leather Seats', 'Navigation System', 'Sunroof'];
  const result = await service.mapAndUpdateCheckboxes(testFeatures);
  
  logger.info(`Result: ${JSON.stringify(result, null, 2)}`);
}

async function testRecoveryService(page: Page) {
  logger.info('🧪 Testing WorkflowRecoveryService...');
  
  const { WorkflowRecoveryService } = await import('../core/services/WorkflowRecoveryService');
  const service = new WorkflowRecoveryService(page, logger);
  
  // Test navigation recovery
  const result = await service.recoverFromNavigationFailure();
  
  logger.info(`Result: ${JSON.stringify(result, null, 2)}`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    logger.info('Enhanced Workflow Test Usage:');
    logger.info('  npm run test:enhanced                    # Run full enhanced workflow');
    logger.info('  npm run test:enhanced -- --service window-sticker-access  # Test specific service');
    logger.info('  npm run test:enhanced -- --service checkbox-mapping       # Test checkbox mapping');
    logger.info('  npm run test:enhanced -- --service recovery               # Test recovery service');
    return;
  }
  
  const serviceIndex = args.indexOf('--service');
  if (serviceIndex !== -1 && args[serviceIndex + 1]) {
    const serviceName = args[serviceIndex + 1];
    await testSpecificService(serviceName);
    return;
  }
  
  // Run full enhanced workflow
  await testEnhancedWorkflow();
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run main function
main().catch(error => {
  logger.error('Main execution failed:', error);
  process.exit(1);
});