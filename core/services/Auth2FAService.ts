import { Logger } from '../utils/Logger';
import { Page } from 'playwright';
import { reliableClick } from '../utils/reliabilityUtils';

export interface Auth2FAConfig {
  webhookUrl?: string;
  timeout?: number;
  codeInputSelector: string;
  submitSelector: string;
  phoneSelectButton?: string;
  twoFactorTitle?: string;
}

export interface Auth2FAResult {
  success: boolean;
  code?: string;
  error?: string;
  timestamp: Date;
}

/**
 * Dedicated 2FA Authentication Service
 * 
 * This service handles ONLY the 2FA authentication flow.
 * It's isolated from other automation logic to protect the working implementation.
 */
export class Auth2FAService {
  private logger: Logger;

  constructor(private config: Auth2FAConfig) {
    this.logger = new Logger('Auth2FAService');
  }

  /**
   * Complete 2FA authentication flow
   * Returns success/failure without affecting other automation
   */
  async authenticate(page: Page): Promise<Auth2FAResult> {
    const startTime = new Date();
    
    try {
      this.logger.info('🔐 Starting 2FA authentication...');
      
      // Step 1: Handle 2FA selection if needed
      await this.handlePhoneSelection(page);
      
      // Step 2: Wait for and retrieve SMS code
      const code = await this.retrieveSMSCode();
      
      if (!code) {
        throw new Error('Failed to retrieve SMS code');
      }
      
      // Step 3: Enter code and submit
      await this.enterAndSubmitCode(page, code);
      
      // Step 4: Verify success
      await this.verifyAuthSuccess(page);
      
      this.logger.info('✅ 2FA authentication completed successfully');
      
      return {
        success: true,
        code,
        timestamp: startTime
      };
      
    } catch (error) {
      this.logger.error('❌ 2FA authentication failed', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: startTime
      };
    }
  }

  /**
   * Handle phone selection for 2FA
   * This contains your working phone selection logic
   */
  private async handlePhoneSelection(page: Page): Promise<void> {
    try {
      await page.waitForLoadState('networkidle');
      
      // Check for 2FA selection page
      if (this.config.twoFactorTitle) {
        try {
          await page.waitForSelector(this.config.twoFactorTitle, { timeout: 10000 });
          this.logger.info('2FA verification page detected');
        } catch (error) {
          this.logger.warn('2FA verification page not detected', error);
        }
      }
      
      // Take screenshot for diagnostics
      await this.takeScreenshot(page, 'vauto-2fa-options-page');

      // Log all visible button texts for diagnostics
      const allButtons = await page.$$('button');
      const buttonTexts = [];
      for (const btn of allButtons) {
        try {
          const text = await btn.textContent();
          if (text && text.trim()) buttonTexts.push(text.trim());
        } catch {}
      }
      this.logger.info(`2FA Option Step: Visible button texts: ${JSON.stringify(buttonTexts)}`);

      // Look for "Select" buttons with your working logic
      if (this.config.phoneSelectButton) {
        let selectButtons = await page.locator(this.config.phoneSelectButton).all();
        this.logger.info(`Found ${selectButtons.length} Select buttons`);

        // If none found, try the absolute XPath (your working fallback)
        if (selectButtons.length === 0) {
          const absXpath = '/html/body/div[2]/div/div[3]/div/div/div[1]/div[2]/div/div/div[2]/div/span[2]/button';
          const absBtn = await page.locator(`xpath=${absXpath}`).first();
          if (absBtn) {
            this.logger.info('Found Select button via absolute XPath');
            selectButtons = [absBtn];
          }
        }

        if (selectButtons.length > 0) {
          this.logger.info('Clicking the Select button for phone 2FA');
          await this.takeScreenshot(page, 'before-select-2fa-click');
          await selectButtons[0].click();
          await page.waitForLoadState('networkidle');
          await this.takeScreenshot(page, 'after-select-2fa-click');
        } else {
          // Your working alternative selectors
          const possibleSelectors = [
            'button:has-text("Continue")',
            'button:has-text("Next")',
            'button:has-text("Send")',
            'a:has-text("Select")',
            'div[role="button"]:has-text("Select")'
          ];

          let clicked = false;
          for (const selector of possibleSelectors) {
            try {
              const element = await page.locator(selector).first();
              if (await element.isVisible()) {
                this.logger.info(`Found alternative selector: ${selector}`);
                await element.click();
                await page.waitForLoadState('networkidle');
                clicked = true;
                break;
              }
            } catch (e) {
              // Continue trying other selectors
            }
          }

          if (!clicked) {
            this.logger.warn('Could not find any 2FA selection button');
            await this.takeScreenshot(page, 'vauto-2fa-selection-error');
          }
        }
      }
    } catch (error) {
      this.logger.warn('Error during phone selection', error);
      await this.takeScreenshot(page, 'vauto-2fa-selection-error');
    }
  }

  /**
   * Retrieve SMS code using your working webhook polling
   */
  private async retrieveSMSCode(): Promise<string | null> {
    if (!this.config.webhookUrl) {
      throw new Error('No webhook URL configured for SMS code retrieval');
    }

    const timeout = this.config.timeout || 300000; // 5 minutes default
    const startTime = Date.now();
    let pollCount = 0;

    this.logger.info(`🔍 Starting webhook polling for 2FA code`);
    this.logger.info(`   Webhook URL: ${this.config.webhookUrl}`);
    this.logger.info(`   Timeout: ${timeout}ms`);

    while (Date.now() - startTime < timeout) {
      pollCount++;
      const elapsed = Date.now() - startTime;

      try {
        this.logger.info(`📡 Poll attempt ${pollCount} (${Math.round(elapsed/1000)}s elapsed)`);

        const response = await fetch(this.config.webhookUrl);

        if (response.ok) {
          const data = await response.json();
          this.logger.info(`   Response data: ${JSON.stringify(data)}`);

          if (data.code) {
            this.logger.info(`✅ Successfully received 2FA code: ${data.code}`);
            return data.code;
          } else if (data.error) {
            this.logger.debug(`   Server message: ${data.error}`);
          }
        } else {
          this.logger.warn(`   HTTP error ${response.status}: ${response.statusText}`);
        }
      } catch (fetchErr) {
        this.logger.error(`❌ Poll ${pollCount} failed:`, fetchErr);
      }

      if (Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    this.logger.error(`❌ Timeout after ${pollCount} polls over ${Math.round((Date.now() - startTime)/1000)}s`);
    return null;
  }

  /**
   * Enter code and submit using your working logic
   */
  private async enterAndSubmitCode(page: Page, code: string): Promise<void> {
    this.logger.info(`Entering 2FA code: ${code}`);
    
    // Take screenshot before entering code
    await this.takeScreenshot(page, '2fa-before-code-entry');
    
    // Handle XPath selectors properly (your working approach)
    const inputSelector = this.config.codeInputSelector.startsWith('//')
      ? { xpath: this.config.codeInputSelector }
      : { css: this.config.codeInputSelector };
    
    // Try multiple methods to enter the code (your working methods)
    const inputElement = await page.locator(this.config.codeInputSelector).first();
    
    // Clear and fill input
    await inputElement.clear();
    await page.waitForTimeout(500);
    await inputElement.fill(code);
    
    // Verify the code was entered
    await page.waitForTimeout(500);
    const enteredValue = await inputElement.inputValue();
    this.logger.info(`Verified entered value: ${enteredValue}`);
    
    // Take screenshot after entering code
    await this.takeScreenshot(page, '2fa-after-code-entry');
    
    // Submit the code
    if (this.config.submitSelector) {
      await page.waitForTimeout(1000);
      await this.takeScreenshot(page, '2fa-before-submit');
      
      const submitElement = await page.locator(this.config.submitSelector).first();
      await submitElement.click();
      
      await page.waitForTimeout(1000);
      await this.takeScreenshot(page, '2fa-after-submit');
      await page.waitForLoadState('networkidle');
    }
  }

  /**
   * Verify authentication success
   */
  private async verifyAuthSuccess(page: Page): Promise<void> {
    // Wait for page to load after 2FA
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    this.logger.info(`Post-2FA URL: ${currentUrl}`);
    
    // Check for success indicators (your working logic)
    if (currentUrl.includes('dashboard') ||
        currentUrl.includes('provision') ||
        currentUrl.includes('vauto.app') ||
        !currentUrl.includes('signin')) {
      this.logger.info('2FA verification successful');
      await this.takeScreenshot(page, '2fa-success');
    } else {
      throw new Error(`2FA verification may have failed - unexpected URL: ${currentUrl}`);
    }
  }

  /**
   * Helper method for screenshots
   */
  private async takeScreenshot(page: Page, name: string): Promise<void> {
    try {
      await page.screenshot({ 
        path: `screenshots/${name}-${Date.now()}.png`,
        fullPage: true 
      });
    } catch (error) {
      this.logger.warn(`Failed to take screenshot: ${name}`, error);
    }
  }
} 