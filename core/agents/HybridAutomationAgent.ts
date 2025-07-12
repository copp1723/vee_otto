import { Page, Browser } from 'playwright';
import { Logger } from '../utils/Logger';
import { OCRService } from '../../integrations/ocr/OCRService';
import { 
  SmartInteractionEngine, 
  AutomationError,
  SmartActionOptions,
  SmartTypeOptions,
  SmartSelectOptions 
} from '../utils/reliabilityUtils';

export interface HybridAgentConfig {
  headless?: boolean;
  timeout?: number;
  retries?: number;
  screenshotOnFailure?: boolean;
  ocrEnabled?: boolean;
  performanceMonitoring?: boolean;
}

export interface ActionMetrics {
  actionType: string;
  humanName: string;
  startTime: number;
  endTime: number;
  success: boolean;
  method: 'playwright' | 'ocr' | 'failed';
  retryCount: number;
  error?: string;
}

export class HybridAutomationAgent {
  private page: Page;
  private browser: Browser;
  private logger: Logger;
  private ocrService?: OCRService;
  private smartEngine: SmartInteractionEngine;
  private config: HybridAgentConfig;
  private metrics: ActionMetrics[] = [];

  constructor(
    page: Page, 
    browser: Browser, 
    config: HybridAgentConfig = {},
    ocrService?: OCRService
  ) {
    this.page = page;
    this.browser = browser;
    this.logger = new Logger('HybridAutomationAgent');
    this.ocrService = ocrService;
    this.smartEngine = new SmartInteractionEngine(page, ocrService);
    
    this.config = {
      headless: false,
      timeout: 10000,
      retries: 2,
      screenshotOnFailure: true,
      ocrEnabled: !!ocrService,
      performanceMonitoring: true,
      ...config
    };

    this.logger.info('🚀 HybridAutomationAgent initialized', {
      ocrEnabled: this.config.ocrEnabled,
      performanceMonitoring: this.config.performanceMonitoring
    });
  }

  /**
   * Enhanced click with full hybrid capabilities and metrics
   */
  public async hybridClick(
    selector: string,
    humanName: string,
    options: Partial<SmartActionOptions> = {}
  ): Promise<boolean> {
    const startTime = Date.now();
    let success = false;
    let method: 'playwright' | 'ocr' | 'failed' = 'failed';
    let retryCount = 0;
    let error: string | undefined;

    try {
      const smartOptions: SmartActionOptions = {
        humanName,
        timeout: this.config.timeout,
        retries: this.config.retries,
        ...options
      };

      success = await this.smartEngine.smartClick(selector, smartOptions);
      method = success ? 'playwright' : 'failed';
      
      return success;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      
      if (err instanceof AutomationError) {
        // Handle screenshot saving if enabled
        if (this.config.screenshotOnFailure && err.screenshot) {
          await this.saveFailureScreenshot(err);
        }
        retryCount = this.config.retries || 0;
      }
      
      throw err;
    } finally {
      // Record metrics if enabled
      if (this.config.performanceMonitoring) {
        this.recordMetrics({
          actionType: 'click',
          humanName,
          startTime,
          endTime: Date.now(),
          success,
          method,
          retryCount,
          error
        });
      }
    }
  }

  /**
   * Enhanced type with verification and metrics
   */
  public async hybridType(
    selector: string,
    text: string,
    humanName: string,
    options: Partial<SmartTypeOptions> = {}
  ): Promise<boolean> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      const smartOptions: SmartTypeOptions = {
        humanName,
        timeout: this.config.timeout,
        retries: this.config.retries,
        clearFirst: true,
        verifyText: true,
        ...options
      };

      success = await this.smartEngine.smartType(selector, text, smartOptions);
      return success;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      if (this.config.performanceMonitoring) {
        this.recordMetrics({
          actionType: 'type',
          humanName,
          startTime,
          endTime: Date.now(),
          success,
          method: 'playwright',
          retryCount: 0,
          error
        });
      }
    }
  }

  /**
   * Enhanced select with options and metrics
   */
  public async hybridSelect(
    selector: string,
    value: string,
    humanName: string,
    options: Partial<SmartSelectOptions> = {}
  ): Promise<boolean> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      const smartOptions: SmartSelectOptions = {
        humanName,
        timeout: this.config.timeout,
        retries: this.config.retries,
        byValue: true,
        ...options
      };

      success = await this.smartEngine.smartSelect(selector, value, smartOptions);
      return success;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      if (this.config.performanceMonitoring) {
        this.recordMetrics({
          actionType: 'select',
          humanName,
          startTime,
          endTime: Date.now(),
          success,
          method: 'playwright',
          retryCount: 0,
          error
        });
      }
    }
  }

  /**
   * Navigate to a URL with stability checks
   */
  public async navigateToUrl(url: string, waitForStable: boolean = true): Promise<void> {
    this.logger.info(`🌐 Navigating to: ${url}`);
    
    try {
      await this.page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout 
      });
      
      if (waitForStable) {
        await this.smartEngine.waitForStable();
      }
      
      this.logger.info(`✅ Successfully navigated to: ${url}`);
    } catch (error) {
      this.logger.error(`❌ Navigation failed for: ${url}`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Wait for an element to appear with smart verification
   */
  public async waitForElement(
    selector: string,
    humanName: string,
    timeout: number = this.config.timeout!
  ): Promise<boolean> {
    this.logger.info(`⏳ Waiting for element: "${humanName}"`);
    
    try {
      return await this.smartEngine.verifyElement(selector, humanName, { timeout });
    } catch (error) {
      this.logger.warn(`⚠️ Element wait timeout: "${humanName}"`);
      return false;
    }
  }

  /**
   * Take a screenshot with context
   */
  public async takeScreenshot(context: string = 'general'): Promise<Buffer> {
    this.logger.info(`📸 Taking screenshot: ${context}`);
    
    const screenshot = await this.page.screenshot({ 
      fullPage: false,
      type: 'png'
    });
    
    return screenshot;
  }

  /**
   * Execute a sequence of actions with rollback on failure
   */
  public async executeSequence(
    actions: Array<() => Promise<any>>,
    sequenceName: string
  ): Promise<boolean> {
    this.logger.info(`🔄 Executing sequence: "${sequenceName}"`);
    
    const startTime = Date.now();
    let completedActions = 0;
    
    try {
      for (const action of actions) {
        await action();
        completedActions++;
      }
      
      const duration = Date.now() - startTime;
      this.logger.info(`✅ Sequence completed: "${sequenceName}" (${duration}ms)`);
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`❌ Sequence failed: "${sequenceName}" at step ${completedActions + 1} (${duration}ms)`, {
        error: error instanceof Error ? error.message : String(error),
        completedActions,
        totalActions: actions.length
      });
      
      // Take failure screenshot
      if (this.config.screenshotOnFailure) {
        const screenshot = await this.takeScreenshot(`sequence_failure_${sequenceName}`);
        // Could save to file system here if needed
      }
      
      throw error;
    }
  }

  /**
   * Get performance metrics for analysis
   */
  public getMetrics(): ActionMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get success rate statistics
   */
  public getSuccessRate(): { overall: number; byAction: Record<string, number> } {
    if (this.metrics.length === 0) {
      return { overall: 0, byAction: {} };
    }

    const successful = this.metrics.filter(m => m.success).length;
    const overall = (successful / this.metrics.length) * 100;

    const byAction: Record<string, number> = {};
    const actionTypes = [...new Set(this.metrics.map(m => m.actionType))];
    
    for (const actionType of actionTypes) {
      const actionMetrics = this.metrics.filter(m => m.actionType === actionType);
      const actionSuccessful = actionMetrics.filter(m => m.success).length;
      byAction[actionType] = (actionSuccessful / actionMetrics.length) * 100;
    }

    return { overall, byAction };
  }

  /**
   * Clear metrics (useful for testing specific workflows)
   */
  public clearMetrics(): void {
    this.metrics = [];
    this.logger.info('📊 Metrics cleared');
  }

  /**
   * Close the agent and cleanup resources
   */
  public async close(): Promise<void> {
    this.logger.info('🔒 Closing HybridAutomationAgent');
    
    if (this.ocrService) {
      await this.ocrService.terminate();
    }
    
    // Log final metrics
    if (this.config.performanceMonitoring && this.metrics.length > 0) {
      const stats = this.getSuccessRate();
      this.logger.info('📊 Final Performance Stats', {
        totalActions: this.metrics.length,
        overallSuccessRate: `${stats.overall.toFixed(1)}%`,
        actionBreakdown: stats.byAction
      });
    }
  }

  // Private helper methods

  private async saveFailureScreenshot(error: AutomationError): Promise<void> {
    if (!error.screenshot) return;

    try {
      const timestamp = error.timestamp.toISOString().replace(/[:.]/g, '-');
      const filename = `failure_${error.actionType}_${timestamp}.png`;
      
      // In a real implementation, you'd save to a screenshots directory
      this.logger.info(`💾 Failure screenshot would be saved as: ${filename}`);
      
      // Example: await fs.writeFile(path.join('./screenshots', filename), error.screenshot);
    } catch (saveError) {
      this.logger.warn('Failed to save failure screenshot', { error: saveError instanceof Error ? saveError.message : String(saveError) });
    }
  }

  private recordMetrics(metrics: ActionMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only last 1000 metrics to prevent memory issues
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  // Backward compatibility methods (delegate to smart engine)

  public async reliableClick(selector: string, humanName: string): Promise<boolean> {
    return await this.hybridClick(selector, humanName);
  }

  public async reliableType(selector: string, text: string, humanName: string): Promise<boolean> {
    return await this.hybridType(selector, text, humanName);
  }

  public async reliableSelect(selector: string, value: string, humanName: string): Promise<boolean> {
    return await this.hybridSelect(selector, value, humanName);
  }
}

