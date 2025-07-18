import { chromium, Browser, Page } from 'playwright';
import * as dotenv from 'dotenv';
import { TaskOrchestrator } from '../core/services/TaskOrchestrator';
import {
  basicLoginTask,
  twoFactorAuthTask,
  navigateToInventoryTask,
  applyInventoryFiltersTask,
  processVehicleInventoryTask
} from '../platforms/vauto/tasks/VAutoTasks';
import { Logger } from '../core/utils/Logger';

dotenv.config();

const logger = new Logger('StandardVehicleProcessing');

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

async function runStandardVehicleProcessing() {
  const config: Config = {
    username: process.env.VAUTO_USERNAME || '',
    password: process.env.VAUTO_PASSWORD || '',
    webhookUrl: process.env.WEBHOOK_URL,
    headless: process.env.HEADLESS !== 'false',
    maxVehiclesToProcess: process.env.MAX_VEHICLES ? parseInt(process.env.MAX_VEHICLES) : 5,
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

  logger.info('🚀 Starting Standard Vehicle Processing Workflow...');
  logger.info(`Configuration:
  - Username: ${config.username}
  - Headless: ${config.headless}
  - Max Vehicles: ${config.maxVehiclesToProcess}
  - Read Only: ${config.readOnly}
  - Semantic Mapping: ${config.useSemanticFeatureMapping}
  - Webhook URL: ${config.webhookUrl ? 'Configured' : 'Not configured'}`);

  const browser = await chromium.launch({
    headless: config.headless,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    const orchestrator = new TaskOrchestrator('StandardVehicleProcessing');
    
    const allTasks = [
      basicLoginTask,
      twoFactorAuthTask,
      navigateToInventoryTask,
      applyInventoryFiltersTask,
      processVehicleInventoryTask
    ];
    
    allTasks.forEach(task => orchestrator.registerTask(task));

    const tasksToRun = config.runSpecificTasks
      ? allTasks.filter(task => config.runSpecificTasks!.includes(task.id))
      : allTasks;

    logger.info(`📋 Tasks to run: ${tasksToRun.map(t => t.name).join(', ')}`);

    const results = await orchestrator.executeAll(page, config);

    logger.info('\n📊 Task Results:');
    results.forEach((result, taskId) => {
      const task = allTasks.find(t => t.id === taskId);
      if (task) {
        logger.info(`\n${task.name}:`);
        logger.info(`  Status: ${result.success ? '✅ Success' : '❌ Failed'}`);
        if (result.error) {
          logger.error(`  Error: ${result.error}`);
        }
        if (result.data) {
          logger.info(`  Data: ${JSON.stringify(result.data, null, 2)}`);
        }
      }
    });

    const vehicleProcessingResult = results.get('process-vehicles');
    if (vehicleProcessingResult && vehicleProcessingResult.success && vehicleProcessingResult.data) {
      const data = vehicleProcessingResult.data;
      logger.info('\n🚗 Vehicle Processing Summary:');
      logger.info(`  Total Vehicles: ${data.metadata?.totalVehicles || 0}`);
      logger.info(`  Processed: ${data.metadata?.processedVehicles || 0}`);
      logger.info(`  Failed: ${data.metadata?.failedVehicles || 0}`);
      logger.info(`  Window Stickers Scraped: ${data.metadata?.windowStickersScraped || 0}`);
      logger.info(`  Total Features Found: ${data.metadata?.totalFeaturesFound || 0}`);
      logger.info(`  Total Checkboxes Updated: ${data.metadata?.totalCheckboxesUpdated || 0}`);
      
      if (data.metadata?.navigationMetrics) {
        const navMetrics = data.metadata.navigationMetrics;
        logger.info('\n📊 Navigation Performance:');
        logger.info(`  Success Rate: ${navMetrics.successRate?.toFixed(1)}%`);
        logger.info(`  Avg Navigation Time: ${navMetrics.avgNavigationTime ? (navMetrics.avgNavigationTime / 1000).toFixed(2) : 0}s`);
        if (navMetrics.timeBreakdown) {
          logger.info(`  Avg Tab Access Time: ${(navMetrics.timeBreakdown.tabAccess / 1000).toFixed(2)}s`);
          logger.info(`  Avg Window Sticker Time: ${(navMetrics.timeBreakdown.windowSticker / 1000).toFixed(2)}s`);
        }
      }
    }

  } catch (error) {
    logger.error('❌ Workflow failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the workflow
runStandardVehicleProcessing().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});