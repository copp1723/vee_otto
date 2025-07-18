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
      
      // Step 1: Handle phone selection if needed
      await this.handlePhoneSelection(page);
      
      // Step 2: Wait for and retrieve SMS code
      this.logger.info('🔍 About to retrieve SMS code...');
      const code = await this.retrieveSMSCode();
      this.logger.info(`📱 Retrieved code result: ${code}`);
      
      // Step 3: Enter and submit the code (with fixes)
      if (code) {
        this.logger.info('🔤 About to enter code: ' + code);
        this.logger.info('🔍 DEBUG: Starting code entry process with code: ' + code);
        
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);
        
        // Try multiple ways to enter the code
        let codeEntered = false;
        const inputSelectors = [
          this.config.codeInputSelector, 
          'input[type="text"]', 
          'input[type="number"]',
          'input[placeholder*="verification"]',
          'input[placeholder*="code"]'
        ];
        
        for (const selector of inputSelectors) {
          try {
            const input = page.locator(selector).first();
            if (await input.isVisible()) {
              await input.fill(code);
              await page.waitForTimeout(500);
              const value = await input.inputValue();
              if (value === code) {
                this.logger.info('✅ Code entered with selector: ' + selector);
                codeEntered = true;
                break;
              }
            }
          } catch (e) {
            this.logger.debug(`Input selector failed: ${e}`);
          }
        }
        
        if (!codeEntered) {
          throw new Error('Failed to enter code');
        }
        
        // Submit the code
        let submitted = false;
        const submitSelectors = [
          this.config.submitSelector,
          '//button[contains(text(), "Verify")] | //button[contains(text(), "Continue")] | //button[@type="submit"][not(contains(text(), "Sign in"))]',
          'button[type="submit"]', 
          'input[type="submit"]', 
          'button[text()="Verify"]'
        ];
        
        for (const selector of submitSelectors) {
          try {
            const button = page.locator(selector).first();
            if (await button.isVisible() && await button.isEnabled()) {
              await button.click();
              this.logger.info(`✅ Submitted with selector: ${selector}`);
              submitted = true;
              break;
            }
          } catch (e) {
            this.logger.debug(`Submit selector failed: ${e}`);
          }
        }
        
        if (!submitted) {
          this.logger.warn('No submit button found, pressing Enter...');
          await page.keyboard.press('Enter');
        }
        
        // Verify success
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);
        await this.verifyAuthSuccess(page);
        
        return {
          success: true,
          code,
          timestamp: startTime
        };
      } else {
        return {
          success: false,
          error: 'No code retrieved',
          timestamp: startTime
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('2FA authentication failed:', error);
      await this.takeScreenshot(page, '2fa-auth-error');
      return {
        success: false,
        error: errorMessage,
        timestamp: startTime
      };
    }
  }

  /**
   * Handle phone selection for 2FA
   * This contains your working phone selection logic
   */
  private async handlePhoneSelection(page: Page): Promise<void> {
    this.logger.info('🔍 DEBUG: Starting phone selection process...');
    
    try {
      await page.waitForLoadState('networkidle');
      this.logger.info('✅ DEBUG: Page loaded');
      
      // Debug: Check current page state
      this.logger.info(`🔍 DEBUG: Current URL: ${page.url()}`);
      this.logger.info(`🔍 DEBUG: Page title: ${await page.title()}`);
      
      // Check for 2FA selection page
      if (this.config.twoFactorTitle) {
        try {
          await page.waitForSelector(this.config.twoFactorTitle, { timeout: 10000 });
          this.logger.info('✅ DEBUG: 2FA verification page detected');
        } catch (error) {
          this.logger.warn('⚠️ DEBUG: 2FA verification page not detected', error);
        }
      }
      
      // Take screenshot for diagnostics
      await this.takeScreenshot(page, 'vauto-2fa-options-page');

      // Debug: List ALL elements on the page
      this.logger.info('🔍 DEBUG: Scanning all interactive elements...');
      
      // Debug: List all buttons with detailed info
      const allButtons = await page.$$('button');
      this.logger.info(`🔍 DEBUG: Found ${allButtons.length} button elements`);
      
      const buttonDetails = [];
      for (let i = 0; i < allButtons.length; i++) {
        const btn = allButtons[i];
        try {
          const text = await btn.textContent();
          const isVisible = await btn.isVisible();
          const isEnabled = await btn.isEnabled();
          const className = await btn.getAttribute('class');
          const id = await btn.getAttribute('id');
          
          buttonDetails.push({
            index: i,
            text: text?.trim() || 'no-text',
            visible: isVisible,
            enabled: isEnabled,
            class: className || 'no-class',
            id: id || 'no-id'
          });
          
          if (text && text.trim()) {
            this.logger.info(`🔍 DEBUG: Button ${i}: text="${text.trim()}", visible=${isVisible}, enabled=${isEnabled}`);
          }
        } catch (e) {
          this.logger.info(`🔍 DEBUG: Button ${i}: Could not get attributes`);
        }
      }
      
      // Debug: List all divs with role="button"
      const roleButtons = await page.$$('div[role="button"]');
      this.logger.info(`🔍 DEBUG: Found ${roleButtons.length} div[role="button"] elements`);
      
      for (let i = 0; i < roleButtons.length; i++) {
        const btn = roleButtons[i];
        try {
          const text = await btn.textContent();
          const isVisible = await btn.isVisible();
          const isEnabled = await btn.isEnabled();
          
          if (text && text.trim()) {
            this.logger.info(`🔍 DEBUG: Role-button ${i}: text="${text.trim()}", visible=${isVisible}, enabled=${isEnabled}`);
          }
        } catch (e) {
          this.logger.info(`🔍 DEBUG: Role-button ${i}: Could not get attributes`);
        }
      }
      
      // Debug: List all links
      const allLinks = await page.$$('a');
      this.logger.info(`🔍 DEBUG: Found ${allLinks.length} link elements`);
      
      for (let i = 0; i < allLinks.length; i++) {
        const link = allLinks[i];
        try {
          const text = await link.textContent();
          const isVisible = await link.isVisible();
          const href = await link.getAttribute('href');
          
          if (text && text.trim()) {
            this.logger.info(`🔍 DEBUG: Link ${i}: text="${text.trim()}", visible=${isVisible}, href=${href}`);
          }
        } catch (e) {
          this.logger.info(`🔍 DEBUG: Link ${i}: Could not get attributes`);
        }
      }
      
      // Debug: Search for specific keywords
      const keywords = ['select', 'phone', 'sms', 'text', 'mobile', 'continue', 'next', 'send'];
      for (const keyword of keywords) {
        try {
          const elements = await page.locator(`*:has-text("${keyword}")`).all();
          this.logger.info(`🔍 DEBUG: Found ${elements.length} elements containing "${keyword}"`);
        } catch (e) {
          this.logger.info(`🔍 DEBUG: Error searching for keyword "${keyword}": ${e}`);
        }
      }

      // Debug: Try to find the phone 2FA option specifically
      this.logger.info('🔍 DEBUG: Looking for phone 2FA option...');
      
      // Debug: Check for phone-related text
      const phoneTexts = ['phone', 'sms', 'text message', 'mobile'];
      for (const text of phoneTexts) {
        try {
          const elements = await page.locator(`*:has-text("${text}")`).all();
          if (elements.length > 0) {
            this.logger.info(`✅ DEBUG: Found ${elements.length} elements with text "${text}"`);
          }
        } catch (e) {
          // Continue
        }
      }

      // Look for "Select" buttons with enhanced debugging
      if (this.config.phoneSelectButton) {
        this.logger.info(`🔍 DEBUG: Trying configured selector: ${this.config.phoneSelectButton}`);
        let selectButtons = await page.locator(this.config.phoneSelectButton).all();
        this.logger.info(`🔍 DEBUG: Found ${selectButtons.length} Select buttons with configured selector`);

        // If none found, try the absolute XPath (your working fallback)
        if (selectButtons.length === 0) {
          const absXpath = '/html/body/div[2]/div/div[3]/div/div/div[1]/div[2]/div/div/div[2]/div/span[2]/button';
          this.logger.info(`🔍 DEBUG: Trying absolute XPath: ${absXpath}`);
          const absBtn = await page.locator(`xpath=${absXpath}`).first();
          if (absBtn) {
            const isVisible = await absBtn.isVisible();
            const isEnabled = await absBtn.isEnabled();
            this.logger.info(`🔍 DEBUG: Absolute XPath button: visible=${isVisible}, enabled=${isEnabled}`);
            if (isVisible && isEnabled) {
              this.logger.info('✅ DEBUG: Found Select button via absolute XPath');
              selectButtons = [absBtn];
            }
          } else {
            this.logger.info('❌ DEBUG: Absolute XPath button not found');
          }
        }

        if (selectButtons.length > 0) {
          this.logger.info('✅ DEBUG: About to click the Select button for phone 2FA');
          await this.takeScreenshot(page, 'before-select-2fa-click');
          
          const button = selectButtons[0];
          const isVisible = await button.isVisible();
          const isEnabled = await button.isEnabled();
          this.logger.info(`🔍 DEBUG: Button state before click: visible=${isVisible}, enabled=${isEnabled}`);
          
          if (isVisible && isEnabled) {
            await button.click();
            this.logger.info('✅ DEBUG: Select button clicked successfully');
            await page.waitForLoadState('networkidle');
            await this.takeScreenshot(page, 'after-select-2fa-click');
          } else {
            this.logger.error('❌ DEBUG: Button not visible or enabled for clicking');
          }
        } else {
          // Enhanced debugging for alternative selectors
          this.logger.info('🔍 DEBUG: Trying alternative selectors...');
          const possibleSelectors = [
            'button:has-text("Continue")',
            'button:has-text("Next")',
            'button:has-text("Send")',
            'a:has-text("Select")',
            'div[role="button"]:has-text("Select")',
            'button:has-text("select")',
            'button:has-text("SELECT")',
            'div:has-text("Select")',
            'span:has-text("Select")'
          ];

          let clicked = false;
          for (const selector of possibleSelectors) {
            try {
              this.logger.info(`🔍 DEBUG: Trying selector: ${selector}`);
              const elements = await page.locator(selector).all();
              
              for (const element of elements) {
                const isVisible = await element.isVisible();
                const isEnabled = await element.isEnabled();
                const text = await element.textContent();
                
                this.logger.info(`🔍 DEBUG: Selector ${selector}: found element, text="${text?.trim()}", visible=${isVisible}, enabled=${isEnabled}`);
                
                if (isVisible && isEnabled) {
                  this.logger.info(`✅ DEBUG: Clicking element with selector: ${selector}`);
                  await element.click();
                  await page.waitForLoadState('networkidle');
                  clicked = true;
                  break;
                }
              }
              
              if (clicked) break;
            } catch (e) {
              this.logger.info(`🔍 DEBUG: Selector ${selector} failed: ${e}`);
              continue;
            }
          }

          if (!clicked) {
            this.logger.error('❌ DEBUG: Could not find any 2FA selection button with any selector');
            await this.takeScreenshot(page, 'vauto-2fa-selection-error');
          }
        }
      } else {
        this.logger.warn('⚠️ DEBUG: No phoneSelectButton configured in config');
      }
    } catch (error) {
      this.logger.error('❌ DEBUG: Error during phone selection', error);
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
   * Verify authentication success by checking for expected URL patterns
   */
  private async verifyAuthSuccess(page: Page): Promise<void> {
    const post2FAUrl = page.url();
    this.logger.info(`Post-2FA URL: ${post2FAUrl}`);
    
    if (post2FAUrl.includes('dashboard') ||
        post2FAUrl.includes('provision') ||
        post2FAUrl.includes('vauto.app') ||
        !post2FAUrl.includes('signin')) {
      this.logger.info('2FA verification successful');
      await this.takeScreenshot(page, '2fa-success');
    } else {
      throw new Error(`2FA verification may have failed - unexpected URL: ${post2FAUrl}`);
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