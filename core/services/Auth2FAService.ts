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
      this.logger.info('🔍 About to retrieve SMS code...');
      const code = await this.retrieveSMSCode();
      this.logger.info(`📱 Retrieved code result: ${code}`);
      
      if (!code) {
        throw new Error('Failed to retrieve SMS code');
      }
      
      // Step 3: Enter code and submit
      this.logger.info(`🔤 About to enter code: ${code}`);
      await this.enterAndSubmitCode(page, code);
      this.logger.info('✅ Code entry completed');
      
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
   * Enter code and submit using your working logic
   */
  private async enterAndSubmitCode(page: Page, code: string): Promise<void> {
    this.logger.info(`🔍 DEBUG: Starting code entry process with code: ${code}`);
    
    // Take screenshot before entering code
    await this.takeScreenshot(page, '2fa-before-code-entry');
    
    // Debug: Check current page state
    this.logger.info(`🔍 DEBUG: Current URL: ${page.url()}`);
    this.logger.info(`🔍 DEBUG: Page title: ${await page.title()}`);
    
    // Debug: List all input fields on the page
    const allInputs = await page.$$('input');
    this.logger.info(`🔍 DEBUG: Found ${allInputs.length} input fields total`);
    
    for (let i = 0; i < allInputs.length; i++) {
      try {
        const input = allInputs[i];
        const type = await input.getAttribute('type');
        const id = await input.getAttribute('id');
        const name = await input.getAttribute('name');
        const placeholder = await input.getAttribute('placeholder');
        const isVisible = await input.isVisible();
        this.logger.info(`🔍 DEBUG: Input ${i}: type="${type}", id="${id}", name="${name}", placeholder="${placeholder}", visible=${isVisible}`);
      } catch (e) {
        this.logger.info(`🔍 DEBUG: Input ${i}: Could not get attributes`);
      }
    }
    
    // Debug: Check if we're in an iframe
    const frames = page.frames();
    this.logger.info(`🔍 DEBUG: Found ${frames.length} frames on page`);
    if (frames.length > 1) {
      for (let i = 1; i < frames.length; i++) {
        const frame = frames[i];
        this.logger.info(`🔍 DEBUG: Frame ${i}: URL: ${frame.url()}`);
        const frameInputs = await frame.$$('input');
        this.logger.info(`🔍 DEBUG: Frame ${i}: Found ${frameInputs.length} input fields`);
      }
    }
    
    // Try the original working selector first
    const inputSelectors = [
      this.config.codeInputSelector,
      '//input[@type="text"]',
      '//input[@type="number"]',
      'input[placeholder*="verification"]',
      'input[placeholder*="code"]',
      'input[name*="verification"]',
      'input[name*="code"]',
      'input[id*="verification"]',
      'input[id*="code"]'
    ];
    
    this.logger.info(`🔍 DEBUG: Trying to find input field with selectors: ${JSON.stringify(inputSelectors)}`);
    
    let inputElement = null;
    let foundSelector = null;
    
    for (const selector of inputSelectors) {
      try {
        this.logger.info(`🔍 DEBUG: Trying selector: ${selector}`);
        const element = page.locator(selector).first();
        const isVisible = await element.isVisible({ timeout: 5000 });
        const isEnabled = await element.isEnabled();
        this.logger.info(`🔍 DEBUG: Selector ${selector}: visible=${isVisible}, enabled=${isEnabled}`);
        
        if (isVisible && isEnabled) {
          inputElement = element;
          foundSelector = selector;
          this.logger.info(`✅ DEBUG: Found input field with selector: ${selector}`);
          break;
        }
      } catch (e) {
        this.logger.info(`🔍 DEBUG: Selector ${selector} failed: ${e}`);
        continue;
      }
    }
    
    if (!inputElement) {
      this.logger.error(`❌ DEBUG: Could not find 2FA code input field with any selector`);
      throw new Error('Could not find 2FA code input field');
    }
    
    this.logger.info(`🔍 DEBUG: Using selector: ${foundSelector}`);
    
    // Debug: Check element state before interaction
    const elementHandle = await inputElement.elementHandle();
    if (elementHandle) {
      const boundingBox = await elementHandle.boundingBox();
      const outerHTML = await elementHandle.evaluate(el => el.outerHTML);
      const isEditable = await elementHandle.isEditable();
      this.logger.info(`🔍 DEBUG: Element outerHTML: ${outerHTML}`);
      this.logger.info(`🔍 DEBUG: Element bounding box: ${JSON.stringify(boundingBox)}`);
      this.logger.info(`🔍 DEBUG: Element is editable: ${isEditable}`);
    }
    
    // Debug: Try to focus the element first
    try {
      await inputElement.focus();
      this.logger.info(`✅ DEBUG: Successfully focused input element`);
    } catch (e) {
      this.logger.error(`❌ DEBUG: Failed to focus input element: ${e}`);
    }
    
    // Clear and fill input with detailed debugging
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        this.logger.info(`🔍 DEBUG: Attempt ${attempt} to enter code...`);
        
        this.logger.info(`   Clearing input...`);
        await inputElement.clear({ timeout: 5000 });
        this.logger.info(`   Input cleared.`);
        await page.waitForTimeout(250);
        
        this.logger.info(`   Filling with code: "${code}"`);
        await inputElement.fill(code, { timeout: 5000 });
        this.logger.info(`   Code fill action completed.`);
        await page.waitForTimeout(250);
        
        const enteredValue = await inputElement.inputValue({ timeout: 5000 });
        this.logger.info(`   Value after fill: "${enteredValue}"`);
        
        if (enteredValue === code) {
          this.logger.info(`✅ DEBUG: Code entered and verified successfully on attempt ${attempt}`);
          break;
        }
        
        this.logger.warn(`   Code mismatch. Expected "${code}", got "${enteredValue}". Retrying...`);

        if (attempt === 3) {
          await this.takeScreenshot(page, '2fa-code-entry-failure');
          throw new Error(`Code entry failed after 3 attempts. Expected "${code}", but got "${enteredValue}".`);
        }
        
      } catch (error) {
        this.logger.error(`❌ DEBUG: Attempt ${attempt} to enter code failed with error:`, error);
        await this.takeScreenshot(page, `2fa-code-entry-error-attempt-${attempt}`);
        if (attempt === 3) throw error;
        
        this.logger.warn(`🔍 DEBUG: Retrying in 1 second...`);
        await page.waitForTimeout(1000);
      }
    }
    
    // Take screenshot after entering code
    await this.takeScreenshot(page, '2fa-after-code-entry');
    
    // Submit the code with multiple selector attempts
    const submitSelectors = [
      this.config.submitSelector,
      '//button[@type="submit"]',
      '//button[contains(text(), "Verify")]',
      '//button[contains(text(), "Submit")]',
      '//button[contains(text(), "Continue")]',
      '//input[@type="submit"]'
    ];
    
    let submitElement = null;
    for (const selector of submitSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 5000 })) {
          submitElement = element;
          this.logger.info(`Found submit button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (submitElement) {
      await page.waitForTimeout(1000);
      await this.takeScreenshot(page, '2fa-before-submit');
      
      await submitElement.click();
      this.logger.info('✅ Submit button clicked');
      
      await page.waitForTimeout(2000);
      await this.takeScreenshot(page, '2fa-after-submit');
      await page.waitForLoadState('networkidle');
    } else {
      this.logger.warn('No submit button found, trying Enter key');
      await inputElement.press('Enter');
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