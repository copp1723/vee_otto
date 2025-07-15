#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { VAutoAgent } from '../../platforms/vauto/VAutoAgent';
import { Logger } from '../../core/utils/Logger';
import * as fs from 'fs-extra';

dotenv.config();

const logger = new Logger('Module-01-Login');

async function main() {
  logger.info('🔐 MODULE 01: Login and 2FA ONLY');
  
  const agent = new VAutoAgent({
    username: process.env.VAUTO_USERNAME || '',
    password: process.env.VAUTO_PASSWORD || '',
    headless: false,
    slowMo: 1000,
    screenshotOnError: true
  });

  try {
    // Initialize and login
    await agent.initialize();
    const loginSuccess = await agent.login();
    
    if (!loginSuccess) {
      throw new Error('Login failed');
    }
    
    logger.info('✅ Login and 2FA successful!');
    
    // Save the authenticated state
    const page = (agent as any).page as Page;
    const context = page.context();
    
    // Save cookies and session
    const cookies = await context.cookies();
    const state = await context.storageState();
    
    await fs.ensureDir('session');
    await fs.writeJson('session/cookies.json', cookies, { spaces: 2 });
    await fs.writeJson('session/state.json', state, { spaces: 2 });
    
    logger.info('💾 Session saved to session/state.json');
    logger.info('✅ MODULE 01 COMPLETE - Ready for next module');
    
    // Keep browser open for next module
    logger.info('Browser staying open. Press Ctrl+C to close.');
    
    // Export for next module
    process.env.VAUTO_SESSION_FILE = 'session/state.json';
    
  } catch (error) {
    logger.error('Module 01 failed:', error);
    await agent.cleanup();
    process.exit(1);
  }
}

main().catch(console.error); 