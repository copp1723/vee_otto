#!/usr/bin/env node

import { chromium, Browser, Page } from 'playwright';
import * as dotenv from 'dotenv';
import { TaskOrchestrator, TaskResult } from '../core/services/TaskOrchestrator';
import { Logger } from '../core/utils/Logger';
import { createEnhancedOrchestrator } from '../core/utils/EnhancedTaskOrchestrator';
import {
  basicLoginTask,
  twoFactorAuthTask,
  navigateToInventoryTask,
  applyInventoryFiltersTask
} from '../platforms/vauto/tasks/VAutoTasks';
import { enhancedVehicleProcessingTask } from '../platforms/vauto/tasks/EnhancedVehicleProcessingTask';

// Load environment variables from .env file and process.env
dotenv.config();

const logger = new Logger('HybridVehicleProcessing');
const VERSION = '1.0.0';

/**
 * Safe parsing utilities for environment variables
 */
const safeParseInt = (envVar: string | undefined, defaultVal: number): number => {
  const parsed = Number(envVar ?? defaultVal);
  return isNaN(parsed) ? defaultVal : parsed;
};

const safeParseFloat = (envVar: string | undefined, defaultVal: number): number => {
  const parsed = parseFloat(envVar ?? String(defaultVal));
  return isNaN(parsed) ? defaultVal : parsed;
};

const safeParseBool = (envVar: string | undefined, defaultVal: boolean): boolean => {
  if (!envVar) return defaultVal;
  return envVar.toLowerCase() === 'true';
};

interface HybridConfig {
  username: string;
  password: string;
  webhookUrl?: string;
  headless: boolean;
  slowMo: number;
  maxVehiclesToProcess: number;
  readOnlyMode: boolean;
  runSpecificTasks?: string[];
  useSemanticFeatureMapping: boolean;
  semanticSimilarityThreshold: number;
  semanticMaxResults: number;
  viewportWidth: number;
  viewportHeight: number;
  enableTracing: boolean;
  retryAttempts: number;
}

/**
 * Creates a robust configuration object with safe defaults and validation
 */
function createHybridConfig(): HybridConfig {
  const config: HybridConfig = {
    username: process.env.VAUTO_USERNAME || '',
    password: process.env.VAUTO_PASSWORD || '',
    webhookUrl: process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/api/2fa/latest` : undefined,
    headless: safeParseBool(process.env.HEADLESS, true),
    slowMo: safeParseInt(process.env.SLOW_MO, 1000),
    maxVehiclesToProcess: safeParseInt(process.env.MAX_VEHICLES_TO_PROCESS, 5),
    readOnlyMode: safeParseBool(process.env.READ_ONLY_MODE, false),
    runSpecificTasks: process.env.RUN_SPECIFIC_TASKS ? process.env.RUN_SPECIFIC_TASKS.split(',').map(t => t.trim()) : undefined,
    useSemanticFeatureMapping: safeParseBool(process.env.USE_SEMANTIC_MAPPING, false),
    semanticSimilarityThreshold: safeParseFloat(process.env.SEMANTIC_THRESHOLD, 0.8),
    semanticMaxResults: safeParseInt(process.env.SEMANTIC_MAX_RESULTS, 5),
    viewportWidth: safeParseInt(process.env.VIEWPORT_WIDTH, 1920),
    viewportHeight: safeParseInt(process.env.VIEWPORT_HEIGHT, 1080),
    enableTracing: safeParseBool(process.env.ENABLE_TRACING, false),
    retryAttempts: safeParseInt(process.env.RETRY_ATTEMPTS, 3)
  };

  // Validation and warnings
  if (!config.username || !config.password) {
    throw new Error('❌ Missing required environment variables: VAUTO_USERNAME and VAUTO_PASSWORD');
  }

  if (!config.webhookUrl && !config.readOnlyMode) {
    logger.warn('⚠️  No webhook URL configured - 2FA may require manual intervention');
    logger.info('💡 Set PUBLIC_URL environment variable for automatic 2FA handling');
  }

  if (config.maxVehiclesToProcess > 50) {
    logger.warn(`⚠️  Processing ${config.maxVehiclesToProcess} vehicles may take a long time`);
    logger.info('💡 Consider using smaller batches for testing');
  }

  return config;
}

/**
 * Retry wrapper for flaky Playwright actions
 */
async function retryAction<T>(
  action: () => Promise<T>,
  actionName: string,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.debug(`🔄 ${actionName} - Attempt ${attempt}/${maxAttempts}`);
      return await action();
    } catch (error) {
      lastError = error as Error;
      logger.warn(`⚠️  ${actionName} failed on attempt ${attempt}: ${error}`);

      if (attempt < maxAttempts) {
        const delay = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
        logger.info(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`❌ ${actionName} failed after ${maxAttempts} attempts. Last error: ${lastError?.message}`);
}



/**
 * Hybrid VAuto Automation Runner
 *
 * This runner combines the robust 2FA/navigation capabilities from run-full-workflow.ts
 * with the enhanced vehicle processing capabilities from run-enhanced-vehicle-processing.ts
 */
/**
 * Runs the hybrid VAuto workflow, combining robust auth/nav with enhanced processing.
 *
 * This function orchestrates a two-phase approach:
 * Phase 1: Robust 2FA & Navigation (from run-full-workflow.ts)
 * Phase 2: Enhanced Vehicle Processing (from run-enhanced-vehicle-processing.ts)
 *
 * @throws {Error} If required env vars are missing or browser launch fails.
 */
async function runHybridVehicleProcessing() {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    logger.info(`🚀 Starting Hybrid VAuto Vehicle Processing v${VERSION}`);
    logger.info('💡 Combining robust 2FA/navigation + enhanced vehicle processing');

    // Create robust configuration
    const config = createHybridConfig();

    logger.info('📋 Configuration Summary:');
    logger.info(`  Username: ${config.username}`);
    logger.info(`  Headless: ${config.headless}`);
    logger.info(`  Slow Motion: ${config.slowMo}ms`);
    logger.info(`  Max Vehicles: ${config.maxVehiclesToProcess}`);
    logger.info(`  Read Only: ${config.readOnlyMode}`);
    logger.info(`  Semantic Mapping: ${config.useSemanticFeatureMapping}`);
    logger.info(`  Viewport: ${config.viewportWidth}x${config.viewportHeight}`);
    logger.info(`  Tracing: ${config.enableTracing ? 'Enabled' : 'Disabled'}`);
    logger.info(`  Retry Attempts: ${config.retryAttempts}`);
    logger.info(`  Webhook URL: ${config.webhookUrl ? 'Configured' : 'Not configured'}`);
    logger.info(`  Specific Tasks: ${config.runSpecificTasks?.join(', ') || 'All tasks'}`);

    // Initialize browser with enhanced settings
    logger.info('🌐 Initializing browser with hybrid optimizations...');
    browser = await retryAction(
      () => chromium.launch({
        headless: config.headless,
        slowMo: config.slowMo,
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled', // Detection avoidance
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      }),
      'Browser launch',
      config.retryAttempts
    );

    const context = await browser.newContext({
      viewport: { width: config.viewportWidth, height: config.viewportHeight },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Enable tracing in debug mode
    if (config.enableTracing && !config.headless) {
      logger.info('📹 Enabling browser tracing for debugging...');
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true
      });
    }

    page = await context.newPage();

    // Create enhanced task orchestrator with advanced features
    const orchestrator = createEnhancedOrchestrator('Hybrid-VAuto-Automation', {
      globalTimeout: 30 * 60 * 1000, // 30 minutes
      enableJsonSummary: true,
      retryConfig: {
        useExponentialBackoff: true,
        baseDelayMs: 1000,
        maxDelayMs: 30000
      }
    });

    // HYBRID APPROACH: Robust navigation + enhanced processing
    const hybridTasks = [
      basicLoginTask,           // ✅ Proven 2FA handling
      twoFactorAuthTask,        // ✅ Proven 2FA handling
      navigateToInventoryTask,  // ✅ Proven navigation
      applyInventoryFiltersTask, // ✅ Proven filtering
      enhancedVehicleProcessingTask // ✅ Enhanced vehicle processing
    ];

    // Filter tasks if specific ones are requested
    const tasksToRun = config.runSpecificTasks
      ? hybridTasks.filter(task => config.runSpecificTasks!.includes(task.id))
      : hybridTasks;

    if (tasksToRun.length === 0) {
      throw new Error(`No valid tasks found. Available: ${hybridTasks.map(t => t.id).join(', ')}`);
    }

    logger.info(`📚 Registering ${tasksToRun.length} hybrid tasks...`);

    for (const task of tasksToRun) {
      orchestrator.registerTask(task);
      logger.info(`  ✅ ${task.id}: ${task.name}`);
    }

    // Execute tasks with enhanced monitoring
    logger.info('🎯 Starting hybrid task execution...');
    logger.info('🔄 Phase 1: Robust 2FA & Navigation');
    logger.info('🔄 Phase 2: Enhanced Vehicle Processing');

    const startTime = Date.now();
    const results = await orchestrator.executeAll(page, config);
    const totalTime = Date.now() - startTime;

    // Save tracing if enabled
    if (config.enableTracing && !config.headless) {
      const tracePath = `traces/hybrid-execution-${Date.now()}.zip`;
      await context.tracing.stop({ path: tracePath });
      logger.info(`📹 Trace saved to: ${tracePath}`);
    }

    // Generate detailed summary
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

    logger.info(`✅ Hybrid automation completed successfully!`);
    logger.info(`📊 Final Results: ${successful}/${total} tasks completed in ${(totalTime/1000).toFixed(1)}s`);
    logger.info(`⚡ Average time per task: ${(totalTime/total/1000).toFixed(1)}s`);

    // Enhanced vehicle processing results with detailed metrics
    const vehicleProcessingResult = results.get('enhanced-process-vehicles');
    if (vehicleProcessingResult && vehicleProcessingResult.success && vehicleProcessingResult.data) {
      const data = vehicleProcessingResult.data;
      logger.info('\n🚗 Enhanced Vehicle Processing Summary:');
      logger.info(`  Total Vehicles Found: ${data.metadata?.totalVehicles || 0}`);
      logger.info(`  Successfully Processed: ${data.metadata?.processedVehicles || 0}`);
      logger.info(`  Failed to Process: ${data.metadata?.failedVehicles || 0}`);
      logger.info(`  Window Stickers Scraped: ${data.metadata?.windowStickersScraped || 0}`);
      logger.info(`  Total Features Found: ${data.metadata?.totalFeaturesFound || 0}`);
      logger.info(`  Total Checkboxes Updated: ${data.metadata?.totalCheckboxesUpdated || 0}`);

      // Success rate calculation
      const totalAttempted = (data.metadata?.processedVehicles || 0) + (data.metadata?.failedVehicles || 0);
      const successRate = totalAttempted > 0 ? ((data.metadata?.processedVehicles || 0) / totalAttempted * 100) : 0;
      logger.info(`  Success Rate: ${successRate.toFixed(1)}%`);

      if (data.metadata?.navigationMetrics) {
        const navMetrics = data.metadata.navigationMetrics;
        logger.info('\n📊 Navigation Performance Metrics:');
        logger.info(`  Navigation Success Rate: ${navMetrics.successRate?.toFixed(1)}%`);
        logger.info(`  Avg Navigation Time: ${navMetrics.avgNavigationTime ? (navMetrics.avgNavigationTime / 1000).toFixed(2) : 0}s`);
        if (navMetrics.timeBreakdown) {
          logger.info(`  Avg Tab Access Time: ${(navMetrics.timeBreakdown.tabAccess / 1000).toFixed(2)}s`);
          logger.info(`  Avg Window Sticker Time: ${(navMetrics.timeBreakdown.windowSticker / 1000).toFixed(2)}s`);
        }
      }

      // Performance recommendations
      if (successRate < 80) {
        logger.warn('⚠️  Success rate below 80% - consider adjusting timeouts or selectors');
      }
      if (totalTime > 300000) { // 5 minutes
        logger.info('💡 Long execution time - consider processing fewer vehicles per batch');
      }
    }

    // Regular vehicle processing fallback results
    const regularVehicleResult = results.get('process-vehicles');
    if (regularVehicleResult && regularVehicleResult.success && regularVehicleResult.data && !vehicleProcessingResult) {
      const vehicleData = regularVehicleResult.data;
      logger.info(`🚗 Vehicle Processing: ${vehicleData.processedVehicles}/${vehicleData.totalVehicles} vehicles processed`);
    }

  } catch (error) {
    logger.error('❌ Hybrid automation failed:', error);

    // Enhanced error reporting
    if (error instanceof Error) {
      logger.error(`   Error Type: ${error.constructor.name}`);
      logger.error(`   Error Message: ${error.message}`);
      if (error.stack) {
        logger.debug(`   Stack Trace: ${error.stack}`);
      }
    }

    process.exit(1);
  } finally {
    // Check if we should keep the browser open
    const keepAlive = process.env.KEEP_ALIVE === 'true' || process.argv.includes('--keep-alive');
    
    if (keepAlive) {
      logger.info('\n🔓 KEEP-ALIVE MODE: Browser will stay open for 1 hour');
      logger.info('📍 You can now run other scripts that connect to this session');
      logger.info('⏰ Session will expire at:', new Date(Date.now() + 60 * 60 * 1000).toLocaleTimeString());
      logger.info('🛑 Press Ctrl+C to close the browser and exit\n');
      
      // Keep the process alive for 1 hour
      await new Promise(resolve => setTimeout(resolve, 60 * 60 * 1000));
    }
    
    // Cleanup with error handling
    try {
      if (page) {
        await page.close();
        logger.debug('📄 Page closed successfully');
      }
      if (browser) {
        await browser.close();
        logger.debug('🌐 Browser closed successfully');
      }
    } catch (cleanupError) {
      logger.warn('⚠️  Cleanup warning:', cleanupError);
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
    logger.info(`🧪 Testing specific hybrid task: ${taskId}`);
    
    // Find the task
    const allTasks = [
      basicLoginTask,
      twoFactorAuthTask,
      navigateToInventoryTask,
      applyInventoryFiltersTask,
      enhancedVehicleProcessingTask
    ];
    
    const task = allTasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}. Available tasks: ${allTasks.map(t => t.id).join(', ')}`);
    }
    
    // Configuration for testing
    const config = {
      username: process.env.VAUTO_USERNAME || '',
      password: process.env.VAUTO_PASSWORD || '',
      webhookUrl: process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/api/2fa/latest` : 'http://localhost:3000/api/2fa/latest',
      headless: false, // Always visible for testing
      slowMo: 2000,
      maxVehiclesToProcess: 1,
      readOnlyMode: true // Safe for testing
    };
    
    // Initialize browser
    browser = await chromium.launch({
      headless: config.headless,
      slowMo: config.slowMo,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    
    page = await browser.newPage();
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Create orchestrator with test configuration
    const orchestrator = createEnhancedOrchestrator('Hybrid-Task-Test', {
      globalTimeout: 10 * 60 * 1000, // 10 minutes for testing
      enableJsonSummary: true,
      retryConfig: {
        useExponentialBackoff: true,
        baseDelayMs: 1000,
        maxDelayMs: 10000
      }
    });
    orchestrator.registerTask(task);
    
    const results = await orchestrator.executeAll(page, config);
    const result = results.get(taskId);
    
    if (result?.success) {
      logger.info(`✅ Task ${taskId} completed successfully`);
      if (result.data) {
        logger.info(`📊 Result data:`, result.data);
      }
    } else {
      logger.error(`❌ Task ${taskId} failed:`, result?.error);
    }
    
  } catch (error) {
    logger.error(`❌ Task test failed:`, error);
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0] === '--test-task') {
    if (args.length < 2) {
      logger.error('Usage: --test-task <task-id>');
      logger.info('Available tasks: basic-login, two-factor-auth, navigate-inventory, apply-filters, enhanced-process-vehicles');
      process.exit(1);
    }
    runSpecificTask(args[1]).catch(error => {
      logger.error('Fatal error:', error);
      process.exit(1);
    });
  } else {
    runHybridVehicleProcessing().catch(error => {
      logger.error('Fatal error:', error);
      process.exit(1);
    });
  }
}