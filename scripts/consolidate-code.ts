#!/usr/bin/env npx ts-node

/**
 * Code Consolidation Script
 * Consolidates duplicate code patterns in the vee_otto codebase
 */

import fs from 'fs-extra';
import path from 'path';

class CodeConsolidator {
  private changesLog: string[] = [];

  async consolidate() {
    console.log('🔧 Starting code consolidation...\n');

    // 1. Consolidate retry logic
    await this.consolidateRetryLogic();

    // 2. Consolidate configuration constants
    await this.createConstantsFile();

    // 3. Consolidate type definitions
    await this.consolidateTypes();

    // 4. Create shared test utilities
    await this.enhanceTestHelper();

    // 5. Update imports
    await this.updateImports();

    // Save changes log
    await this.saveChangesLog();

    console.log('\n✅ Code consolidation complete!');
    console.log('📄 Changes log saved to: consolidation-changes.log');
  }

  private async consolidateRetryLogic() {
    console.log('1️⃣ Creating unified retry utility...');

    const retryUtilsContent = `/**
 * Unified Retry Utilities
 * Consolidates retry logic from across the codebase
 */

import pRetry from 'p-retry';
import { Logger } from './Logger';

export interface RetryOptions {
  retries?: number;
  minTimeout?: number;
  maxTimeout?: number;
  factor?: number;
  onFailedAttempt?: (error: Error, attempt: number) => void;
}

const logger = new Logger('RetryUtils');

/**
 * Unified retry function that wraps p-retry with our standard configuration
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const defaultOptions: RetryOptions = {
    retries: 3,
    minTimeout: 1000,
    maxTimeout: 10000,
    factor: 2,
  };

  const finalOptions = { ...defaultOptions, ...options };

  return await pRetry(operation, {
    retries: finalOptions.retries!,
    minTimeout: finalOptions.minTimeout!,
    maxTimeout: finalOptions.maxTimeout!,
    factor: finalOptions.factor!,
    onFailedAttempt: (error) => {
      const attempt = (error as any).attemptNumber;
      logger.warn(\`Retry attempt \${attempt} failed: \${error.message}\`);
      
      if (finalOptions.onFailedAttempt) {
        finalOptions.onFailedAttempt(error, attempt);
      }
    },
  });
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        logger.debug(\`Retrying after \${delay}ms (attempt \${i + 1}/\${maxRetries})\`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

/**
 * Retry with custom condition
 */
export async function retryUntil<T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  options: { maxAttempts?: number; delay?: number } = {}
): Promise<T> {
  const { maxAttempts = 10, delay = 1000 } = options;
  
  for (let i = 0; i < maxAttempts; i++) {
    const result = await fn();
    if (condition(result)) {
      return result;
    }
    if (i < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(\`Condition not met after \${maxAttempts} attempts\`);
}
`;

    await fs.writeFile('./core/utils/retryUtils.ts', retryUtilsContent);
    this.changesLog.push('Created unified retry utility at core/utils/retryUtils.ts');
  }

  private async createConstantsFile() {
    console.log('2️⃣ Creating constants file...');

    const constantsContent = `/**
 * Shared Constants
 * Centralizes hardcoded values from across the codebase
 */

export const TIMEOUTS = {
  DEFAULT: 5000,
  SHORT: 2000,
  MEDIUM: 10000,
  LONG: 30000,
  NAVIGATION: 60000,
} as const;

export const RETRY_CONFIG = {
  DEFAULT_RETRIES: 3,
  DEFAULT_MIN_TIMEOUT: 1000,
  DEFAULT_MAX_TIMEOUT: 10000,
  DEFAULT_FACTOR: 2,
} as const;

export const PORTS = {
  DEFAULT_SERVER: 3000,
  DEFAULT_FRONTEND: 8080,
  DEFAULT_WEBHOOK: 3001,
} as const;

export const URLS = {
  LOCAL_SERVER: \`http://localhost:\${PORTS.DEFAULT_SERVER}\`,
  LOCAL_FRONTEND: \`http://localhost:\${PORTS.DEFAULT_FRONTEND}\`,
} as const;

export const PATHS = {
  SCREENSHOTS: 'screenshots',
  LOGS: 'logs',
  REPORTS: 'reports',
  CONFIG: 'config',
  TEMP: 'temp',
} as const;

export const BROWSER_CONFIG = {
  DEFAULT_VIEWPORT: { width: 1920, height: 1080 },
  HEADLESS: process.env.HEADLESS === 'true',
  SLOW_MO: process.env.DEBUG_MODE === 'true' ? 500 : 0,
} as const;

export const LOG_CONFIG = {
  MAX_SIZE: '10m',
  MAX_FILES: '7d',
  DATE_PATTERN: 'YYYY-MM-DD',
} as const;
`;

    await fs.writeFile('./core/utils/constants.ts', constantsContent);
    this.changesLog.push('Created constants file at core/utils/constants.ts');
  }

  private async consolidateTypes() {
    console.log('3️⃣ Consolidating type definitions...');

    const existingTypes = await fs.readFile('./core/types/index.ts', 'utf-8');
    
    const additionalTypes = `
// Consolidated retry options
export interface RetryOptions {
  retries?: number;
  minTimeout?: number;
  maxTimeout?: number;
  factor?: number;
  onFailedAttempt?: (error: Error, attempt: number) => void;
}

// Consolidated browser configuration
export interface BrowserConfig {
  headless?: boolean;
  viewport?: { width: number; height: number };
  timeout?: number;
  slowMo?: number;
  args?: string[];
}

// Consolidated automation options
export interface AutomationOptions {
  timeout?: number;
  waitForStable?: boolean;
  screenshotOnFailure?: boolean;
  retries?: number;
}

// Consolidated element selector
export interface ElementSelector {
  selector: string;
  text?: string;
  index?: number;
  visible?: boolean;
}
`;

    // Append to existing types if not already present
    if (!existingTypes.includes('RetryOptions')) {
      await fs.appendFile('./core/types/index.ts', additionalTypes);
      this.changesLog.push('Added consolidated types to core/types/index.ts');
    }
  }

  private async enhanceTestHelper() {
    console.log('4️⃣ Enhancing test helper utilities...');

    const testHelperContent = `/**
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
    this.logger.info(\`Setting up test: \${this.testName}\`);

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
    this.logger.info(\`Tearing down test: \${this.testName}\`);

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
        \`\${this.testName}-failure-\${Date.now()}.png\`
      );
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      this.logger.error(\`Test failed, screenshot saved: \${screenshotPath}\`, { error });
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
      throw new Error(\`Text mismatch. Expected: "\${expectedText}", Got: "\${actualText}"\`);
    }
  }

  static async verifyUrl(page: Page, expectedUrl: string | RegExp) {
    const currentUrl = page.url();
    if (typeof expectedUrl === 'string') {
      if (!currentUrl.includes(expectedUrl)) {
        throw new Error(\`URL mismatch. Expected: "\${expectedUrl}", Got: "\${currentUrl}"\`);
      }
    } else if (!expectedUrl.test(currentUrl)) {
      throw new Error(\`URL mismatch. Pattern: \${expectedUrl}, Got: "\${currentUrl}"\`);
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
    console.log(\`✅ \${testName}: PASSED\`);
  } catch (error) {
    console.error(\`❌ \${testName}: FAILED\`);
    await helper.screenshotOnFailure(error as Error);
    throw error;
  } finally {
    await helper.teardown();
  }
}
`;

    await fs.writeFile('./tests/utils/TestHelper.ts', testHelperContent);
    this.changesLog.push('Enhanced TestHelper with common test patterns');
  }

  private async updateImports() {
    console.log('5️⃣ Updating imports to use consolidated modules...');
    
    // This would be a more complex operation in practice
    // For now, we'll just log the recommendation
    this.changesLog.push(`
Recommended import updates:
- Replace retry logic imports with: import { withRetry } from './core/utils/retryUtils'
- Replace hardcoded values with: import { TIMEOUTS, PORTS, URLS } from './core/utils/constants'
- Use TestHelper for all test files: import { TestHelper, runTest } from './tests/utils/TestHelper'
`);
  }

  private async saveChangesLog() {
    const logContent = this.changesLog.join('\n');
    await fs.writeFile('./consolidation-changes.log', logContent);
  }
}

// Run consolidation
if (require.main === module) {
  const consolidator = new CodeConsolidator();
  consolidator.consolidate().catch(console.error);
}