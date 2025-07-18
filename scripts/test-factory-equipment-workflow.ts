import { chromium } from 'playwright';
import { VAutoAgent } from '../platforms/vauto/VAutoAgent';
import { EnhancedWindowStickerService } from '../platforms/vauto/services/WindowStickerService';
import { Logger } from '../core/utils/Logger';
import { reliableClick, waitForLoadingToComplete } from '../core/utils/reliabilityUtils';
import { vAutoSelectors } from '../platforms/vauto/vautoSelectors';
import * as dotenv from 'dotenv';

dotenv.config();

const logger = new Logger('FactoryEquipmentTest');

async function testFactoryEquipmentWorkflow() {
  logger.info('Starting Factory Equipment workflow test...');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    
    // Test 1: Navigate to a vehicle detail page (assuming we're already logged in)
    logger.info('Test 1: Navigating to vehicle detail page...');
    // This would normally be done through the full workflow
    // For testing, you might navigate directly to a known vehicle URL
    
    // Test 2: Click Factory Equipment tab
    logger.info('Test 2: Clicking Factory Equipment tab...');
    await reliableClick(page, vAutoSelectors.vehicleDetails.factoryEquipmentTab, 'Factory Equipment Tab');
    await page.waitForTimeout(2000);
    
    // Test 3: Extract window sticker content
    logger.info('Test 3: Extracting window sticker content...');
    const windowStickerService = new EnhancedWindowStickerService(page);
    
    try {
      const stickerContent = await windowStickerService.extractFromPopup();
      
      logger.info('Window Sticker Content Extracted:');
      logger.info(`- Total features: ${stickerContent.allFeatures.length}`);
      logger.info(`- Interior features: ${stickerContent.sections.interior.length}`);
      logger.info(`- Comfort & Convenience: ${stickerContent.sections.comfortConvenience.length}`);
      logger.info(`- Mechanical features: ${stickerContent.sections.mechanical.length}`);
      logger.info(`- Priced options: ${stickerContent.pricedOptions.size}`);
      
      // Log some sample features
      logger.info('\nSample features found:');
      stickerContent.allFeatures.slice(0, 10).forEach(feature => {
        logger.info(`  - ${feature}`);
      });
      
      // Log priced options
      if (stickerContent.pricedOptions.size > 0) {
        logger.info('\nPriced options:');
        stickerContent.pricedOptions.forEach((price, feature) => {
          logger.info(`  - ${feature}: $${price}`);
        });
      }
      
      // Test 4: Close popup and navigate to Description page
      logger.info('\nTest 4: Closing popup and navigating to Description page...');
      await windowStickerService.closePopup();
      await page.waitForTimeout(1000);
      
      await reliableClick(page, vAutoSelectors.vehicleDetails.editDescriptionButton, 'Edit Description Button');
      await waitForLoadingToComplete(page, Object.values(vAutoSelectors.loading));
      
      // Test 5: Verify checkbox container is visible
      logger.info('Test 5: Verifying checkbox container...');
      const containerVisible = await page.isVisible(vAutoSelectors.vehicleDetails.descriptionContainer);
      logger.info(`Checkbox container visible: ${containerVisible}`);
      
      // Test 6: Count total checkboxes (ExtJS uses image-based checkboxes)
      const checkboxImages = await page.$$('img[src*="pixel.gif"], img[src*="checkbox"], img[id*="checkbox"]');
      const extjsCheckboxes = await page.$$('[id*="ext-va-feature-checkbox-"] img, div[id*="checkbox"] img');
      logger.info(`Total checkbox images found: ${checkboxImages.length}`);
      logger.info(`ExtJS specific checkboxes found: ${extjsCheckboxes.length}`);
      
      // Test 7: Test checkbox label extraction
      logger.info('\nTest 7: Testing checkbox label extraction...');
      const sampleLabels: string[] = [];
      const allCheckboxes = [...checkboxImages, ...extjsCheckboxes];
      
      // Get unique checkboxes by parent ID
      const uniqueCheckboxes = new Map<string, any>();
      for (const checkbox of allCheckboxes) {
        const parentId = await checkbox.evaluate((el: HTMLElement) => {
          const parent = el.closest('[id]');
          return parent?.id || '';
        });
        if (parentId && !uniqueCheckboxes.has(parentId)) {
          uniqueCheckboxes.set(parentId, checkbox);
        }
      }
      
      logger.info(`Found ${uniqueCheckboxes.size} unique checkboxes`);
      
      let count = 0;
      for (const [parentId, checkbox] of uniqueCheckboxes) {
        if (count >= 5) break;
        const label = await getExtJSCheckboxLabel(page, checkbox);
        if (label) {
          sampleLabels.push(label);
          logger.info(`  Checkbox ${count + 1} (${parentId}): "${label}"`);
          count++;
        }
      }
      
      // Test 8: Test feature mapping
      logger.info('\nTest 8: Testing feature mapping...');
      const testFeatures = ['Heated Seats', 'Navigation', 'Sunroof', 'Leather Seats', 'Backup Camera'];
      for (const feature of testFeatures) {
        const matchingCheckbox = sampleLabels.find(label => 
          label.toLowerCase().includes(feature.toLowerCase()) ||
          feature.toLowerCase().includes(label.toLowerCase())
        );
        logger.info(`  Feature "${feature}" maps to: ${matchingCheckbox || 'No match found'}`);
      }
      
      // Test 9: Test checkbox state detection
      logger.info('\nTest 9: Testing checkbox state detection...');
      for (const [parentId, checkbox] of Array.from(uniqueCheckboxes).slice(0, 3)) {
        const isChecked = await isExtJSCheckboxChecked(page, checkbox);
        logger.info(`  Checkbox ${parentId} is ${isChecked ? 'checked' : 'unchecked'}`);
      }

      logger.info('\n✅ Factory Equipment workflow test completed successfully!');
      
    } catch (error) {
      logger.error('Test failed:', error);
      
      // Take screenshot for debugging
      await page.screenshot({ 
        path: `screenshots/factory-equipment-test-error-${Date.now()}.png`,
        fullPage: true 
      });
    }
    
  } finally {
    await browser.close();
  }
}

async function getCheckboxLabel(page: any, checkboxElement: any): Promise<string> {
  try {
    // Try various strategies to get the label
    const id = await checkboxElement.getAttribute('id');
    if (id) {
      const labelElement = await page.$(`label[for="${id}"]`);
      if (labelElement) {
        const text = await labelElement.textContent();
        if (text) return text.trim();
      }
    }
    
    // Check parent element
    const parentText = await checkboxElement.evaluate((el: HTMLElement) => {
      const parent = el.parentElement;
      return parent?.textContent?.trim() || '';
    });
    
    return parentText;
  } catch (error) {
    return '';
  }
}

async function getExtJSCheckboxLabel(page: any, checkboxImg: any): Promise<string> {
  try {
    const labelText = await checkboxImg.evaluate((img: HTMLElement) => {
      // Check parent TD's next sibling TD
      const parentTd = img.closest('td');
      if (parentTd && parentTd.nextElementSibling) {
        const text = parentTd.nextElementSibling.textContent?.trim();
        if (text) return text;
      }
      
      // Check parent div's text content
      const parentDiv = img.closest('div[id]');
      if (parentDiv) {
        const clone = parentDiv.cloneNode(true) as HTMLElement;
        const imgs = clone.querySelectorAll('img');
        imgs.forEach(i => i.remove());
        const text = clone.textContent?.trim();
        if (text) return text;
      }
      
      // Look for label in parent row
      const parentRow = img.closest('tr');
      if (parentRow) {
        const cells = parentRow.querySelectorAll('td');
        for (const cell of Array.from(cells)) {
          const text = cell.textContent?.trim();
          if (text && text.length > 2 && !cell.contains(img)) {
            return text;
          }
        }
      }
      
      return '';
    });
    
    return labelText || '';
  } catch (error) {
    return '';
  }
}

async function isExtJSCheckboxChecked(page: any, checkboxImg: any): Promise<boolean> {
  try {
    const imgSrc = await checkboxImg.getAttribute('src');
    const imgClass = await checkboxImg.getAttribute('class');
    const parentClass = await checkboxImg.evaluate((img: HTMLElement) => 
      img.parentElement?.className || ''
    );
    
    const checkedPatterns = ['checked', 'true', 'selected', 'x-grid3-check-col-on'];
    const srcAndClasses = `${imgSrc} ${imgClass} ${parentClass}`.toLowerCase();
    
    return checkedPatterns.some(pattern => srcAndClasses.includes(pattern));
  } catch (error) {
    return false;
  }
}

// Run the test
if (require.main === module) {
  testFactoryEquipmentWorkflow()
    .then(() => {
      logger.info('Test completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Test failed:', error);
      process.exit(1);
    });
} 