import { TaskDefinition, TaskContext } from '../../../core/services/TaskOrchestrator';
import { WindowStickerService } from '../../../core/services/WindowStickerService';
import { WindowStickerAccessService } from '../../../core/services/WindowStickerAccessService';
import { VAutoCheckboxMappingService } from '../../../core/services/VAutoCheckboxMappingService';
import { WorkflowRecoveryService } from '../../../core/services/WorkflowRecoveryService';
import { VehicleValidationService } from '../../../core/services/VehicleValidationService';
import { IntelligentAnomalyDetector, VehicleAnomalyData } from '../../../core/services/IntelligentAnomalyDetector';
import { ReportingService, RunSummary, VehicleProcessingResult as ReportVehicleResult } from '../../../core/services/ReportingService';
import { NavigationMetrics } from '../../../core/metrics/NavigationMetrics';
import { Page } from 'playwright';
import { TIMEOUTS } from '../../../core/config/constants';
import { vAutoSelectors } from '../vautoSelectors';

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
      await page.waitForTimeout(5000);
      
      // Get vehicle links using enhanced detection
      logger.info('🔍 Detecting vehicle links...');
      const vehicleLinks = await this.getVehicleLinks(page, logger);
      results.totalVehicles = vehicleLinks.length;
      
      logger.info(`Found ${results.totalVehicles} vehicles to process`);
      
      // Process each vehicle (limit for testing)
      const maxVehicles = config.maxVehiclesToProcess || results.totalVehicles;
      const vehiclesToProcess = Math.min(vehicleLinks.length, maxVehicles);
      
      for (let i = 0; i < vehiclesToProcess; i++) {
        const vehicleResult = await this.processVehicle(
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
  },
  
  /**
   * Get vehicle links from inventory grid
   */
  async getVehicleLinks(page: Page, logger: any): Promise<any[]> {
    const vehicleLinkSelectors = [
      // Target the specific cell that contains the main vehicle link
      '//tr[contains(@class, "x-grid3-row")]//td[position()=1 or position()=2]//a[contains(@href, "javascript") or contains(@onclick, "OpenVehicle") or contains(@onclick, "viewVehicle")]',
      // Look for links with specific onclick patterns
      '//tr[contains(@class, "x-grid3-row")]//a[contains(@onclick, "OpenVehicle") or contains(@onclick, "viewVehicle") or contains(@onclick, "ShowVehicle")]',
      // Target first link in each row (usually the main one)
      '//tr[contains(@class, "x-grid3-row")]//td[1]//a[1]',
      // Year/Make/Model column specifically
      '//tr[contains(@class, "x-grid3-row")]//td[contains(@class, "x-grid3-col-model") or contains(@class, "x-grid3-col-year")]//a'
    ];
    
    let vehicleLinks: any[] = [];
    
    for (const selector of vehicleLinkSelectors) {
      const links = await page.locator(selector).all();
      if (links.length > 0 && links.length <= 25) { // Reasonable number of links
        vehicleLinks = links;
        logger.info(`✅ Found ${links.length} vehicle links using selector: ${selector}`);
        break;
      }
    }
    
    // If still no links, try row-by-row approach
    if (vehicleLinks.length === 0) {
      logger.info('⚠️ Using row-by-row approach to find vehicle links...');
      const rows = await page.locator('//tr[contains(@class, "x-grid3-row")]').all();
      
      for (const row of rows) {
        const rowLinks = await row.locator('a').all();
        if (rowLinks.length > 0) {
          vehicleLinks.push(rowLinks[0]); // Take first link per row
        }
      }
      logger.info(`✅ Found ${vehicleLinks.length} unique vehicle links (1 per row)`);
    }
    
    return vehicleLinks;
  },
  
  /**
   * Process a single vehicle following the exact workflow
   */
  async processVehicle(
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
      const beforeClickUrl = page.url();
      await vehicleLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Verify navigation
      const afterClickUrl = page.url();
      if (afterClickUrl === beforeClickUrl) {
        throw new Error('Navigation failed - still on same page');
      }
      
      // Extract vehicle data
      const vehicleResult = await validationService.extractVehicleData();
      vehicleData = vehicleResult.vehicleData;
      
      if (!vehicleResult.success) {
        errors.push(`Failed to extract vehicle data: ${vehicleResult.error}`);
      }
      
      logger.info(`📋 Processing vehicle: ${vehicleData.vin} (${vehicleData.year} ${vehicleData.make} ${vehicleData.model})`);
      
      if (config.readOnlyMode) {
        logger.info('Read-only mode: Skipping window sticker processing');
        processed = true;
      } else {
        // STEP 2: Access window sticker following exact workflow
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
                try {
                  logger.info('💾 Saving factory equipment changes...');
                  const saveButton = page.locator('#ext-gen58').first(); // Real save button ID
                  if (await saveButton.isVisible({ timeout: 5000 })) {
                    await saveButton.click();
                    await page.waitForLoadState('networkidle');
                    await page.waitForTimeout(2000);
                    logger.info('✅ Changes saved successfully');
                  } else {
                    logger.warn('Save button not found, changes may not be saved');
                    errors.push('Save button not found');
                  }
                } catch (saveError) {
                  logger.error('Failed to save changes:', saveError);
                  errors.push('Failed to save checkbox changes');
                }
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
      
      // Navigate back to inventory
      try {
        await page.goBack();
        await page.waitForTimeout(3000);
        
        // Verify we're back on inventory page
        if (!page.url().includes('/Inventory/')) {
          logger.warn('Back navigation failed, attempting recovery...');
          const recoveryResult = await recoveryService.recoverFromNavigationFailure();
          if (!recoveryResult.success) {
            throw new Error('Failed to return to inventory page');
          }
        }
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
};