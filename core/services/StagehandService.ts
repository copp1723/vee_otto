import { Stagehand } from '@browserbasehq/stagehand';
import { Page, Browser } from 'playwright';
import { Logger } from '../utils/Logger';

export interface StagehandConfig {
  apiKey?: string;
  model?: string;
  headless?: boolean;
  env?: 'LOCAL' | 'BROWSERBASE';
  cacheEnabled?: boolean;
  timeout?: number;
  enableCaching?: boolean;
  verbose?: boolean;
}

export interface StagehandMetrics {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  averageResponseTime: number;
  cacheHitRate: number;
  apiCalls: number;
  costEstimate: number;
}

export interface StagehandActionResult {
  success: boolean;
  method: 'stagehand' | 'fallback';
  responseTime: number;
  error?: string;
  cacheHit?: boolean;
}

export class StagehandService {
  private stagehand: Stagehand | null = null;
  private logger: Logger;
  private config: StagehandConfig;
  private metrics: StagehandMetrics;
  private initialized = false;

  constructor(config: StagehandConfig = {}) {
    this.logger = new Logger('StagehandService');
    this.config = {
      model: 'openai/gpt-4o',
      headless: false,
      env: 'LOCAL',
      cacheEnabled: true,
      timeout: 30000,
      enableCaching: true,
      verbose: process.env.NODE_ENV === 'development',
      ...config
    };

    this.metrics = {
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      apiCalls: 0,
      costEstimate: 0
    };

    this.logger.info('StagehandService initialized', {
      model: this.config.model,
      cacheEnabled: this.config.cacheEnabled,
      env: this.config.env
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.logger.info('Initializing Stagehand...');

      // Validate API key if required
      if (this.config.env === 'BROWSERBASE' && !this.config.apiKey) {
        throw new Error('API key required for BROWSERBASE environment');
      }

      // Initialize Stagehand with configuration
      const stagehandConfig: any = {
        env: this.config.env,
        headless: this.config.headless,
        enableCaching: this.config.enableCaching,
        verbose: this.config.verbose
      };

      if (this.config.apiKey) {
        stagehandConfig.apiKey = this.config.apiKey;
      }

      if (this.config.model) {
        stagehandConfig.modelName = this.config.model;
      }

      this.stagehand = new Stagehand(stagehandConfig);
      await this.stagehand.init();

      this.initialized = true;
      this.logger.info('Stagehand initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Stagehand', error);
      throw error;
    }
  }

  async createPage(): Promise<Page> {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized');
    }

    try {
      const page = this.stagehand.page;
      return page;
    } catch (error) {
      this.logger.error('Failed to create Stagehand page', error);
      throw error;
    }
  }

  async performAction(
    action: string,
    instruction: string,
    options: {
      timeout?: number;
      verifyAction?: () => Promise<boolean>;
      domSettleTime?: number;
    } = {}
  ): Promise<StagehandActionResult> {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized');
    }

    const startTime = Date.now();
    this.metrics.totalActions++;

    try {
      this.logger.info(`Performing Stagehand action: ${action}`, {
        instruction,
        timeout: options.timeout
      });

      let result: any;
      const actionTimeout = options.timeout || this.config.timeout || 30000;

      switch (action) {
        case 'navigate':
          result = await this.stagehand.page.goto(instruction, { 
            timeout: actionTimeout 
          });
          break;
        
        case 'act':
          result = await this.stagehand.page.act(instruction);
          break;
        
        case 'extract':
          result = await this.stagehand.page.extract(instruction);
          break;
        
        case 'observe':
          result = await this.stagehand.page.observe(instruction);
          break;
        
        default:
          throw new Error(`Unknown action type: ${action}`);
      }

      // Verify action if verification function provided
      if (options.verifyAction) {
        const verified = await options.verifyAction();
        if (!verified) {
          throw new Error('Action verification failed');
        }
      }

      const responseTime = Date.now() - startTime;
      this.updateMetrics(true, responseTime);

      this.logger.info(`Stagehand action completed successfully`, {
        action,
        responseTime: `${responseTime}ms`
      });

      return {
        success: true,
        method: 'stagehand',
        responseTime,
        cacheHit: false // TODO: Implement cache hit detection
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateMetrics(false, responseTime);

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Stagehand action failed: ${action}`, {
        instruction,
        error: errorMessage,
        responseTime: `${responseTime}ms`
      });

      return {
        success: false,
        method: 'stagehand',
        responseTime,
        error: errorMessage
      };
    }
  }

  async takeScreenshot(filename?: string): Promise<Buffer> {
    if (!this.stagehand?.page) {
      throw new Error('Stagehand page not available');
    }

    try {
      const screenshot = await this.stagehand.page.screenshot({
        fullPage: false,
        type: 'png'
      });

      if (filename) {
        this.logger.info(`Screenshot captured: ${filename}`);
      }

      return screenshot;
    } catch (error) {
      this.logger.error('Failed to take screenshot', error);
      throw error;
    }
  }

  getMetrics(): StagehandMetrics {
    return { ...this.metrics };
  }

  clearMetrics(): void {
    this.metrics = {
      totalActions: 0,
      successfulActions: 0,
      failedActions: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      apiCalls: 0,
      costEstimate: 0
    };
    this.logger.info('Stagehand metrics cleared');
  }

  async cleanup(): Promise<void> {
    try {
      if (this.stagehand) {
        await this.stagehand.close();
        this.logger.info('Stagehand cleanup completed');
      }
    } catch (error) {
      this.logger.error('Error during Stagehand cleanup', error);
    } finally {
      this.initialized = false;
      this.stagehand = null;
    }
  }

  isInitialized(): boolean {
    return this.initialized && this.stagehand !== null;
  }

  // Private helper methods
  private updateMetrics(success: boolean, responseTime: number): void {
    if (success) {
      this.metrics.successfulActions++;
    } else {
      this.metrics.failedActions++;
    }

    // Update average response time
    const totalTime = this.metrics.averageResponseTime * (this.metrics.totalActions - 1) + responseTime;
    this.metrics.averageResponseTime = totalTime / this.metrics.totalActions;

    // Increment API calls (assuming each action is an API call)
    this.metrics.apiCalls++;

    // Estimate cost (rough calculation - $0.03 per 1K tokens, assuming ~500 tokens per action)
    this.metrics.costEstimate += 0.015; // Rough estimate
  }
}