import { Page, Browser } from 'playwright';
import { StagehandService, StagehandConfig } from '../services/StagehandService';
import { StagehandAdapter, StagehandAdapterConfig, AdapterActionResult } from '../adapters/StagehandAdapter';
import { HybridAutomationAgent } from './HybridAutomationAgent';
import { Logger } from '../utils/Logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ExperimentalConfig {
  stagehand: StagehandConfig & StagehandAdapterConfig;
  experimental: {
    features: {
      stagehandPrimary: boolean;
      hybridFallback: boolean;
      metricsCollection: boolean;
      performanceComparison: boolean;
      debugMode: boolean;
    };
    limits: {
      maxActionsPerSession: number;
      maxRetryAttempts: number;
      timeoutMs: number;
    };
    safety: {
      enableFallbacks: boolean;
      requireConfirmation: boolean;
      logAllActions: boolean;
      captureScreenshots: boolean;
    };
  };
  logging: {
    level: string;
    logStagehandActions: boolean;
    logFallbackActions: boolean;
    logPerformanceMetrics: boolean;
    outputDir: string;
  };
  metrics: {
    enabled: boolean;
    trackResponseTimes: boolean;
    trackSuccessRates: boolean;
    trackCosts: boolean;
    exportFormat: string;
    exportInterval: number;
  };
}

export interface ExperimentalMetrics {
  session: {
    startTime: number;
    totalActions: number;
    stagehandActions: number;
    fallbackActions: number;
    failedActions: number;
  };
  performance: {
    stagehandAvgResponseTime: number;
    fallbackAvgResponseTime: number;
    successRateStagehand: number;
    successRateFallback: number;
  };
  comparison: {
    stagehandFaster: number;
    fallbackFaster: number;
    equivalent: number;
  };
  costs: {
    estimatedStagehandCost: number;
    estimatedFallbackCost: number;
  };
}

export interface ActionComparison {
  instruction: string;
  stagehandResult?: AdapterActionResult;
  fallbackResult?: AdapterActionResult;
  winner: 'stagehand' | 'fallback' | 'tie' | 'both_failed';
  timeDifference: number;
  notes?: string;
}

export class ExperimentalVAutoAgent {
  private stagehandService!: StagehandService;
  private stagehandAdapter!: StagehandAdapter;
  private hybridAgent: HybridAutomationAgent;
  private logger: Logger;
  private config!: ExperimentalConfig;
  private metrics!: ExperimentalMetrics;
  private page: Page;
  private browser: Browser;
  private actionHistory: ActionComparison[] = [];
  private sessionId: string;

  constructor(
    page: Page,
    browser: Browser,
    hybridAgent: HybridAutomationAgent,
    configPath: string = 'config/experimental.json'
  ) {
    this.page = page;
    this.browser = browser;
    this.hybridAgent = hybridAgent;
    this.logger = new Logger('ExperimentalVAutoAgent');
    this.sessionId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.initializeMetrics();
  }

  async initialize(configPath: string = 'config/experimental.json'): Promise<void> {
    try {
      // Load experimental configuration
      await this.loadConfig(configPath);
      
      // Initialize Stagehand service
      this.stagehandService = new StagehandService(this.config.stagehand);
      await this.stagehandService.initialize();
      
      // Initialize Stagehand adapter
      this.stagehandAdapter = new StagehandAdapter(
        this.page,
        this.stagehandService,
        this.hybridAgent,
        {
          fallbackEnabled: this.config.experimental.features.hybridFallback,
          fallbackTimeout: this.config.stagehand.fallbackTimeout,
          stagehandTimeout: this.config.stagehand.stagehandTimeout,
          enableMetrics: this.config.metrics.enabled,
          debugMode: this.config.experimental.features.debugMode
        }
      );

      this.logger.info('ExperimentalVAutoAgent initialized', {
        sessionId: this.sessionId,
        stagehandPrimary: this.config.experimental.features.stagehandPrimary,
        fallbackEnabled: this.config.experimental.features.hybridFallback
      });

    } catch (error) {
      this.logger.error('Failed to initialize ExperimentalVAutoAgent', error);
      throw error;
    }
  }

  /**
   * Smart navigation with experimental features
   */
  async smartNavigate(
    instruction: string,
    url?: string,
    options: { 
      timeout?: number; 
      verifyNavigation?: () => Promise<boolean>;
      runComparison?: boolean;
    } = {}
  ): Promise<AdapterActionResult> {
    const shouldCompare = options.runComparison && this.config.experimental.features.performanceComparison;
    
    if (shouldCompare && url) {
      return await this.runNavigationComparison(instruction, url, options);
    }

    // Standard navigation using primary method
    if (this.config.experimental.features.stagehandPrimary) {
      const result = await this.stagehandAdapter.smartNavigate(instruction, url, options);
      await this.recordAction('navigate', instruction, result);
      return result;
    } else {
      // Use traditional navigation as primary
      await this.hybridAgent.navigateToUrl(url || instruction);
      const result = true; // navigateToUrl doesn't return boolean, assumes success if no throw
      const adapterResult: AdapterActionResult = {
        success: result,
        method: 'playwright',
        responseTime: 0, // Traditional agent doesn't track this
        instruction
      };
      await this.recordAction('navigate', instruction, adapterResult);
      return adapterResult;
    }
  }

  /**
   * Smart click with experimental features
   */
  async smartClick(
    instruction: string,
    selector?: string,
    humanName?: string,
    options: { 
      timeout?: number; 
      verifyAction?: () => Promise<boolean>;
      runComparison?: boolean;
    } = {}
  ): Promise<AdapterActionResult> {
    const shouldCompare = options.runComparison && this.config.experimental.features.performanceComparison;
    
    if (shouldCompare && selector) {
      return await this.runClickComparison(instruction, selector, humanName, options);
    }

    // Standard click using primary method
    if (this.config.experimental.features.stagehandPrimary) {
      const result = await this.stagehandAdapter.smartClick(instruction, selector, humanName, options);
      await this.recordAction('click', instruction, result);
      return result;
    } else {
      // Use traditional click as primary
      const result = await this.hybridAgent.hybridClick(
        selector || instruction,
        humanName || instruction,
        { timeout: options.timeout }
      );
      const adapterResult: AdapterActionResult = {
        success: result,
        method: 'playwright',
        responseTime: 0,
        instruction
      };
      await this.recordAction('click', instruction, adapterResult);
      return adapterResult;
    }
  }

  /**
   * Smart form filling with experimental features
   */
  async smartFill(
    instruction: string,
    value: string,
    selector?: string,
    humanName?: string,
    options: { 
      timeout?: number; 
      verifyInput?: boolean;
      runComparison?: boolean;
    } = {}
  ): Promise<AdapterActionResult> {
    const shouldCompare = options.runComparison && this.config.experimental.features.performanceComparison;
    
    if (shouldCompare && selector) {
      return await this.runFillComparison(instruction, value, selector, humanName, options);
    }

    // Standard fill using primary method
    if (this.config.experimental.features.stagehandPrimary) {
      const result = await this.stagehandAdapter.smartFill(instruction, value, selector, humanName, options);
      await this.recordAction('fill', instruction, result);
      return result;
    } else {
      // Use traditional fill as primary
      const result = await this.hybridAgent.hybridType(
        selector || instruction,
        value,
        humanName || instruction,
        { 
          timeout: options.timeout,
          verifyText: options.verifyInput
        }
      );
      const adapterResult: AdapterActionResult = {
        success: result,
        method: 'playwright',
        responseTime: 0,
        instruction
      };
      await this.recordAction('fill', instruction, adapterResult);
      return adapterResult;
    }
  }

  /**
   * Extract data using Stagehand
   */
  async extractData(
    instruction: string,
    options: { timeout?: number; schema?: any } = {}
  ): Promise<{ success: boolean; data?: any; error?: string; method: string }> {
    const result = await this.stagehandAdapter.extractData(instruction, options);
    await this.recordAction('extract', instruction, {
      success: result.success,
      method: result.method as 'stagehand' | 'playwright' | 'ocr' | 'failed',
      responseTime: 0,
      instruction,
      error: result.error
    });
    return result;
  }

  /**
   * Run side-by-side navigation comparison
   */
  private async runNavigationComparison(
    instruction: string,
    url: string,
    options: { timeout?: number; verifyNavigation?: () => Promise<boolean> }
  ): Promise<AdapterActionResult> {
    this.logger.info('Running navigation comparison', { instruction, url });

    try {
      // Create a new page for comparison testing
      const comparisonPage = await this.browser.newPage();
      
      // Test Stagehand navigation
      const stagehandStart = Date.now();
      const stagehandResult = await this.stagehandAdapter.smartNavigate(instruction, url, options);
      
      // Test traditional navigation on comparison page
      const fallbackStart = Date.now();
      let fallbackResult: AdapterActionResult;
      try {
        await comparisonPage.goto(url, { timeout: options.timeout });
        if (options.verifyNavigation) {
          const verified = await options.verifyNavigation();
          if (!verified) throw new Error('Navigation verification failed');
        }
        fallbackResult = {
          success: true,
          method: 'playwright',
          responseTime: Date.now() - fallbackStart,
          instruction
        };
      } catch (error) {
        fallbackResult = {
          success: false,
          method: 'failed',
          responseTime: Date.now() - fallbackStart,
          instruction,
          error: error instanceof Error ? error.message : String(error)
        };
      }

      // Clean up comparison page
      await comparisonPage.close();

      // Record comparison
      const comparison: ActionComparison = {
        instruction,
        stagehandResult,
        fallbackResult,
        winner: this.determineWinner(stagehandResult, fallbackResult),
        timeDifference: Math.abs(stagehandResult.responseTime - fallbackResult.responseTime)
      };
      
      this.actionHistory.push(comparison);
      await this.recordAction('navigate_comparison', instruction, stagehandResult);

      return stagehandResult.success ? stagehandResult : fallbackResult;

    } catch (error) {
      this.logger.error('Navigation comparison failed', error);
      // Fall back to standard navigation
      return await this.stagehandAdapter.smartNavigate(instruction, url, options);
    }
  }

  /**
   * Run side-by-side click comparison
   */
  private async runClickComparison(
    instruction: string,
    selector: string,
    humanName?: string,
    options: { timeout?: number; verifyAction?: () => Promise<boolean> } = {}
  ): Promise<AdapterActionResult> {
    this.logger.info('Running click comparison', { instruction, selector });

    // Note: For click comparisons, we'll test on the same page but in sequence
    // This is a simplified approach - in production, you might want more sophisticated comparison
    
    const stagehandResult = await this.stagehandAdapter.smartClick(instruction, selector, humanName, options);
    
    // Record the attempt
    const comparison: ActionComparison = {
      instruction,
      stagehandResult,
      winner: stagehandResult.success ? 'stagehand' : 'both_failed',
      timeDifference: 0,
      notes: 'Single method test - comparison would require page state restoration'
    };
    
    this.actionHistory.push(comparison);
    await this.recordAction('click_comparison', instruction, stagehandResult);

    return stagehandResult;
  }

  /**
   * Run side-by-side fill comparison
   */
  private async runFillComparison(
    instruction: string,
    value: string,
    selector: string,
    humanName?: string,
    options: { timeout?: number; verifyInput?: boolean } = {}
  ): Promise<AdapterActionResult> {
    this.logger.info('Running fill comparison', { instruction, value, selector });

    const stagehandResult = await this.stagehandAdapter.smartFill(instruction, value, selector, humanName, options);
    
    // Record the attempt
    const comparison: ActionComparison = {
      instruction,
      stagehandResult,
      winner: stagehandResult.success ? 'stagehand' : 'both_failed',
      timeDifference: 0,
      notes: 'Single method test - comparison would require input state restoration'
    };
    
    this.actionHistory.push(comparison);
    await this.recordAction('fill_comparison', instruction, stagehandResult);

    return stagehandResult;
  }

  /**
   * Get experimental metrics
   */
  getMetrics(): ExperimentalMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get action history
   */
  getActionHistory(): ActionComparison[] {
    return [...this.actionHistory];
  }

  /**
   * Export metrics to file
   */
  async exportMetrics(format: 'json' | 'csv' = 'json'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `experimental_metrics_${this.sessionId}_${timestamp}.${format}`;
    const outputPath = path.join(this.config.logging.outputDir, filename);

    const data = {
      sessionId: this.sessionId,
      metrics: this.getMetrics(),
      actionHistory: this.getActionHistory(),
      config: this.config,
      exportedAt: new Date().toISOString()
    };

    try {
      // Ensure output directory exists
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      
      if (format === 'json') {
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
      } else {
        // Simple CSV export (would need more sophisticated implementation for full CSV)
        const csvContent = this.convertToCsv(data);
        await fs.writeFile(outputPath, csvContent);
      }

      this.logger.info('Metrics exported', { outputPath, format });
      return outputPath;

    } catch (error) {
      this.logger.error('Failed to export metrics', error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.exportMetrics();
      await this.stagehandService?.cleanup();
      this.logger.info('ExperimentalVAutoAgent cleanup completed', { sessionId: this.sessionId });
    } catch (error) {
      this.logger.error('Error during cleanup', error);
    }
  }

  // Private helper methods
  private async loadConfig(configPath: string): Promise<void> {
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      this.config = JSON.parse(configData);
    } catch (error) {
      this.logger.warn('Failed to load config, using defaults', error);
      this.config = this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): ExperimentalConfig {
    return {
      stagehand: {
        model: 'openai/gpt-4o',
        headless: false,
        env: 'LOCAL',
        cacheEnabled: true,
        timeout: 30000,
        enableCaching: true,
        verbose: true,
        fallbackEnabled: true,
        fallbackTimeout: 10000,
        stagehandTimeout: 30000,
        enableMetrics: true,
        debugMode: true
      },
      experimental: {
        features: {
          stagehandPrimary: true,
          hybridFallback: true,
          metricsCollection: true,
          performanceComparison: true,
          debugMode: true
        },
        limits: {
          maxActionsPerSession: 100,
          maxRetryAttempts: 3,
          timeoutMs: 60000
        },
        safety: {
          enableFallbacks: true,
          requireConfirmation: false,
          logAllActions: true,
          captureScreenshots: true
        }
      },
      logging: {
        level: 'debug',
        logStagehandActions: true,
        logFallbackActions: true,
        logPerformanceMetrics: true,
        outputDir: 'logs/experimental'
      },
      metrics: {
        enabled: true,
        trackResponseTimes: true,
        trackSuccessRates: true,
        trackCosts: true,
        exportFormat: 'json',
        exportInterval: 300000
      }
    };
  }

  private initializeMetrics(): void {
    this.metrics = {
      session: {
        startTime: Date.now(),
        totalActions: 0,
        stagehandActions: 0,
        fallbackActions: 0,
        failedActions: 0
      },
      performance: {
        stagehandAvgResponseTime: 0,
        fallbackAvgResponseTime: 0,
        successRateStagehand: 0,
        successRateFallback: 0
      },
      comparison: {
        stagehandFaster: 0,
        fallbackFaster: 0,
        equivalent: 0
      },
      costs: {
        estimatedStagehandCost: 0,
        estimatedFallbackCost: 0
      }
    };
  }

  private async recordAction(action: string, instruction: string, result: AdapterActionResult): Promise<void> {
    this.metrics.session.totalActions++;
    
    if (result.method === 'stagehand') {
      this.metrics.session.stagehandActions++;
    } else if (result.method === 'playwright' || result.method === 'ocr') {
      this.metrics.session.fallbackActions++;
    }

    if (!result.success) {
      this.metrics.session.failedActions++;
    }

    if (this.config.experimental.safety.captureScreenshots && this.config.experimental.safety.logAllActions) {
      try {
        await this.stagehandAdapter.takeScreenshot(`${action}_${Date.now()}`);
      } catch (error) {
        this.logger.warn('Failed to capture screenshot', error);
      }
    }
  }

  private updateMetrics(): void {
    const stagehandActions = this.metrics.session.stagehandActions;
    const fallbackActions = this.metrics.session.fallbackActions;
    const totalActions = this.metrics.session.totalActions;

    if (stagehandActions > 0) {
      this.metrics.performance.successRateStagehand = 
        ((stagehandActions - this.metrics.session.failedActions) / stagehandActions) * 100;
    }

    if (fallbackActions > 0) {
      this.metrics.performance.successRateFallback = 
        ((fallbackActions - this.metrics.session.failedActions) / fallbackActions) * 100;
    }

    // Update cost estimates (rough calculation)
    this.metrics.costs.estimatedStagehandCost = stagehandActions * 0.015;
    this.metrics.costs.estimatedFallbackCost = fallbackActions * 0.001;
  }

  private determineWinner(stagehandResult: AdapterActionResult, fallbackResult: AdapterActionResult): 'stagehand' | 'fallback' | 'tie' | 'both_failed' {
    if (!stagehandResult.success && !fallbackResult.success) {
      return 'both_failed';
    }
    
    if (stagehandResult.success && !fallbackResult.success) {
      return 'stagehand';
    }
    
    if (!stagehandResult.success && fallbackResult.success) {
      return 'fallback';
    }
    
    // Both succeeded, compare response times
    const timeDiff = Math.abs(stagehandResult.responseTime - fallbackResult.responseTime);
    if (timeDiff < 500) { // Consider within 500ms as equivalent
      return 'tie';
    }
    
    return stagehandResult.responseTime < fallbackResult.responseTime ? 'stagehand' : 'fallback';
  }

  private convertToCsv(data: any): string {
    // Simple CSV conversion - would need more sophisticated implementation
    const headers = ['Action', 'Method', 'Success', 'ResponseTime', 'Instruction'];
    const rows = [headers.join(',')];
    
    for (const action of this.actionHistory) {
      if (action.stagehandResult) {
        rows.push([
          'stagehand',
          action.stagehandResult.method,
          action.stagehandResult.success,
          action.stagehandResult.responseTime,
          `"${action.instruction}"`
        ].join(','));
      }
      
      if (action.fallbackResult) {
        rows.push([
          'fallback',
          action.fallbackResult.method,
          action.fallbackResult.success,
          action.fallbackResult.responseTime,
          `"${action.instruction}"`
        ].join(','));
      }
    }
    
    return rows.join('\n');
  }
}