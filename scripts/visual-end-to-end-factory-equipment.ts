#!/usr/bin/env ts-node

import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import { WindowStickerAccessService } from '../core/services/WindowStickerAccessService';
import { WindowStickerService } from '../core/services/WindowStickerService';
import { VAutoCheckboxMappingService } from '../core/services/VAutoCheckboxMappingService';
import { Logger } from '../core/utils/Logger';

dotenv.config();

const VAUTO_USERNAME = process.env.VAUTO_USERNAME || '';
const VAUTO_PASSWORD = process.env.VAUTO_PASSWORD || '';

async function visualEndToEndFactoryEquipment() {
  const logger = new Logger('Visual-E2E');
  logger.info('🚦 Starting FULLY AUTOMATED End-to-End Factory Equipment Workflow...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 1200
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    // 1. Go to login page
    logger.info('🔑 Navigating to VAuto login page...');
    await page.goto('https://login.vauto.com/');

    // 2. Enter username and password
    logger.info('🔑 Entering credentials...');
    await page.fill('input[name="username"], input[type="email"]', VAUTO_USERNAME);
    await page.fill('input[name="password"], input[type="password"]', VAUTO_PASSWORD);
    await page.click('button[type="submit"], input[type="submit"]');

    // 3. Handle 2FA
    logger.info('🔐 Waiting for 2FA prompt...');
    await page.waitForSelector('input[type="text"][name*="code"], input[type="text"][aria-label*="code"]', { timeout: 60000 });
    logger.info('🔐 Please enter your 2FA code in the terminal:');
    process.stdout.write('2FA Code: ');
    const code = await new Promise<string>(resolve => {
      process.stdin.once('data', data => resolve(data.toString().trim()));
    });
    await page.fill('input[type="text"][name*="code"], input[type="text"][aria-label*="code"]', code);
    await page.click('button[type="submit"], input[type="submit"]');
    logger.info('🔓 2FA submitted, waiting for dashboard...');

    // 4. Wait for inventory/dashboard
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 });
    logger.info('📦 Navigating to Inventory...');
    await page.goto('https://app.vauto.com/Inventory/');

    // 5. Click first vehicle in inventory
    logger.info('🚗 Selecting first vehicle in inventory...');
    await page.waitForSelector('tr.x-grid3-row a', { timeout: 30000 });
    const vehicleLink = await page.locator('tr.x-grid3-row a').first();
    await vehicleLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 6. Navigate to Vehicle Info tab
    logger.info('🗂️ Navigating to Vehicle Info tab...');
    const infoTab = page.locator('a:has-text("Vehicle Info"), button:has-text("Vehicle Info")').first();
    if (await infoTab.isVisible().catch(() => false)) {
      await infoTab.click();
      await page.waitForTimeout(1500);
    }

    // 7. Click Factory Equipment tab
    logger.info('🏭 Clicking Factory Equipment tab...');
    const factoryTab = page.locator('a:has-text("Factory Equipment"), button:has-text("Factory Equipment"), #ext-gen201').first();
    if (await factoryTab.isVisible().catch(() => false)) {
      await factoryTab.click();
      await page.waitForTimeout(2000);
    }

    // 8. Extract features from window sticker
    logger.info('🧾 Extracting window sticker features...');
    const accessService = new WindowStickerAccessService(page, logger);
    const windowStickerService = new WindowStickerService();
    const accessResult = await accessService.accessWindowSticker();
    if (!accessResult.success || !accessResult.content) {
      logger.error(`❌ Failed to access window sticker: ${accessResult.error}`);
      return;
    }
    logger.info(`✅ Window sticker accessed using method: ${accessResult.method}`);
    const extractedData = await windowStickerService.extractFeatures(accessResult.windowStickerPage || page);
    logger.info(`✅ Extracted ${extractedData.features.length} features`);
    if (extractedData.features.length === 0) {
      logger.error('❌ No features extracted from window sticker');
      return;
    }
    logger.info('Sample features:');
    extractedData.features.slice(0, 10).forEach((feature, i) => {
      logger.info(`   ${i + 1}. ${feature}`);
    });

    // 9. Map features to checkboxes and update
    logger.info('🔄 Mapping features to checkboxes and updating...');
    const checkboxService = new VAutoCheckboxMappingService(page, logger);
    const result = await checkboxService.mapAndUpdateCheckboxes(extractedData.features);
    logger.info(`📊 Checkbox workflow: ${result.checkboxesFound} checkboxes found, ${result.checkboxesUpdated} updated`);
    if (result.checkboxesFound === 0) {
      logger.error('❌ No checkboxes found - cannot update');
      return;
    }
    logger.info('Checkbox actions performed:');
    result.actions.forEach((action, index) => {
      logger.info(`   ${index + 1}. ${action.label} - ${action.action} (confidence: ${Math.round(action.confidence * 100)}%)`);
    });

    // 10. Save the changes
    logger.info('💾 Attempting to save changes...');
    const saveButton = page.locator('#ext-gen58').first();
    if (await saveButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      logger.info('✅ Changes saved successfully');
    } else {
      logger.warn('⚠️ Save button not found with selector #ext-gen58');
      // Try alternative selectors
      const saveSelectors = [
        'button:has-text("Save")',
        'button:has-text("Save Changes")',
        'a:has-text("Save")',
        'input[value*="Save"]',
        'div:has-text("Save")'
      ];
      let found = false;
      for (const selector of saveSelectors) {
        const button = page.locator(selector).first();
        if (await button.isVisible().catch(() => false)) {
          await button.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);
          logger.info(`✅ Changes saved using selector: ${selector}`);
          found = true;
          break;
        }
      }
      if (!found) {
        logger.error('❌ No save button found, changes may not be persisted');
      }
    }

    logger.info('👀 Please visually confirm in the browser that checkboxes were checked/unchecked and changes were saved.');
    logger.info('⏸️ Press Enter to close the browser...');
    await new Promise(resolve => process.stdin.once('data', resolve));

  } catch (error) {
    logger.error('❌ Visual E2E session failed:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  visualEndToEndFactoryEquipment().catch(console.error);
}

export { visualEndToEndFactoryEquipment };