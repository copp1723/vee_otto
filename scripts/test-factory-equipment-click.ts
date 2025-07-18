import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs-extra';
import * as path from 'path';
import { clickFactoryEquipmentWithTabCheck } from '../fix-vehicle-info-tab-click';

// Simple logger
const log = (...args: any[]) => console.log('[TestHarness]', ...args);

async function main() {
  const wsEndpointPath = path.resolve(__dirname, '../session/browser-ws-endpoint.txt');
  if (!fs.existsSync(wsEndpointPath)) {
    log('ERROR: WebSocket endpoint file not found. Start the session script and complete login/2FA first.');
    process.exit(1);
  }
  const wsEndpoint = (await fs.readFile(wsEndpointPath, 'utf-8')).trim();
  log('Connecting to existing browser session...');

  const browser: Browser = await chromium.connect(wsEndpoint);
  const pages = browser.contexts().flatMap(ctx => ctx.pages());
  if (pages.length === 0) {
    log('ERROR: No pages found in the browser session.');
    await browser.close();
    process.exit(1);
  }

  // Try to find a page with a VAuto vehicle modal open
  let targetPage: Page | undefined = pages.find(p =>
    p.url().includes('provision.vauto.app.coxautoinc.com') ||
    p.url().includes('inventory')
  );
  if (!targetPage) {
    log('WARNING: No VAuto inventory page detected. Using the first available page.');
    targetPage = pages[0];
  }

  log('Running Factory Equipment click automation...');
  try {
    const result = await clickFactoryEquipmentWithTabCheck(targetPage, log);
    if (result) {
      log('SUCCESS: Factory Equipment button clicked.');
    } else {
      log('FAIL: Could not click Factory Equipment button.');
    }
  } catch (err) {
    log('ERROR during automation:', err);
  }

  await browser.close();
  log('Test harness complete.');
}

main();