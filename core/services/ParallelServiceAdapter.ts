/**
 * Parallel Service Adapter
 * 
 * Provides isolation and coordination for services running in parallel contexts
 * Wraps existing services to work safely in multi-worker environments
 */

import { Page } from 'playwright';
import { VehicleValidationService } from './VehicleValidationService';
import { WindowStickerService } from './WindowStickerService';
import { CheckboxMappingService } from './CheckboxMappingService';
import { NavigationMetrics } from '../metrics/NavigationMetrics';

export interface ServiceExecutionContext {
  workerId: string;
  batchId?: string;
  vehicleIndex: number;
  page: Page;
  logger: any;
}

export interface ServiceExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  executionTime: number;
  workerId: string;
}

export class ParallelServiceAdapter {
  
  /**
   * Execute a service method with isolation and error handling
   */
  static async executeWithIsolation<T>(
    serviceClass: any,
    method: string,
    context: ServiceExecutionContext,
    ...args: any[]
  ): Promise<ServiceExecutionResult<T>> {
    const startTime = Date.now();
    
    try {
      NavigationMetrics.recordParallelAttempt(
        context.workerId,
        context.vehicleIndex,
        `${serviceClass.name}.${method}`,
        context.batchId
      );

      // Create service instance with isolated context
      const service = new serviceClass(context.page, context.logger);
      
      // Execute the method
      const result = await service[method](...args);
      
      const executionTime = Date.now() - startTime;
      
      NavigationMetrics.completeParallelAttempt(
        context.workerId,
        context.vehicleIndex,
        true,
        undefined,
        context.batchId
      );

      // Record performance
      NavigationMetrics.recordWorkerPerformance(context.workerId, {
        vehicleCount: 1,
        totalTime: executionTime,
        successRate: 1
      });

      return {
        success: true,
        data: result,
        executionTime,
        workerId: context.workerId
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      NavigationMetrics.completeParallelAttempt(
        context.workerId,
        context.vehicleIndex,
        false,
        errorMessage,
        context.batchId
      );

      // Record failed performance
      NavigationMetrics.recordWorkerPerformance(context.workerId, {
        vehicleCount: 1,
        totalTime: executionTime,
        successRate: 0
      });

      return {
        success: false,
        error: errorMessage,
        executionTime,
        workerId: context.workerId
      };
    }
  }

  /**
   * Execute vehicle validation in parallel context
   */
  static async validateVehicle(
    context: ServiceExecutionContext
  ): Promise<ServiceExecutionResult> {
    return this.executeWithIsolation(
      VehicleValidationService,
      'extractVehicleData',
      context
    );
  }

  /**
   * Execute window sticker scraping in parallel context
   */
  static async scrapeWindowSticker(
    context: ServiceExecutionContext
  ): Promise<ServiceExecutionResult> {
    return this.executeWithIsolation(
      WindowStickerService,
      'extractFeatures',
      context
    );
  }

  /**
   * Execute checkbox mapping in parallel context
   */
  static async updateCheckboxMapping(
    context: ServiceExecutionContext,
    features: string[]
  ): Promise<ServiceExecutionResult> {
    return this.executeWithIsolation(
      CheckboxMappingService,
      'mapAndUpdateCheckboxes',
      context,
      features
    );
  }

  /**
   * Batch execute multiple services for a single vehicle
   */
  static async executeVehicleWorkflow(
    context: ServiceExecutionContext
  ): Promise<{
    validation: ServiceExecutionResult;
    windowSticker?: ServiceExecutionResult;
    checkboxMapping?: ServiceExecutionResult;
  }> {
    const results: any = {};

    // Step 1: Vehicle validation
    results.validation = await this.validateVehicle(context);
    
    if (!results.validation.success || !results.validation.data?.isValid) {
      return results;
    }

    // Step 2: Window sticker scraping
    results.windowSticker = await this.scrapeWindowSticker(context);

    if (results.windowSticker.success && results.windowSticker.data?.features) {
      // Step 3: Checkbox mapping
      results.checkboxMapping = await this.updateCheckboxMapping(
        context,
        results.windowSticker.data.features
      );
    }

    return results;
  }

  /**
   * Health check for worker services
   */
  static async healthCheck(
    context: ServiceExecutionContext
  ): Promise<ServiceExecutionResult<boolean>> {
    const startTime = Date.now();
    
    try {
      // Basic page health check
      await context.page.waitForLoadState('domcontentloaded', { timeout: 5000 });
      
      return {
        success: true,
        data: true,
        executionTime: Date.now() - startTime,
        workerId: context.workerId
      };
    } catch (error) {
      return {
        success: false,
        error: 'Worker health check failed',
        executionTime: Date.now() - startTime,
        workerId: context.workerId
      };
    }
  }
}