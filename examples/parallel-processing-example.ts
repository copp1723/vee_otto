/**
 * Example: Using Parallel Vehicle Processing with VeeOtto
 * 
 * This example demonstrates how to use the ParallelVehicleProcessor
 * to process multiple vehicles concurrently for faster performance.
 */

import { VAutoAgentParallel } from '../platforms/vauto/VAutoAgentParallel';
import { VAutoConfig } from '../platforms/vauto/VAutoAgent';
import { Logger } from '../core/utils/Logger';

async function runParallelProcessing() {
  const logger = new Logger('ParallelExample');
  
  // Configuration with parallel processing settings
  const config: VAutoConfig = {
    username: process.env.VAUTO_USERNAME!,
    password: process.env.VAUTO_PASSWORD!,
    headless: true,
    slowMo: 0,
    screenshotOnError: true,
    maxVehiclesToProcess: 10,
    readOnlyMode: false,
    
    // Parallel processing specific settings
    maxConcurrency: 3,        // Process 3 vehicles at once
    batchSize: 10,            // Process in batches of 10
    timeout: 300000,          // 5 minutes per vehicle
    
    mailgunConfig: process.env.MAILGUN_API_KEY ? {
      apiKey: process.env.MAILGUN_API_KEY,
      domain: process.env.MAILGUN_DOMAIN || 'veeotto.ai',
      from: 'VeeOtto <automation@veeotto.ai>',
      to: ['notifications@veeotto.ai']
    } : undefined
  };
  
  try {
    // Initialize the parallel agent
    const agent = new VAutoAgentParallel(config);
    
    logger.info('Starting VeeOtto with parallel processing...');
    logger.info(`Configuration:`, {
      maxConcurrency: config.maxConcurrency,
      batchSize: config.batchSize,
      maxVehicles: config.maxVehiclesToProcess
    });
    
    // Initialize browser and login
    await agent.initialize();
    const loginSuccess = await agent.login();
    
    if (!loginSuccess) {
      throw new Error('Login failed');
    }
    
    // Process inventory with parallel processing
    const startTime = Date.now();
    const result = await agent.processInventory();
    const endTime = Date.now();
    
    // Log results
    logger.info('🎉 Parallel processing completed!');
    logger.info('📊 Results:', {
      totalVehicles: result.totalVehicles,
      successful: result.successfulVehicles,
      failed: result.failedVehicles,
      totalDuration: `${((endTime - startTime) / 1000).toFixed(2)}s`,
      averageTimePerVehicle: `${((endTime - startTime) / result.totalVehicles / 1000).toFixed(2)}s`
    });
    
    // Compare with sequential processing estimate
    const sequentialEstimate = result.totalVehicles * 300; // 5 minutes per vehicle
    const timeSaved = sequentialEstimate - (endTime - startTime);
    const speedup = sequentialEstimate / (endTime - startTime);
    
    logger.info('⚡ Performance improvement:', {
      sequentialEstimate: `${(sequentialEstimate / 1000 / 60).toFixed(1)} minutes`,
      actualTime: `${((endTime - startTime) / 1000 / 60).toFixed(1)} minutes`,
      timeSaved: `${(timeSaved / 1000 / 60).toFixed(1)} minutes`,
      speedup: `${speedup.toFixed(1)}x faster`
    });
    
    // Log any failures for investigation
    if (result.failedVehicles > 0) {
      logger.warn('⚠️ Some vehicles failed processing:');
      result.vehicles
        .filter(v => !v.processed)
        .forEach(v => {
          logger.warn(`  - ${v.vin}: ${v.errors.join(', ')}`);
        });
    }
    
    // Send summary report if email configured
    if (config.mailgunConfig) {
      await agent.sendReport();
    }
    
    // Cleanup
    await agent.cleanup();
    
  } catch (error) {
    logger.error('Parallel processing failed:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  runParallelProcessing().catch(console.error);
}

export { runParallelProcessing };