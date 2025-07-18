import { chromium, Browser, Page } from 'playwright';
import { Logger } from './core/utils/Logger';

async function debugFactoryEquipmentClick() {
  const logger = new Logger('DebugFactoryEquipment');
  let browser: Browser | null = null;
  
  try {
    logger.info('🔍 Starting Factory Equipment click debug...');
    
    // Launch browser in visible mode
    browser = await chromium.launch({
      headless: false,
      slowMo: 1000, // Slow down actions to see what's happening
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    const page = await context.newPage();
    
    logger.info('💡 INSTRUCTIONS:');
    logger.info('1. Navigate to a vehicle details page manually');
    logger.info('2. Press Enter to continue when ready...');
    
    // Wait for user to navigate
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
    logger.info('📸 Taking screenshot of current state...');
    await page.screenshot({ path: 'screenshots/debug-factory-equipment-before.png', fullPage: true });
    
    // Log all visible tabs
    logger.info('🔍 Looking for all tabs...');
    const allTabs = await page.locator('//a[contains(@class, "x-tab")] | //div[contains(@class, "x-tab")] | //span[contains(@class, "x-tab")]').all();
    logger.info(`Found ${allTabs.length} tabs`);
    
    for (let i = 0; i < allTabs.length; i++) {
      const tabText = await allTabs[i].textContent();
      logger.info(`Tab ${i}: "${tabText?.trim()}"`);
    }
    
    // Try to find Factory Equipment with multiple strategies
    logger.info('🏭 Attempting to find Factory Equipment tab...');
    
    const strategies = [
      {
        name: 'ExtJS ID #ext-gen175',
        selector: '#ext-gen175',
        type: 'css'
      },
      {
        name: 'ExtJS ID #ext-gen201',
        selector: '#ext-gen201',
        type: 'css'
      },
      {
        name: 'Text selector',
        selector: 'text=Factory Equipment',
        type: 'text'
      },
      {
        name: 'Contains text XPath',
        selector: '//a[contains(., "Factory Equipment")] | //div[contains(., "Factory Equipment")] | //span[contains(., "Factory Equipment")]',
        type: 'xpath'
      },
      {
        name: 'Tab class with text',
        selector: '//div[contains(@class, "x-tab") and contains(., "Factory Equipment")]',
        type: 'xpath'
      },
      {
        name: 'Any element with Factory Equipment text',
        selector: '//*[contains(text(), "Factory Equipment")]',
        type: 'xpath'  
      }
    ];
    
    let found = false;
    
    for (const strategy of strategies) {
      logger.info(`\n🔧 Trying strategy: ${strategy.name}`);
      logger.info(`   Selector: ${strategy.selector}`);
      
      try {
        const elements = await page.locator(strategy.selector).all();
        logger.info(`   Found ${elements.length} matching elements`);
        
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          const isVisible = await element.isVisible();
          const text = await element.textContent();
          const tagName = await element.evaluate(el => el.tagName);
          const className = await element.getAttribute('class');
          const id = await element.getAttribute('id');
          
          logger.info(`   Element ${i}:`);
          logger.info(`     - Visible: ${isVisible}`);
          logger.info(`     - Text: "${text?.trim()}"`);
          logger.info(`     - Tag: ${tagName}`);
          logger.info(`     - Class: ${className}`);
          logger.info(`     - ID: ${id}`);
          
          if (isVisible) {
            // Highlight the element
            await page.evaluate(el => {
              if (el) {
                el.style.border = '3px solid red';
                el.style.backgroundColor = 'yellow';
              }
            }, await element.elementHandle());
            
            await page.waitForTimeout(2000);
            
            logger.info(`   ✅ This looks like the Factory Equipment tab!`);
            logger.info(`   Press Enter to click it, or 'n' to try next...`);
            
            const response = await new Promise<string>(resolve => {
              process.stdin.once('data', data => resolve(data.toString().trim()));
            });
            
            if (response !== 'n') {
              logger.info('   🖱️ Clicking the element...');
              await element.click();
              found = true;
              
              await page.waitForTimeout(3000);
              await page.screenshot({ path: 'screenshots/debug-factory-equipment-after-click.png', fullPage: true });
              
              // Check for new windows
              const pages = context.pages();
              logger.info(`\n📄 Context now has ${pages.length} pages:`);
              for (let j = 0; j < pages.length; j++) {
                const p = pages[j];
                const title = await p.title();
                const url = p.url();
                logger.info(`   Page ${j}: title="${title}", url="${url}"`);
              }
              
              break;
            }
          }
        }
        
        if (found) break;
        
      } catch (error) {
        logger.error(`   Strategy failed: ${error}`);
      }
    }
    
    if (!found) {
      logger.warn('❌ Could not find Factory Equipment tab with any strategy');
      
      // Try iframe approach
      logger.info('\n🔍 Checking for iframes...');
      const iframes = await page.locator('iframe').all();
      logger.info(`Found ${iframes.length} iframes`);
      
      for (let i = 0; i < iframes.length; i++) {
        const iframe = iframes[i];
        const id = await iframe.getAttribute('id');
        const src = await iframe.getAttribute('src');
        logger.info(`Iframe ${i}: id="${id}", src="${src}"`);
        
        if (id === 'GaugePageIFrame') {
          logger.info('✅ Found GaugePageIFrame!');
          
          const frame = page.frameLocator('#GaugePageIFrame');
          const factoryTabInFrame = frame.locator('text=Factory Equipment').first();
          
          if (await factoryTabInFrame.isVisible({ timeout: 3000 })) {
            logger.info('✅ Found Factory Equipment tab inside iframe!');
            logger.info('Press Enter to click it...');
            
            await new Promise(resolve => {
              process.stdin.once('data', resolve);
            });
            
            await factoryTabInFrame.click();
            await page.waitForTimeout(3000);
            await page.screenshot({ path: 'screenshots/debug-factory-equipment-iframe-click.png', fullPage: true });
          }
        }
      }
    }
    
    logger.info('\n✅ Debug session complete!');
    logger.info('Check the screenshots folder for captured states');
    logger.info('Press Enter to close browser...');
    
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
    
  } catch (error) {
    logger.error('Debug session failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Enable stdin for user input
process.stdin.resume();
process.stdin.setEncoding('utf8');

// Run the debug script
debugFactoryEquipmentClick().catch(console.error); 