/**
 * Test script to verify the improved saved filters approach
 * This script specifically tests the "recent inventory" saved filter functionality
 */

import { chromium, Page } from 'playwright';
import { vAutoSelectors } from './platforms/vauto/vautoSelectors';
import { applyInventoryFiltersTask } from './platforms/vauto/tasks/VAutoTasks';
import { TaskContext, TaskResult } from './core/services/TaskOrchestrator';
import { Logger } from './core/utils/Logger';

async function testSavedFilters() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000  // Slow down for debugging
  });
  
  const page = await browser.newPage();
  
  // Create proper logger instance
  const logger = new Logger('saved-filters-test');
  
  // Mock config
  const config = {
    username: 'test_user',
    password: 'test_password'
  };
  
  try {
    logger.info('🧪 Starting saved filters test...');
    
    // Navigate to a test page or vAuto inventory page
    // For testing, you might want to use the mockup or actual vAuto page
    await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Dashboard/ProvisionEnterprise/Default.aspx');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Create task context
    const taskContext: TaskContext = {
      page,
      config,
      logger,
      results: new Map<string, TaskResult>()
    };
    
    // Test the improved saved filters task
    const result = await applyInventoryFiltersTask.execute(taskContext);
    
    logger.info('✅ Test completed successfully!');
    logger.info(`📊 Result: ${JSON.stringify(result, null, 2)}`);
    
    // Keep browser open for manual inspection
    await page.waitForTimeout(30000);
    
  } catch (error) {
    logger.error(`❌ Test failed: ${error}`);
    
    // Take screenshot on error
    await page.screenshot({ path: 'test-saved-filters-error.png' });
    
  } finally {
    await browser.close();
  }
}

// Run the test
testSavedFilters().catch(console.error); 