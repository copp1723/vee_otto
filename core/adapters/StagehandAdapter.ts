import { Page } from 'playwright';
import { StagehandService, StagehandActionResult } from '../services/StagehandService';
import { HybridAutomationAgent } from '../agents/HybridAutomationAgent';
import { Logger } from '../utils/Logger';
import { OCRService } from '../../integrations/ocr/OCRService';

export interface StagehandAdapterConfig {
  fallbackEnabled?: boolean;
  fallbackTimeout?: number;
  stagehandTimeout?: number;
  enableMetrics?: boolean;
  debugMode?: boolean;
}

export interface AdapterActionResult {
  success: boolean;
  method: 'stagehand' | 'playwright' | 'ocr' | 'failed';
  responseTime: number;
  instruction?: string;
  error?: string;
  fallbackUsed?: boolean;
}

export class StagehandAdapter {
  private stagehandService: StagehandService;
  private hybridAgent?: HybridAutomationAgent;
  private logger: Logger;
  private config: StagehandAdapterConfig;
  private page: Page;

  constructor(
    page: Page,
    stagehandService: StagehandService,
    hybridAgent?: HybridAutomationAgent,
    config: StagehandAdapterConfig = {}
  ) {
    this.page = page;
    this.stagehandService = stagehandService;
    this.hybridAgent = hybridAgent;
    this.logger = new Logger('StagehandAdapter');
    
    this.config = {
      fallbackEnabled: true,
      fallbackTimeout: 10000,
      stagehandTimeout: 30000,
      enableMetrics: true,
      debugMode: process.env.NODE_ENV === 'development',
      ...config
    };

    this.logger.info('StagehandAdapter initialized', {
      fallbackEnabled: this.config.fallbackEnabled,
      debugMode: this.config.debugMode
    });
  }

  /**
   * Smart navigation using natural language
   */
  async smartNavigate(
    instruction: string,
    url?: string,
    options: { timeout?: number; verifyNavigation?: () => Promise<boolean> } = {}
  ): Promise<AdapterActionResult> {
    const startTime = Date.now();
    
    this.logger.info(`Smart Navigate: "${instruction}"`, { url });

    try {
      // Try Stagehand first
      const stagehandResult = await this.stagehandService.performAction(
        url ? 'navigate' : 'act',
        url || instruction,
        {
          timeout: options.timeout || this.config.stagehandTimeout,
          verifyAction: options.verifyNavigation
        }
      );

      if (stagehandResult.success) {
        return {
          success: true,
          method: 'stagehand',
          responseTime: Date.now() - startTime,
          instruction
        };
      }

      // Fallback to traditional navigation if enabled
      if (this.config.fallbackEnabled && url) {
        this.logger.warn('Stagehand navigation failed, falling back to Playwright');
        
        await this.page.goto(url, { 
          timeout: options.timeout || this.config.fallbackTimeout 
        });
        
        if (options.verifyNavigation) {
          const verified = await options.verifyNavigation();
          if (!verified) {
            throw new Error('Navigation verification failed');
          }
        }

        return {
          success: true,
          method: 'playwright',
          responseTime: Date.now() - startTime,
          instruction,
          fallbackUsed: true
        };
      }

      return {
        success: false,
        method: 'failed',
        responseTime: Date.now() - startTime,
        instruction,
        error: stagehandResult.error
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Smart navigation failed', { instruction, error: errorMessage });

      return {
        success: false,
        method: 'failed',
        responseTime: Date.now() - startTime,
        instruction,
        error: errorMessage
      };
    }
  }

  /**
   * Smart click using natural language with hybrid fallback
   */
  async smartClick(
    instruction: string,
    selector?: string,
    humanName?: string,
    options: { timeout?: number; verifyAction?: () => Promise<boolean> } = {}
  ): Promise<AdapterActionResult> {
    const startTime = Date.now();
    const displayName = humanName || instruction;
    
    this.logger.info(`Smart Click: "${displayName}"`, { instruction, selector });

    try {
      // Try Stagehand first
      const stagehandResult = await this.stagehandService.performAction(
        'act',
        `Click on ${instruction}`,
        {
          timeout: options.timeout || this.config.stagehandTimeout,
          verifyAction: options.verifyAction
        }
      );

      if (stagehandResult.success) {
        return {
          success: true,
          method: 'stagehand',
          responseTime: Date.now() - startTime,
          instruction
        };
      }

      // Fallback to hybrid automation if enabled and selector provided
      if (this.config.fallbackEnabled && this.hybridAgent && selector) {
        this.logger.warn('Stagehand click failed, falling back to HybridAutomationAgent');
        
        const hybridSuccess = await this.hybridAgent.hybridClick(
          selector,
          displayName,
          { timeout: options.timeout || this.config.fallbackTimeout }
        );

        if (hybridSuccess) {
          if (options.verifyAction) {
            const verified = await options.verifyAction();
            if (!verified) {
              throw new Error('Click verification failed');
            }
          }

          return {
            success: true,
            method: 'playwright',
            responseTime: Date.now() - startTime,
            instruction,
            fallbackUsed: true
          };
        }
      }

      return {
        success: false,
        method: 'failed',
        responseTime: Date.now() - startTime,
        instruction,
        error: stagehandResult.error
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Smart click failed', { instruction, error: errorMessage });

      return {
        success: false,
        method: 'failed',
        responseTime: Date.now() - startTime,
        instruction,
        error: errorMessage
      };
    }
  }

  /**
   * Smart form filling using natural language
   */
  async smartFill(
    instruction: string,
    value: string,
    selector?: string,
    humanName?: string,
    options: { timeout?: number; verifyInput?: boolean } = {}
  ): Promise<AdapterActionResult> {
    const startTime = Date.now();
    const displayName = humanName || instruction;
    
    this.logger.info(`Smart Fill: "${value}" into "${displayName}"`, { instruction, selector });

    try {
      // Try Stagehand first
      const stagehandResult = await this.stagehandService.performAction(
        'act',
        `Fill "${value}" into ${instruction}`,
        {
          timeout: options.timeout || this.config.stagehandTimeout
        }
      );

      if (stagehandResult.success) {
        // Verify input if requested
        if (options.verifyInput && selector) {
          const actualValue = await this.page.locator(selector).inputValue();
          if (actualValue !== value) {
            throw new Error(`Input verification failed. Expected: "${value}", Got: "${actualValue}"`);
          }
        }

        return {
          success: true,
          method: 'stagehand',
          responseTime: Date.now() - startTime,
          instruction
        };
      }

      // Fallback to hybrid automation if enabled and selector provided
      if (this.config.fallbackEnabled && this.hybridAgent && selector) {
        this.logger.warn('Stagehand fill failed, falling back to HybridAutomationAgent');
        
        const hybridSuccess = await this.hybridAgent.hybridType(
          selector,
          value,
          displayName,
          { 
            timeout: options.timeout || this.config.fallbackTimeout,
            verifyText: options.verifyInput
          }
        );

        if (hybridSuccess) {
          return {
            success: true,
            method: 'playwright',
            responseTime: Date.now() - startTime,
            instruction,
            fallbackUsed: true
          };
        }
      }

      return {
        success: false,
        method: 'failed',
        responseTime: Date.now() - startTime,
        instruction,
        error: stagehandResult.error
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Smart fill failed', { instruction, error: errorMessage });

      return {
        success: false,
        method: 'failed',
        responseTime: Date.now() - startTime,
        instruction,
        error: errorMessage
      };
    }
  }

  /**
   * Extract data using natural language
   */
  async extractData(
    instruction: string,
    options: { timeout?: number; schema?: any } = {}
  ): Promise<{ success: boolean; data?: any; error?: string; method: string }> {
    const startTime = Date.now();
    
    this.logger.info(`Extract Data: "${instruction}"`);

    try {
      // Try Stagehand extract
      const stagehandResult = await this.stagehandService.performAction(
        'extract',
        instruction,
        {
          timeout: options.timeout || this.config.stagehandTimeout
        }
      );

      if (stagehandResult.success) {
        return {
          success: true,
          data: stagehandResult, // The actual extracted data will be in the result
          method: 'stagehand'
        };
      }

      return {
        success: false,
        error: stagehandResult.error,
        method: 'stagehand'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Data extraction failed', { instruction, error: errorMessage });

      return {
        success: false,
        error: errorMessage,
        method: 'failed'
      };
    }
  }

  /**
   * Observe page state using natural language
   */
  async observePage(
    instruction: string,
    options: { timeout?: number } = {}
  ): Promise<{ success: boolean; observation?: string; error?: string }> {
    this.logger.info(`Observe Page: "${instruction}"`);

    try {
      const stagehandResult = await this.stagehandService.performAction(
        'observe',
        instruction,
        {
          timeout: options.timeout || this.config.stagehandTimeout
        }
      );

      if (stagehandResult.success) {
        return {
          success: true,
          observation: 'Page observed successfully' // Actual observation data would be in result
        };
      }

      return {
        success: false,
        error: stagehandResult.error
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Page observation failed', { instruction, error: errorMessage });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(context: string = 'general'): Promise<Buffer> {
    return await this.stagehandService.takeScreenshot(context);
  }

  /**
   * Get adapter metrics
   */
  getMetrics() {
    return this.stagehandService.getMetrics();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<StagehandAdapterConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Configuration updated', newConfig);
  }
}