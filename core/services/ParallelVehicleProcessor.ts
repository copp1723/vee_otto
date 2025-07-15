import { Logger } from '../utils/Logger';
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor';
import { ErrorReporter } from '../utils/ErrorReporter';

export interface Vehicle {
  vin: string;
  year: number;
  make: string;
  model: string;
  stockNumber?: string;
  [key: string]: any;
}

export interface VehicleResult {
  vehicle: Vehicle;
  status: 'success' | 'failed' | 'skipped';
  error?: Error;
  duration?: number;
  details?: any;
}

export interface BatchResult {
  results: VehicleResult[];
  successRate: number;
  totalDuration: number;
  averageDuration: number;
}

export interface ProcessorConfig {
  maxConcurrency?: number;
  batchSize?: number;
  retryAttempts?: number;
  timeout?: number;
  errorThreshold?: number;
}

export class ParallelVehicleProcessor {
  private logger: Logger;
  private performanceMonitor: PerformanceMonitor;
  private errorReporter: ErrorReporter;
  private config: Required<ProcessorConfig>;

  constructor(config: ProcessorConfig = {}) {
    this.config = {
      maxConcurrency: config.maxConcurrency || 3,
      batchSize: config.batchSize || 10,
      retryAttempts: config.retryAttempts || 2,
      timeout: config.timeout || 300000, // 5 minutes
      errorThreshold: config.errorThreshold || 0.5 // Stop if >50% fail
    };

    this.logger = new Logger('ParallelVehicleProcessor');
    this.performanceMonitor = new PerformanceMonitor('vehicle-processing');
    this.errorReporter = new ErrorReporter('ParallelProcessor');
  }

  /**
   * Process vehicles in parallel batches
   */
  async processBatch(
    vehicles: Vehicle[],
    processFunc: (vehicle: Vehicle) => Promise<VehicleResult>,
    options: { abortOnError?: boolean } = {}
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const results: VehicleResult[] = [];
    let processedCount = 0;
    let failedCount = 0;

    this.logger.info(`Starting parallel processing of ${vehicles.length} vehicles`, {
      maxConcurrency: this.config.maxConcurrency,
      batchSize: this.config.batchSize
    });

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < vehicles.length; i += this.config.batchSize) {
      const batch = vehicles.slice(i, i + this.config.batchSize);
      const batchResults = await this.processConcurrentBatch(batch, processFunc);
      
      results.push(...batchResults);
      processedCount += batchResults.length;
      failedCount += batchResults.filter(r => r.status === 'failed').length;

      // Check error threshold
      if (options.abortOnError && failedCount / processedCount > this.config.errorThreshold) {
        this.logger.error(`Error threshold exceeded: ${failedCount}/${processedCount} failed`);
        
        // Mark remaining vehicles as skipped
        const remaining = vehicles.slice(i + this.config.batchSize);
        results.push(...remaining.map(v => ({
          vehicle: v,
          status: 'skipped' as const,
          error: new Error('Batch processing aborted due to error threshold')
        })));
        
        break;
      }

      this.logger.info(`Batch ${Math.floor(i / this.config.batchSize) + 1} completed`, {
        processed: batchResults.length,
        successful: batchResults.filter(r => r.status === 'success').length,
        failed: batchResults.filter(r => r.status === 'failed').length
      });
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'success').length;

    const batchResult: BatchResult = {
      results,
      successRate: successCount / results.length,
      totalDuration,
      averageDuration: totalDuration / results.length
    };

    this.logger.info('Parallel processing completed', {
      total: vehicles.length,
      successful: successCount,
      failed: failedCount,
      skipped: results.filter(r => r.status === 'skipped').length,
      duration: `${(totalDuration / 1000).toFixed(2)}s`,
      successRate: `${(batchResult.successRate * 100).toFixed(1)}%`
    });

    return batchResult;
  }

  /**
   * Process a concurrent batch with worker pool pattern
   */
  private async processConcurrentBatch(
    vehicles: Vehicle[],
    processFunc: (vehicle: Vehicle) => Promise<VehicleResult>
  ): Promise<VehicleResult[]> {
    const queue = [...vehicles];
    const results: VehicleResult[] = [];
    const workers: Promise<void>[] = [];

    // Create worker pool
    const workerCount = Math.min(this.config.maxConcurrency, vehicles.length);
    for (let i = 0; i < workerCount; i++) {
      workers.push(this.createWorker(i, queue, processFunc, results));
    }

    // Wait for all workers to complete
    await Promise.all(workers);
    return results;
  }

  /**
   * Worker function that processes vehicles from the queue
   */
  private async createWorker(
    workerId: number,
    queue: Vehicle[],
    processFunc: (vehicle: Vehicle) => Promise<VehicleResult>,
    results: VehicleResult[]
  ): Promise<void> {
    while (queue.length > 0) {
      const vehicle = queue.shift();
      if (!vehicle) break;

      const startTime = Date.now();
      this.logger.debug(`Worker ${workerId} processing vehicle ${vehicle.vin}`);

      try {
        // Process with timeout
        const result = await this.processWithTimeout(
          () => this.processWithRetry(vehicle, processFunc),
          this.config.timeout,
          vehicle
        );

        result.duration = Date.now() - startTime;
        results.push(result);

        this.performanceMonitor.recordMetric('vehicle.processed', 1, {
          status: result.status,
          duration: result.duration,
          workerId: workerId.toString()
        });

        this.logger.debug(`Worker ${workerId} completed vehicle ${vehicle.vin}`, {
          status: result.status,
          duration: `${(result.duration / 1000).toFixed(2)}s`
        });

      } catch (error) {
        const errorResult: VehicleResult = {
          vehicle,
          status: 'failed',
          error: error instanceof Error ? error : new Error(String(error)),
          duration: Date.now() - startTime
        };

        results.push(errorResult);
        this.errorReporter.reportError(error, { vehicle, workerId });

        this.logger.error(`Worker ${workerId} failed for vehicle ${vehicle.vin}`, {
          error: error instanceof Error ? error.message : String(error),
          duration: `${(errorResult.duration / 1000).toFixed(2)}s`
        });
      }
    }

    this.logger.debug(`Worker ${workerId} completed`);
  }

  /**
   * Process with retry logic
   */
  private async processWithRetry(
    vehicle: Vehicle,
    processFunc: (vehicle: Vehicle) => Promise<VehicleResult>
  ): Promise<VehicleResult> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        this.logger.debug(`Processing vehicle ${vehicle.vin} (attempt ${attempt}/${this.config.retryAttempts})`);
        return await processFunc(vehicle);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.config.retryAttempts) {
          this.logger.warn(`Retry ${attempt}/${this.config.retryAttempts} for vehicle ${vehicle.vin}`, {
            error: lastError.message
          });
          
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    return {
      vehicle,
      status: 'failed',
      error: lastError || new Error('Unknown error')
    };
  }

  /**
   * Process with timeout protection
   */
  private async processWithTimeout(
    processFunc: () => Promise<VehicleResult>,
    timeout: number,
    vehicle: Vehicle
  ): Promise<VehicleResult> {
    return Promise.race([
      processFunc(),
      new Promise<VehicleResult>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
      )
    ]).catch(error => ({
      vehicle,
      status: 'failed' as const,
      error: error instanceof Error ? error : new Error(String(error))
    }));
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<ProcessorConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ProcessorConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };

    this.logger.info('Configuration updated', this.config);
  }
}