/**
 * Enhanced Test Helper Utilities
 * Provides common test setup and teardown patterns
 */

import { chromium, Browser, Page } from 'playwright';
import { Logger } from '../../core/utils/Logger';
import { BROWSER_CONFIG, TIMEOUTS } from '../../core/utils/constants';
import * as dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';

// Load environment variables
dotenv.config();

export class TestHelper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private logger: Logger;
  private testName: string;

  constructor(testName: string) {
    this.testName = testName;
    this.logger = new Logger(testName);
  }

  /**
   * Standard test setup
   */
  async setup(options: {
    headless?: boolean;
    viewport?: { width: number; height: number };
    slowMo?: number;
  } = {}) {
    this.logger.info(`Setting up test: ${this.testName}`);

    // Create test directories
    await this.ensureTestDirectories();

    // Launch browser
    this.browser = await chromium.launch({
      headless: options.headless ?? BROWSER_CONFIG.HEADLESS,
      slowMo: options.slowMo ?? BROWSER_CONFIG.SLOW_MO,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // Create page
    this.page = await this.browser.newPage();
    await this.page.setViewportSize(
      options.viewport ?? BROWSER_CONFIG.DEFAULT_VIEWPORT
    );

    // Set default timeouts
    this.page.setDefaultTimeout(TIMEOUTS.DEFAULT);
    this.page.setDefaultNavigationTimeout(TIMEOUTS.NAVIGATION);

    return { browser: this.browser, page: this.page, logger: this.logger };
  }

  /**
   * Standard test teardown
   */
  async teardown() {
    this.logger.info(`Tearing down test: ${this.testName}`);

    if (this.page) {
      await this.page.close().catch(() => {});
    }

    if (this.browser) {
      await this.browser.close().catch(() => {});
    }
  }

  /**
   * Take screenshot on failure
   */
  async screenshotOnFailure(error: Error) {
    if (this.page) {
      const screenshotPath = path.join(
        'tests/screenshots',
        `${this.testName}-failure-${Date.now()}.png`
      );
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      this.logger.error(`Test failed, screenshot saved: ${screenshotPath}`, { error });
    }
  }

  /**
   * Ensure test directories exist
   */
  private async ensureTestDirectories() {
    const dirs = ['tests/screenshots', 'reports', 'logs'];
    for (const dir of dirs) {
      await fs.ensureDir(dir);
    }
  }

  /**
   * Common test assertions
   */
  static async verifyElementExists(page: Page, selector: string, timeout = TIMEOUTS.SHORT) {
    await page.waitForSelector(selector, { timeout });
  }

  static async verifyText(page: Page, selector: string, expectedText: string) {
    const actualText = await page.textContent(selector);
    if (actualText !== expectedText) {
      throw new Error(`Text mismatch. Expected: "${expectedText}", Got: "${actualText}"`);
    }
  }

  static async verifyUrl(page: Page, expectedUrl: string | RegExp) {
    const currentUrl = page.url();
    if (typeof expectedUrl === 'string') {
      if (!currentUrl.includes(expectedUrl)) {
        throw new Error(`URL mismatch. Expected: "${expectedUrl}", Got: "${currentUrl}"`);
      }
    } else if (!expectedUrl.test(currentUrl)) {
      throw new Error(`URL mismatch. Pattern: ${expectedUrl}, Got: "${currentUrl}"`);
    }
  }
}

/**
 * Test runner wrapper
 */
export async function runTest(
  testName: string,
  testFunction: (setup: { browser: Browser; page: Page; logger: Logger }) => Promise<void>
) {
  const helper = new TestHelper(testName);
  
  try {
    const setup = await helper.setup();
    await testFunction(setup);
    console.log(`✅ ${testName}: PASSED`);
  } catch (error) {
    console.error(`❌ ${testName}: FAILED`);
    await helper.screenshotOnFailure(error as Error);
    throw error;
  } finally {
    await helper.teardown();
  }
}
