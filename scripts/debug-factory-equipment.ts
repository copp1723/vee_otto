import { chromium, Browser, Page } from 'playwright';
import * as dotenv from 'dotenv';
import { TaskOrchestrator } from '../core/services/TaskOrchestrator';
import {
  basicLoginTask,
  twoFactorAuthTask,
  navigateToInventoryTask,
  applyInventoryFiltersTask
} from '../platforms/vauto/tasks/VAutoTasks';
import { enhancedVehicleProcessingTask } from '../platforms/vauto/tasks/EnhancedVehicleProcessingTask';
import { Logger } from '../core/utils/Logger';

dotenv.config();

const logger = new Logger('EnhancedVehicleProcessing');

interface Config {
  username: string;
  password: string;
  webhookUrl?: string;
  headless: boolean;
  maxVehiclesToProcess?: number;
  readOnly?: boolean;
  runSpecificTasks?: string[];
  useSemanticFeatureMapping?: boolean;
  semanticSimilarityThreshold?: number;
  semanticMaxResults?: number;
}

async function runEnhancedVehicleProcessing() {
  const config: Config = {
    username: process.env.VAUTO_USERNAME || '',
    password: process.env.VAUTO_PASSWORD || '',
    webhookUrl: process.env.WEBHOOK_URL,
    headless: process.env.HEADLESS === 'true',
    maxVehiclesToProcess: process.env.MAX_VEHICLES_TO_PROCESS ? parseInt(process.env.MAX_VEHICLES_TO_PROCESS) : 1,
    readOnly: process.env.READ_ONLY === 'true',
    useSemanticFeatureMapping: process.env.USE_SEMANTIC_MAPPING === 'true',
    semanticSimilarityThreshold: process.env.SEMANTIC_THRESHOLD ? parseFloat(process.env.SEMANTIC_THRESHOLD) : 0.8,
    semanticMaxResults: process.env.SEMANTIC_MAX_RESULTS ? parseInt(process.env.SEMANTIC_MAX_RESULTS) : 5
  };

  // Parse specific tasks from command line
  const args = process.argv.slice(2);
  if (args.length > 0 && args[0] === '--tasks') {
    config.runSpecificTasks = args.slice(1);
  }

  if (!config.username || !config.password) {
    logger.error('❌ Missing required environment variables: VAUTO_USERNAME and VAUTO_PASSWORD');
    process.exit(1);
  }

  logger.info('🚀 Starting Enhanced Vehicle Processing Workflow...');
  logger.info(`Configuration:
  - Username: ${config.username}
  - Headless: ${config.headless}
  - Max Vehicles: ${config.maxVehiclesToProcess}
  - Read Only: ${config.readOnly}
  - Semantic Mapping: ${config.useSemanticFeatureMapping}
  - Webhook URL: ${config.webhookUrl ? 'Configured' : 'Not configured'}`);

  const browser = await chromium.launch({
    headless: config.headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--remote-debugging-port=9222'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    const orchestrator = new TaskOrchestrator('EnhancedVehicleProcessing');
    
    // Register all tasks including the enhanced vehicle processing task
    const allTasks = [
      basicLoginTask,
      twoFactorAuthTask,
      navigateToInventoryTask,
      applyInventoryFiltersTask,
      enhancedVehicleProcessingTask // Use enhanced task instead of regular one
    ];
    
    allTasks.forEach(task => orchestrator.registerTask(task));

    // Determine which tasks to run
    const tasksToRun = config.runSpecificTasks
      ? allTasks.filter(task => config.runSpecificTasks!.includes(task.id))
      : allTasks;

    logger.info(`📋 Tasks to run: ${tasksToRun.map(t => t.name).join(', ')}`);

    // Execute tasks
    const results = await orchestrator.executeAll(page, config);

    // Display results
    logger.info('\n📊 Task Results:');
    results.forEach((result, taskId) => {
      logger.info(`\n${orchestrator.getTask(taskId)?.name}:`);
      logger.info(`  Status: ${result.success ? '✅ Success' : '❌ Failure'}`);
      if (result.error) {
        logger.error(`  Error: ${result.error}`);
      }
      logger.info(`  Data: ${JSON.stringify(result.data, null, 2)}`);
    });

    logger.info('✅ Enhanced Vehicle Processing Workflow completed successfully!');
    logger.info('📊 Task Summary:');
    console.log(orchestrator.generateSummary());

    // Keep browser open for testing Factory Equipment functionality
    logger.info('🛑 Browser will remain open for 1 hour for Factory Equipment testing...');
    logger.info('💡 You can now run: HEADLESS=false npx ts-node scripts/test-factory-equipment-only.ts');
    logger.info('🔄 The browser will stay open at: http://localhost:9222');

    // Keep browser open for testing Factory Equipment functionality
    const CDP_PORT = '9222';
    
    // Enable CDP debugging
    await context.exposeBinding('cdpPort', () => CDP_PORT);
    
    logger.info('🛑 Browser will remain open for 1 hour for Factory Equipment testing...');
    logger.info(`💡 Browser is accessible via CDP at: http://localhost:${CDP_PORT}`);
    logger.info('💡 You can now run in another terminal: npx ts-node scripts/test-factory-equipment-only.ts');
    logger.info('💡 Or manually inspect the page to update selectors');

    // Wait for 1 hour (3600 seconds)
    const waitTime = 60 * 60 * 1000; // 1 hour in milliseconds
    const startTime = Date.now();
    const endTime = startTime + waitTime;

    logger.info(`⏰ Browser will close automatically at: ${new Date(endTime).toLocaleTimeString()}`);

    // Show periodic status updates every 5 minutes
    const updateInterval = 5 * 60 * 1000; // 5 minutes
    let nextUpdate = startTime + updateInterval;

    while (Date.now() < endTime) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds

      if (Date.now() >= nextUpdate) {
        const remainingTime = Math.ceil((endTime - Date.now()) / (60 * 1000)); // minutes remaining
        logger.info(`⏳ Browser still open - ${remainingTime} minutes remaining for testing`);
        logger.info(`💡 CDP still accessible at: http://localhost:${CDP_PORT}`);
        nextUpdate += updateInterval;
      }
    }

    logger.info('⏰ 1 hour elapsed - closing browser');

  } catch (error) {
    logger.error('❌ Enhanced Vehicle Processing failed:', error);

    // Still keep browser open for debugging even if there's an error
    logger.info('🛑 Browser will remain open for 30 minutes for debugging...');
    logger.info(`💡 Browser is accessible via CDP at: http://localhost:9222`);
    logger.info('💡 You can still test Factory Equipment with: npx ts-node scripts/test-factory-equipment-only.ts');

    await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000)); // 30 minutes

  } finally {
    if (browser) {
      await browser.close();
      logger.info('🔒 Browser closed');
    }
  }
}

runEnhancedVehicleProcessing();
