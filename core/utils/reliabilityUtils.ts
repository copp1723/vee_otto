import { Page, Locator } from 'playwright';
import { Logger } from './Logger';
import { OCRService } from '../../integrations/ocr/OCRService';

export interface SmartActionOptions {
  humanName: string;
  fallbackText?: string;
  fallbackImage?: string;
  verification?: () => Promise<boolean>;
  timeout?: number;
  retries?: number;
  waitForStable?: boolean;
}

export interface SmartTypeOptions extends SmartActionOptions {
  clearFirst?: boolean;
  pressEnter?: boolean;
  verifyText?: boolean;
}

export interface SmartSelectOptions extends SmartActionOptions {
  byValue?: boolean;
  byText?: boolean;
}

export interface RetryOptions {
  retries: number;
  minTimeout: number;
  maxTimeout?: number;
  factor?: number;
}

export class AutomationError extends Error {
  public readonly actionType: string;
  public readonly selector: string;
  public readonly humanName: string;
  public readonly screenshot?: Buffer;
  public readonly timestamp: Date;

  constructor(
    actionType: string,
    selector: string,
    humanName: string,
    message: string,
    screenshot?: Buffer
  ) {
    super(message);
    this.name = 'AutomationError';
    this.actionType = actionType;
    this.selector = selector;
    this.humanName = humanName;
    this.screenshot = screenshot;
    this.timestamp = new Date();
  }
}

export class SmartInteractionEngine {
  private page: Page;
  private logger: Logger;
  private ocrService?: OCRService;

  constructor(page: Page, ocrService?: OCRService) {
    this.page = page;
    this.logger = new Logger('SmartInteractionEngine');
    this.ocrService = ocrService;
  }

  /**
   * The master smart click function - attempts Playwright first, falls back to OCR
   */
  public async smartClick(
    primarySelector: string,
    options: SmartActionOptions
  ): Promise<boolean> {
    const { humanName, fallbackText, fallbackImage, verification, timeout = 10000, retries = 2 } = options;
    
    this.logger.info(`🎯 Smart Click: "${humanName}"`);

    return await this.withRetry(async () => {
      // Plan A: Playwright-based click
      try {
        await this.attemptPlaywrightClick(primarySelector, humanName, timeout);
        
        // Verify the action if verification function provided
        if (verification && !(await verification())) {
          throw new Error(`Verification failed after clicking "${humanName}"`);
        }
        
        this.logger.info(`✅ SUCCESS: Clicked "${humanName}" via Playwright`);
        return true;
      } catch (playwrightError) {
        const errorMessage = playwrightError instanceof Error ? playwrightError.message : String(playwrightError);
        this.logger.warn(`⚠️ Playwright click failed for "${humanName}": ${errorMessage}`);
      }

      // Plan B: OCR-based fallback
      if (this.ocrService && (fallbackText || fallbackImage)) {
        try {
          const success = await this.attemptOCRClick(fallbackText, fallbackImage, humanName);
          
          if (success && verification && !(await verification())) {
            throw new Error(`Verification failed after OCR click "${humanName}"`);
          }
          
          if (success) {
            this.logger.info(`✅ SUCCESS: Clicked "${humanName}" via OCR fallback`);
            return true;
          }
        } catch (ocrError) {
          const errorMessage = ocrError instanceof Error ? ocrError.message : String(ocrError);
          this.logger.warn(`⚠️ OCR fallback failed for "${humanName}": ${errorMessage}`);
        }
      }

      // Plan C: Final failure with screenshot
      const screenshot = await this.page.screenshot({ fullPage: false });
      throw new AutomationError(
        'click',
        primarySelector,
        humanName,
        `All click attempts failed for "${humanName}"`,
        screenshot
      );
    }, { retries, minTimeout: 1000, maxTimeout: 3000 });
  }

  /**
   * Smart text input with verification
   */
  public async smartType(
    primarySelector: string,
    text: string,
    options: SmartTypeOptions
  ): Promise<boolean> {
    const { 
      humanName, 
      clearFirst = true, 
      pressEnter = false, 
      verifyText = true,
      timeout = 10000,
      retries = 2 
    } = options;

    this.logger.info(`⌨️ Smart Type: "${text}" into "${humanName}"`);

    return await this.withRetry(async () => {
      try {
        const element = this.page.locator(primarySelector).first();
        await element.waitFor({ state: 'visible', timeout });

        if (clearFirst) {
          await element.clear();
        }

        await element.type(text, { delay: 50 });

        if (pressEnter) {
          await element.press('Enter');
        }

        // Verify the text was entered correctly
        if (verifyText) {
          const actualValue = await element.inputValue();
          if (actualValue !== text) {
            throw new Error(`Text verification failed. Expected: "${text}", Got: "${actualValue}"`);
          }
        }

        this.logger.info(`✅ SUCCESS: Typed "${text}" into "${humanName}"`);
        return true;
      } catch (error) {
        const screenshot = await this.page.screenshot({ fullPage: false });
        throw new AutomationError(
          'type',
          primarySelector,
          humanName,
          `Failed to type "${text}" into "${humanName}": ${error instanceof Error ? error.message : String(error)}`,
          screenshot
        );
      }
    }, { retries, minTimeout: 500, maxTimeout: 2000 });
  }

  /**
   * Smart dropdown selection
   */
  public async smartSelect(
    primarySelector: string,
    value: string,
    options: SmartSelectOptions
  ): Promise<boolean> {
    const { humanName, byValue = true, byText = false, timeout = 10000, retries = 2 } = options;

    this.logger.info(`📋 Smart Select: "${value}" in "${humanName}"`);

    return await this.withRetry(async () => {
      try {
        const element = this.page.locator(primarySelector).first();
        await element.waitFor({ state: 'visible', timeout });

        if (byValue) {
          await element.selectOption({ value });
        } else if (byText) {
          await element.selectOption({ label: value });
        } else {
          await element.selectOption(value);
        }

        this.logger.info(`✅ SUCCESS: Selected "${value}" in "${humanName}"`);
        return true;
      } catch (error) {
        const screenshot = await this.page.screenshot({ fullPage: false });
        throw new AutomationError(
          'select',
          primarySelector,
          humanName,
          `Failed to select "${value}" in "${humanName}": ${error instanceof Error ? error.message : String(error)}`,
          screenshot
        );
      }
    }, { retries, minTimeout: 500, maxTimeout: 2000 });
  }

  /**
   * Verify an element exists or a condition is met
   */
  public async verifyElement(
    selector: string,
    humanName: string,
    options: { timeout?: number; shouldExist?: boolean } = {}
  ): Promise<boolean> {
    const { timeout = 5000, shouldExist = true } = options;

    try {
      const element = this.page.locator(selector).first();
      
      if (shouldExist) {
        await element.waitFor({ state: 'visible', timeout });
        this.logger.info(`✅ VERIFIED: "${humanName}" is visible`);
      } else {
        await element.waitFor({ state: 'hidden', timeout });
        this.logger.info(`✅ VERIFIED: "${humanName}" is hidden`);
      }
      
      return true;
    } catch (error) {
      this.logger.warn(`❌ VERIFICATION FAILED: "${humanName}" - ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Wait for page to be stable (no network activity)
   */
  public async waitForStable(timeout: number = 5000): Promise<void> {
    try {
      await this.page.waitForLoadState('networkidle', { timeout });
      this.logger.info('✅ Page is stable (network idle)');
    } catch (error) {
      this.logger.warn(`⚠️ Page stability timeout after ${timeout}ms`);
    }
  }

  // Private helper methods

  private async attemptPlaywrightClick(
    selector: string,
    humanName: string,
    timeout: number
  ): Promise<void> {
    const element = this.page.locator(selector).first();
    
    // Wait for element to be visible and stable
    await element.waitFor({ state: 'visible', timeout });
    await element.waitFor({ state: 'attached', timeout });
    
    // Scroll into view if needed
    await element.scrollIntoViewIfNeeded();
    
    // Wait a bit for any animations to complete
    await this.page.waitForTimeout(200);
    
    // Perform the click
    await element.click({ timeout: 5000 });
  }

  private async attemptOCRClick(
    fallbackText?: string,
    fallbackImage?: string,
    humanName?: string
  ): Promise<boolean> {
    if (!this.ocrService) {
      throw new Error('OCR service not available');
    }

    // Take a screenshot for OCR analysis
    const screenshot = await this.page.screenshot({ fullPage: false });
    
    let searchTarget = fallbackText;
    if (!searchTarget && fallbackImage) {
      // If only image provided, we'd need to implement image matching
      // For now, we'll require text for OCR
      throw new Error('OCR text search requires fallbackText parameter');
    }

    if (!searchTarget) {
      throw new Error('No search target provided for OCR');
    }

    // Use OCR to find the text
    const result = await this.ocrService.extractFromScreenshot(screenshot);
    
    // Save screenshot to temp file for findTextInImage
    const fs = await import('fs-extra');
    const path = await import('path');
    const tempPath = path.join('./temp-ocr', `search_${Date.now()}.png`);
    await fs.ensureDir('./temp-ocr');
    await fs.writeFile(tempPath, screenshot);
    
    try {
      const searchResult = await this.ocrService.findTextInImage(
        tempPath,
        searchTarget,
        { fuzzyMatch: true, threshold: 70 }
      );

      if (searchResult.found && searchResult.location) {
        // Calculate click coordinates (center of found text)
        const x = searchResult.location.x0 + (searchResult.location.x1 - searchResult.location.x0) / 2;
        const y = searchResult.location.y0 + (searchResult.location.y1 - searchResult.location.y0) / 2;
        
        // Perform the click
        await this.page.mouse.click(x, y);
        return true;
      }

      return false;
    } finally {
      // Clean up temp file
      await fs.remove(tempPath).catch(() => {});
    }
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions
  ): Promise<T> {
    const { retries, minTimeout, maxTimeout = minTimeout * 4, factor = 2 } = options;
    
    let lastError: Error;
    let timeout = minTimeout;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === retries) {
          break; // Last attempt, don't wait
        }

        this.logger.warn(`Attempt ${attempt + 1} failed, retrying in ${timeout}ms...`);
        await this.page.waitForTimeout(timeout);
        
        // Exponential backoff
        timeout = Math.min(timeout * factor, maxTimeout);
      }
    }

    throw lastError!;
  }
}

// Utility functions for backward compatibility and convenience

export async function reliableClick(
  page: Page,
  selector: string,
  humanName: string,
  ocrService?: OCRService
): Promise<boolean> {
  const engine = new SmartInteractionEngine(page, ocrService);
  return await engine.smartClick(selector, { humanName });
}

export async function reliableType(
  page: Page,
  selector: string,
  text: string,
  humanName: string
): Promise<boolean> {
  const engine = new SmartInteractionEngine(page);
  return await engine.smartType(selector, text, { humanName });
}

export async function scrapeInlineContent(
  page: Page,
  selector: string,
  options: { timeout?: number; waitForText?: boolean } = {}
): Promise<string> {
  const { timeout = 5000, waitForText = false } = options;
  
  try {
    const element = page.locator(selector).first();
    await element.waitFor({ state: 'visible', timeout });
    
    if (waitForText) {
      await element.waitFor({ state: 'attached', timeout });
    }
    
    const content = await element.textContent();
    return content || '';
  } catch (error) {
    console.warn(`Failed to scrape content from ${selector}:`, error);
    return '';
  }
}

export async function setCheckbox(
  page: Page,
  selector: string,
  shouldBeChecked: boolean
): Promise<boolean> {
  try {
    const checkbox = page.locator(selector).first();
    await checkbox.waitFor({ state: 'visible', timeout: 5000 });
    
    const isCurrentlyChecked = await checkbox.isChecked();
    
    if (isCurrentlyChecked !== shouldBeChecked) {
      await checkbox.setChecked(shouldBeChecked);
    }
    
    return true;
  } catch (error) {
    console.warn(`Failed to set checkbox ${selector}:`, error);
    return false;
  }
}

export async function waitForLoadingToComplete(
  page: Page,
  loadingSelectors: string[],
  timeout: number = 10000
): Promise<void> {
  try {
    // Wait for all loading indicators to disappear
    for (const selector of loadingSelectors) {
      try {
        const loadingElement = page.locator(selector).first();
        await loadingElement.waitFor({ state: 'hidden', timeout: timeout / loadingSelectors.length });
      } catch {
        // If selector doesn't exist, that's fine - it means no loading indicator
      }
    }
    
    // Also wait for network idle as a backup
    await page.waitForLoadState('networkidle', { timeout: Math.min(timeout, 5000) });
  } catch (error) {
    console.warn('Loading wait timed out, continuing anyway');
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { retries, minTimeout, maxTimeout = minTimeout * 4, factor = 2 } = options;
  
  let lastError: Error;
  let timeout = minTimeout;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === retries) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, timeout));
      timeout = Math.min(timeout * factor, maxTimeout);
    }
  }

  throw lastError!;
}

