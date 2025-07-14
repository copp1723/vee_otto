import { TaskDefinition, TaskContext } from '../../../core/services/TaskOrchestrator';
import { Auth2FAService, Auth2FAConfig } from '../../../core/services/Auth2FAService';
import { Page } from 'playwright';
import { reliableClick } from '../../../core/utils/reliabilityUtils';
import { vAutoSelectors } from '../vautoSelectors';

/**
 * VAuto Task Definitions
 * 
 * These are modular tasks that can be run independently or in sequence.
 * Each task is self-contained and can be tested/debugged separately.
 */

/**
 * Task 1: Basic Login (Username/Password only)
 * This task handles ONLY the basic login without 2FA
 */
export const basicLoginTask: TaskDefinition = {
  id: 'basic-login',
  name: 'Basic Login',
  description: 'Login with username and password (no 2FA)',
  dependencies: [],
  timeout: 60000, // 1 minute
  retryCount: 2,
  critical: true,
  
  async execute(context: TaskContext): Promise<any> {
    const { page, config, logger } = context;
    
    logger.info('🔐 Starting basic login...');
    
    // Navigate to login page
    await page.goto(vAutoSelectors.login.url);
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, 'vauto-login-page');
    
    // Enter username
    await page.fill(vAutoSelectors.login.username, config.username);
    await reliableClick(page, vAutoSelectors.login.nextButton, 'Next Button');
    await page.waitForLoadState('networkidle');
    
    // Enter password
    await page.fill(vAutoSelectors.login.password, config.password);
    await takeScreenshot(page, 'vauto-credentials-entered');
    await reliableClick(page, vAutoSelectors.login.submit, 'Submit Button');
    
    // Wait for response
    await page.waitForLoadState('networkidle');
    
    logger.info('✅ Basic login completed');
    
    return {
      url: page.url(),
      timestamp: new Date()
    };
  }
};

/**
 * Task 2: 2FA Authentication
 * This task handles ONLY the 2FA process using the isolated service
 */
export const twoFactorAuthTask: TaskDefinition = {
  id: '2fa-auth',
  name: '2FA Authentication',
  description: 'Handle 2FA authentication via SMS',
  dependencies: ['basic-login'],
  timeout: 300000, // 5 minutes
  retryCount: 1, // Don't retry 2FA to avoid code expiration
  critical: true,
  
  async execute(context: TaskContext): Promise<any> {
    const { page, config, logger } = context;
    
    logger.info('🔐 Starting 2FA authentication...');
    
    // Configure 2FA service with your working settings
    const auth2FAConfig: Auth2FAConfig = {
      webhookUrl: config.webhookUrl || `${process.env.PUBLIC_URL || 'http://localhost:3000'}/api/2fa/latest`,
      timeout: 300000,
      codeInputSelector: vAutoSelectors.login.otpInput,
      submitSelector: vAutoSelectors.login.otpSubmit,
      phoneSelectButton: vAutoSelectors.login.phoneSelectButton,
      twoFactorTitle: vAutoSelectors.login.twoFactorTitle
    };
    
    // Use the isolated 2FA service
    const auth2FAService = new Auth2FAService(auth2FAConfig);
    const result = await auth2FAService.authenticate(page);
    
    if (!result.success) {
      throw new Error(`2FA authentication failed: ${result.error}`);
    }
    
    logger.info('✅ 2FA authentication completed successfully');
    
    return {
      code: result.code,
      timestamp: result.timestamp,
      url: page.url()
    };
  }
};

/**
 * Task 3: Navigate to Inventory
 * This task navigates to the inventory page after successful login
 */
export const navigateToInventoryTask: TaskDefinition = {
  id: 'navigate-inventory',
  name: 'Navigate to Inventory',
  description: 'Navigate to the inventory page',
  dependencies: ['2fa-auth'],
  timeout: 60000,
  retryCount: 2,
  critical: true,
  
  async execute(context: TaskContext): Promise<any> {
    const { page, config, logger } = context;
    
    logger.info('🧭 Navigating to inventory...');
    
    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
    
         // Navigate to inventory via menu
     try {
       // Click on View Inventory (direct navigation)
       await reliableClick(page, vAutoSelectors.inventory.viewInventoryLink, 'View Inventory');
       await page.waitForLoadState('networkidle');
      
      await takeScreenshot(page, 'vauto-inventory-page');
      
      logger.info('✅ Successfully navigated to inventory');
      
      return {
        url: page.url(),
        timestamp: new Date()
      };
      
    } catch (error) {
      logger.error('Navigation failed, trying direct URL...');
      
      // Fallback: Direct navigation
      await page.goto('https://vauto.app.coxautoinc.com/inventory');
      await page.waitForLoadState('networkidle');
      
      return {
        url: page.url(),
        timestamp: new Date(),
        method: 'direct'
      };
    }
  }
};

/**
 * Task 4: Apply Inventory Filters
 * This task applies the 0-1 days filter to the inventory
 */
export const applyInventoryFiltersTask: TaskDefinition = {
  id: 'apply-filters',
  name: 'Apply Inventory Filters',
  description: 'Apply 0-1 days age filter to inventory',
  dependencies: ['navigate-inventory'],
  timeout: 120000,
  retryCount: 2,
  critical: true,
  
  async execute(context: TaskContext): Promise<any> {
    const { page, config, logger } = context;
    
    logger.info('🔍 Applying inventory filters...');
    
         try {
       logger.info('Applying manual filter...');
       
       // Click on filter button
       await reliableClick(page, vAutoSelectors.inventory.filterButton, 'Filter Button');
       await page.waitForTimeout(1000);
       
       // Set age filter (0-1 days)
       await page.fill(vAutoSelectors.inventory.ageMinInput, '0');
       await page.fill(vAutoSelectors.inventory.ageMaxInput, '1');
       
       // Apply filter
       await reliableClick(page, vAutoSelectors.inventory.applyFilter, 'Apply Filter');
       await page.waitForLoadState('networkidle');
       
       await takeScreenshot(page, 'vauto-filters-applied');
       
       // Count filtered vehicles
       const vehicleCount = await page.locator(vAutoSelectors.inventory.vehicleRows).count();
      
      logger.info(`✅ Filters applied successfully. Found ${vehicleCount} vehicles`);
      
             return {
         vehicleCount,
         filterMethod: 'manual',
         timestamp: new Date()
       };
      
    } catch (error) {
      logger.error('Filter application failed:', error);
      throw error;
    }
  }
};

/**
 * Task 5: Process Vehicle Inventory
 * This task processes the filtered vehicles
 */
export const processVehicleInventoryTask: TaskDefinition = {
  id: 'process-vehicles',
  name: 'Process Vehicle Inventory',
  description: 'Process filtered vehicles for feature updates',
  dependencies: ['apply-filters'],
  timeout: 600000, // 10 minutes
  retryCount: 1,
  critical: false, // Not critical - partial success is okay
  
  async execute(context: TaskContext): Promise<any> {
    const { page, config, logger } = context;
    
    logger.info('🚗 Processing vehicle inventory...');
    
    const results = {
      totalVehicles: 0,
      processedVehicles: 0,
      failedVehicles: 0,
      vehicles: [] as any[]
    };
    
    try {
             // Get all vehicle rows
       const vehicleRows = await page.locator(vAutoSelectors.inventory.vehicleRows).all();
      results.totalVehicles = vehicleRows.length;
      
      logger.info(`Found ${results.totalVehicles} vehicles to process`);
      
      // Process each vehicle (limit for testing)
      const maxVehicles = config.maxVehiclesToProcess || 1;
      const vehiclesToProcess = Math.min(vehicleRows.length, maxVehicles);
      
      for (let i = 0; i < vehiclesToProcess; i++) {
        try {
          logger.info(`Processing vehicle ${i + 1}/${vehiclesToProcess}...`);
          
          // Click on vehicle
          await vehicleRows[i].click();
          await page.waitForLoadState('networkidle');
          
          // Get VIN
          const vin = await getVehicleVIN(page);
          
          // Process vehicle features
          const vehicleResult = await processVehicleFeatures(page, vin, config, logger);
          
          results.vehicles.push(vehicleResult);
          results.processedVehicles++;
          
          logger.info(`✅ Vehicle ${i + 1} processed successfully`);
          
          // Go back to inventory list
          await page.goBack();
          await page.waitForLoadState('networkidle');
          
        } catch (error) {
          logger.error(`❌ Failed to process vehicle ${i + 1}:`, error);
          results.failedVehicles++;
          
          // Try to go back to inventory list
          try {
            await page.goBack();
            await page.waitForLoadState('networkidle');
          } catch (backError) {
            logger.warn('Failed to go back to inventory list');
          }
        }
      }
      
      logger.info(`✅ Vehicle processing completed. Processed: ${results.processedVehicles}, Failed: ${results.failedVehicles}`);
      
      return results;
      
    } catch (error) {
      logger.error('Vehicle processing failed:', error);
      throw error;
    }
  }
};

/**
 * Helper function to take screenshots
 */
async function takeScreenshot(page: Page, name: string): Promise<void> {
  try {
    await page.screenshot({ 
      path: `screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  } catch (error) {
    console.warn(`Failed to take screenshot: ${name}`, error);
  }
}

/**
 * Helper function to get vehicle VIN
 */
async function getVehicleVIN(page: Page): Promise<string> {
  try {
    const vinElement = await page.locator(vAutoSelectors.vehicleDetails.vinField).first();
    return await vinElement.textContent() || 'UNKNOWN';
  } catch (error) {
    return 'UNKNOWN';
  }
}

/**
 * Helper function to process vehicle features
 */
async function processVehicleFeatures(page: Page, vin: string, config: any, logger: any): Promise<any> {
  // This is a simplified version - you can expand this based on your needs
  const result = {
    vin,
    processed: true,
    featuresFound: [] as string[],
    featuresUpdated: [] as string[],
    errors: [] as string[],
    processingTime: 0
  };
  
  const startTime = Date.now();
  
  try {
    // Get window sticker content if available
    const stickerContent = await getWindowStickerContent(page);
    
    if (stickerContent) {
      // Process features from sticker
      result.featuresFound = extractFeaturesFromSticker(stickerContent);
      logger.info(`Found ${result.featuresFound.length} features in window sticker`);
    }
    
    // Update checkboxes based on features (if not in read-only mode)
    if (!config.readOnlyMode) {
      result.featuresUpdated = await updateFeatureCheckboxes(page, result.featuresFound);
    } else {
      logger.info('Read-only mode: Skipping checkbox updates');
    }
    
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
    logger.error(`Error processing vehicle ${vin}:`, error);
  }
  
  result.processingTime = Date.now() - startTime;
  return result;
}

/**
 * Helper function to get window sticker content
 */
async function getWindowStickerContent(page: Page): Promise<string> {
  try {
    // Look for window sticker link
    const stickerLink = await page.locator(vAutoSelectors.vehicleDetails.windowStickerButton).first();
    if (await stickerLink.isVisible()) {
      await stickerLink.click();
      await page.waitForLoadState('networkidle');
      
      // Get sticker content
      const content = await page.locator(vAutoSelectors.vehicleDetails.stickerContentContainer).textContent();
      return content || '';
    }
  } catch (error) {
    // Window sticker not available
  }
  
  return '';
}

/**
 * Helper function to extract features from sticker content
 */
function extractFeaturesFromSticker(content: string): string[] {
  // This is a simplified version - you can expand this based on your feature mapping
  const features: string[] = [];
  
  // Look for common features
  if (content.includes('Navigation')) features.push('Navigation');
  if (content.includes('Sunroof')) features.push('Sunroof');
  if (content.includes('Leather')) features.push('Leather');
  if (content.includes('Heated Seats')) features.push('Heated Seats');
  
  return features;
}

/**
 * Helper function to update feature checkboxes
 */
async function updateFeatureCheckboxes(page: Page, features: string[]): Promise<string[]> {
  const updatedFeatures: string[] = [];
  
  for (const feature of features) {
    try {
      // Look for checkbox with this feature
      const checkbox = await page.locator(`input[type="checkbox"][name*="${feature}"]`).first();
      if (await checkbox.isVisible()) {
        const isChecked = await checkbox.isChecked();
        if (!isChecked) {
          await checkbox.check();
          updatedFeatures.push(feature);
        }
      }
    } catch (error) {
      // Feature checkbox not found
    }
  }
  
  return updatedFeatures;
}

/**
 * All VAuto tasks in dependency order
 */
export const allVAutoTasks = [
  basicLoginTask,
  twoFactorAuthTask,
  navigateToInventoryTask,
  applyInventoryFiltersTask,
  processVehicleInventoryTask
]; 