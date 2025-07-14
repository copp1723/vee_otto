import { chromium, Browser, Page } from 'playwright';
import { TaskOrchestrator } from '../core/services/TaskOrchestrator';
import { allVAutoTasks } from '../platforms/vauto/tasks/VAutoTasks';
import { Logger } from '../core/utils/Logger';
import * as dotenv from 'dotenv';

dotenv.config();

const logger = new Logger('FullWorkflow');

/**
 * Run the complete VAuto workflow with window sticker scraping and checkbox updating
 */
async function runFullWorkflow() {
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    logger.info('🚀 Starting Full VAuto Workflow...');
    logger.info('==================================');
    
    // Validate configuration
    if (!process.env.VAUTO_USERNAME || !process.env.VAUTO_PASSWORD) {
      throw new Error('Missing required environment variables: VAUTO_USERNAME and VAUTO_PASSWORD');
    }
    
    // Configuration
    const config = {
      username: process.env.VAUTO_USERNAME,
      password: process.env.VAUTO_PASSWORD,
      dealershipId: process.env.VAUTO_DEALERSHIP_ID,
      webhookUrl: process.env.WEBHOOK_URL || 'http://localhost:3000/api/2fa/latest',
      maxVehiclesToProcess: parseInt(process.env.MAX_VEHICLES_TO_PROCESS || '0') || undefined,
      readOnlyMode: process.env.READ_ONLY_MODE === 'true',
      headless: process.env.HEADLESS === 'true',
      slowMo: parseInt(process.env.SLOW_MO || '0'),
      timeout: 30000,
      screenshotOnError: true
    };
    
    // Log configuration
    logger.info('📋 Configuration:');
    logger.info(`- Username: ${config.username}`);
    logger.info(`- Max Vehicles: ${config.maxVehiclesToProcess || 'All'}`);
    logger.info(`- Read-Only Mode: ${config.readOnlyMode}`);
    logger.info(`- Headless: ${config.headless}`);
    logger.info(`- 2FA Method: ${process.env.TWO_FACTOR_METHOD || 'SMS'}`);
    
    // Launch browser
    browser = await chromium.launch({
      headless: config.headless,
      slowMo: config.slowMo,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });
    
    page = await browser.newPage();
    
    // Set viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Create task orchestrator
    const orchestrator = new TaskOrchestrator('FullWorkflow');
    
    // Register all tasks
    allVAutoTasks.forEach(task => orchestrator.registerTask(task));
    
    logger.info('📊 Registered tasks:');
    allVAutoTasks.forEach(task => {
      logger.info(`  - ${task.id}: ${task.name}`);
    });
    
    // Execute all tasks
    logger.info('\n🔄 Starting task execution...\n');
    const results = await orchestrator.executeAll(page, config);
    
    // Generate summary
    const summary = orchestrator.generateSummary();
    logger.info('\n📊 Execution Summary:');
    logger.info(summary);
    
    // Get specific task results
    const processVehiclesResult = orchestrator.getTaskResult('process-vehicles');
    if (processVehiclesResult?.success && processVehiclesResult.data) {
      const data = processVehiclesResult.data;
      logger.info('\n🚗 Vehicle Processing Results:');
      logger.info(`- Total Vehicles: ${data.totalVehicles}`);
      logger.info(`- Processed: ${data.processedVehicles}`);
      logger.info(`- Failed: ${data.failedVehicles}`);
      logger.info(`- Window Stickers Scraped: ${data.windowStickersScraped}`);
      logger.info(`- Total Features Found: ${data.totalFeaturesFound}`);
      logger.info(`- Total Checkboxes Updated: ${data.totalCheckboxesUpdated}`);
      
      if (data.reportPaths) {
        logger.info('\n📄 Reports Generated:');
        logger.info(`- CSV: ${data.reportPaths.csv}`);
        logger.info(`- JSON: ${data.reportPaths.json}`);
        logger.info(`- HTML: ${data.reportPaths.html}`);
      }
      
      if (data.errors && data.errors.length > 0) {
        logger.warn('\n⚠️ Errors Encountered:');
        data.errors.forEach((error: any) => {
          logger.warn(`- VIN ${error.vin}: ${error.error}`);
        });
      }
    }
    
    logger.info('\n✅ Full workflow completed successfully!');
    
  } catch (error) {
    logger.error('❌ Full workflow failed:', error);
    
    // Take screenshot on error
    if (page) {
      try {
        await page.screenshot({ 
          path: `screenshots/error-${Date.now()}.png`,
          fullPage: true 
        });
      } catch (screenshotError) {
        logger.warn('Failed to take error screenshot:', screenshotError);
      }
    }
    
    throw error;
    
  } finally {
    // Cleanup
    if (browser) {
      await browser.close();
    }
  }
}

// Run the workflow
if (require.main === module) {
  runFullWorkflow()
    .then(() => {
      logger.info('🎉 Workflow execution completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('💥 Workflow execution failed:', error);
      process.exit(1);
    });
} 