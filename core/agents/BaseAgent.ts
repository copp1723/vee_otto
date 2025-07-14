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
    this.logger.info('Initializing agent...', { configName: this.config.configName });
    
    try {
      // Load configuration
      const fullConfig = await this.configManager.loadConfig(this.config.configName!);
      this.logger.info('Configuration loaded successfully');
      
      // Initialize browser with enhanced error handling
      this.logger.info('Initializing browser automation...');
      await this.browser.initialize();
      
      // Verify browser is healthy after initialization
      if (!(await this.browser.isHealthy())) {
        throw new Error('Browser initialization completed but health check failed');
      }
      
      // Initialize email provider if configured
      if (fullConfig.email) {
        this.logger.info('Initializing email provider...');
        this.emailProvider = EmailFactory.create(fullConfig.email);
        await this.emailProvider.initialize();
      }
      
      this.logger.info('Agent initialized successfully');
      
    } catch (error) {
      this.logger.error('Agent initialization failed', { error: error instanceof Error ? error.message : String(error) });
      
      // Clean up any partial initialization
      await this.cleanup().catch(cleanupError => {
        this.logger.warn('Cleanup during initialization failure also failed', cleanupError);
      });
      
      throw new Error(`Agent initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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
        this.logger.info(`Polling webhook for 2FA code at: ${twoFactorConfig.webhookUrl}`);
        let pollCount = 0;
        
        while (!code && (Date.now() - startTime < timeout)) {
          pollCount++;
          try {
            this.logger.debug(`Poll attempt ${pollCount} to ${twoFactorConfig.webhookUrl}`);
            const response = await fetch(twoFactorConfig.webhookUrl);
            
            if (response.ok) {
              const data = await response.json();
              this.logger.info(`Webhook response: ${JSON.stringify(data)}`);
              
              if (data.code) {
                code = data.code;
                this.logger.info(`Successfully received 2FA code from webhook: ${code}`);
              }
            } else {
              this.logger.debug(`Webhook returned status ${response.status}: ${response.statusText}`);
            }
          } catch (fetchErr) {
            this.logger.warn(`Webhook poll ${pollCount} failed:`, fetchErr);
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
        this.logger.info(`Attempting to fill 2FA code: ${code} into selector: ${twoFactorConfig.codeInputSelector}`);
        
        // Take screenshot before entering code
        await this.browser.takeScreenshot('2fa-before-code-entry');
        
        // Handle XPath selectors properly
        const inputSelector = twoFactorConfig.codeInputSelector.startsWith('//')
          ? { xpath: twoFactorConfig.codeInputSelector }
          : { css: twoFactorConfig.codeInputSelector };
        
        // Try to find the input element first
        const inputElement = await this.browser.findElement(inputSelector);
        if (!inputElement) {
          this.logger.error(`Could not find 2FA input element with selector: ${twoFactorConfig.codeInputSelector}`);
          await this.browser.takeScreenshot('2fa-input-not-found');
          throw new Error(`2FA input element not found: ${twoFactorConfig.codeInputSelector}`);
        }
        
        // Clear the input first
        this.logger.debug('Clearing 2FA input field...');
        await inputElement.clear();
        await page.waitForTimeout(500);
        
        // Try multiple methods to enter the code
        let inputFilled = false;
        const methods = [
          // Method 1: Use fillInput with clear option
          async () => {
            this.logger.debug('Trying fillInput method...');
            return await this.browser.fillInput(inputSelector, code, { clear: true, delay: 100 });
          },
          // Method 2: Click and type
          async () => {
            this.logger.debug('Trying click and type method...');
            await inputElement.click();
            await page.waitForTimeout(300);
            await page.keyboard.type(code, { delay: 100 });
            return true;
          },
          // Method 3: Direct fill
          async () => {
            this.logger.debug('Trying direct fill method...');
            await inputElement.fill(code);
            return true;
          }
        ];
        
        for (const method of methods) {
          try {
            inputFilled = await method();
            if (inputFilled) {
              this.logger.info('Successfully filled 2FA code input');
              break;
            }
          } catch (err) {
            this.logger.warn(`Method failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        
        if (!inputFilled) {
          await this.browser.takeScreenshot('2fa-fill-failed');
          throw new Error(`Failed to fill 2FA code input after trying multiple methods: ${twoFactorConfig.codeInputSelector}`);
        }
        
        // Verify the code was entered
        await page.waitForTimeout(500);
        const enteredValue = await inputElement.inputValue();
        this.logger.info(`Verified entered value: ${enteredValue}`);
        
        // Take screenshot after entering code
        await this.browser.takeScreenshot('2fa-after-code-entry');
        
        if (twoFactorConfig.submitSelector) {
          this.logger.info(`Looking for submit button: ${twoFactorConfig.submitSelector}`);
          
          const submitSelector = twoFactorConfig.submitSelector.startsWith('//')
            ? { xpath: twoFactorConfig.submitSelector }
            : { css: twoFactorConfig.submitSelector };
          
          // Wait a moment before clicking submit
          await page.waitForTimeout(1000);
          
          // Take screenshot before clicking submit
          await this.browser.takeScreenshot('2fa-before-submit');
          
          // Try to find the submit button first
          const submitElement = await this.browser.findElement(submitSelector);
          if (!submitElement) {
            this.logger.error(`Could not find 2FA submit button with selector: ${twoFactorConfig.submitSelector}`);
            await this.browser.takeScreenshot('2fa-submit-not-found');
            throw new Error(`2FA submit button not found: ${twoFactorConfig.submitSelector}`);
          }
          
          // Check if button is enabled
          const isEnabled = await submitElement.isEnabled();
          if (!isEnabled) {
            this.logger.warn('Submit button is disabled, waiting for it to be enabled...');
            await page.waitForTimeout(2000);
          }
          
          // Try multiple methods to click the submit button
          let submitClicked = false;
          const clickMethods: Array<() => Promise<boolean>> = [
            // Method 1: Use reliableClick
            async (): Promise<boolean> => {
              this.logger.debug('Trying reliableClick method...');
              await this.browser.reliableClick(submitSelector);
              return true;
            },
            // Method 2: Direct click
            async (): Promise<boolean> => {
              this.logger.debug('Trying direct click method...');
              await submitElement.click();
              return true;
            },
            // Method 3: JavaScript click
            async (): Promise<boolean> => {
              this.logger.debug('Trying JavaScript click method...');
              await submitElement.evaluate((el) => (el as HTMLElement).click());
              return true;
            }
          ];
          
          for (const method of clickMethods) {
            try {
              submitClicked = await method();
              if (submitClicked) {
                this.logger.info('Successfully clicked 2FA submit button');
                break;
              }
            } catch (err) {
              this.logger.warn(`Click method failed: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
          
          if (!submitClicked) {
            await this.browser.takeScreenshot('2fa-submit-failed');
            throw new Error(`Failed to click 2FA submit button after trying multiple methods: ${twoFactorConfig.submitSelector}`);
          }
          
          // Take screenshot after clicking submit
          await page.waitForTimeout(1000);
          await this.browser.takeScreenshot('2fa-after-submit');
          
          // Wait for page to load after submit
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