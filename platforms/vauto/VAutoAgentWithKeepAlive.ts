import { VAutoAgent, VAutoConfig } from './VAutoAgent';
import { SessionKeepAliveService, KeepAliveConfig } from '../../core/services/SessionKeepAliveService';
import { Logger } from '../../core/utils/Logger';
import fs from 'fs-extra';
import path from 'path';

export interface VAutoKeepAliveConfig extends VAutoConfig {
  keepAlive?: KeepAliveConfig;
}

/**
 * VAutoAgent with Session Keep-Alive capabilities
 * 
 * Extends the base VAutoAgent to maintain sessions and reduce 2FA requirements
 * through minimal user activity simulation.
 */
export class VAutoAgentWithKeepAlive extends VAutoAgent {
  private keepAliveService: SessionKeepAliveService | null = null;
  private keepAliveLogger: Logger;

  constructor(config: VAutoKeepAliveConfig) {
    super(config);
    this.keepAliveLogger = new Logger('VAutoKeepAlive');
    
    // Initialize keep-alive service if config provided
    if (config.keepAlive) {
      this.keepAliveService = new SessionKeepAliveService(config.keepAlive);
    } else {
      // Load default configuration
      this.loadDefaultKeepAliveConfig();
    }
  }

  /**
   * Load default keep-alive configuration
   */
  private loadDefaultKeepAliveConfig(): void {
    try {
      const configPath = path.join(__dirname, '../../config/session-config.json');
      const sessionConfig = fs.readJsonSync(configPath);
      
      const keepAliveConfig: KeepAliveConfig = {
        ...sessionConfig.keepAlive,
        sessionTimeoutSelectors: sessionConfig.vauto.sessionTimeoutSelectors,
        loginRequiredSelectors: sessionConfig.vauto.loginRequiredSelectors
      };

      this.keepAliveService = new SessionKeepAliveService(keepAliveConfig);
      this.keepAliveLogger.info('Loaded default keep-alive configuration');
    } catch (error) {
      this.keepAliveLogger.warn('Failed to load keep-alive configuration', error);
    }
  }

  /**
   * Enhanced login with keep-alive initialization
   */
  async login(): Promise<boolean> {
    const loginSuccess = await super.login();
    
    if (loginSuccess && this.keepAliveService && this.page) {
      this.keepAliveLogger.info('Login successful, starting keep-alive service');
      
      // Start keep-alive service after successful login
      await this.keepAliveService.start(this.page);
      
      // Log keep-alive status
      const status = this.keepAliveService.getStatus();
      this.keepAliveLogger.info('Keep-alive service started', {
        isActive: status.isActive,
        startTime: status.startTime
      });
    }
    
    return loginSuccess;
  }

  /**
   * Enhanced processing with session monitoring
   */
  async processInventory() {
    try {
      // Check if keep-alive service is running
      if (this.keepAliveService && !this.keepAliveService.isRunning()) {
        this.keepAliveLogger.warn('Keep-alive service not running, session may expire');
      }

      return await super.processInventory();
    } catch (error) {
      // Check if error is related to session expiration
      if (this.isSessionExpiredError(error)) {
        this.keepAliveLogger.error('Session expired during processing', error);
        
        // Stop keep-alive service
        if (this.keepAliveService) {
          this.keepAliveService.stop();
        }
        
        // Attempt to re-login
        this.keepAliveLogger.info('Attempting to re-login...');
        const reLoginSuccess = await this.login();
        
        if (reLoginSuccess) {
          this.keepAliveLogger.info('Re-login successful, retrying inventory processing');
          return await super.processInventory();
        }
      }
      
      throw error;
    }
  }

  /**
   * Check if error indicates session expiration
   */
  private isSessionExpiredError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    return errorMessage.includes('session') ||
           errorMessage.includes('login') ||
           errorMessage.includes('signin') ||
           errorMessage.includes('authentication') ||
           errorMessage.includes('unauthorized');
  }

  /**
   * Get keep-alive service status
   */
  getKeepAliveStatus() {
    return this.keepAliveService?.getStatus() || null;
  }

  /**
   * Manually trigger keep-alive activity
   */
  async triggerKeepAlive(): Promise<void> {
    if (this.keepAliveService && this.page) {
      this.keepAliveLogger.info('Manually triggering keep-alive activity');
      // Access private method through any cast for manual trigger
      await (this.keepAliveService as any).performKeepAliveActivity(this.page);
    }
  }

  /**
   * Stop keep-alive service
   */
  stopKeepAlive(): void {
    if (this.keepAliveService) {
      this.keepAliveService.stop();
      this.keepAliveLogger.info('Keep-alive service stopped');
    }
  }

  /**
   * Enhanced cleanup to stop keep-alive service
   */
  async cleanup(): Promise<void> {
    this.stopKeepAlive();
    await super.cleanup();
  }

  /**
   * Generate enhanced report with keep-alive statistics
   */
  async generateReport(): Promise<string> {
    const baseReport = await super.generateReport();
    
    if (this.keepAliveService) {
      const status = this.keepAliveService.getStatus();
      const keepAliveReport = `

Keep-Alive Service Status
------------------------
Service Active: ${status.isActive ? 'Yes' : 'No'}
Start Time: ${status.startTime.toLocaleString()}
Last Activity: ${status.lastActivity.toLocaleString()}
Activity Count: ${status.activityCount}
Session Expired: ${status.sessionExpired ? 'Yes' : 'No'}
`;
      
      return baseReport + keepAliveReport;
    }
    
    return baseReport;
  }
}