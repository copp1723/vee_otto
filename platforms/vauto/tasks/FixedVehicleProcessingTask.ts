import { TaskDefinition, TaskContext } from '../../../core/services/TaskOrchestrator';
import { WindowStickerService } from '../../../core/services/WindowStickerService';
import { CheckboxMappingService } from '../../../core/services/CheckboxMappingService';
import { VehicleValidationService } from '../../../core/services/VehicleValidationService';
import { Page } from 'playwright';
import { TIMEOUTS } from '../../../core/config/constants';

/**
 * Process a single vehicle following the fixed workflow
 */
async function processVehicle(page: Page, vehicleLink: any, index: number, logger: any): Promise<any> {
  let vehicleData: any = null;
  let featuresFound: string[] = [];
  let errors: string[] = [];
  
  try {
    logger.info(`Processing vehicle ${index}...`);
    
    // Navigate to vehicle
    await vehicleLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Extract vehicle data
    const validationService = new VehicleValidationService(page, logger);
    const vehicleResult = await validationService.extractVehicleData();
    vehicleData = vehicleResult.vehicleData;
    
    logger.info(`📋 Processing: ${vehicleData.vin}`);
    
    // Navigate to Factory Equipment - FIXED APPROACH
    let tabSuccess = false;
    
    // Strategy 1: Text-based selector
    try {
      const factoryTab = page.locator('text=Factory Equipment').first();
      if (await factoryTab.isVisible({ timeout: 5000 })) {
        await factoryTab.click();
        await page.waitForTimeout(2000);
        tabSuccess = true;
        logger.info('✅ Factory Equipment tab clicked (text selector)');
      }
    } catch (e) {
      logger.debug('Text selector failed');
    }
    
    // Strategy 2: Position-based fallback
    if (!tabSuccess) {
      try {
        const tabs = await page.locator('//ul[contains(@class, "x-tab-strip")]//a').all();
        for (let i = 2; i < Math.min(tabs.length, 6); i++) {
          const tabText = await tabs[i].textContent();
          if (tabText?.toLowerCase().includes('factory') || tabText?.toLowerCase().includes('equipment')) {
            await tabs[i].click();
            await page.waitForTimeout(2000);
            tabSuccess = true;
            logger.info(`✅ Factory Equipment tab clicked (position ${i})`);
            break;
          }
        }
      } catch (e) {
        logger.debug('Position selector failed');
      }
    }
    
    if (tabSuccess) {
      // Check for new window
      const pages = page.context().pages();
      let contentPage = page;
      
      for (const p of pages) {
        if (p !== page) {
          const title = await p.title();
          if (title.includes('factory-equipment') || title.includes('sticker')) {
            contentPage = p;
            await contentPage.waitForLoadState('networkidle');
            logger.info('✅ Using factory equipment window');
            break;
          }
        }
      }
      
      // Extract features
      const windowStickerService = new WindowStickerService();
      const extractedData = await windowStickerService.extractFeatures(contentPage);
      featuresFound = extractedData.features;
      
      logger.info(`📋 Extracted ${featuresFound.length} features`);
      
      if (featuresFound.length > 0) {
        // Map and update checkboxes
        const checkboxService = new CheckboxMappingService(page, logger);
        const checkboxResult = await checkboxService.mapAndUpdateCheckboxes(featuresFound);
        
        if (checkboxResult.success && checkboxResult.checkboxesUpdated > 0) {
          // Save changes
          const saveButton = page.locator('text=Save').first();
          if (await saveButton.isVisible({ timeout: 3000 })) {
            await saveButton.click();
            await page.waitForTimeout(2000);
            logger.info('✅ Changes saved');
          }
        }
      }
      
      // Close content window if different
      if (contentPage !== page) {
        await contentPage.close();
      }
    } else {
      errors.push('Failed to access Factory Equipment tab');
    }
    
    // Navigate back
    await page.goBack();
    await page.waitForTimeout(3000);
    
    return {
      vin: vehicleData?.vin || 'UNKNOWN',
      success: tabSuccess && featuresFound.length > 0,
      featuresFound,
      errors
    };
    
  } catch (error) {
    errors.push(String(error));
    logger.error(`Failed to process vehicle ${index}:`, error);
    
    // Recovery
    try {
      await page.goBack();
      await page.waitForTimeout(3000);
    } catch (e) {
      logger.error('Recovery failed');
    }
    
    return {
      vin: vehicleData?.vin || 'UNKNOWN',
      success: false,
      featuresFound: [],
      errors
    };
  }
}

export const fixedVehicleProcessingTask: TaskDefinition = {
  id: 'fixed-process-vehicles',
  name: 'Fixed Vehicle Processing',
  description: 'Process vehicles with reliable navigation',
  dependencies: ['apply-filters'],
  timeout: TIMEOUTS.TWO_FACTOR * 2,
  retryCount: 1,
  critical: false,
  
  async execute(context: TaskContext): Promise<any> {
    const { page, config, logger } = context;
    
    logger.info('🚗 Starting fixed vehicle processing...');
    
    const results = {
      totalVehicles: 0,
      processedVehicles: 0,
      failedVehicles: 0,
      vehicles: [] as any[]
    };
    
    try {
      await page.waitForTimeout(5000);
      
      // Get vehicle links
      const vehicleLinks = await page.locator('//tr[contains(@class, "x-grid3-row")]//td[1]//a[1]').all();
      results.totalVehicles = vehicleLinks.length;
      
      logger.info(`Found ${results.totalVehicles} vehicles to process`);
      
      const maxVehicles = Math.min(vehicleLinks.length, config.maxVehiclesToProcess || 2);
      
      for (let i = 0; i < maxVehicles; i++) {
        const vehicleResult = await processVehicle(page, vehicleLinks[i], i + 1, logger);
        
        if (vehicleResult.success) {
          results.processedVehicles++;
        } else {
          results.failedVehicles++;
        }
        
        results.vehicles.push(vehicleResult);
      }
      
      logger.info(`✅ Processing complete. Success: ${results.processedVehicles}, Failed: ${results.failedVehicles}`);
      
      return results;
      
    } catch (error) {
      logger.error('Vehicle processing failed:', error);
      throw error;
    }
  }
};