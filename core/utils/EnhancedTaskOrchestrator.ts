import { TaskOrchestrator, TaskDefinition, TaskResult, TaskContext } from '../services/TaskOrchestrator';
import { Logger } from './Logger';
import { Page } from 'playwright';

/**
 * Enhanced TaskOrchestrator utilities with improved error handling and observability
 */
export class EnhancedTaskOrchestratorUtils {
  private logger: Logger;
  private globalTimeout: number;
  private enableJsonSummary: boolean;
  private retryConfig: {
    useExponentialBackoff: boolean;
    baseDelayMs: number;
    maxDelayMs: number;
  };

  constructor(name: string, options: {
    globalTimeout?: number;
    enableJsonSummary?: boolean;
    retryConfig?: {
      useExponentialBackoff?: boolean;
      baseDelayMs?: number;
      maxDelayMs?: number;
    };
  } = {}) {
    this.logger = new Logger('EnhancedTaskOrchestrator');
    this.globalTimeout = options.globalTimeout || 30 * 60 * 1000; // 30 minutes default
    this.enableJsonSummary = options.enableJsonSummary || false;
    this.retryConfig = {
      useExponentialBackoff: options.retryConfig?.useExponentialBackoff || true,
      baseDelayMs: options.retryConfig?.baseDelayMs || 1000,
      maxDelayMs: options.retryConfig?.maxDelayMs || 30000
    };
  }

  /**
   * Create an enhanced orchestrator with timeout protection
   */
  createOrchestrator(name: string): TaskOrchestrator {
    const orchestrator = new TaskOrchestrator(name);
    
    // Store original executeAll method
    const originalExecuteAll = orchestrator.executeAll.bind(orchestrator);
    
    // Override with timeout protection
    orchestrator.executeAll = async (page: Page, config: any): Promise<Map<string, TaskResult>> => {
      this.logger.info(`🚀 Starting enhanced execution with ${this.globalTimeout/1000}s global timeout`);
      
      const flowPromise = originalExecuteAll(page, config);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Global timeout of ${this.globalTimeout/1000}s exceeded`)), this.globalTimeout)
      );

      try {
        const results = await Promise.race([flowPromise, timeoutPromise]);
        
        if (this.enableJsonSummary) {
          const jsonSummary = this.generateJsonSummary(results);
          this.logger.info('📊 JSON Summary:', JSON.stringify(jsonSummary, null, 2));
        }
        
        return results;
      } catch (error) {
        this.logger.error('❌ Enhanced execution failed:', error);
        throw error;
      }
    };
    
    return orchestrator;
  }

  /**
   * Generate JSON summary of execution results
   */
  generateJsonSummary(results: Map<string, TaskResult>): {
    success: number;
    failed: number;
    totalTime: number;
    successRate: number;
    tasks: TaskResult[];
    metadata: {
      executionTime: string;
      globalTimeout: number;
    };
  } {
    const resultsArray = Array.from(results.values());
    const successful = resultsArray.filter(r => r.success).length;
    const failed = resultsArray.filter(r => !r.success).length;
    const totalTime = resultsArray.reduce((sum, r) => sum + (r.duration || 0), 0);
    
    return {
      success: successful,
      failed: failed,
      totalTime,
      successRate: resultsArray.length > 0 ? (successful / resultsArray.length) * 100 : 0,
      tasks: resultsArray,
      metadata: {
        executionTime: new Date().toISOString(),
        globalTimeout: this.globalTimeout
      }
    };
  }
}

/**
 * Utility function to create an enhanced orchestrator
 */
export function createEnhancedOrchestrator(name: string, options?: {
  globalTimeout?: number;
  enableJsonSummary?: boolean;
  retryConfig?: {
    useExponentialBackoff?: boolean;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
}): TaskOrchestrator {
  const utils = new EnhancedTaskOrchestratorUtils(name, options);
  return utils.createOrchestrator(name);
}