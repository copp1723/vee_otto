#!/usr/bin/env node

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as dotenv from 'dotenv';
import { Logger } from '../core/utils/Logger';
import { WindowStickerService } from '../core/services/WindowStickerService';
import { WindowStickerAccessService } from '../core/services/WindowStickerAccessService';
import { VAutoCheckboxMappingService } from '../core/services/VAutoCheckboxMappingService';
import { ReportingService } from '../core/services/ReportingService';
import { VehicleModalNavigationService } from '../platforms/vauto/services/VehicleModalNavigationService';
import * as fs from 'fs-extra';
import * as path from 'path';

// Load MVP-specific environment variables
dotenv.config({ path: '.env.mvp' });

const logger = new Logger('MVP-End-to-End');

interface MVPConfig {
  username: string;
  password: string;
  headless: boolean;
  slowMo: number;
  maxVehiclesToProcess?: number;
  maxPagesToProcess?: number;
  screenshotDir: string;
  reportDir: string;
  sessionDir: string;
}

interface ProcessingResult {
  vin: string;
  success: boolean;
  featuresFound: number;
  checkboxesUpdated: number;
  error?: string;
  timestamp: Date;
}

class MVPVAutoAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: MVPConfig;
  private results: ProcessingResult[] = [];
  private reportingService: ReportingService;

  constructor(config: MVPConfig) {
    this.config = config;
    this.reportingService = new ReportingService();
    
    // Ensure directories exist
    fs.ensureDirSync(this.config.screenshotDir);
    fs.ensureDirSync(this.config.reportDir);
    fs.ensureDirSync(this.config.sessionDir);
  }

  /**
   * Main execution flow combining best practices from all implementations
   */
  async run() {
    try {
      logger.info('🚀 Starting MVP End-to-End VAuto Automation');
      logger.info(`📋 Configuration:
        - Username: ${this.config.username}
        - Headless: ${this.config.headless}
        - Max Vehicles: ${this.config.maxVehiclesToProcess || 'All'}
        - Max Pages: ${this.config.maxPagesToProcess || 'All'}`);

      // Step 1: Initialize browser with robust settings
      await this.initializeBrowser();

      // Step 2: Login and 2FA
      await this.performLogin();

      // Step 3: Navigate to inventory
      await this.navigateToInventory();

      // Step 4: Apply age filter (0-1 days)
      await this.applyAgeFilter();

      // Step 5: Process all vehicles
      await this.processAllVehicles();

      // Step 6: Generate report
      await this.generateReport();

      logger.info('✅ MVP automation completed successfully!');

    } catch (error) {
      logger.error('❌ MVP automation failed:', error);
      await this.takeDebugScreenshot('error-final');
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Initialize browser with best settings from all implementations
   */
  private async initializeBrowser() {
    logger.info('🌐 Initializing browser...');
    
    this.browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security'
      ]
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    this.page = await this.context.newPage();
    logger.info('✅ Browser initialized');
  }

  /**
   * Login with 2FA handling
   */
  private async performLogin() {
    logger.info('🔑 Starting login process...');
    
    // Check for existing session
    const sessionFile = path.join(this.config.sessionDir, 'auth-session.json');
    if (await fs.pathExists(sessionFile)) {
      logger.info('📂 Found existing session, attempting to restore...');
      try {
        await this.context!.addCookies(await fs.readJson(sessionFile));
        await this.page!.goto('https://provision.vauto.app.coxautoinc.com/Va/Dashboard/ProvisionEnterprise/Default.aspx');
        await this.page!.waitForLoadState('networkidle');
        
        // Check if we're logged in
        if (await this.page!.locator('#m_16-menu').isVisible({ timeout: 5000 })) {
          logger.info('✅ Session restored successfully');
          return;
        }
      } catch (error) {
        logger.warn('⚠️ Session restore failed, proceeding with fresh login');
      }
    }

    // Fresh login
    const loginUrl = process.env.PLATFORM_URL || 'https://signin.coxautoinc.com';
    logger.info(`Navigating to login URL: ${loginUrl}`);
    await this.page!.goto(loginUrl);
    await this.page!.waitForLoadState('networkidle');
    await this.page!.waitForTimeout(2000); // Extra wait for form to be ready

    // Enter credentials
    logger.info('📝 Entering credentials...');
    try {
      // Wait for username field to be visible
      await this.page!.waitForSelector('#okta-signin-username', { state: 'visible', timeout: 10000 });
      await this.page!.fill('#okta-signin-username', this.config.username);
      await this.page!.fill('#okta-signin-password', this.config.password);
      await this.page!.click('#okta-signin-submit');
    } catch (error) {
      logger.error('Failed to fill credentials. Trying alternative selectors...');
      // Try alternative selectors
      await this.page!.waitForSelector('input[name="username"]', { state: 'visible', timeout: 10000 });
      await this.page!.fill('input[name="username"]', this.config.username);
      await this.page!.fill('input[name="password"]', this.config.password);
      await this.page!.click('button[type="submit"]');
    }

    // Handle 2FA
    logger.info('🔐 Waiting for 2FA...');
    try {
      await this.page!.waitForSelector('input[type="text"][name*="code"], input[type="text"][aria-label*="code"]', { timeout: 60000 });
      
      logger.info('🔐 2FA required. Please enter your code:');
      process.stdout.write('2FA Code: ');
      
      const code = await new Promise<string>(resolve => {
        process.stdin.once('data', data => resolve(data.toString().trim()));
      });
      
      await this.page!.fill('input[type="text"][name*="code"], input[type="text"][aria-label*="code"]', code);
      await this.page!.click('button[type="submit"], input[type="submit"]');
      
      logger.info('✅ 2FA submitted');
    } catch (error) {
      logger.info('✅ No 2FA required or already authenticated');
    }

    // Wait for dashboard
    await this.page!.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 });
    
    // Save session
    const cookies = await this.context!.cookies();
    await fs.writeJson(sessionFile, cookies);
    logger.info('💾 Session saved for future use');
  }

  /**
   * Navigate to inventory page
   */
  private async navigateToInventory() {
    logger.info('📦 Navigating to inventory...');
    
    // Try direct navigation first
    await this.page!.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/Vehicles.aspx');
    await this.page!.waitForLoadState('networkidle');
    
    // Verify we're on inventory page
    const inventoryIndicators = [
      '#ext-gen25', // Inventory grid
      '.x-grid3-row', // Vehicle rows
      'text=Filter' // Filter tab
    ];
    
    let onInventory = false;
    for (const indicator of inventoryIndicators) {
      if (await this.page!.locator(indicator).isVisible({ timeout: 5000 }).catch(() => false)) {
        onInventory = true;
        break;
      }
    }
    
    if (!onInventory) {
      // Fallback: Click View Inventory link
      logger.info('📋 Using View Inventory link...');
      await this.page!.click('a[href*="Inventory"]:has-text("View Inventory"), #m_16-menu a');
      await this.page!.waitForLoadState('networkidle');
    }
    
    logger.info('✅ On inventory page');
    await this.takeDebugScreenshot('inventory-page');
  }

  /**
   * Apply age filter (0-1 days)
   */
  private async applyAgeFilter() {
    logger.info('🔍 Applying age filter (0-1 days)...');
    
    // Click Filter tab
    const filterTab = this.page!.locator('#ext-gen73, text=Filter, button:has-text("Filter")').first();
    await filterTab.click();
    await this.page!.waitForTimeout(1000);
    
    // Enable Age filter
    const ageCheckbox = this.page!.locator('#ext-gen119, input[type="checkbox"][name*="age"], input[type="checkbox"]:near(:text("Age"))').first();
    if (!await ageCheckbox.isChecked()) {
      await ageCheckbox.click();
    }
    
    // Set age range
    await this.page!.fill('#ext-gen114, input[name*="min"]:near(:text("Age")), input:near(:text("Age")):first', '0');
    await this.page!.fill('#ext-gen115, input[name*="max"]:near(:text("Age")), input:near(:text("Age")):last', '1');
    
    // Apply filter
    const applyButton = this.page!.locator('#ext-gen745, button:has-text("Apply"), button:has-text("Filter")').last();
    await applyButton.click();
    await this.page!.waitForLoadState('networkidle');
    await this.page!.waitForTimeout(2000);
    
    logger.info('✅ Age filter applied');
    await this.takeDebugScreenshot('filter-applied');
  }

  /**
   * Process all vehicles across all pages
   */
  private async processAllVehicles() {
    let currentPage = 1;
    let totalProcessed = 0;
    const maxPages = this.config.maxPagesToProcess || 999;
    const maxVehicles = this.config.maxVehiclesToProcess || 999999;

    while (currentPage <= maxPages && totalProcessed < maxVehicles) {
      logger.info(`📄 Processing page ${currentPage}...`);
      
      // Get vehicle count on current page
      const vehicleCount = await this.getVehicleLinksOnPage();
      logger.info(`📊 Found ${vehicleCount} vehicles on page ${currentPage}`);
      
      // Process each vehicle
      for (let i = 0; i < vehicleCount && totalProcessed < maxVehicles; i++) {
        const startTime = Date.now();
        logger.info(`\n🚗 Processing vehicle ${totalProcessed + 1} (${i + 1}/${vehicleCount} on page ${currentPage})...`);
        
        try {
          const result = await this.processVehicle(i);
          this.results.push(result);
          totalProcessed++;
          
          const duration = Date.now() - startTime;
          logger.info(`✅ Vehicle processed in ${(duration / 1000).toFixed(1)}s`);
          
        } catch (error) {
          logger.error(`❌ Failed to process vehicle ${i + 1}:`, error);
          this.results.push({
            vin: 'UNKNOWN',
            success: false,
            featuresFound: 0,
            checkboxesUpdated: 0,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date()
          });
        }
        
        // Return to inventory after each vehicle
        await this.returnToInventory();
      }
      
      // Check for next page
      const hasNextPage = await this.goToNextPage();
      if (!hasNextPage) {
        logger.info('📄 No more pages to process');
        break;
      }
      
      currentPage++;
    }
    
    logger.info(`\n✅ Processed ${totalProcessed} vehicles across ${currentPage} pages`);
  }

  /**
   * Get all vehicle links on current page
   */
  private async getVehicleLinksOnPage(): Promise<number> {
    // Wait for grid to load
    await this.page!.waitForSelector('.x-grid3-row', { timeout: 30000 });
    
    // Count vehicle rows
    const rows = await this.page!.locator('.x-grid3-row').count();
    return rows;
  }

  /**
   * Process a single vehicle
   */
  private async processVehicle(index: number): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      vin: 'UNKNOWN',
      success: false,
      featuresFound: 0,
      checkboxesUpdated: 0,
      timestamp: new Date()
    };

    try {
      // Click vehicle at index
      const vehicleRow = this.page!.locator('.x-grid3-row').nth(index);
      const vehicleLink = vehicleRow.locator('a').first();
      
      // Get vehicle info before clicking
      const vehicleText = await vehicleLink.textContent() || '';
      logger.info(`📋 Clicking vehicle: ${vehicleText}`);
      
      // Click with retry
      let clicked = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await vehicleLink.click({ timeout: 5000 });
          clicked = true;
          break;
        } catch (error) {
          if (attempt === 3) throw error;
          logger.warn(`⚠️ Click attempt ${attempt} failed, retrying...`);
          await this.page!.waitForTimeout(1000);
        }
      }
      
      if (!clicked) {
        throw new Error('Failed to click vehicle after 3 attempts');
      }
      
      // Wait for modal
      await this.page!.waitForSelector('.x-window, #GaugePageIFrame', { timeout: 10000 });
      await this.page!.waitForTimeout(2000);
      
      // Extract VIN
      const vinElement = await this.page!.locator('label:has-text("VIN") + *, text=/[A-Z0-9]{17}/').first();
      result.vin = await vinElement.textContent() || 'UNKNOWN';
      logger.info(`🔖 VIN: ${result.vin}`);
      
      // Navigate to Factory Equipment
      const navService = new VehicleModalNavigationService(this.page!, logger);
      const factoryEquipmentClicked = await navService.clickFactoryEquipmentWithTabVerification();
      
      if (!factoryEquipmentClicked) {
        throw new Error('Failed to access Factory Equipment');
      }
      
      // Access window sticker
      const accessService = new WindowStickerAccessService(this.page!, logger);
      const windowStickerResult = await accessService.accessWindowSticker();
      
      if (!windowStickerResult.success) {
        throw new Error(`Failed to access window sticker: ${windowStickerResult.error}`);
      }
      
      logger.info(`✅ Window sticker accessed via method: ${windowStickerResult.method}`);
      
      // Extract features
      const stickerService = new WindowStickerService();
      const features = await stickerService.extractFeatures(windowStickerResult.windowStickerPage || this.page!);
      result.featuresFound = features.features.length;
      
      logger.info(`✅ Found ${result.featuresFound} features`);
      if (result.featuresFound > 0) {
        logger.info('  Sample features:');
        features.features.slice(0, 5).forEach((f, i) => {
          logger.info(`    ${i + 1}. ${f}`);
        });
      }
      
      // Close window sticker popup if it's a separate window
      if (windowStickerResult.windowStickerPage && windowStickerResult.windowStickerPage !== this.page) {
        await windowStickerResult.windowStickerPage.close();
        logger.info('🪟 Closed window sticker popup');
      }
      
      // Update checkboxes
      const checkboxService = new VAutoCheckboxMappingService(this.page!, logger);
      
      // Note: getCheckboxStates is in the parent class
      logger.info(`📊 Preparing to update checkboxes...`);
      
      const mappingResult = await checkboxService.mapAndUpdateCheckboxes(features.features);
      result.checkboxesUpdated = mappingResult.checkboxesUpdated;
      
      logger.info(`✅ Updated ${result.checkboxesUpdated} checkboxes`);
      if (mappingResult.actions.length > 0) {
        logger.info('  Sample updates:');
        mappingResult.actions.slice(0, 5).forEach((a, i) => {
          logger.info(`    ${i + 1}. ${a.label} (${a.action})`);
        });
      }
      
      // Save changes
      await this.saveChanges();
      
      result.success = true;
      
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Vehicle processing failed: ${result.error}`);
      await this.takeDebugScreenshot(`vehicle-${index}-error`);
    }
    
    return result;
  }

  /**
   * Save changes in the modal
   */
  private async saveChanges() {
    logger.info('💾 Saving changes...');
    
    const saveSelectors = [
      '#ext-gen58',
      'button:has-text("Save")',
      'button:has-text("Save Changes")',
      'a:has-text("Save")',
      'input[value*="Save"]'
    ];
    
    let saved = false;
    for (const selector of saveSelectors) {
      try {
        const saveButton = this.page!.locator(selector).first();
        if (await saveButton.isVisible({ timeout: 2000 })) {
          await saveButton.click();
          await this.page!.waitForLoadState('networkidle', { timeout: 10000 });
          logger.info(`✅ Changes saved using selector: ${selector}`);
          saved = true;
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!saved) {
      logger.warn('⚠️ Could not find save button, changes may not be saved');
    }
    
    await this.page!.waitForTimeout(2000);
  }

  /**
   * Return to inventory page after processing a vehicle
   */
  private async returnToInventory() {
    logger.info('🔙 Returning to inventory...');
    
    // Close modal if open
    const closeButton = this.page!.locator('.x-tool-close, button[aria-label="Close"], .x-window .x-tool-close');
    if (await closeButton.isVisible({ timeout: 2000 })) {
      await closeButton.click();
      await this.page!.waitForTimeout(1000);
    }
    
    // Navigate back to inventory
    await this.page!.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/Vehicles.aspx');
    await this.page!.waitForLoadState('networkidle');
    await this.page!.waitForTimeout(2000);
    
    // Reapply filter
    await this.applyAgeFilter();
  }

  /**
   * Navigate to next page of results
   */
  private async goToNextPage(): Promise<boolean> {
    logger.info('📄 Checking for next page...');
    
    const nextButton = this.page!.locator('#ext-gen41, button:has-text("Next"), a:has-text("Next")').first();
    
    if (await nextButton.isVisible({ timeout: 5000 }) && await nextButton.isEnabled()) {
      await nextButton.click();
      await this.page!.waitForLoadState('networkidle');
      await this.page!.waitForTimeout(2000);
      return true;
    }
    
    return false;
  }

  /**
   * Generate final report
   */
  private async generateReport() {
    logger.info('📊 Generating report...');
    
    const summary = {
      totalVehicles: this.results.length,
      successful: this.results.filter(r => r.success).length,
      failed: this.results.filter(r => !r.success).length,
      totalFeaturesFound: this.results.reduce((sum, r) => sum + r.featuresFound, 0),
      totalCheckboxesUpdated: this.results.reduce((sum, r) => sum + r.checkboxesUpdated, 0),
      timestamp: new Date(),
      results: this.results
    };
    
    // Save JSON report
    const reportPath = path.join(this.config.reportDir, `mvp-report-${Date.now()}.json`);
    await fs.writeJson(reportPath, summary, { spaces: 2 });
    
    // Log summary
    logger.info(`
📊 Final Report:
- Total Vehicles: ${summary.totalVehicles}
- Successful: ${summary.successful} (${((summary.successful / summary.totalVehicles) * 100).toFixed(1)}%)
- Failed: ${summary.failed}
- Total Features Found: ${summary.totalFeaturesFound}
- Total Checkboxes Updated: ${summary.totalCheckboxesUpdated}
- Report saved to: ${reportPath}
    `);
    
    // Log errors
    if (summary.failed > 0) {
      logger.warn('\n❌ Failed vehicles:');
      this.results.filter(r => !r.success).forEach(r => {
        logger.warn(`  - VIN: ${r.vin}, Error: ${r.error}`);
      });
    }
  }

  /**
   * Take debug screenshot
   */
  private async takeDebugScreenshot(name: string) {
    if (this.page) {
      const screenshotPath = path.join(this.config.screenshotDir, `${name}-${Date.now()}.png`);
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      logger.debug(`📸 Screenshot saved: ${screenshotPath}`);
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup() {
    logger.info('🧹 Cleaning up...');
    
    if (this.page) {
      await this.page.close();
    }
    
    if (this.context) {
      await this.context.close();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
    
    logger.info('✅ Cleanup complete');
  }
}

/**
 * Main execution
 */
async function main() {
  // Load configuration
  const config: MVPConfig = {
    username: process.env.VAUTO_USERNAME || '',
    password: process.env.VAUTO_PASSWORD || '',
    headless: process.env.HEADLESS === 'true',
    slowMo: parseInt(process.env.SLOW_MO || '1000'),
    maxVehiclesToProcess: process.env.MAX_VEHICLES ? parseInt(process.env.MAX_VEHICLES) : undefined,
    maxPagesToProcess: process.env.MAX_PAGES ? parseInt(process.env.MAX_PAGES) : undefined,
    screenshotDir: 'screenshots/mvp',
    reportDir: 'reports/mvp',
    sessionDir: 'session'
  };
  
  // Validate configuration
  if (!config.username || !config.password) {
    logger.error('❌ Missing required environment variables: VAUTO_USERNAME and VAUTO_PASSWORD');
    process.exit(1);
  }
  
  // Create and run automation
  const automation = new MVPVAutoAutomation(config);
  
  try {
    await automation.run();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { MVPVAutoAutomation };