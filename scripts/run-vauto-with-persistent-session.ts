import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs-extra';
import { Logger } from '../core/utils/Logger';

const logger = new Logger('PersistentSession');

/**
 * Run VAuto automation with persistent browser session
 * Keeps browser open for 24 hours for testing
 */
async function runWithPersistentSession() {
  let context: BrowserContext | null = null;
  const userDataDir = path.join(process.cwd(), 'browser-data', 'vauto-session');
  
  try {
    // Ensure user data directory exists
    await fs.ensureDir(userDataDir);
    logger.info(`📁 Using browser data directory: ${userDataDir}`);
    
    // Launch browser with persistent context
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ],
      // Keep cookies and session data
      acceptDownloads: true,
      bypassCSP: true,
      ignoreHTTPSErrors: true
    });
    
    logger.info('🌐 Browser launched with persistent session');
    
    // Get the first page
    const pages = context.pages();
    const page = pages[0] || await context.newPage();
    
    // Check if already logged in
    await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Dashboard/ProvisionEnterprise/Default.aspx');
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    logger.info(`Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('signin')) {
      logger.info('📝 Not logged in, please login manually');
      logger.info('After logging in and passing 2FA, the session will be saved');
    } else {
      logger.info('✅ Already logged in! Session restored from previous run');
    }
    
    // Keep browser open
    logger.info('');
    logger.info('🔓 Browser session will remain open for 24 hours');
    logger.info('📌 You can now:');
    logger.info('   1. Login manually if needed');
    logger.info('   2. Test automation scripts in another terminal');
    logger.info('   3. The session data is saved in: ' + userDataDir);
    logger.info('');
    logger.info('Press Ctrl+C to close the browser and save session');
    
    // Keep process alive for 24 hours
    const keepAliveInterval = setInterval(() => {
      logger.debug('Session still active...');
    }, 60000); // Log every minute
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('\n👋 Closing browser and saving session...');
      clearInterval(keepAliveInterval);
      if (context) {
        await context.close();
      }
      logger.info('✅ Session saved. Run this script again to restore the session');
      process.exit(0);
    });
    
    // Wait for 24 hours
    await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000));
    
  } catch (error) {
    logger.error('Error in persistent session:', error);
  } finally {
    if (context) {
      await context.close();
    }
  }
}

// Script to test automation with existing session
export async function testWithExistingSession() {
  const userDataDir = path.join(process.cwd(), 'browser-data', 'vauto-session');
  
  if (!await fs.pathExists(userDataDir)) {
    logger.error('No saved session found. Run the persistent session script first.');
    return;
  }
  
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1920, height: 1080 }
  });
  
  try {
    const page = browser.pages()[0] || await browser.newPage();
    
    // Navigate to inventory
    logger.info('🚗 Navigating to inventory...');
    await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/');
    await page.waitForLoadState('networkidle');
    
    // Your automation logic here
    logger.info('✅ You can now run your automation logic on the logged-in session');
    
    // Example: Click a vehicle
    const vehicleLink = page.locator('//a[contains(@class, "YearMakeModel")]').first();
    if (await vehicleLink.isVisible({ timeout: 5000 })) {
      await vehicleLink.click();
      logger.info('✅ Clicked vehicle');
      
      // Import and use the Vehicle Info tab helper
      const { clickFactoryEquipmentWithTabCheck } = await import('../fix-vehicle-info-tab-click');
      const success = await clickFactoryEquipmentWithTabCheck(page, logger);
      
      if (success) {
        logger.info('✅ Successfully navigated to Factory Equipment');
      }
    }
    
  } catch (error) {
    logger.error('Test error:', error);
  } finally {
    // Don't close browser to keep session
    logger.info('Keeping browser open to preserve session...');
  }
}

// Run based on command line argument
const args = process.argv.slice(2);
if (args.includes('--test')) {
  testWithExistingSession().catch(console.error);
} else {
  runWithPersistentSession().catch(console.error);
} 