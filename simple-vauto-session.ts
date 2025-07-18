#!/usr/bin/env node

import { chromium } from 'playwright';
import * as fs from 'fs-extra';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.mvp' });

async function startSession() {
  console.log('Starting VAuto session...');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000
  });

  // Save connection info  
  await fs.ensureDir('./session');
  // Use connectOverCDP approach - save a marker file
  await fs.writeFile('./session/browser-ws-endpoint.txt', 'manual-session');
  console.log('Session marker saved');

  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('https://signin.coxautoinc.com');
  await page.fill('#okta-signin-username', process.env.VAUTO_USERNAME || '');
  await page.fill('#okta-signin-password', process.env.VAUTO_PASSWORD || '');
  await page.click('#okta-signin-submit');

  console.log('Complete 2FA in the browser...');
  console.log('Then navigate to inventory and open a vehicle modal');
  console.log('Session will stay open. Press Ctrl+C to close.');

  // Keep alive
  await new Promise(() => {});
}

startSession().catch(console.error);