import { chromium } from 'playwright';
import { Logger } from '../core/utils/Logger';

const logger = new Logger('FactoryButtonExactTest');

async function testExactFactoryButton() {
  try {
    logger.info('🔌 Connecting to existing browser at http://localhost:9222...');
    
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const contexts = browser.contexts();
    
    if (contexts.length === 0) {
      logger.error('❌ No browser contexts found');
      return;
    }
    
    const page = contexts[0].pages()[0];
    logger.info(`✅ Connected to page: ${await page.title()}`);
    logger.info(`📍 Current URL: ${page.url()}`);
    
    // Check if we're on a vehicle details page
    if (!page.url().includes('vehicle_id=')) {
      logger.error('❌ Not on a vehicle details page');
      return;
    }
    
    // THE EXACT APPROACH - Direct and Simple
    logger.info('\n🎯 USING EXACT SELECTOR PROVIDED BY USER');
    logger.info('Selector: button#ext-gen199');
    
    try {
      // Wait for iframe
      logger.info('1️⃣ Waiting for GaugePageIFrame...');
      await page.waitForSelector('#GaugePageIFrame', { state: 'visible', timeout: 10000 });
      logger.info('✅ iframe found');
      
      const iframe = page.frameLocator('#GaugePageIFrame');
      
      // Try to find the button with exact ID
      logger.info('2️⃣ Looking for button with id="ext-gen199"...');
      
      const button = iframe.locator('#ext-gen199');
      
      // Check if button exists and is visible
      const exists = await button.count() > 0;
      logger.info(`   Button exists: ${exists}`);
      
      if (exists) {
        const isVisible = await button.isVisible();
        logger.info(`   Button visible: ${isVisible}`);
        
        const text = await button.textContent();
        logger.info(`   Button text: "${text}"`);
        
        const classes = await button.getAttribute('class');
        logger.info(`   Button classes: ${classes}`);
        
        if (isVisible) {
          logger.info('\n3️⃣ CLICKING THE BUTTON...');
          
          // Store page count before click
          const pagesBefore = page.context().pages().length;
          logger.info(`   Pages before click: ${pagesBefore}`);
          
          // Click the button
          await button.click();
          logger.info('✅ BUTTON CLICKED!');
          
          // Wait for response
          await page.waitForTimeout(3000);
          
          // Check if new window opened
          const pagesAfter = page.context().pages().length;
          logger.info(`   Pages after click: ${pagesAfter}`);
          
          if (pagesAfter > pagesBefore) {
            logger.info('🎉 NEW WINDOW OPENED - SUCCESS!');
            
            // Find the new window
            const allPages = page.context().pages();
            for (const p of allPages) {
              const title = await p.title();
              const url = p.url();
              logger.info(`   Window: "${title}" - ${url}`);
              
              if (title.includes('factory-equipment-details')) {
                logger.info('✅ Found factory-equipment-details window!');
              }
            }
          } else {
            logger.info('⚠️ No new window detected');
            
            // Check if content changed in iframe
            logger.info('Checking for content changes...');
            const contentAfter = await iframe.locator('body').textContent();
            if (contentAfter?.includes('Standard Equipment') || contentAfter?.includes('Optional Equipment')) {
              logger.info('✅ Factory Equipment content loaded in iframe!');
            }
          }
          
        } else {
          logger.error('❌ Button exists but is not visible');
        }
      } else {
        logger.error('❌ Button with id="ext-gen199" not found');
        
        // Debug: List all buttons in iframe
        logger.info('\n🔍 Debugging - Looking for all buttons in iframe...');
        const allButtons = await iframe.locator('button').all();
        logger.info(`Found ${allButtons.length} buttons in iframe:`);
        
        for (let i = 0; i < Math.min(10, allButtons.length); i++) {
          const btn = allButtons[i];
          const id = await btn.getAttribute('id');
          const text = await btn.textContent();
          const classes = await btn.getAttribute('class');
          logger.info(`   Button ${i + 1}: id="${id}", text="${text}", class="${classes}"`);
        }
      }
      
    } catch (error) {
      logger.error('❌ Error:', error);
    }
    
    logger.info('\n✅ Test complete');
    
  } catch (error) {
    logger.error('❌ Connection error:', error);
  }
}

// Run the test
testExactFactoryButton();