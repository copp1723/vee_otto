#!/usr/bin/env ts-node

import { chromium } from 'playwright';
import { WindowStickerAccessService } from '../core/services/WindowStickerAccessService';
import { WindowStickerService } from '../core/services/WindowStickerService';
import { VAutoCheckboxMappingService } from '../core/services/VAutoCheckboxMappingService';
import { Logger } from '../core/utils/Logger';

async function debugCheckboxChecking() {
  const logger = new Logger('Checkbox-Debug');
  logger.info('🔍 Starting FULLY AUTOMATED Factory Equipment Checkbox Workflow Debug Session...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 2000
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    
    logger.info('📍 Please:');
    logger.info('1. Login to VAuto');
    logger.info('2. Navigate to a specific vehicle details page');
    logger.info('3. Ensure you are on the Factory Equipment tab or main vehicle page');
    logger.info('4. Press Enter to continue...');
    
    await new Promise(resolve => process.stdin.once('data', resolve));
    
    // 1. Extract factory equipment features from window sticker
    logger.info('🧪 Attempting to extract window sticker features...');
    const accessService = new WindowStickerAccessService(page, logger);
    const windowStickerService = new WindowStickerService();

    const accessResult = await accessService.accessWindowSticker();
    if (!accessResult.success || !accessResult.content) {
      logger.error(`❌ Failed to access window sticker: ${accessResult.error}`);
      return;
    }
    logger.info(`✅ Window sticker accessed using method: ${accessResult.method}`);

    // 2. Parse features from the window sticker
    logger.info('📋 Parsing features from window sticker...');
    const extractedData = await windowStickerService.extractFeatures(
      accessResult.windowStickerPage || page
    );
    logger.info(`✅ Extracted ${extractedData.features.length} features`);
    if (extractedData.features.length === 0) {
      logger.error('❌ No features extracted from window sticker');
      return;
    }
    logger.info('Sample features:');
    extractedData.features.slice(0, 10).forEach((feature, i) => {
      logger.info(`   ${i + 1}. ${feature}`);
    });

    // 3. Map features to checkboxes and update them
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

    // 4. Save the changes
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
    logger.error('❌ Debug session failed:', error);
  } finally {
    await browser.close();
  }
}

// Run debug if called directly
if (require.main === module) {
  debugCheckboxChecking().catch(console.error);
}

export { debugCheckboxChecking };