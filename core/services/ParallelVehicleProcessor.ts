import { Browser, BrowserContext, Page } from 'playwright';
import { WorkerPoolManager } from './WorkerPoolManager';
import { ParallelCoordinator } from './ParallelCoordinator';

export interface ParallelConfig {
  maxConcurrency: number;
  workerTimeout: number;
  errorThreshold: number;
  batchSize: number;
}

export interface ServiceConfig {
  validation: any;
  windowSticker: any;
  checkboxMapping: any;
  inventoryFilter: any;
}

export interface ParallelResult {
  success: boolean;
  totalVehicles: number;
  processedVehicles: number;
  failedVehicles: number;
  totalFeatures: number;
  processingTime: number;
  workerResults: WorkerResult[];
  errors: string[];
}

export interface WorkerResult {
  workerId: string;
  vehiclesProcessed: number;
  featuresFound: number;
  processingTime: number;
  success: boolean;
  errors: string[];
}

export class ParallelVehicleProcessor {
  private config: ParallelConfig;
  private services: ServiceConfig;
  private workerPool: WorkerPoolManager;
  private coordinator: ParallelCoordinator;
  private logger: any;

  constructor(config: ParallelConfig, services: ServiceConfig, logger: any) {
    this.config = config;
    this.services = services;
    this.logger = logger;
    this.workerPool = new WorkerPoolManager(config, logger);
    this.coordinator = new ParallelCoordinator(config, logger);
  }

  /**
   * Process vehicles in parallel using worker pool
   */
  async processVehicles(vehicleLinks: any[], mainPage: Page): Promise<ParallelResult> {
    const startTime = Date.now();
    this.logger.info(`🔄 Starting parallel processing of ${vehicleLinks.length} vehicles with ${this.config.maxConcurrency} workers`);

    const result: ParallelResult = {
      success: false,
      totalVehicles: vehicleLinks.length,
      processedVehicles: 0,
      failedVehicles: 0,
      totalFeatures: 0,
      processingTime: 0,
      workerResults: [],
      errors: []
    };

    try {
      // Initialize worker pool
      await this.workerPool.initialize(mainPage.context().browser()!);

      // Split vehicles into batches for parallel processing
      const batches = this.createBatches(vehicleLinks, this.config.batchSize);
      
      // Process batches in parallel
      const workerPromises: Promise<WorkerResult>[] = [];
      
      for (let i = 0; i < Math.min(batches.length, this.config.maxConcurrency); i++) {
        const batch = batches[i];
        const workerId = `worker-${i + 1}`;
        
        const workerPromise = this.processWorkerBatch(workerId, batch, i);
        workerPromises.push(workerPromise);
      }

      // Wait for all workers to complete
      const workerResults = await Promise.allSettled(workerPromises);
      
      // Process results
      for (const workerResult of workerResults) {
        if (workerResult.status === 'fulfilled') {
          const worker = workerResult.value;
          result.workerResults.push(worker);
          result.processedVehicles += worker.vehiclesProcessed;
          result.totalFeatures += worker.featuresFound;
          
          if (!worker.success) {
            result.failedVehicles += worker.errors.length;
            result.errors.push(...worker.errors);
          }
        } else {
          const errorResult = workerResult as PromiseRejectedResult;
          result.errors.push(`Worker failed: ${errorResult.reason}`);
          result.failedVehicles++;
        }
      }

      // Calculate success
      const successRate = result.processedVehicles / result.totalVehicles;
      result.success = successRate >= (1 - this.config.errorThreshold);
      
      result.processingTime = Date.now() - startTime;
      
      this.logger.info(`✅ Parallel processing completed: ${result.processedVehicles}/${result.totalVehicles} vehicles (${(successRate * 100).toFixed(1)}% success)`);
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
      this.logger.error(`❌ Parallel processing failed: ${errorMessage}`);
      return result;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Process a batch of vehicles in a single worker
   */
  private async processWorkerBatch(workerId: string, vehicleBatch: any[], workerIndex: number): Promise<WorkerResult> {
    const workerStartTime = Date.now();
    this.logger.info(`👷 ${workerId}: Starting batch of ${vehicleBatch.length} vehicles`);

    const result: WorkerResult = {
      workerId,
      vehiclesProcessed: 0,
      featuresFound: 0,
      processingTime: 0,
      success: true,
      errors: []
    };

    let workerContext: BrowserContext | null = null;
    let workerPage: Page | null = null;

    try {
      // Get isolated worker context
      workerContext = await this.workerPool.getWorkerContext(workerId);
      workerPage = await workerContext.newPage();
      
      // Navigate to inventory (inherit session from main page)
      await this.coordinator.inheritSession(workerPage, workerId);

      // Process each vehicle in the batch
      for (let i = 0; i < vehicleBatch.length; i++) {
        const vehicleLink = vehicleBatch[i];
        
        try {
          const vehicleResult = await this.processVehicleInWorker(
            workerPage, 
            vehicleLink, 
            workerId, 
            i
          );
          
          if (vehicleResult.success) {
            result.vehiclesProcessed++;
            result.featuresFound += vehicleResult.featuresFound;
          } else {
            result.errors.push(`Vehicle ${i + 1}: ${vehicleResult.error}`);
          }
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Vehicle ${i + 1}: ${errorMessage}`);
          this.logger.warn(`${workerId}: Vehicle ${i + 1} failed: ${errorMessage}`);
        }
      }

      result.success = result.errors.length === 0;
      result.processingTime = Date.now() - workerStartTime;
      
      this.logger.info(`✅ ${workerId}: Completed ${result.vehiclesProcessed}/${vehicleBatch.length} vehicles`);
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
      result.success = false;
      this.logger.error(`❌ ${workerId}: Worker failed: ${errorMessage}`);
      return result;
    } finally {
      if (workerPage) await workerPage.close();
      if (workerContext) await this.workerPool.releaseWorkerContext(workerId);
    }
  }

  /**
   * Process single vehicle within worker context
   */
  private async processVehicleInWorker(
    page: Page, 
    vehicleLink: any, 
    workerId: string, 
    vehicleIndex: number
  ): Promise<{ success: boolean; featuresFound: number; error?: string }> {
    
    try {
      // Navigate to vehicle
      await vehicleLink.locator.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Use ParallelServiceAdapter for isolated execution
      const { ParallelServiceAdapter } = await import('./ParallelServiceAdapter');
      
      const context = {
        workerId,
        vehicleIndex,
        page,
        logger: this.logger
      };

      // Execute complete vehicle workflow using your adapter
      const results = await ParallelServiceAdapter.executeVehicleWorkflow(context);
      
      let featuresFound = 0;
      if (results.windowSticker?.success && results.windowSticker.data?.features) {
        featuresFound = results.windowSticker.data.features.length;
      }

      const success = results.validation.success && 
                     (results.windowSticker?.success || false);

      return {
        success,
        featuresFound,
        error: success ? undefined : 'Vehicle processing failed'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        featuresFound: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Create batches for parallel processing
   */
  private createBatches(items: any[], batchSize: number): any[][] {
    const batches: any[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    await this.workerPool.cleanup();
    await this.coordinator.cleanup();
  }
}