#!/usr/bin/env node

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from '../core/utils/Logger';

const logger = new Logger('Test-With-Session');

async function runTestWithSession(testScript: string) {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    // Check for session files
    const wsEndpointFile = './session/browser-ws-endpoint.txt';
    const stateFile = './session/auth-state.json';

    if (!await fs.pathExists(wsEndpointFile)) {
      throw new Error('No active session found. Run "npm run vauto:session" first.');
    }

    // Connect to existing browser
    const wsEndpoint = await fs.readFile(wsEndpointFile, 'utf-8');
    logger.info('🔌 Connecting to existing browser session...');
    
    try {
      browser = await chromium.connectOverCDP(wsEndpoint);
      logger.info('✅ Connected to browser');
    } catch (error) {
      logger.error('Failed to connect. The session may have ended.');
      throw error;
    }

    // Create new context with saved auth state
    if (await fs.pathExists(stateFile)) {
      logger.info('📂 Loading authentication state...');
      context = await browser.newContext({
        storageState: stateFile,
        viewport: { width: 1920, height: 1080 }
      });
    } else {
      context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
      });
    }

    page = await context.newPage();
    
    // Make page available globally for the test script
    (global as any).testPage = page;
    (global as any).testContext = context;
    (global as any).testBrowser = browser;

    // Verify we're logged in by checking the URL
    await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/');
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    if (url.includes('signin') || url.includes('login')) {
      throw new Error('Session expired. Please run "npm run vauto:session" again.');
    }

    logger.info('✅ Session is active and authenticated');
    logger.info(`🧪 Running test script: ${testScript}`);

    // Import and run the test script
    const testPath = path.resolve(__dirname, testScript);
    if (!testPath.includes('.ts') && !testPath.includes('.js')) {
      throw new Error('Test script must be a .ts or .js file');
    }

    if (!await fs.pathExists(testPath)) {
      throw new Error(`Test script not found: ${testPath}`);
    }

    // Run the test
    await import(testPath);

  } catch (error) {
    logger.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Cleanup only the context and page, not the browser
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    // DO NOT close the browser - it's shared!
  }
}

// Main
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npm run test:with-session <test-script>');
    console.log('Example: npm run test:with-session test-factory-equipment.ts');
    process.exit(1);
  }

  const testScript = args[0];
  runTestWithSession(testScript).catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}