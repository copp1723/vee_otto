#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { chromium, Browser, Page } from 'playwright';
import { Logger } from '../core/utils/Logger';
import { TaskOrchestrator } from '../core/services/TaskOrchestrator';
import { allVAutoTasks } from '../platforms/vauto/tasks/VAutoTasks';

// Load environment variables
dotenv.config();

const logger = new Logger('VAutoModular');

interface ModularConfig {
  username: string;
  password: string;
  webhookUrl?: string;
  headless?: boolean;
  slowMo?: number;
  maxVehiclesToProcess?: number;
  readOnlyMode?: boolean;
  runSpecificTasks?: string[];
}

/**
 * Modular VAuto Automation Runner
 * 
 * This runner executes VAuto automation tasks in a modular, waterfall approach.
 * Each task is independent and can be run/tested separately.
 */
async function runModularAutomation() {
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    logger.info('🚀 Starting Modular VAuto Automation');
    
    // Configuration
    const config: ModularConfig = {
      username: process.env.VAUTO_USERNAME || '',
      password: process.env.VAUTO_PASSWORD || '',
      webhookUrl: process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/api/2fa/latest` : 'http://localhost:3000/api/2fa/latest',
      headless: process.env.HEADLESS === 'true',
      slowMo: parseInt(process.env.SLOW_MO || '1000'),
      maxVehiclesToProcess: parseInt(process.env.MAX_VEHICLES_TO_PROCESS || '1'),
      readOnlyMode: process.env.READ_ONLY_MODE === 'true',
      runSpecificTasks: process.env.RUN_SPECIFIC_TASKS ? process.env.RUN_SPECIFIC_TASKS.split(',') : undefined
    };
    
    // Validate configuration
    if (!config.username || !config.password) {
      throw new Error('Missing required environment variables: VAUTO_USERNAME and VAUTO_PASSWORD');
    }
    
         logger.info('📋 Configuration:');
     logger.info(`  Username: ${config.username}`);
     logger.info(`  Headless: ${config.headless}`);
     logger.info(`  Slow Motion: ${config.slowMo}ms`);
     logger.info(`  Max Vehicles: ${config.maxVehiclesToProcess}`);
     logger.info(`  Read Only: ${config.readOnlyMode}`);
     logger.info(`  Webhook URL: ${config.webhookUrl}`);
     logger.info(`  Specific Tasks: ${config.runSpecificTasks || 'all'}`);
    
    // Initialize browser
    logger.info('🌐 Initializing browser...');
    browser = await chromium.launch({
      headless: config.headless,
      slowMo: config.slowMo,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    
    page = await browser.newPage();
    
    // Set up page
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Create task orchestrator
    const orchestrator = new TaskOrchestrator('VAuto-Automation');
    
    // Register tasks
    const tasksToRun = config.runSpecificTasks 
      ? allVAutoTasks.filter(task => config.runSpecificTasks!.includes(task.id))
      : allVAutoTasks;
    
    logger.info(`📚 Registering ${tasksToRun.length} tasks...`);
    
    for (const task of tasksToRun) {
      orchestrator.registerTask(task);
      logger.info(`  ✅ ${task.id}: ${task.name}`);
    }
    
    // Execute tasks
    logger.info('🎯 Starting task execution...');
    
    const startTime = Date.now();
    const results = await orchestrator.executeAll(page, config);
    const totalTime = Date.now() - startTime;
    
    // Generate and display summary
    const summary = orchestrator.generateSummary();
    logger.info(summary);
    
    // Check for critical failures
    const failedCriticalTasks = Array.from(results.values())
      .filter(result => !result.success && tasksToRun.find(t => t.id === result.taskId)?.critical);
    
    if (failedCriticalTasks.length > 0) {
      logger.error(`❌ Critical tasks failed: ${failedCriticalTasks.map(t => t.taskId).join(', ')}`);
      process.exit(1);
    }
    
    // Success metrics
    const successful = Array.from(results.values()).filter(r => r.success).length;
    const total = results.size;
    
    logger.info(`✅ Modular automation completed successfully!`);
    logger.info(`📊 Results: ${successful}/${total} tasks completed in ${(totalTime/1000).toFixed(1)}s`);
    
    // If vehicle processing was successful, show vehicle metrics
    const vehicleProcessingResult = results.get('process-vehicles');
    if (vehicleProcessingResult && vehicleProcessingResult.success && vehicleProcessingResult.data) {
      const vehicleData = vehicleProcessingResult.data;
      logger.info(`🚗 Vehicle Processing: ${vehicleData.processedVehicles}/${vehicleData.totalVehicles} vehicles processed`);
    }
    
  } catch (error) {
    logger.error('❌ Modular automation failed:', error);
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
 * Run specific task for testing
 */
async function runSpecificTask(taskId: string) {
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    logger.info(`🧪 Testing specific task: ${taskId}`);
    
    // Find the task
    const task = allVAutoTasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    logger.info(`📋 Task: ${task.name} - ${task.description}`);
    
    // Check dependencies
    if (task.dependencies.length > 0) {
      logger.warn(`⚠️  Task has dependencies: ${task.dependencies.join(', ')}`);
      logger.warn(`   You may need to run the full automation or ensure dependencies are satisfied`);
    }
    
    // Configuration
    const config: ModularConfig = {
      username: process.env.VAUTO_USERNAME || '',
      password: process.env.VAUTO_PASSWORD || '',
      webhookUrl: process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/api/2fa/latest` : 'http://localhost:3000/api/2fa/latest',
      headless: process.env.HEADLESS === 'true',
      slowMo: parseInt(process.env.SLOW_MO || '1000'),
      maxVehiclesToProcess: parseInt(process.env.MAX_VEHICLES_TO_PROCESS || '1'),
      readOnlyMode: process.env.READ_ONLY_MODE === 'true'
    };
    
    // Initialize browser
    browser = await chromium.launch({
      headless: config.headless,
      slowMo: config.slowMo,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    
    page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Create orchestrator and run single task
    const orchestrator = new TaskOrchestrator(`Test-${taskId}`);
    orchestrator.registerTask(task);
    
    const startTime = Date.now();
    const results = await orchestrator.executeAll(page, config);
    const totalTime = Date.now() - startTime;
    
    const result = results.get(taskId);
    if (result && result.success) {
      logger.info(`✅ Task test completed successfully in ${(totalTime/1000).toFixed(1)}s`);
             if (result.data) {
         logger.info(`📊 Task data: ${JSON.stringify(result.data, null, 2)}`);
       }
    } else {
      logger.error(`❌ Task test failed: ${result?.error || 'Unknown error'}`);
      process.exit(1);
    }
    
  } catch (error) {
    logger.error(`❌ Task test failed:`, error);
    process.exit(1);
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

/**
 * Show available tasks
 */
function showTasks() {
  logger.info('📚 Available VAuto Tasks:');
  logger.info('========================');
  
  for (const task of allVAutoTasks) {
    const deps = task.dependencies.length > 0 ? ` (depends on: ${task.dependencies.join(', ')})` : '';
    const critical = task.critical ? ' [CRITICAL]' : '';
    
    logger.info(`🔹 ${task.id}${critical}`);
    logger.info(`   ${task.name} - ${task.description}${deps}`);
    logger.info(`   Timeout: ${(task.timeout || 300000)/1000}s, Retries: ${task.retryCount || 0}`);
    logger.info('');
  }
  
  logger.info('Usage Examples:');
  logger.info('  npm run vauto:modular                    # Run all tasks');
  logger.info('  npm run vauto:modular -- --task basic-login  # Test specific task');
  logger.info('  RUN_SPECIFIC_TASKS=basic-login,2fa-auth npm run vauto:modular  # Run subset');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showTasks();
    return;
  }
  
  if (args.includes('--tasks')) {
    showTasks();
    return;
  }
  
  const taskIndex = args.indexOf('--task');
  if (taskIndex !== -1 && args[taskIndex + 1]) {
    const taskId = args[taskIndex + 1];
    await runSpecificTask(taskId);
    return;
  }
  
  // Run full automation
  await runModularAutomation();
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
  logger.error('Main function failed:', error);
  process.exit(1);
}); 