import { TaskDefinition, TaskContext } from '../../../core/services/TaskOrchestrator';
import { WindowStickerService } from '../../../core/services/WindowStickerService';
import { WindowStickerAccessService } from '../../../core/services/WindowStickerAccessService';
import { VAutoCheckboxMappingService } from '../../../core/services/VAutoCheckboxMappingService';
import { WorkflowRecoveryService } from '../../../core/services/WorkflowRecoveryService';
import { VehicleValidationService } from '../../../core/services/VehicleValidationService';
import { IntelligentAnomalyDetector, VehicleAnomalyData } from '../../../core/services/IntelligentAnomalyDetector';
import { ReportingService, RunSummary, VehicleProcessingResult as ReportVehicleResult } from '../../../core/services/ReportingService';
import { NavigationMetrics } from '../../../core/metrics/NavigationMetrics';
import { VehicleModalNavigationService } from '../services/VehicleModalNavigationService';
import { Page } from 'playwright';
import { TIMEOUTS } from '../../../core/config/constants';
import { vAutoSelectors } from '../vautoSelectors';

/**
 * Get vehicle links from inventory grid
 */
/**
 * Clicks the Factory Equipment button within the vehicle modal's iframe.
 * @param page The Playwright Page object.
 * @param logger The logger instance.
 * @returns {Promise<boolean>} True if the button was clicked successfully, false otherwise.
 */
async function clickFactoryEquipmentButton(page: Page, logger: any): Promise<boolean> {
  logger.info('🏭 Attempting to click Factory Equipment button...');
  await page.screenshot({ path: `debug-before-factory-button.png`, fullPage: true });

  // First, ensure we're in the correct iframe context
  const gaugeFrame = page.frameLocator('#GaugePageIFrame');

  // Multiple selector strategies based on yesterday's breakthrough
  const factoryButtonSelectors = [
    '#ext-gen199',  // Specific ID from yesterday's breakthrough
    'button:has-text("Factory Equipment")',  // Text-based fallback
    '//button[contains(text(), "Factory Equipment")]',  // XPath text fallback
    'button[class*="x-btn-text"]:has-text("Factory Equipment")',  // Class + text combination
    '#ext-gen201',  // Alternative ID mentioned in docs
    '#ext-gen175'   // Another alternative ID
  ];

  for (let attempt = 0; attempt < factoryButtonSelectors.length; attempt++) {
    const selector = factoryButtonSelectors[attempt];
    logger.info(`🔍 Trying Factory Equipment selector ${attempt + 1}/${factoryButtonSelectors.length}: ${selector}`);

    try {
      const factoryButton = gaugeFrame.locator(selector).first();

      // Check if button exists and is visible
      const isVisible = await factoryButton.isVisible({ timeout: 3000 });
      if (!isVisible) {
        logger.info(`❌ Button not visible with selector: ${selector}`);
        continue;
      }

      const isEnabled = await factoryButton.isEnabled();
      const outerHTML = await factoryButton.evaluate((el: Element) => el.outerHTML).catch(() => '[HTML not accessible]');

      logger.info(`✅ Found Factory Equipment button - Selector: ${selector}, Visible: ${isVisible}, Enabled: ${isEnabled}`);
      logger.info(`Button HTML: ${outerHTML}`);

      if (isVisible && isEnabled) {
        // Try multiple click strategies
        const clickStrategies = [
          { name: 'normal', action: () => factoryButton.click() },
          { name: 'force', action: () => factoryButton.click({ force: true }) },
          { name: 'javascript', action: () => factoryButton.evaluate((el: HTMLElement) => el.click()) }
        ];

        for (const strategy of clickStrategies) {
          try {
            logger.info(`🖱️ Attempting ${strategy.name} click on Factory Equipment button`);
            await strategy.action();

            // Wait for either new window or content change
            await page.waitForTimeout(2000);

            // Check if new window opened (popup)
            const pages = page.context().pages();
            if (pages.length > 1) {
              logger.info('✅ Factory Equipment popup window detected - button click successful!');
              return true;
            }

            // Check if content changed in iframe (alternative behavior)
            const hasStandardEquipment = await gaugeFrame.locator('//div[contains(text(), "Standard Equipment")]').isVisible({ timeout: 2000 }).catch(() => false);
            if (hasStandardEquipment) {
              logger.info('✅ Factory Equipment content loaded in iframe - button click successful!');
              return true;
            }

            logger.info(`⚠️ ${strategy.name} click completed but no expected result detected`);

          } catch (clickError) {
            logger.warn(`❌ ${strategy.name} click failed: ${clickError}`);
          }
        }

        logger.warn(`⚠️ All click strategies failed for selector: ${selector}`);
      } else {
        logger.warn(`❌ Button not ready - Visible: ${isVisible}, Enabled: ${isEnabled}`);
      }

    } catch (error) {
      logger.warn(`❌ Error with selector ${selector}: ${error}`);
    }
  }

  logger.error('❌ All Factory Equipment button selectors and click strategies failed');
  await page.screenshot({ path: `debug-factory-button-all-failed.png`, fullPage: true });
  return false;
}

/**
 * Saves the changes made to the vehicle's equipment.
 * @param page The Playwright Page object.
 * @param logger The logger instance.
 * @returns {Promise<boolean>} True if changes were saved, false otherwise.
 */
async function saveChanges(page: Page, logger: any): Promise<boolean> {
  logger.info('💾 Saving factory equipment changes...');
  // Use a more stable, text-based selector for the save button.
  const saveButton = page.locator('#ext-gen58'); // TODO: Replace with a more stable selector if possible, e.g., a text-based one.

  try {
    if (await saveButton.isVisible({ timeout: 5000 })) {
      await saveButton.click();
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      logger.info('✅ Changes saved successfully.');
      return true;
    } else {
      logger.warn('Save button was not visible, so no changes were saved.');
      return false;
    }
  } catch (saveError) {
    logger.error(`❌ Failed to save changes: ${saveError}`);
    return false;
  }
}

async function getVehicleLinks(page: Page, logger: any): Promise<any[]> {
  const vehicleLinkSelectors = [
    // Try the full XPath provided by user (for the first vehicle)
    'xpath=/html/body/form/div[4]/div/div[2]/div/div[6]/div[1]/div[1]/div[2]/div/div[1]/div[2]/div/div[1]/table/tbody/tr/td[4]/div/div[1]/a/div',
    // Target the YearMakeModel div (most robust for vAuto)
    'xpath=//div[contains(@class, "YearMakeModel")]',
    // Target the specific cell that contains the main vehicle link
    'xpath=//tr[contains(@class, "x-grid3-row")]//td[position()=1 or position()=2]//a[contains(@href, "javascript") or contains(@onclick, "OpenVehicle") or contains(@onclick, "viewVehicle")]',
    // Look for links with specific onclick patterns
    'xpath=//tr[contains(@class, "x-grid3-row")]//a[contains(@onclick, "OpenVehicle") or contains(@onclick, "viewVehicle") or contains(@onclick, "ShowVehicle")]',
    // Target first link in each row (usually the main one)
    'xpath=//tr[contains(@class, "x-grid3-row")]//td[1]//a[1]',
    // Year/Make/Model column specifically
    'xpath=//tr[contains(@class, "x-grid3-row")]//td[contains(@class, "x-grid3-col-model") or contains(@class, "x-grid3-col-year")]//a'
  ];

  let vehicleLinks: any[] = [];

  for (const selector of vehicleLinkSelectors) {
    try {
      const links = await page.locator(selector).all();
      if (links.length > 0 && links.length <= 25) { // Reasonable number of links
        vehicleLinks = links;
        logger.info(`✅ Found ${links.length} vehicle links using selector: ${selector}`);
        break;
      }
    } catch (error: any) {
      logger.warn(`⚠️ Selector failed: ${selector} - ${error.message || error}`);
      continue;
    }
  }

  // If still no links, try row-by-row approach
  if (vehicleLinks.length === 0) {
    logger.info('⚠️ Using row-by-row approach to find vehicle links...');
    try {
      const rows = await page.locator('xpath=//tr[contains(@class, "x-grid3-row")]').all();

      for (const row of rows) {
        const rowLinks = await row.locator('a').all();
        if (rowLinks.length > 0) {
          vehicleLinks.push(rowLinks[0]); // Take first link per row
        }
      }
      logger.info(`✅ Found ${vehicleLinks.length} unique vehicle links (1 per row)`);
    } catch (error: any) {
      logger.error(`❌ Row-by-row approach failed: ${error.message || error}`);
    }
  }
  
  return vehicleLinks;
}

/**
 * Process a single vehicle following the exact workflow
 */
async function processVehicle(
  page: Page, 
  vehicleLink: any, 
  index: number, 
  total: number, 
  config: any, 
  logger: any
): Promise<ReportVehicleResult> {
  const vehicleStartTime = Date.now();
  let vehicleData: any = null;
  let processed = false;
  let featuresFound: string[] = [];
  let featuresUpdated: string[] = [];
  let errors: string[] = [];
  let windowStickerScraped = false;
  
  // Initialize services
  const windowStickerAccessService = new WindowStickerAccessService(page, logger);
  const windowStickerService = new WindowStickerService();
  const vAutoCheckboxService = new VAutoCheckboxMappingService(page, logger);
  const recoveryService = new WorkflowRecoveryService(page, logger);
  const validationService = new VehicleValidationService(page, logger);
  const anomalyDetector = new IntelligentAnomalyDetector({
    pricingThreshold: 0.25,
    enableSMSAlerts: false,
    logger
  });
  
  try {
    logger.info(`Processing vehicle ${index}/${total}...`);

    // STEP 1: Navigate to vehicle details
    await page.screenshot({ path: `debug-before-vehicle-click-${index}.png` });

    // Using the specific vehicleLink passed to the function
    logger.info(`🚗 Processing vehicle ${index + 1}/${total}`);

    // The vehicleLink should already be a valid Locator from getVehicleLinks
    const vehicleLinkElement = vehicleLink;

    // Log the element details for debugging
    try {
      const elementText = await vehicleLinkElement.textContent();
      logger.info(`📋 Vehicle link text: ${elementText?.trim() || 'N/A'}`);
    } catch (e: unknown) {
      logger.warn(`⚠️ Could not get vehicle link text: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Take screenshot before clicking
    await page.screenshot({ path: `debug-before-vehicle-click-${index}.png` });

    // Try normal click, then force, then JS
    try {
      await vehicleLinkElement.click({ timeout: 5000 });
      logger.info(`✅ Successfully clicked vehicle link using normal click`);
    } catch (e: unknown) {
      logger.warn(`⚠️ Normal click failed, trying force click: ${e instanceof Error ? e.message : String(e)}`);
      try {
        await vehicleLinkElement.click({ force: true, timeout: 5000 });
        logger.info(`✅ Successfully clicked vehicle link using force click`);
      } catch (e2: unknown) {
        logger.warn(`⚠️ Force click failed, trying JS click: ${e2 instanceof Error ? e2.message : String(e2)}`);
        await vehicleLinkElement.evaluate((el: HTMLElement) => el.click());
        logger.info(`✅ Successfully clicked vehicle link using JS click`);
      }
    }

    // Wait for the modal and iframe to ensure the page is ready. Replaces waitForTimeout.
    await page.waitForSelector('.x-window', { state: 'visible', timeout: 10000 });
    logger.info('✅ Vehicle modal container detected.');
    await page.waitForSelector('#GaugePageIFrame', { state: 'visible', timeout: 10000 });
    logger.info('✅ GaugePageIFrame detected in modal.');

    // Use VehicleModalNavigationService to ensure we're on the Vehicle Info tab
    const navigationService = new VehicleModalNavigationService(page, logger);
    const tabReady = await navigationService.ensureVehicleInfoTabActive();
    
    if (!tabReady) {
      throw new Error('Failed to navigate to Vehicle Info tab');
    }

    // Extract vehicle data from modal
    logger.info('📋 Extracting vehicle data from modal...');
    const vehicleResult = await validationService.extractVehicleData();
    vehicleData = vehicleResult.vehicleData;
    
    if (!vehicleData) {
      logger.error('Failed to extract vehicle data from modal');
      await page.screenshot({ path: `debug-vehicle-data-failed-${index}.png` });
    }
    
    if (!vehicleResult.success) {
      errors.push(`Failed to extract vehicle data: ${vehicleResult.error}`);
    }
    
    logger.info(`📋 Processing vehicle: ${vehicleData.vin} (${vehicleData.year} ${vehicleData.make} ${vehicleData.model})`);

    if (config.readOnlyMode) {
      logger.info('Read-only mode: Skipping window sticker processing');
      processed = true;
    } else {
      // STEP 2: Click Factory Equipment button using navigation service
      const navigationService = new VehicleModalNavigationService(page, logger);
      const factoryButtonClicked = await navigationService.clickFactoryEquipmentWithTabVerification();

      if (!factoryButtonClicked) {
        errors.push('Failed to click Factory Equipment button');
        throw new Error('Failed to click Factory Equipment button');
      }
      
      await page.screenshot({ path: `debug-after-factory-button-${index}.png`, fullPage: true });
      
      // STEP 3: Access window sticker following exact workflow
      logger.info('📄 Accessing window sticker following exact workflow...');
      const accessResult = await windowStickerAccessService.accessWindowSticker();
      
      if (accessResult.success && accessResult.content) {
        logger.info(`✅ Window sticker accessed using method: ${accessResult.method}`);
        windowStickerScraped = true;
        
        // STEP 3: Extract features from window sticker
        const extractedData = await windowStickerService.extractFeatures(
          accessResult.windowStickerPage || page
        );
        
        featuresFound = extractedData.features;
        logger.info(`📋 Extracted ${featuresFound.length} features from window sticker`);
        
        if (featuresFound.length > 0) {
          logger.info('Features found: ' + featuresFound.slice(0, 5).join(', ') + (featuresFound.length > 5 ? '...' : ''));
          
          // STEP 4: Map features to checkboxes and update them
          logger.info('🔄 Mapping features to checkboxes...');
          const checkboxResult = await vAutoCheckboxService.mapAndUpdateCheckboxes(featuresFound);
          
          if (checkboxResult.success) {
            featuresUpdated = checkboxResult.actions
              .filter(action => action.action !== 'none')
              .map(action => `${action.label} (${action.action})`);
            
            logger.info(`✅ Updated ${checkboxResult.checkboxesUpdated} checkboxes`);
            
            // STEP 5: Save changes if any updates were made
            if (checkboxResult.checkboxesUpdated > 0) {
              await saveChanges(page, logger);
            }
            
            processed = true;
            
            // Run anomaly detection
            try {
              const anomalyData: VehicleAnomalyData = {
                vin: vehicleData.vin,
                year: vehicleData.year ? parseInt(vehicleData.year) : undefined,
                make: vehicleData.make,
                model: vehicleData.model,
                features: featuresFound,
              };
              
              const anomalyReport = await anomalyDetector.analyzeVehicle(anomalyData);
              
              if (anomalyReport.totalAnomalies > 0) {
                logger.warn(`🚨 ${anomalyReport.totalAnomalies} anomalies detected for ${vehicleData.vin}`);
                errors.push(`Anomalies detected: ${anomalyReport.overallRisk} risk level`);
              }
            } catch (anomalyError) {
              logger.warn('Anomaly detection failed:', anomalyError);
            }
            
          } else {
            logger.warn('Checkbox mapping failed, attempting recovery...');
            const recoveryResult = await recoveryService.recoverFromCheckboxFailure();
            if (!recoveryResult.success) {
              errors.push(...checkboxResult.errors);
            }
          }
        } else {
          errors.push('No features found in window sticker');
        }
        
        // Close window sticker page if it was opened
        if (accessResult.windowStickerPage && accessResult.windowStickerPage !== page) {
          await accessResult.windowStickerPage.close();
        }
        
      } else {
        logger.warn(`Window sticker access failed: ${accessResult.error}`);
        
        // Attempt recovery
        const recoveryResult = await recoveryService.recoverFromWindowStickerFailure(vehicleData.vin);
        if (!recoveryResult.success) {
          errors.push(`Window sticker access failed: ${accessResult.error}`);
        }
      }
    }
    
    // Navigate back to inventory by closing the modal
    try {
      logger.info('🔄 Closing vehicle modal to return to inventory...');
      // More reliable way to close the modal
      const closeButton = page.locator('.x-tool-close').first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await page.waitForSelector('.x-window', { state: 'hidden', timeout: 5000 });
        logger.info('✅ Modal closed successfully.');
      } else {
        // Fallback to goBack if close button isn't there
        await page.goBack();
      }
      await page.waitForLoadState('networkidle');
    } catch (navError) {
      logger.error('Navigation back to inventory failed:', navError);
      errors.push('Failed to return to inventory page');
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);
    logger.error(`Failed to process vehicle ${index} (${vehicleData?.vin || 'UNKNOWN'}):`, error);
    
    // Recovery: Try to get back to inventory page
    try {
      const recoveryResult = await recoveryService.recoverFromNavigationFailure();
      if (!recoveryResult.success) {
        logger.error('Recovery failed - may need manual intervention');
      }
    } catch (recoveryError) {
      logger.error('Recovery failed:', recoveryError);
    }
  }
  
  return {
    vin: vehicleData?.vin || 'UNKNOWN',
    processed,
    featuresFound,
    featuresUpdated,
    errors,
    windowStickerScraped,
    factoryEquipmentAccessed: windowStickerScraped,
    featureUpdateReport: null,
    processingTime: Date.now() - vehicleStartTime,
    timestamp: new Date(),
    vehicleData,
    success: processed
  };
}

/**
 * Enhanced Vehicle Processing Task
 * 
 * This task implements the complete workflow:
 * 1. Navigate to each vehicle
 * 2. Access GaugePageIFrame
 * 3. Click Factory Equipment tab (id=ext-gen201)
 * 4. Switch to factory-equipment-details window
 * 5. Extract window sticker content
 * 6. Parse features and map to checkboxes
 * 7. Update checkboxes and save
 * 8. Handle errors with recovery
 */
export const enhancedVehicleProcessingTask: TaskDefinition = {
  id: 'enhanced-process-vehicles',
  name: 'Enhanced Vehicle Processing',
  description: 'Process vehicles with complete window sticker workflow and error recovery',
  dependencies: ['apply-filters'],
  timeout: TIMEOUTS.TWO_FACTOR * 3, // 15 minutes for full processing
  retryCount: 1,
  critical: false,
  
  async execute(context: TaskContext): Promise<any> {
    const { page, config, logger } = context;
    
    logger.info('🚗 Starting enhanced vehicle processing...');
    
    // Initialize services
    const reportingService = new ReportingService();
    await reportingService.initialize();
    
    const runId = `enhanced-run-${Date.now()}`;
    const startTime = new Date();
    
    const results = {
      totalVehicles: 0,
      processedVehicles: 0,
      failedVehicles: 0,
      windowStickersScraped: 0,
      totalFeaturesFound: 0,
      totalCheckboxesUpdated: 0,
      vehicles: [] as ReportVehicleResult[],
      errors: [] as Array<{ vin: string; error: string }>
    };
    
    try {
      // Wait for inventory grid to be ready
      logger.info('Waiting for any loading masks to disappear...');
      await page.waitForSelector(vAutoSelectors.loading.extjsMaskVisible, { state: 'hidden', timeout: 30000 });
      logger.info('✅ Loading masks are gone.');
      
      // Additional wait to ensure grid is populated after mask disappears
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'debug-before-get-vehicle-links.png', fullPage: true });

      logger.info('Waiting for vehicle count to be visible...');
      await page.waitForSelector('div.xtb-text#ext-comp-1011', { state: 'visible', timeout: 10000 });
      logger.info('✅ Vehicle count is visible.');

      // Wait for either vehicle row or YearMakeModel div to be present
      await Promise.race([
        page.waitForSelector(vAutoSelectors.inventory.vehicleRows, { timeout: 15000 }),
        page.waitForSelector('//div[contains(@class, "YearMakeModel")]', { timeout: 15000 })
      ]);
      logger.info('✅ Inventory grid is ready.');
      
      // Get vehicle links using enhanced detection
      logger.info('🔍 Detecting vehicle links...');
      const vehicleLinks = await getVehicleLinks(page, logger);
      results.totalVehicles = vehicleLinks.length;
      
      logger.info(`Found ${results.totalVehicles} vehicles to process`);
      
      // Process each vehicle (limit for testing)
      const maxVehicles = config.maxVehiclesToProcess || results.totalVehicles;
      const vehiclesToProcess = Math.min(vehicleLinks.length, maxVehicles);

      if (vehiclesToProcess === 0) {
        logger.warn('No vehicles found to process. Please check inventory filters.');
        return { ...results, success: true }; // Success, but nothing to do
      }
      
      for (let i = 0; i < vehiclesToProcess; i++) {
        const vehicleResult = await processVehicle(
          page, 
          vehicleLinks[i], 
          i + 1, 
          vehiclesToProcess, 
          config, 
          logger
        );
        
        // Update results
        if (vehicleResult.success) {
          results.processedVehicles++;
          results.windowStickersScraped += vehicleResult.windowStickerScraped ? 1 : 0;
          results.totalFeaturesFound += vehicleResult.featuresFound.length;
          results.totalCheckboxesUpdated += vehicleResult.featuresUpdated.length;
        } else {
          results.failedVehicles++;
        }
        
        results.vehicles.push(vehicleResult);
        
        if (vehicleResult.errors.length > 0) {
          results.errors.push({
            vin: vehicleResult.vin,
            error: vehicleResult.errors.join('; ')
          });
        }
      }
      
      // Generate reports
      const endTime = new Date();
      const summary: RunSummary = {
        runId,
        startTime,
        endTime,
        totalDuration: (endTime.getTime() - startTime.getTime()) / 1000,
        totalVehicles: results.totalVehicles,
        successfulVehicles: results.processedVehicles,
        failedVehicles: results.failedVehicles,
        windowStickersScraped: results.windowStickersScraped,
        totalFeaturesFound: results.totalFeaturesFound,
        totalCheckboxesUpdated: results.totalCheckboxesUpdated,
        errors: results.errors
      };
      
      const reportPaths = await reportingService.generateAllReports(runId, summary, results.vehicles);
      logger.info('📊 Reports generated:', reportPaths);
      
      logger.info(`✅ Enhanced vehicle processing completed. Processed: ${results.processedVehicles}, Failed: ${results.failedVehicles}`);
      
      return {
        success: results.processedVehicles > 0,
        totalVehicles: results.totalVehicles,
        processedVehicles: results.processedVehicles,
        failedVehicles: results.failedVehicles,
        windowStickersScraped: results.windowStickersScraped,
        totalFeaturesFound: results.totalFeaturesFound,
        totalCheckboxesUpdated: results.totalCheckboxesUpdated,
        reportPaths,
        timestamp: new Date()
      };
      
    } catch (error) {
      logger.error('Enhanced vehicle processing failed:', error);
      throw error;
    }
  }
};