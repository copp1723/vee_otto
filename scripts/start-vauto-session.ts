#!/usr/bin/env node

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Logger } from '../core/utils/Logger';

// Load environment
dotenv.config({ path: '.env.mvp' });

const logger = new Logger('VAuto-Session');

async function startVAutoSession() {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    logger.info('🚀 Starting VAuto Session Manager');
    
    // Configuration
    const config = {
      username: process.env.VAUTO_USERNAME || '',
      password: process.env.VAUTO_PASSWORD || '',
      headless: false,
      slowMo: 1000,
      sessionDir: './session',
      wsEndpointFile: './session/browser-ws-endpoint.txt',
      stateFile: './session/auth-state.json'
    };

    // Validate
    if (!config.username || !config.password) {
      throw new Error('Missing VAUTO_USERNAME or VAUTO_PASSWORD');
    }

    // Clean up old session files
    await fs.ensureDir(config.sessionDir);
    await fs.remove(config.wsEndpointFile).catch(() => {});
    await fs.remove(config.stateFile).catch(() => {});

    // Launch browser with debugging port
    logger.info('🌐 Launching browser...');
    browser = await chromium.launch({
      headless: config.headless,
      slowMo: config.slowMo,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--remote-debugging-port=9222'
      ]
    });
    
    // Save WebSocket endpoint
    const wsEndpoint = (browser as any).wsEndpoint();
    await fs.writeFile(config.wsEndpointFile, wsEndpoint);
    logger.info(`💾 Browser WebSocket endpoint saved to: ${config.wsEndpointFile}`);

    // Create context
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    page = await context.newPage();

    // Perform login
    logger.info('🔑 Logging into VAuto...');
    await page.goto('https://signin.coxautoinc.com');
    await page.waitForLoadState('networkidle');

    // Fill credentials
    try {
      await page.fill('#okta-signin-username', config.username);
      await page.fill('#okta-signin-password', config.password);
      await page.click('#okta-signin-submit');
    } catch (error) {
      // Try alternative selectors
      await page.fill('input[name="username"]', config.username);
      await page.fill('input[name="password"]', config.password);
      await page.click('button[type="submit"]');
    }

    // Wait for 2FA or successful login
    logger.info('⏳ Waiting for 2FA or login completion...');
    await page.waitForTimeout(5000);

    // Check if 2FA is needed
    const needs2FA = await page.locator('input[name*="code"], input[placeholder*="code"]').isVisible().catch(() => false);
    
    if (needs2FA) {
      logger.info('🔐 2FA required. Please complete 2FA in the browser...');
      logger.info('⏳ Waiting for you to complete 2FA manually...');
      
      // Wait for navigation away from 2FA page
      await page.waitForURL(/vauto|provision/, { timeout: 300000 });
      logger.info('✅ 2FA completed!');
    }

    // Navigate to inventory
    const currentUrl = page.url();
    if (!currentUrl.includes('inventory')) {
      logger.info('📋 Navigating to inventory...');
      await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/');
      await page.waitForLoadState('networkidle');
    }

    // Save authentication state
    await context.storageState({ path: config.stateFile });
    logger.info(`💾 Authentication state saved to: ${config.stateFile}`);

    // Session info
    logger.info('\n✅ VAuto Session Started Successfully!');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('📂 Session Files:');
    logger.info(`   - WebSocket: ${config.wsEndpointFile}`);
    logger.info(`   - Auth State: ${config.stateFile}`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('\n🔧 Session is now active and logged in');
    logger.info('📍 Current page: ' + page.url());
    logger.info('\n⏰ Session will stay active for 2 hours');
    logger.info('🛑 Press Ctrl+C to end the session\n');

    // Keep alive for 2 hours
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, 2 * 60 * 60 * 1000);
      
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        logger.info('\n🛑 Shutting down session...');
        clearTimeout(timeout);
        resolve(undefined);
      });
    });

  } catch (error) {
    logger.error('❌ Session failed:', error);
    if (error instanceof Error) {
      logger.error('Error details:', error.message);
      logger.error('Stack:', error.stack);
    }
    throw error;
  } finally {
    // Cleanup
    logger.info('🧹 Cleaning up...');
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    
    // Remove session files on cleanup
    await fs.remove('./session/browser-ws-endpoint.txt').catch(() => {});
    
    logger.info('✅ Session ended');
  }
}

// Run if called directly
if (require.main === module) {
  startVAutoSession().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

export { startVAutoSession };