import { ParallelVehicleProcessor, ParallelConfig, ServiceConfig } from '../core/services/ParallelVehicleProcessor';
import { VehicleValidationService } from '../core/services/VehicleValidationService';
import { WindowStickerService } from '../core/services/WindowStickerService';
import { CheckboxMappingService } from '../core/services/CheckboxMappingService';
import { InventoryFilterService } from '../core/services/InventoryFilterService';

/**
 * Example: How to integrate ParallelVehicleProcessor with your existing services
 */
export async function runParallelProcessingExample(page: any, logger: any) {
  
  // Configuration for parallel processing
  const parallelConfig: ParallelConfig = {
    maxConcurrency: 3,        // Start with 3 workers
    workerTimeout: 300000,    // 5 minutes per worker
    errorThreshold: 0.5,      // Stop if >50% fail
    batchSize: 5              // 5 vehicles per batch
  };

  // Your existing services configuration
  const serviceConfig: ServiceConfig = {
    validation: VehicleValidationService,
    windowSticker: WindowStickerService,
    checkboxMapping: CheckboxMappingService,
    inventoryFilter: InventoryFilterService
  };

  // Create parallel processor
  const parallelProcessor = new ParallelVehicleProcessor(
    parallelConfig,
    serviceConfig,
    logger
  );

  try {
    logger.info('🚀 Starting parallel vehicle processing...');

    // Get vehicle links (using your existing detection logic)
    const vehicleLinks = await detectVehicleLinks(page, logger);
    
    if (vehicleLinks.length === 0) {
      logger.warn('No vehicles found to process');
      return;
    }

    logger.info(`Found ${vehicleLinks.length} vehicles for parallel processing`);

    // Process vehicles in parallel
    const result = await parallelProcessor.processVehicles(vehicleLinks, page);

    // Log results
    logger.info('📊 Parallel Processing Results:');
    logger.info(`  Total Vehicles: ${result.totalVehicles}`);
    logger.info(`  Processed: ${result.processedVehicles}`);
    logger.info(`  Failed: ${result.failedVehicles}`);
    logger.info(`  Total Features: ${result.totalFeatures}`);
    logger.info(`  Processing Time: ${(result.processingTime / 1000).toFixed(2)}s`);
    logger.info(`  Success Rate: ${((result.processedVehicles / result.totalVehicles) * 100).toFixed(1)}%`);

    // Time comparison
    const sequentialEstimate = result.totalVehicles * 120; // 2 minutes per vehicle
    const timeSaved = sequentialEstimate - result.processingTime;
    const percentageSaved = ((timeSaved / sequentialEstimate) * 100).toFixed(1);
    
    logger.info(`⚡ Time Saved: ${(timeSaved / 1000).toFixed(2)}s (${percentageSaved}% faster than sequential)`);

    // Worker performance breakdown
    logger.info('👷 Worker Performance:');
    result.workerResults.forEach(worker => {
      logger.info(`  ${worker.workerId}: ${worker.vehiclesProcessed} vehicles, ${worker.featuresFound} features, ${(worker.processingTime / 1000).toFixed(2)}s`);
    });

    return result;

  } catch (error) {
    logger.error('❌ Parallel processing failed:', error);
    throw error;
  }
}

/**
 * Helper function to detect vehicle links (placeholder - use your existing logic)
 */
async function detectVehicleLinks(page: any, logger: any): Promise<any[]> {
  // This would use your existing VehicleValidationService logic
  // For now, returning mock data structure
  
  const vehicleLinkSelectors = [
    '//tr[contains(@class, "x-grid3-row")]//td[position()=1 or position()=2]//a[contains(@href, "javascript")]',
    '//tr[contains(@class, "x-grid3-row")]//a[contains(@onclick, "OpenVehicle")]'
  ];

  let vehicleLinks: any[] = [];
  
  for (const selector of vehicleLinkSelectors) {
    try {
      const links = await page.locator(selector).all();
      if (links.length > 0 && links.length <= 25) {
        vehicleLinks = links;
        logger.info(`✅ Found ${links.length} vehicle links using selector: ${selector}`);
        break;
      }
    } catch (error) {
      continue;
    }
  }

  return vehicleLinks;
}

/**
 * Performance comparison utility
 */
export function calculatePerformanceGains(parallelResult: any): {
  timeSaved: number;
  percentageFaster: number;
  vehiclesPerMinute: number;
} {
  const sequentialEstimate = parallelResult.totalVehicles * 120000; // 2 minutes per vehicle in ms
  const timeSaved = sequentialEstimate - parallelResult.processingTime;
  const percentageFaster = (timeSaved / sequentialEstimate) * 100;
  const vehiclesPerMinute = (parallelResult.totalVehicles / (parallelResult.processingTime / 60000));

  return {
    timeSaved: Math.round(timeSaved / 1000), // in seconds
    percentageFaster: Math.round(percentageFaster),
    vehiclesPerMinute: Math.round(vehiclesPerMinute * 10) / 10 // 1 decimal place
  };
}