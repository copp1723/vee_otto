#!/usr/bin/env node

import { chromium, Browser, Page } from 'playwright';
import * as dotenv from 'dotenv';
import { Logger } from '../core/utils/Logger';
import { WindowStickerAccessService } from '../core/services/WindowStickerAccessService';
import { WindowStickerService } from '../core/services/WindowStickerService';
import { VAutoCheckboxMappingService } from '../core/services/VAutoCheckboxMappingService';
import { VehicleModalNavigationService } from '../platforms/vauto/services/VehicleModalNavigationService';
import * as fs from 'fs-extra';

dotenv.config();

const logger = new Logger('Test-WindowSticker-Checkboxes');

interface TestConfig {
  username: string;
  password: string;
  headless: boolean;
  saveDebugData: boolean;
}

async function testWindowStickerAndCheckboxes() {
  const config: TestConfig = {
    username: process.env.VAUTO_USERNAME || '',
    password: process.env.VAUTO_PASSWORD || '',
    headless: false,
    saveDebugData: true
  };

  if (!config.username || !config.password) {
    logger.error('❌ Missing VAUTO_USERNAME and VAUTO_PASSWORD');
    return;
  }

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    logger.info('🧪 Testing Window Sticker Parsing and Checkbox Selection');
    
    // Initialize browser
    browser = await chromium.launch({
      headless: config.headless,
      slowMo: 1000
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    page = await context.newPage();

    // Step 1: Navigate to a vehicle with Factory Equipment
    logger.info('\n📋 Step 1: Navigate to test vehicle');
    logger.info('For this test, we need to manually navigate to a vehicle...');
    
    // Go to login
    await page.goto('https://login.vauto.com/');
    await page.fill('input[name="username"], input[type="email"]', config.username);
    await page.fill('input[name="password"], input[type="password"]', config.password);
    await page.click('button[type="submit"], input[type="submit"]');
    
    // Handle 2FA if needed
    try {
      await page.waitForSelector('input[type="text"][name*="code"]', { timeout: 30000 });
      logger.info('🔐 Enter 2FA code:');
      process.stdout.write('2FA Code: ');
      const code = await new Promise<string>(resolve => {
        process.stdin.once('data', data => resolve(data.toString().trim()));
      });
      await page.fill('input[type="text"][name*="code"]', code);
      await page.click('button[type="submit"]');
    } catch (e) {
      logger.info('No 2FA required');
    }
    
    // Navigate to inventory
    await page.waitForLoadState('networkidle');
    await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/Vehicles.aspx');
    await page.waitForLoadState('networkidle');
    
    // Click first vehicle
    logger.info('📋 Clicking first vehicle...');
    const firstVehicle = page.locator('.x-grid3-row').first().locator('a').first();
    await firstVehicle.click();
    await page.waitForTimeout(3000);
    
    // Step 2: Test Factory Equipment Navigation
    logger.info('\n📋 Step 2: Test Factory Equipment Navigation');
    const navService = new VehicleModalNavigationService(page, logger);
    
    // First ensure we're on Vehicle Info tab
    const onVehicleInfo = await navService.ensureVehicleInfoTabActive();
    logger.info(`Vehicle Info Tab Active: ${onVehicleInfo}`);
    
    // Try to click Factory Equipment
    const factoryClicked = await navService.clickFactoryEquipmentWithTabVerification();
    logger.info(`Factory Equipment Clicked: ${factoryClicked}`);
    
    if (!factoryClicked) {
      logger.error('❌ Failed to click Factory Equipment button');
      await page.screenshot({ path: 'debug-factory-equipment-failed.png' });
      return;
    }
    
    // Step 3: Test Window Sticker Access
    logger.info('\n📋 Step 3: Test Window Sticker Access');
    const accessService = new WindowStickerAccessService(page, logger);
    const accessResult = await accessService.accessWindowSticker();
    
    logger.info(`Window Sticker Access Result:`);
    logger.info(`  Success: ${accessResult.success}`);
    logger.info(`  Method: ${accessResult.method}`);
    logger.info(`  Error: ${accessResult.error || 'None'}`);
    
    if (!accessResult.success) {
      logger.error('❌ Failed to access window sticker');
      return;
    }
    
    // Step 4: Test Feature Extraction
    logger.info('\n📋 Step 4: Test Feature Extraction');
    const stickerService = new WindowStickerService();
    const extractedData = await stickerService.extractFeatures(
      accessResult.windowStickerPage || page
    );
    
    logger.info(`Extracted Features:`);
    logger.info(`  Total Features: ${extractedData.features.length}`);
    logger.info(`  Interior: ${extractedData.sections.interior.length}`);
    logger.info(`  Mechanical: ${extractedData.sections.mechanical.length}`);
    logger.info(`  Comfort: ${extractedData.sections.comfort.length}`);
    logger.info(`  Safety: ${extractedData.sections.safety.length}`);
    logger.info(`  Other: ${extractedData.sections.other.length}`);
    
    // Show sample features
    logger.info('\nSample Features (first 10):');
    extractedData.features.slice(0, 10).forEach((feature, i) => {
      logger.info(`  ${i + 1}. ${feature}`);
    });
    
    // Save debug data
    if (config.saveDebugData) {
      await fs.ensureDir('debug-data');
      await fs.writeJson('debug-data/extracted-features.json', extractedData, { spaces: 2 });
      logger.info('💾 Saved extracted features to debug-data/extracted-features.json');
    }
    
    // Step 5: Test Checkbox Detection
    logger.info('\n📋 Step 5: Test Checkbox Detection');
    
    // Close window sticker popup if open
    if (accessResult.windowStickerPage && accessResult.windowStickerPage !== page) {
      await accessResult.windowStickerPage.close();
    }
    
    // Return to main page context
    const checkboxService = new VAutoCheckboxMappingService(page, logger);
    
    // Get current checkbox states
    const checkboxStates = await checkboxService.getCheckboxStates();
    logger.info(`Found ${checkboxStates.length} checkboxes`);
    
    // Show categories
    const categories = new Set(checkboxStates.map(cb => cb.category));
    logger.info(`Categories: ${Array.from(categories).join(', ')}`);
    
    // Step 6: Test Feature-to-Checkbox Mapping
    logger.info('\n📋 Step 6: Test Feature-to-Checkbox Mapping');
    const mappingResult = await checkboxService.mapAndUpdateCheckboxes(extractedData.features);
    
    logger.info(`Mapping Results:`);
    logger.info(`  Checkboxes Found: ${mappingResult.checkboxesFound}`);
    logger.info(`  Checkboxes Updated: ${mappingResult.checkboxesUpdated}`);
    logger.info(`  Actions Performed: ${mappingResult.actions.length}`);
    
    // Show mapping details
    logger.info('\nMapping Actions (first 10):');
    mappingResult.actions.slice(0, 10).forEach((action, i) => {
      logger.info(`  ${i + 1}. ${action.feature} → ${action.label} (${action.action}, confidence: ${(action.confidence * 100).toFixed(1)}%)`);
    });
    
    // Save mapping data
    if (config.saveDebugData) {
      await fs.writeJson('debug-data/mapping-result.json', mappingResult, { spaces: 2 });
      logger.info('💾 Saved mapping result to debug-data/mapping-result.json');
    }
    
    // Step 7: Verify Updates
    logger.info('\n📋 Step 7: Verify Checkbox Updates');
    await page.screenshot({ path: 'debug-data/checkboxes-after-update.png', fullPage: true });
    logger.info('📸 Screenshot saved: debug-data/checkboxes-after-update.png');
    
    // Get updated states
    const updatedStates = await checkboxService.getCheckboxStates();
    const changedCount = updatedStates.filter((cb, i) => 
      checkboxStates[i] && cb.checked !== checkboxStates[i].checked
    ).length;
    
    logger.info(`✅ ${changedCount} checkboxes changed state`);
    
    // Test save functionality
    logger.info('\n📋 Step 8: Test Save Functionality');
    const saveSelectors = [
      '#ext-gen58',
      'button:has-text("Save")',
      'button:has-text("Save Changes")',
      'a:has-text("Save")'
    ];
    
    let saveFound = false;
    for (const selector of saveSelectors) {
      const saveButton = page.locator(selector).first();
      if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        logger.info(`✅ Found save button: ${selector}`);
        saveFound = true;
        
        // Don't actually click save in test mode
        logger.info('⚠️ Not clicking save in test mode');
        break;
      }
    }
    
    if (!saveFound) {
      logger.warn('⚠️ No save button found');
    }
    
    // Summary
    logger.info('\n📊 Test Summary:');
    logger.info(`  ✅ Factory Equipment Navigation: ${factoryClicked ? 'Success' : 'Failed'}`);
    logger.info(`  ✅ Window Sticker Access: ${accessResult.success ? 'Success' : 'Failed'}`);
    logger.info(`  ✅ Feature Extraction: ${extractedData.features.length} features`);
    logger.info(`  ✅ Checkbox Mapping: ${mappingResult.checkboxesUpdated} updated`);
    logger.info(`  ✅ Save Button: ${saveFound ? 'Found' : 'Not Found'}`);
    
    logger.info('\n✅ Window Sticker and Checkbox test complete!');
    logger.info('📁 Check debug-data/ folder for detailed results');
    
  } catch (error) {
    logger.error('❌ Test failed:', error);
    if (page) {
      await page.screenshot({ path: 'debug-data/error-screenshot.png', fullPage: true });
      logger.info('📸 Error screenshot saved');
    }
  } finally {
    if (browser) {
      logger.info('\n⏸️ Press Enter to close browser...');
      await new Promise(resolve => process.stdin.once('data', resolve));
      await browser.close();
    }
  }
}

// Run test
testWindowStickerAndCheckboxes().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});