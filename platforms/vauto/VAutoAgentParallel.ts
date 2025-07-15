import { VAutoAgent, VAutoConfig, VehicleProcessingResult, VAutoRunResult } from './VAutoAgent';
import { ParallelVehicleProcessor, Vehicle, VehicleResult } from '../../core/services/ParallelVehicleProcessor';
import { WindowStickerService } from '../../core/services/WindowStickerService';
import { reliableClick, waitForLoadingToComplete } from '../../core/utils/reliabilityUtils';
import { vAutoSelectors } from './vautoSelectors';
import { Browser, Page } from 'playwright';

/**
 * Enhanced VAutoAgent with parallel processing capabilities
 */
export class VAutoAgentParallel extends VAutoAgent {
  private parallelProcessor: ParallelVehicleProcessor;
  private windowStickerService: WindowStickerService;

  constructor(config: VAutoConfig) {
    super(config);
    
    // Initialize parallel processor with configuration
    this.parallelProcessor = new ParallelVehicleProcessor({
      maxConcurrency: config.maxConcurrency || 3,
      batchSize: config.batchSize || 10,
      retryAttempts: 2,
      timeout: 300000, // 5 minutes per vehicle
      errorThreshold: 0.5
    });
    
    this.windowStickerService = new WindowStickerService();
  }

  /**
   * Override processInventory to use parallel processing
   */
  async processInventory(): Promise<VAutoRunResult> {
    if (!this.page) throw new Error('Page not initialized');
    
    this.currentRunResult.startTime = new Date();
    this.logger.info('Starting parallel inventory processing');
    
    try {
      // Navigate to inventory and apply filters
      await this.navigateViaMenuAndApplySavedFilter();
      
      // Collect all vehicles first
      const vehicles = await this.collectAllVehicles();
      this.currentRunResult.totalVehicles = vehicles.length;
      
      this.logger.info(`Collected ${vehicles.length} vehicles for parallel processing`);
      
      // Process vehicles in parallel batches
      const batchResult = await this.parallelProcessor.processBatch(
        vehicles,
        async (vehicle) => await this.processVehicleParallel(vehicle),
        { abortOnError: false }
      );
      
      // Convert batch results to VAutoRunResult format
      this.currentRunResult.successfulVehicles = batchResult.results.filter(r => r.status === 'success').length;
      this.currentRunResult.failedVehicles = batchResult.results.filter(r => r.status === 'failed').length;
      
      // Map results to VehicleProcessingResult format
      this.currentRunResult.vehicles = batchResult.results.map(result => {
        const details = result.details as VehicleProcessingResult || {
          vin: result.vehicle.vin,
          processed: result.status === 'success',
          featuresFound: [],
          featuresUpdated: [],
          errors: result.error ? [result.error.message] : [],
          processingTime: result.duration || 0,
          dealer: result.vehicle.dealer || '',
          age: result.vehicle.age || '',
          unmappedFeatures: []
        };
        return details;
      });
      
      this.currentRunResult.endTime = new Date();
      
      this.logger.info(`Parallel processing completed:`, {
        total: this.currentRunResult.totalVehicles,
        successful: this.currentRunResult.successfulVehicles,
        failed: this.currentRunResult.failedVehicles,
        duration: `${(batchResult.totalDuration / 1000).toFixed(2)}s`,
        averageTime: `${(batchResult.averageDuration / 1000).toFixed(2)}s per vehicle`,
        successRate: `${(batchResult.successRate * 100).toFixed(1)}%`
      });
      
      return this.currentRunResult;
      
    } catch (error) {
      this.logger.error('Inventory processing failed:', error);
      this.currentRunResult.errors.push(error instanceof Error ? error.message : String(error));
      this.currentRunResult.endTime = new Date();
      throw error;
    }
  }

  /**
   * Collect all vehicles from inventory pages
   */
  private async collectAllVehicles(): Promise<Vehicle[]> {
    const vehicles: Vehicle[] = [];
    let pageNumber = 1;
    let hasNextPage = true;
    
    while (hasNextPage && pageNumber <= 10) { // Limit to 10 pages for safety
      this.logger.info(`Collecting vehicles from page ${pageNumber}`);
      
      // Get all vehicle rows on current page
      const vehicleRows = await this.page!.$$(vAutoSelectors.inventory.vehicleRows);
      
      for (let i = 0; i < vehicleRows.length; i++) {
        try {
          const row = vehicleRows[i];
          const rowHandle = await row.evaluateHandle(el => el.closest('tr'));
          
          // Extract vehicle data from row
          const vehicleData = await this.page!.evaluate(tr => {
            if (!tr) return null;
            
            return {
              vin: tr.querySelector('td:nth-child(2) > div')?.textContent?.trim() || 'UNKNOWN',
              year: parseInt(tr.querySelector('td:nth-child(4) > div')?.textContent?.trim() || '0'),
              make: tr.querySelector('td:nth-child(6) > div')?.textContent?.trim() || '',
              model: tr.querySelector('td:nth-child(7) > div')?.textContent?.trim() || '',
              dealer: tr.querySelector('td:nth-child(3) > div')?.textContent?.trim() || '',
              age: tr.querySelector('td:nth-child(5) > div')?.textContent?.trim() || '',
              stockNumber: tr.querySelector('td:nth-child(1) > div')?.textContent?.trim() || '',
              rowIndex: i,
              pageNumber: pageNumber
            };
          }, rowHandle) as Vehicle | null;
          
          if (vehicleData) {
            vehicles.push(vehicleData);
          }
        } catch (error) {
          this.logger.warn(`Failed to extract vehicle data from row ${i}:`, error);
        }
      }
      
      // Check for next page
      hasNextPage = await this.hasNextPage();
      if (hasNextPage && pageNumber < 10) {
        await reliableClick(this.page!, vAutoSelectors.inventory.nextPageButton, 'Next Page Button');
        await waitForLoadingToComplete(this.page!, Object.values(vAutoSelectors.loading));
        pageNumber++;
      } else {
        hasNextPage = false;
      }
    }
    
    return vehicles;
  }

  /**
   * Process a single vehicle in parallel context
   */
  private async processVehicleParallel(vehicle: Vehicle): Promise<VehicleResult> {
    const startTime = Date.now();
    
    // Create a new browser context for this vehicle
    const context = await this.browser.browser!.newContext();
    const page = await context.newPage();
    
    try {
      // Copy cookies and authentication from main page
      const cookies = await this.page!.context().cookies();
      await context.addCookies(cookies);
      
      // Navigate directly to vehicle detail page
      const vehicleUrl = await this.constructVehicleUrl(vehicle);
      await page.goto(vehicleUrl);
      await page.waitForLoadState('networkidle');
      
      // Process vehicle details
      const result = await this.processVehicleDetails(page, vehicle);
      
      return {
        vehicle,
        status: 'success',
        details: result,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      this.logger.error(`Failed to process vehicle ${vehicle.vin}:`, error);
      
      return {
        vehicle,
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - startTime
      };
      
    } finally {
      // Clean up context
      await context.close();
    }
  }

  /**
   * Construct direct URL to vehicle detail page
   */
  private async constructVehicleUrl(vehicle: Vehicle): Promise<string> {
    // Get base URL from current page
    const currentUrl = this.page!.url();
    const baseUrl = new URL(currentUrl).origin;
    
    // Construct vehicle detail URL (adjust based on your specific vAuto URL structure)
    // This is a common pattern but may need adjustment
    return `${baseUrl}/Va/Inventory/VehicleDetails.aspx?vin=${vehicle.vin}&stock=${vehicle.stockNumber}`;
  }

  /**
   * Process vehicle details in isolated page context
   */
  private async processVehicleDetails(page: Page, vehicle: Vehicle): Promise<VehicleProcessingResult> {
    const result: VehicleProcessingResult = {
      vin: vehicle.vin,
      processed: false,
      featuresFound: [],
      featuresUpdated: [],
      errors: [],
      processingTime: 0,
      dealer: vehicle.dealer || '',
      age: vehicle.age || '',
      unmappedFeatures: []
    };
    
    const startTime = Date.now();
    
    try {
      // Navigate to Factory Equipment tab
      const tabSuccess = await this.navigateToFactoryEquipmentTab(page);
      
      if (tabSuccess) {
        // Extract window sticker features
        const extractedData = await this.windowStickerService.extractFeatures(page);
        result.featuresFound = extractedData.features;
        
        if (result.featuresFound.length > 0) {
          // Update checkboxes if not in read-only mode
          if (!this.vAutoConfig.readOnlyMode) {
            result.featuresUpdated = await this.updateFeatureCheckboxes(page, result.featuresFound);
          }
          result.processed = true;
        }
      }
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      this.logger.error(`Error processing vehicle ${vehicle.vin}:`, error);
    }
    
    result.processingTime = Date.now() - startTime;
    return result;
  }

  /**
   * Navigate to Factory Equipment tab in isolated context
   */
  private async navigateToFactoryEquipmentTab(page: Page): Promise<boolean> {
    try {
      // Try multiple strategies to find and click Factory Equipment tab
      const tabSelectors = [
        vAutoSelectors.vehicleDetails.factoryEquipmentTab,
        '//a[contains(text(), "Factory Equipment")]',
        '//span[contains(text(), "Factory Equipment")]',
        '#ext-gen201', // From workflow
        '#ext-gen175'  // Alternative
      ];
      
      for (const selector of tabSelectors) {
        try {
          const tab = page.locator(selector).first();
          if (await tab.isVisible({ timeout: 3000 })) {
            await tab.click();
            await page.waitForTimeout(2000);
            return true;
          }
        } catch (e) {
          continue;
        }
      }
      
      this.logger.warn('Factory Equipment tab not found');
      return false;
      
    } catch (error) {
      this.logger.error('Failed to navigate to Factory Equipment tab:', error);
      return false;
    }
  }

  /**
   * Update feature checkboxes (stub - implement based on your logic)
   */
  private async updateFeatureCheckboxes(page: Page, features: string[]): Promise<string[]> {
    // This would contain your checkbox update logic
    // For now, returning empty array as placeholder
    return [];
  }

  /**
   * Check if inventory has next page
   */
  private async hasNextPage(): Promise<boolean> {
    try {
      const nextButton = this.page!.locator(vAutoSelectors.inventory.nextPageButton).first();
      return await nextButton.isEnabled();
    } catch {
      return false;
    }
  }
}