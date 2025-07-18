import { chromium } from 'playwright';
import { Logger } from './core/utils/Logger';
import { clickFactoryEquipment } from './fix-factory-equipment-click';

async function testFactoryEquipmentClick() {
  const logger = new Logger('TestFactoryEquipment');
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 
  });
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    logger.info('💡 Test Factory Equipment clicking');
    logger.info('1. Navigate to vAuto and login');
    logger.info('2. Go to a vehicle details page');
    logger.info('3. Once on vehicle details, press Enter to test clicking Factory Equipment...');
    
    // Wait for user to set up
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
    // Take before screenshot
    await page.screenshot({ path: 'screenshots/test-factory-before.png', fullPage: true });
    
    // Test the click function
    const success = await clickFactoryEquipment(page, logger);
    
    if (success) {
      logger.info('✅ Factory Equipment click successful!');
      
      // Wait a bit for any navigation/popup
      await page.waitForTimeout(3000);
      
      // Check for new windows
      const pages = context.pages();
      logger.info(`Found ${pages.length} pages after click`);
      
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        const title = await p.title();
        const url = p.url();
        logger.info(`Page ${i}: title="${title}", url="${url.substring(0, 50)}..."`);
        
        // Check if this is the factory equipment window
        if (title === 'factory-equipment-details' || url.includes('factory') || url.includes('sticker')) {
          logger.info('🎯 Found factory equipment window!');
          await p.screenshot({ path: `screenshots/test-factory-window-${i}.png`, fullPage: true });
        }
      }
      
      // Take after screenshot
      await page.screenshot({ path: 'screenshots/test-factory-after.png', fullPage: true });
      
    } else {
      logger.error('❌ Factory Equipment click failed');
      
      // Debug info
      logger.info('\n🔍 Debugging info:');
      
      // List all tabs
      const tabs = await page.locator('//a[contains(@class, "x-tab")] | //span[contains(@class, "x-tab")]').all();
      logger.info(`Found ${tabs.length} tabs:`);
      for (let i = 0; i < tabs.length; i++) {
        const text = await tabs[i].textContent();
        logger.info(`  Tab ${i}: "${text?.trim()}"`);
      }
      
      // Check for iframes
      const iframes = await page.locator('iframe').all();
      logger.info(`\nFound ${iframes.length} iframes:`);
      for (let i = 0; i < iframes.length; i++) {
        const id = await iframes[i].getAttribute('id');
        logger.info(`  Iframe ${i}: id="${id}"`);
      }
    }
    
    logger.info('\nPress Enter to close...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
  } catch (error) {
    logger.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Enable stdin
process.stdin.resume();
process.stdin.setEncoding('utf8');

// Run test
testFactoryEquipmentClick().catch(console.error); 