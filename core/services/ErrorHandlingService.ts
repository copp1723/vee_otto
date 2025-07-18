import { Page } from 'playwright';
import { Logger } from '../utils/Logger';

export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  NAVIGATION = 'NAVIGATION',
  ELEMENT_NOT_FOUND = 'ELEMENT_NOT_FOUND',
  TIMEOUT = 'TIMEOUT',
  NETWORK = 'NETWORK',
  PARSING = 'PARSING',
  VALIDATION = 'VALIDATION',
  SYSTEM = 'SYSTEM',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

export interface ProcessingError {
  id: string;
  timestamp: Date;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  context?: any;
  screenshotPath?: string;
  recoveryAttempted: boolean;
  recoverySuccessful: boolean;
  vehicleVin?: string;
  dealershipId?: string;
}

export interface ErrorHandlingConfig {
  maxRetries: number;
  retryDelay: number;
  captureScreenshots: boolean;
  screenshotDir: string;
  enableRecovery: boolean;
  criticalErrorThreshold: number;
}

export class ErrorHandlingService {
  private page: Page;
  private logger: Logger;
  private config: ErrorHandlingConfig;
  private errors: ProcessingError[] = [];

  constructor(page: Page, logger: Logger, config: Partial<ErrorHandlingConfig> = {}) {
    this.page = page;
    this.logger = logger;
    this.config = {
      maxRetries: 3,
      retryDelay: 2000,
      captureScreenshots: true,
      screenshotDir: './screenshots',
      enableRecovery: true,
      criticalErrorThreshold: 5,
      ...config
    };
  }

  async handleError(error: any, context: any = {}): Promise<ProcessingError> {
    const processedError: ProcessingError = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      category: this.categorizeError(error),
      severity: this.determineSeverity(error),
      message: error.message || String(error),
      stack: error.stack,
      context,
      recoveryAttempted: false,
      recoverySuccessful: false,
      vehicleVin: context.vehicleVin,
      dealershipId: context.dealershipId
    };

    if (this.config.captureScreenshots) {
      try {
        processedError.screenshotPath = await this.captureErrorScreenshot(processedError.id);
      } catch (screenshotError: any) {
        this.logger.warn(`Failed to capture screenshot: ${screenshotError.message}`);
      }
    }

    if (this.config.enableRecovery && this.shouldAttemptRecovery(processedError)) {
      processedError.recoveryAttempted = true;
      try {
        const recoveryResult: boolean = await this.attemptRecovery(processedError);
        processedError.recoverySuccessful = recoveryResult;
      } catch (recoveryError: any) {
        this.logger.error(`Recovery attempt failed: ${recoveryError.message}`);
      }
    }

    this.errors.push(processedError);
    this.logError(processedError);

    return processedError;
  }

  async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    context: any = {},
    maxRetries: number = this.config.maxRetries
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        const processedError = await this.handleError(error, {
          ...context,
          attempt,
          maxRetries
        });

        if (attempt < maxRetries) {
          this.logger.info(`Retrying operation (attempt ${attempt + 1}/${maxRetries}) after ${this.config.retryDelay}ms`);
          await this.delay(this.config.retryDelay);
        } else {
          this.logger.error(`Operation failed after ${maxRetries} attempts`);
          throw error;
        }
      }
    }
    
    throw lastError;
  }

  async skipVehicle(vin: string, reason: string, context: any = {}): Promise<void> {
    const skipError: ProcessingError = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.MEDIUM,
      message: `Vehicle skipped: ${reason}`,
      context: { ...context, skipReason: reason },
      recoveryAttempted: false,
      recoverySuccessful: false,
      vehicleVin: vin
    };

    this.errors.push(skipError);
    this.logger.warn(`Skipping vehicle ${vin}: ${reason}`);
  }

  getErrors(): ProcessingError[] {
    return [...this.errors];
  }

  getErrorsByCategory(category: ErrorCategory): ProcessingError[] {
    return this.errors.filter(error => error.category === category);
  }

  getErrorsBySeverity(severity: ErrorSeverity): ProcessingError[] {
    return this.errors.filter(error => error.severity === severity);
  }

  getCriticalErrors(): ProcessingError[] {
    return this.getErrorsBySeverity(ErrorSeverity.CRITICAL);
  }

  getErrorStats(): any {
    const stats = {
      total: this.errors.length,
      byCategory: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      recoveryRate: 0
    };

    this.errors.forEach(error => {
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    const recoveredErrors = this.errors.filter(e => e.recoverySuccessful).length;
    const attemptedRecoveries = this.errors.filter(e => e.recoveryAttempted).length;
    stats.recoveryRate = attemptedRecoveries > 0 ? (recoveredErrors / attemptedRecoveries) * 100 : 0;

    return stats;
  }

  clearErrors(): void {
    this.errors = [];
  }

  private categorizeError(error: any): ErrorCategory {
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('timeout') || message.includes('waiting for')) {
      return ErrorCategory.TIMEOUT;
    }
    if (message.includes('element') || message.includes('selector')) {
      return ErrorCategory.ELEMENT_NOT_FOUND;
    }
    if (message.includes('network') || message.includes('connection')) {
      return ErrorCategory.NETWORK;
    }
    if (message.includes('login') || message.includes('auth')) {
      return ErrorCategory.AUTHENTICATION;
    }
    if (message.includes('navigation') || message.includes('navigate')) {
      return ErrorCategory.NAVIGATION;
    }
    if (message.includes('parse') || message.includes('json')) {
      return ErrorCategory.PARSING;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }
    
    return ErrorCategory.UNKNOWN;
  }

  private determineSeverity(error: any): ErrorSeverity {
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    }
    if (message.includes('timeout') || message.includes('network')) {
      return ErrorSeverity.HIGH;
    }
    if (message.includes('element') || message.includes('selector')) {
      return ErrorSeverity.MEDIUM;
    }
    
    return ErrorSeverity.LOW;
  }

  private shouldAttemptRecovery(error: ProcessingError): boolean {
    if (error.severity === ErrorSeverity.CRITICAL || error.category === ErrorCategory.AUTHENTICATION) {
      return false;
    }
    
    const criticalErrorCount = this.getCriticalErrors().length;
    if (criticalErrorCount >= this.config.criticalErrorThreshold) {
      return false;
    }
    
    return true;
  }

  private async attemptRecovery(error: ProcessingError): Promise<boolean> {
    this.logger.info(`Attempting recovery for error: ${error.message}`);
    
    try {
      switch (error.category) {
        case ErrorCategory.NAVIGATION:
          await this.page.goBack();
          await this.page.waitForLoadState('networkidle', { timeout: 5000 });
          return true;
          
        case ErrorCategory.ELEMENT_NOT_FOUND:
          await this.page.reload();
          await this.page.waitForLoadState('networkidle', { timeout: 5000 });
          return true;
          
        case ErrorCategory.TIMEOUT:
          await this.page.waitForTimeout(2000);
          return true;
          
        default:
          return false;
      }
    } catch (recoveryError: any) {
      this.logger.error(`Recovery failed: ${recoveryError.message}`);
      return false;
    }
  }

  private async captureErrorScreenshot(errorId: string): Promise<string> {
    const filename = `error_${errorId}_${Date.now()}.png`;
    const filepath = `${this.config.screenshotDir}/${filename}`;
    
    await this.page.screenshot({ path: filepath, fullPage: true });
    return filepath;
  }

  private logError(error: ProcessingError): void {
    const logMessage = `[${error.severity}] ${error.category}: ${error.message}`;
    
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.error(logMessage);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error(logMessage);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn(logMessage);
        break;
      case ErrorSeverity.LOW:
        this.logger.info(logMessage);
        break;
    }
  }

  private generateErrorId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}