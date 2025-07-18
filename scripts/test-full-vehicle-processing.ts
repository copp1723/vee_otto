import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { clickFactoryEquipment } from '../fix-factory-equipment-click';
import { WindowStickerService } from '../core/services/WindowStickerService';
import { CheckboxMappingService } from '../core/services/CheckboxMappingService';

const SESSION_DIR = path.join(process.cwd(), 'session');
const BROWSER_ENDPOINT_FILE = path.join(SESSION_DIR, 'browser-ws-endpoint.txt');

// Simple logger
const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  debug: (msg: string, ...args: any[]) => console.log(`[DEBUG] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args)
};

interface ProcessingResult {
  success: boolean;
  vehicleInfo?: {
    vin?: string;
    year?: string;
    make?: string;
    model?: string;
  };
  features?: any[];
  checkboxesUpdated?: number;
  error?: string;
}

async function ensureVehicleInfoTab(page: Page): Promise<boolean> {
  logger.info('🔍 Ensuring Vehicle Info tab is active...');
  
  try {
    // Check if we're already on Vehicle Info tab
    const activeTab = await page.locator('.x-tab-strip-active').textContent();
    if (activeTab?.includes('Vehicle Info')) {
      logger.info('✅ Already on Vehicle Info tab');
      return true;
    }

    // Try multiple selectors for Vehicle Info tab
    const tabSelectors = [
      'text="Vehicle Info"',
      '//span[contains(text(), "Vehicle Info")]',
      '//a[contains(@class, "x-tab")]//span[text()="Vehicle Info"]',
      '//div[contains(@class, "x-tab")]//span[contains(text(), "Vehicle Info")]'
    ];

    for (const selector of tabSelectors) {
      try {
        const tab = page.locator(selector).first();
        if (await tab.isVisible({ timeout: 2000 })) {
          await tab.click();
          logger.info(`✅ Clicked Vehicle Info tab using selector: ${selector}`);
          await page.waitForTimeout(2000);
          return true;
        }
      } catch (e) {
        continue;
      }
    }

    logger.error('❌ Could not find Vehicle Info tab');
    return false;
  } catch (error) {
    logger.error('Error ensuring Vehicle Info tab:', error);
    return false;
  }
}

async function extractVehicleInfo(page: Page): Promise<any> {
  try {
    const vehicleInfo: any = {};
    
    // Try to extract VIN, year, make, model
    const infoSelectors = {
      vin: ['#vin', '.vin-value', '//span[contains(@class, "vin")]'],
      year: ['#year', '.year-value', '//span[contains(@class, "year")]'],
      make: ['#make', '.make-value', '//span[contains(@class, "make")]'],
      model: ['#model', '.model-value', '//span[contains(@class, "model")]']
    };

    for (const [key, selectors] of Object.entries(infoSelectors)) {
      for (const selector of selectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 1000 })) {
            vehicleInfo[key] = await element.textContent();
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    return vehicleInfo;
  } catch (error) {
    logger.error('Error extracting vehicle information:', error);
    return {};
  }
}

async function extractWindowStickerContent(page: Page): Promise<{ content: string; features: any[] }> {
  const windowStickerService = new WindowStickerService();
  
  try {
    // Get text content
    const textContent = await page.evaluate(() => {
      return document.body?.innerText || '';
    });

    if (textContent.length > 100) {
      // Parse features
      const result = await windowStickerService.parseWindowSticker(textContent);
      return {
        content: textContent,
        features: result.features
      };
    }
  } catch (error) {
    logger.error('Error extracting window sticker content:', error);
  }

  return { content: '', features: [] };
}

async function updateCheckboxes(page: Page, features: any[]): Promise<number> {
  const checkboxMappingService = new CheckboxMappingService();
  let updatedCount = 0;

  try {
    logger.info('📋 Looking for checkboxes to update...');
    
    // Find all checkboxes on the page
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    logger.info(`Found ${checkboxes.length} checkboxes on the page`);

    // Get checkbox labels
    const checkboxData = [];
    for (const checkbox of checkboxes) {
      try {
        const id = await checkbox.getAttribute('id');
        const name = await checkbox.getAttribute('name');
        const checked = await checkbox.isChecked();
        
        // Try to find associated label
        let label = '';
        if (id) {
          const labelElement = page.locator(`label[for="${id}"]`).first();
          if (await labelElement.isVisible({ timeout: 500 })) {
            label = await labelElement.textContent() || '';
          }
        }
        
        // If no label found, try parent text
        if (!label) {
          const parent = checkbox.locator('..');
          label = await parent.textContent() || '';
        }

        checkboxData.push({ checkbox, id, name, label: label.trim(), checked });
      } catch (e) {
        continue;
      }
    }

    // Map features to checkboxes
    for (const feature of features) {
      const mapping = await checkboxMappingService.mapFeatureToCheckbox(
        feature.name,
        checkboxData.map(d => ({ label: d.label, checked: d.checked }))
      );

      if (mapping.confidence > 0.7) {
        const checkboxItem = checkboxData.find(d => d.label === mapping.checkboxLabel);
        if (checkboxItem && !checkboxItem.checked) {
          await checkboxItem.checkbox.click();
          updatedCount++;
          logger.info(`✅ Checked: ${checkboxItem.label} (matched to: ${feature.name})`);
          await page.waitForTimeout(500); // Small delay between updates
        }
      }
    }

    // Click save button if updates were made
    if (updatedCount > 0) {
      logger.info('💾 Looking for save button...');
      const saveSelectors = [
        'button:has-text("Save")',
        'input[type="submit"][value="Save"]',
        '//button[contains(text(), "Save")]',
        '#save-button',
        '.save-btn'
      ];

      for (const selector of saveSelectors) {
        try {
          const saveButton = page.locator(selector).first();
          if (await saveButton.isVisible({ timeout: 2000 })) {
            await saveButton.click();
            logger.info('✅ Clicked save button');
            await page.waitForTimeout(2000);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

  } catch (error) {
    logger.error('Error updating checkboxes:', error);
  }

  return updatedCount;
}

async function processVehicle(page: Page): Promise<ProcessingResult> {
  const result: ProcessingResult = { success: false };

  try {
    // Step 1: Extract vehicle information
    logger.info('\n📊 Extracting vehicle information...');
    result.vehicleInfo = await extractVehicleInfo(page);
    if (result.vehicleInfo.vin) {
      logger.info(`Vehicle: ${result.vehicleInfo.year} ${result.vehicleInfo.make} ${result.vehicleInfo.model}`);
      logger.info(`VIN: ${result.vehicleInfo.vin}`);
    }

    // Step 2: Ensure Vehicle Info tab is active
    const tabSuccess = await ensureVehicleInfoTab(page);
    if (!tabSuccess) {
      throw new Error('Failed to navigate to Vehicle Info tab');
    }

    // Step 3: Click Factory Equipment
    logger.info('\n🏭 Clicking Factory Equipment...');
    const clickSuccess = await clickFactoryEquipment(page, logger);
    
    if (!clickSuccess) {
      throw new Error('Failed to click Factory Equipment button');
    }

    // Wait for content to load
    await page.waitForTimeout(3000);

    // Step 4: Check for popup window
    const browser = page.context().browser();
    if (browser) {
      const popup = await checkForPopupWindow(browser);
      if (popup) {
        logger.info('✅ Found window sticker in popup window');
        const { content, features } = await extractWindowStickerContent(popup);
        result.features = features;
        await popup.close(); // Close popup after extracting content
      } else {
        // Extract from inline content
        logger.info('🔍 Extracting inline window sticker content...');
        const { content, features } = await extractWindowStickerContent(page);
        result.features = features;
      }
    }

    if (!result.features || result.features.length === 0) {
      throw new Error('No features extracted from window sticker');
    }

    logger.info(`\n🎯 Extracted ${result.features.length} features`);
    result.features.slice(0, 5).forEach(feature => {
      logger.info(`  - ${feature.name} (${feature.category})`);
    });

    // Step 5: Update checkboxes
    logger.info('\n📝 Updating vehicle attributes...');
    result.checkboxesUpdated = await updateCheckboxes(page, result.features);
    logger.info(`✅ Updated ${result.checkboxesUpdated} checkboxes`);

    result.success = true;

  } catch (error: any) {
    result.error = error.message;
    logger.error('❌ Processing failed:', error);
  }

  return result;
}

async function checkForPopupWindow(browser: Browser): Promise<Page | null> {
  const contexts = browser.contexts();
  const allPages = contexts.flatMap(context => context.pages());
  
  for (const page of allPages) {
    const title = await page.title();
    const url = page.url();
    if (title.includes('factory-equipment-details') || 
        url.includes('factory-equipment') ||
        title.includes('Window Sticker') ||
        title.includes('Equipment')) {
      return page;
    }
  }
  
  return null;
}

async function testFullVehicleProcessing() {
  console.log('🚗 vAuto Full Vehicle Processing Test\n');

  // Check if browser endpoint file exists
  if (!fs.existsSync(BROWSER_ENDPOINT_FILE)) {
    console.error('❌ No browser session found!');
    console.error('Please run "npm run vauto:session" first\n');
    process.exit(1);
  }

  try {
    // Read WebSocket endpoint
    const wsEndpoint = fs.readFileSync(BROWSER_ENDPOINT_FILE, 'utf-8').trim();
    console.log('🔌 Connecting to existing browser session...');

    // Connect to existing browser
    const browser = await chromium.connect(wsEndpoint);
    console.log('✅ Connected to browser session');

    // Get all pages
    const contexts = browser.contexts();
    const pages = contexts.flatMap(context => context.pages());
    
    if (pages.length === 0) {
      throw new Error('No pages found in browser session');
    }

    // Find the vAuto page
    let vAutoPage: Page | null = null;
    for (const page of pages) {
      const url = page.url();
      if (url.includes('vauto.app.coxautoinc.com')) {
        vAutoPage = page;
        break;
      }
    }

    if (!vAutoPage) {
      throw new Error('Could not find vAuto page. Please make sure you have vAuto open.');
    }

    console.log('✅ Found vAuto page:', vAutoPage.url());

    // Process the vehicle
    const result = await processVehicle(vAutoPage);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 PROCESSING SUMMARY');
    console.log('='.repeat(60));
    console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (result.vehicleInfo?.vin) {
      console.log(`Vehicle: ${result.vehicleInfo.year} ${result.vehicleInfo.make} ${result.vehicleInfo.model}`);
      console.log(`VIN: ${result.vehicleInfo.vin}`);
    }
    console.log(`Features Extracted: ${result.features?.length || 0}`);
    console.log(`Checkboxes Updated: ${result.checkboxesUpdated || 0}`);
    if (result.error) {
      console.log(`Error: ${result.error}`);
    }
    console.log('='.repeat(60));

    // Save result to file
    const reportDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(reportDir, `vehicle-processing-${timestamp}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(result, null, 2));
    console.log(`\n📄 Report saved to: ${reportFile}`);

    console.log('\n✅ Test complete. Browser session remains active.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testFullVehicleProcessing();