/**
 * Example: Integrating Phase 1 Enhancements into vAuto Tasks
 * 
 * This shows how to gradually adopt the new utilities without breaking existing code
 */

// BEFORE: Original code
/*
import { Logger } from '../core/utils/Logger';

const logger = new Logger('VAutoTasks');

// In processVehicleInventoryTask function:
logger.info('Applying inventory filters using SAVED FILTERS approach...');

// Risky dropdown selection:
await page.click('button:has-text("Saved Filters")');
await page.waitForTimeout(1000);
const dropdownItems = await page.$$('//ul[contains(@class, "x-menu-list")]//li');
for (const item of dropdownItems) {
  const text = await item.textContent();
  if (text?.includes('recent inventory')) {
    await item.click();
    break;
  }
}
*/

// AFTER: Enhanced code with Phase 1 utilities
import { createEnhancedLogger } from '../core/utils/EnhancedLogger';
import { selectSafeDropdownOption } from '../core/utils/dropdownUtils';

// Create enhanced logger (can coexist with regular Logger)
const logger = createEnhancedLogger('VAutoTasks');

// Example 1: Enhanced logging in processVehicleInventoryTask
export async function processVehicleInventoryTaskEnhanced(page: any) {
  logger.logSearch('Applying inventory filters using SAVED FILTERS approach...');
  
  const startTime = Date.now();
  
  try {
    // Safe dropdown selection
    const success = await selectSafeDropdownOption(
      page,
      'button:has-text("Saved Filters")',
      '//ul[contains(@class, "x-menu-list")]//li',
      'recent inventory'
    );
    
    if (success) {
      // Wait for results
      await page.waitForTimeout(2000);
      
      // Count vehicles
      const vehicleCount = await page.$$eval(
        '//div[@class="vehicle-row"]',
        (elements: any[]) => elements.length
      );
      
      logger.logSuccess(`Saved filter "recent inventory" applied successfully`, {
        vehicleCount,
        duration: Date.now() - startTime
      });
      
      logger.logFilter('Filter applied', {
        filterName: 'recent inventory',
        vehicleCount,
        criteria: { age: '0-1 days' }
      });
    } else {
      logger.error('Failed to apply saved filter');
    }
  } catch (error) {
    logger.error('Error applying filters', { error });
    throw error;
  }
}

// Example 2: Enhanced vehicle processing
export async function processVehicleEnhanced(page: any, vehicleData: any, index: number, total: number) {
  logger.logVehicleProcessing({
    index,
    total,
    vin: vehicleData.vin,
    id: vehicleData.id,
    status: 'starting'
  });
  
  const vehicleStartTime = Date.now();
  
  try {
    // Click vehicle link
    logger.logTarget(`Clicking vehicle link for ${vehicleData.vin}`);
    await page.click(vehicleData.selector);
    
    // Wait for page load
    logger.logSearch('Waiting for Vehicle Info tab...');
    await page.waitForSelector('text="Vehicle Info"');
    
    // Process window sticker
    logger.logSearch('Looking for window sticker popup...');
    // ... processing logic ...
    
    logger.logSuccess(`Vehicle processed successfully`, {
      vin: vehicleData.vin,
      featuresFound: 25,
      checkboxesUpdated: 18
    });
    
    logger.logTiming(`Vehicle ${vehicleData.vin} processing`, Date.now() - vehicleStartTime);
    
  } catch (error) {
    logger.error(`Failed to process vehicle ${vehicleData.vin}`, { error, vehicleData });
    throw error;
  }
}

// Example 3: Gradual migration approach
export class VAutoTasksEnhanced {
  private logger: any;
  private legacyLogger: any;
  
  constructor() {
    // Keep both loggers during transition
    this.logger = createEnhancedLogger('VAutoTasks');
    this.legacyLogger = new (require('../core/utils/Logger').Logger)('VAutoTasks');
  }
  
  // New methods use enhanced logger
  async applySmartFilters(page: any) {
    this.logger.logFilter('Applying smart filters...');
    
    const success = await selectSafeDropdownOption(
      page,
      'button:has-text("Saved Filters")',
      '//ul[contains(@class, "x-menu-list")]//li',
      'recent inventory'
    );
    
    if (success) {
      this.logger.logSuccess('Smart filters applied');
    }
    
    return success;
  }
  
  // Existing methods continue using legacy logger
  async doSomethingElse() {
    this.legacyLogger.info('Using legacy logger for existing code');
  }
}

// Example 4: Feature flag approach
const USE_ENHANCED_LOGGING = process.env.USE_ENHANCED_LOGGING === 'true';
const USE_SMART_DROPDOWNS = process.env.USE_SMART_DROPDOWNS === 'true';

export function createLogger(context: string) {
  if (USE_ENHANCED_LOGGING) {
    return createEnhancedLogger(context);
  }
  return new (require('../core/utils/Logger').Logger)(context);
}

export async function selectDropdownOption(page: any, trigger: string, items: string, target: string) {
  if (USE_SMART_DROPDOWNS) {
    return selectSafeDropdownOption(page, trigger, items, target);
  }
  // Fall back to existing implementation
  await page.click(trigger);
  await page.waitForTimeout(1000);
  await page.click(`${items}:has-text("${target}")`);
}

// Example 5: Monitoring improvements
export async function monitoredVehicleProcessing(page: any, vehicles: any[]) {
  const logger = createEnhancedLogger('VehicleMonitor');
  const results = {
    successful: 0,
    failed: 0,
    totalTime: 0,
    errors: [] as any[]
  };
  
  logger.logSearch(`Starting batch processing of ${vehicles.length} vehicles`);
  const batchStart = Date.now();
  
  for (let i = 0; i < vehicles.length; i++) {
    const vehicle = vehicles[i];
    const vehicleStart = Date.now();
    
    try {
      await processVehicleEnhanced(page, vehicle, i + 1, vehicles.length);
      results.successful++;
    } catch (error) {
      results.failed++;
      results.errors.push({ vehicle, error });
      logger.error(`Vehicle ${i + 1} failed`, { vehicle, error });
    }
    
    results.totalTime += Date.now() - vehicleStart;
  }
  
  // Summary logging
  logger.logSuccess(`Batch processing complete`, {
    successful: results.successful,
    failed: results.failed,
    averageTime: Math.round(results.totalTime / vehicles.length),
    totalTime: Date.now() - batchStart
  });
  
  return results;
} 