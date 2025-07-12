import { BrowserAutomation } from '../utils/BrowserAutomation';
import { Logger } from '../utils/Logger';
import { ConfigManager } from '../utils/ConfigManager';
import { EmailProvider } from '../../integrations/email/EmailProvider';
import { EmailFactory } from '../../integrations/email/EmailFactory';

export interface AgentConfig {
  headless?: boolean;
  slowMo?: number;
  timeout?: number;
  screenshotOnError?: boolean;
  configName?: string;
}

export interface LoginConfig {
  url: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  username: string;
  password: string;
  successIndicator: string;
}

export interface TwoFactorConfig {
  enabled: boolean;
  emailSelector?: string;
  codeInputSelector?: string;
  submitSelector?: string;
  successIndicator?: string;
  timeout?: number;
  webhookUrl?: string; // New: URL to poll for 2FA code
}

export abstract class BaseAgent {
  protected browser: BrowserAutomation;
  protected logger: Logger;
  protected configManager: ConfigManager;
  protected emailProvider?: EmailProvider;
  protected config: AgentConfig;

  constructor(config: AgentConfig = {}) {
    this.config = {
      headless: false,
      slowMo: 100,
      timeout: 30000,
      screenshotOnError: true,
      configName: 'default',
      ...config
    };

    this.logger = new Logger(this.constructor.name);
    this.configManager = ConfigManager.getInstance();
    this.browser = new BrowserAutomation({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      timeout: this.config.timeout
    });
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing agent...');
    
    // Load configuration
    const fullConfig = await this.configManager.loadConfig(this.config.configName!);
    
    // Initialize browser
    await this.browser.initialize();
    
    // Initialize email provider if configured
    if (fullConfig.email) {
      this.emailProvider = EmailFactory.create(fullConfig.email);
      await this.emailProvider.initialize();
    }
    
    this.logger.info('Agent initialized successfully');
  }

  async login(loginConfig: LoginConfig): Promise<boolean> {
    try {
      this.logger.info(`Navigating to ${loginConfig.url}`);
      
      const page = this.browser.currentPage;
      await page.goto(loginConfig.url);
      await page.waitForLoadState('networkidle');

      await this.browser.takeScreenshot('login-page');

      this.logger.info('Filling credentials...');
      await this.browser.fillInput(loginConfig.usernameSelector, loginConfig.username);
      await this.browser.takeScreenshot('username-entered');

      await this.browser.fillInput(loginConfig.passwordSelector, loginConfig.password);
      await this.browser.takeScreenshot('password-entered');

      this.logger.info('Submitting login form...');
      await this.browser.reliableClick(loginConfig.submitSelector);

      await page.waitForLoadState('networkidle');
      await this.browser.takeScreenshot('after-login-attempt');

      // Check for success
      const loginSuccess = await page.locator(loginConfig.successIndicator).isVisible();
      
      if (loginSuccess) {
        this.logger.info('Login successful');
        return true;
      } else {
        this.logger.warn('Login success indicator not found');
        return false;
      }
    } catch (error) {
      this.logger.error('Login failed:', error);
      if (this.config.screenshotOnError) {
        await this.browser.takeScreenshot('login-error');
      }
      throw error;
    }
  }

  async handle2FA(twoFactorConfig: TwoFactorConfig): Promise<boolean> {
    if (!twoFactorConfig.enabled) {
      return false;
    }

    try {
      this.logger.info('Handling 2FA...');
      
      const page = this.browser.currentPage;
      
      if (twoFactorConfig.emailSelector) {
        await this.browser.reliableClick(twoFactorConfig.emailSelector);
        await page.waitForLoadState('networkidle');
      }

      let code: string | null = null;
      const startTime = Date.now();
      const timeout = twoFactorConfig.timeout || 300000;

      if (twoFactorConfig.webhookUrl) {
        // Poll webhook for code
        while (!code && (Date.now() - startTime < timeout)) {
          try {
            const response = await fetch(twoFactorConfig.webhookUrl);
            if (response.ok) {
              const data = await response.json();
              if (data.code) {
                code = data.code;
                this.logger.info('Received 2FA code from webhook');
              }
            }
          } catch (fetchErr) {
            this.logger.debug('Webhook poll failed, retrying...', fetchErr);
          }
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } else if (this.emailProvider) {
        // Existing email provider logic
        const codeData = await this.emailProvider.waitForTwoFactorCode(timeout);
        code = codeData.code;
      } else {
        throw new Error('No 2FA method configured (webhook or email)');
      }

      if (!code) {
        throw new Error('Timeout waiting for 2FA code');
      }

      if (twoFactorConfig.codeInputSelector) {
        await this.browser.fillInput(twoFactorConfig.codeInputSelector, code);
        
        if (twoFactorConfig.submitSelector) {
          await this.browser.reliableClick(twoFactorConfig.submitSelector);
          await page.waitForLoadState('networkidle');
        }
        
        if (twoFactorConfig.successIndicator) {
          const success = await page.locator(twoFactorConfig.successIndicator).isVisible();
          return success;
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('2FA handling failed:', error);
      if (this.config.screenshotOnError) {
        await this.browser.takeScreenshot('2fa-error');
      }
      throw error;
    }
  }

  async navigateTo(url: string): Promise<void> {
    const page = this.browser.currentPage;
    await page.goto(url);
    await page.waitForLoadState('networkidle');
  }

  async takeScreenshot(name: string): Promise<string> {
    return await this.browser.takeScreenshot(name);
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up agent...');
    
    if (this.emailProvider) {
      await this.emailProvider.close();
    }
    
    await this.browser.cleanup();
    
    this.logger.info('Agent cleanup complete');
  }

  async execute(task: () => Promise<void>): Promise<void> {
    try {
      await this.initialize();
      await task();
    } catch (error) {
      this.logger.error('Execution failed:', error);
      
      if (this.emailProvider) {
        await this.emailProvider.sendNotificationEmail(
          'Automation Failed',
          `Agent execution failed: ${error instanceof Error ? error.message : String(error)}`,
          true
        );
      }
      
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  // Abstract methods that must be implemented by platform-specific agents
  abstract processData(): Promise<any>;
  abstract generateReport(): Promise<string>;
}