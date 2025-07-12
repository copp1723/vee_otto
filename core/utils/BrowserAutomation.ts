import { Browser, BrowserContext, Page, chromium, Locator } from 'playwright';
import pRetry from 'p-retry';
import * as fuzzball from 'fuzzball';
import { Logger } from './Logger';
import fs from 'fs-extra';
import path from 'path';

const logger = new Logger('BrowserAutomation');

export interface BrowserConfig {
  headless?: boolean;
  slowMo?: number;
  timeout?: number;
  viewport?: { width: number; height: number };
  userAgent?: string;
  extraHTTPHeaders?: Record<string, string>;
}

export interface ElementSelector {
  xpath?: string;
  css?: string;
  text?: string;
  role?: string;
}

export interface RetryOptions {
  retries?: number;
  factor?: number;
  minTimeout?: number;
  maxTimeout?: number;
}

export class BrowserAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: BrowserConfig;

  constructor(config: BrowserConfig = {}) {
    this.config = {
      headless: false,
      slowMo: 100,
      timeout: 30000,
      viewport: { width: 1920, height: 1080 },
      ...config
    };
  }

  async initialize(): Promise<void> {
    logger.info('Launching browser...', { headless: this.config.headless });

    this.browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo
    });

    const contextOptions: any = {
      viewport: this.config.viewport
    };

    if (this.config.userAgent) {
      contextOptions.userAgent = this.config.userAgent;
    }

    if (this.config.extraHTTPHeaders) {
      contextOptions.extraHTTPHeaders = this.config.extraHTTPHeaders;
    }

    this.context = await this.browser.newContext(contextOptions);
    this.page = await this.context.newPage();

    if (this.config.timeout) {
      this.page.setDefaultTimeout(this.config.timeout);
    }

    logger.info('Browser initialized successfully');
  }

  get currentPage(): Page {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    return this.page;
  }

  // Enhanced element finding with multiple selector types
  async findElement(selectors: ElementSelector | ElementSelector[]): Promise<Locator | null> {
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];

    for (const selector of selectorArray) {
      try {
        let locator: Locator | null = null;

        if (selector.xpath) {
          locator = this.page!.locator(`xpath=${selector.xpath}`);
        } else if (selector.css) {
          locator = this.page!.locator(selector.css);
        } else if (selector.text) {
          locator = this.page!.locator(`text="${selector.text}"`);
        } else if (selector.role) {
          locator = this.page!.getByRole(selector.role as any);
        }

        if (locator && await locator.count() > 0) {
          logger.debug('Element found', { selector });
          return locator;
        }
      } catch (error) {
        logger.debug('Selector not found', { selector });
      }
    }

    return null;
  }

  // Reliable click with retries and fallbacks
  async reliableClick(
    selector: string | ElementSelector,
    options: {
      retries?: number;
      delay?: number;
      force?: boolean;
      timeout?: number;
    } = {}
  ): Promise<void> {
    const { retries = 3, delay = 1000, force = true, timeout = 10000 } = options;
    
    const selectorObj = typeof selector === 'string' 
      ? { xpath: selector, css: selector } 
      : selector;

    await this.withRetry(async () => {
      const element = await this.findElement(selectorObj);
      if (!element) {
        throw new Error(`Element not found: ${JSON.stringify(selectorObj)}`);
      }

      await element.scrollIntoViewIfNeeded();
      await this.page!.waitForTimeout(100);
      await element.click({ force, timeout: 5000 });
      
      logger.debug('Successfully clicked element');
    }, { retries });
  }

  // Enhanced text extraction with OCR fallback capability
  async getText(selector: string | ElementSelector): Promise<string | null> {
    try {
      const element = await this.findElement(
        typeof selector === 'string' ? { xpath: selector, css: selector } : selector
      );
      
      if (!element) {
        return null;
      }

      return await element.textContent();
    } catch (error) {
      logger.error('Failed to get text', { selector });
      return null;
    }
  }

  // Reliable form filling
  async fillInput(
    selector: string | ElementSelector,
    value: string,
    options: { delay?: number; clear?: boolean } = {}
  ): Promise<boolean> {
    try {
      const element = await this.findElement(
        typeof selector === 'string' ? { xpath: selector, css: selector } : selector
      );
      
      if (!element) {
        return false;
      }

      if (options.clear) {
        await element.clear();
      }

      await element.fill(value, { timeout: 10000 });
      
      if (options.delay) {
        await this.page!.waitForTimeout(options.delay);
      }

      return true;
    } catch (error) {
      logger.error('Failed to fill input', { selector, error });
      return false;
    }
  }

  // Enhanced checkbox handling
  async setCheckbox(
    selector: string | ElementSelector,
    checked: boolean,
    options: { retries?: number } = {}
  ): Promise<boolean> {
    const { retries = 3 } = options;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const element = await this.findElement(
          typeof selector === 'string' ? { xpath: selector, css: selector } : selector
        );
        
        if (!element) {
          return false;
        }

        const isChecked = await element.isChecked();
        
        if (isChecked === checked) {
          return true;
        }
        
        await this.reliableClick(selector, { retries: 1 });
        await this.page!.waitForTimeout(500);
        
        const newState = await element.isChecked();
        if (newState === checked) {
          return true;
        }
        
      } catch (error) {
        logger.warn(`Checkbox attempt ${attempt} failed`, { selector, error });
      }
    }
    
    return false;
  }

  // Content scraping with multiple strategies
  async scrapeContent(
    containerSelector: string,
    options: { timeout?: number; waitForText?: boolean } = {}
  ): Promise<string> {
    const { timeout = 30000, waitForText = true } = options;
    
    try {
      await this.page!.waitForSelector(containerSelector, { state: 'visible', timeout });
      
      if (waitForText) {
        await this.page!.waitForFunction(
          (selector) => {
            const elem = document.querySelector(selector) || 
              document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            return elem && elem.textContent && elem.textContent.trim().length > 0;
          },
          containerSelector,
          { timeout: timeout / 2 }
        );
      }
      
      const content = await this.page!.evaluate((selector) => {
        const elem = document.querySelector(selector) || 
          document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        
        if (!elem) return '';
        
        if (elem instanceof HTMLIFrameElement) {
          try {
            const iframeDoc = elem.contentDocument || elem.contentWindow?.document;
            return iframeDoc?.body?.innerText || '';
          } catch (e) {
            return '[IFRAME: Cross-origin content]';
          }
        }
        
        return (elem as HTMLElement).innerText || elem.textContent || '';
      }, containerSelector);
      
      return content.trim();
    } catch (error) {
      logger.error('Failed to scrape content', { selector: containerSelector, error });
      throw error;
    }
  }

  // Wait for loading to complete
  async waitForLoadingComplete(
    loadingSelectors: string[],
    options: { timeout?: number } = {}
  ): Promise<void> {
    const { timeout = 30000 } = options;
    
    try {
      for (const selector of loadingSelectors) {
        try {
          await this.page!.waitForSelector(selector, { 
            state: 'hidden', 
            timeout: timeout / loadingSelectors.length 
          });
        } catch {
          // Ignore if selector doesn't exist
        }
      }
      
      await this.page!.waitForLoadState('networkidle', { timeout: 5000 });
    } catch (error) {
      logger.debug('Loading wait completed (possibly timed out)');
    }
  }

  // Screenshot utility
  async takeScreenshot(
    name: string,
    options: { fullPage?: boolean; path?: string } = {}
  ): Promise<string> {
    try {
      const timestamp = Date.now();
      const filename = `${name}-${timestamp}.png`;
      const screenshotDir = options.path || 'screenshots';
      
      await fs.ensureDir(screenshotDir);
      const filepath = path.join(screenshotDir, filename);

      await this.page!.screenshot({
        path: filepath,
        fullPage: options.fullPage !== false
      });

      logger.info('Screenshot saved', { filepath });
      return filepath;
    } catch (error) {
      logger.error('Failed to take screenshot', { name, error });
      throw error;
    }
  }

  // Fuzzy text matching for flexible element selection
  findBestTextMatch(target: string, candidates: string[], threshold: number = 70): string | null {
    if (!candidates.length) return null;

    let bestMatch = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = Math.max(
        fuzzball.ratio(target, candidate),
        fuzzball.partial_ratio(target, candidate),
        fuzzball.token_sort_ratio(target, candidate)
      );
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    return bestScore >= threshold ? bestMatch : null;
  }

  // Element stability check
  async waitForElementStability(
    selector: string | ElementSelector,
    options: { checks?: number; interval?: number; tolerance?: number } = {}
  ): Promise<boolean> {
    const { checks = 3, interval = 100, tolerance = 2 } = options;
    
    let lastPosition: { x: number; y: number } | null = null;
    let stableCount = 0;

    for (let i = 0; i < checks + 2; i++) {
      const element = await this.findElement(
        typeof selector === 'string' ? { xpath: selector, css: selector } : selector
      );
      
      if (!element) return false;

      const box = await element.boundingBox();
      if (!box) return false;

      const currentPosition = { x: box.x, y: box.y };

      if (lastPosition) {
        const moved = Math.abs(currentPosition.x - lastPosition.x) > tolerance ||
                     Math.abs(currentPosition.y - lastPosition.y) > tolerance;
        
        if (!moved) {
          stableCount++;
          if (stableCount >= checks) {
            return true;
          }
        } else {
          stableCount = 0;
        }
      }

      lastPosition = currentPosition;
      if (i < checks + 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    return false;
  }

  // Retry wrapper with exponential backoff
  private async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const defaultOptions = {
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 10000,
      onFailedAttempt: (error: any) => {
        logger.warn(`Attempt ${error.attemptNumber} failed. Retrying...`, {
          retriesLeft: error.retriesLeft,
          error: error.message
        });
      }
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      return await pRetry(operation, finalOptions);
    } catch (error) {
      logger.error('All retry attempts failed', { error });
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
      }
      
      if (this.context) {
        await this.context.close();
      }
      
      if (this.browser) {
        await this.browser.close();
      }
      
      // Force GC if available
      if (global.gc) {
        global.gc();
      }
      
      logger.info('Browser cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup browser', { error });
    }
  }

  // Add memory monitoring method
  async monitorMemory(threshold: number = 500 * 1024 * 1024): Promise<void> { // 500MB default
    const memory = process.memoryUsage();
    if (memory.heapUsed > threshold) {
      logger.warn(`High memory usage detected: ${memory.heapUsed / 1024 / 1024} MB`);
      // Optionally trigger cleanup or alert
    }
  }
}