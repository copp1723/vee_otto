import { Page } from 'playwright';
import { connectToExistingSession } from '../core/browser/sessionManager';
import { Logger } from '../core/utils/Logger';

async function testTabNavigation() {
  const logger = new Logger({ module: 'TestTabNavigation' });
  logger.info('🚀 Starting Tab Navigation Test...');

  try {
    const { page } = await connectToExistingSession();
    logger.info('✅ Connected to existing session');

    // Helper function to detect current tab
    async function detectCurrentTab(): Promise<string> {
      return await page.evaluate(() => {
        // Look for content that indicates which tab we're on
        const indicators = [
          { tab: 'Vehicle Info', selectors: ['label:has-text("VIN:")', 'label:has-text("Stock")', 'button:has-text("Factory Equipment")'] },
          { tab: 'Pricing', selectors: ['text="List Price"', 'text="Unit Cost"', 'div:has-text("Competitive Criteria")'] },
          { tab: 'Transfer Adv', selectors: ['text="Transfer"', 'text="Advertising"'] },
          { tab: 'Book Values', selectors: ['text="Book Values"', 'text="Trade-In"', 'text="Retail"'] },
          { tab: 'Media', selectors: ['text="Photos"', 'text="Images"', 'div[class*="media"]'] },
        ];

        for (const { tab, selectors } of indicators) {
          for (const selector of selectors) {
            try {
              const element = document.querySelector(selector);
              if (element && element.offsetParent !== null) {
                return tab;
              }
            } catch (e) {
              // Continue
            }
          }
        }
        return 'Unknown';
      });
    }

    // Helper function to click Vehicle Info tab
    async function clickVehicleInfoTab(): Promise<boolean> {
      logger.info('🎯 Attempting to click Vehicle Info tab...');

      // Strategy 1: Click based on text position
      const clicked = await page.evaluate(() => {
        // Find all elements containing "Vehicle Info" text
        const allElements = Array.from(document.querySelectorAll('*'));
        const vehicleInfoElements = allElements.filter(el => 
          el.textContent?.trim() === 'Vehicle Info' && 
          !el.children.length && // Leaf node
          el.offsetParent !== null // Visible
        );

        console.log(`Found ${vehicleInfoElements.length} elements with "Vehicle Info" text`);

        for (const textElement of vehicleInfoElements) {
          // Look for clickable parent within modal header area
          let current = textElement as HTMLElement;
          let depth = 0;
          
          while (current && depth < 10) {
            // Check if we're in the modal header area
            const rect = current.getBoundingClientRect();
            const isInHeaderArea = rect.top < 200; // Modal header is typically at top
            
            if (isInHeaderArea) {
              // Try clicking on various parent levels
              console.log(`Trying to click on ${current.tagName} with class: ${current.className}`);
              
              try {
                // Simulate mouse events
                const mouseEvent = new MouseEvent('click', {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  clientX: rect.left + rect.width / 2,
                  clientY: rect.top + rect.height / 2
                });
                
                current.dispatchEvent(mouseEvent);
                
                // Also try direct click
                if (current.click) {
                  current.click();
                }
                
                console.log(`Clicked on ${current.tagName}`);
                return true;
              } catch (e) {
                console.log(`Click failed on ${current.tagName}:`, e);
              }
            }
            
            current = current.parentElement as HTMLElement;
            depth++;
          }
        }
        
        return false;
      });

      if (clicked) {
        logger.info('✅ Clicked Vehicle Info tab (browser context)');
        await page.waitForTimeout(2000); // Wait for tab to switch
        return true;
      }

      // Strategy 2: Use Playwright selectors
      const selectors = [
        // Text-based
        'text="Vehicle Info"',
        ':text("Vehicle Info")',
        
        // Position-based (Vehicle Info is usually the first tab)
        '.x-tab-strip >> nth=0',
        '.x-window >> :text("Vehicle Info")',
        
        // Parent element containing the text
        '*:has-text("Vehicle Info"):not(:has(*))', // Element with text but no children
      ];

      for (const selector of selectors) {
        try {
          logger.info(`Trying selector: ${selector}`);
          const element = page.locator(selector).first();
          
          if (await element.isVisible({ timeout: 1000 })) {
            // Get bounding box
            const box = await element.boundingBox();
            if (box) {
              logger.info(`Found element at: ${box.x}, ${box.y}`);
              
              // Try different click methods
              try {
                await element.click({ timeout: 2000 });
                logger.info('✅ Clicked with normal click');
                await page.waitForTimeout(1500);
                return true;
              } catch (e) {
                // Try clicking at position
                await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                logger.info('✅ Clicked with mouse at position');
                await page.waitForTimeout(1500);
                return true;
              }
            }
          }
        } catch (e) {
          logger.debug(`Selector ${selector} failed:`, e);
        }
      }

      return false;
    }

    // Main test flow
    logger.info('\n📊 Current Tab Detection:');
    const currentTab = await detectCurrentTab();
    logger.info(`Currently on tab: ${currentTab}`);

    if (currentTab === 'Vehicle Info') {
      logger.info('✅ Already on Vehicle Info tab!');
    } else {
      logger.info('📑 Need to navigate to Vehicle Info tab...');
      
      const success = await clickVehicleInfoTab();
      
      if (success) {
        // Verify we're now on Vehicle Info tab
        const newTab = await detectCurrentTab();
        logger.info(`Now on tab: ${newTab}`);
        
        if (newTab === 'Vehicle Info') {
          logger.info('✅ Successfully navigated to Vehicle Info tab!');
          
          // Now try to click Factory Equipment
          logger.info('\n🏭 Attempting to click Factory Equipment...');
          
          const factoryClicked = await page.evaluate(() => {
            const selectors = [
              '#ext-gen199',
              '#ext-gen201',
              'button:has-text("Factory Equipment")',
              'a:has-text("Factory Equipment")'
            ];
            
            for (const selector of selectors) {
              try {
                const element = document.querySelector(selector) as HTMLElement;
                if (element && element.offsetParent !== null) {
                  element.click();
                  console.log(`Clicked Factory Equipment with selector: ${selector}`);
                  return true;
                }
              } catch (e) {
                console.log(`Failed with selector ${selector}:`, e);
              }
            }
            return false;
          });
          
          if (factoryClicked) {
            logger.info('✅ Factory Equipment clicked!');
          } else {
            logger.error('❌ Failed to click Factory Equipment');
          }
        } else {
          logger.error('❌ Tab navigation verification failed');
        }
      } else {
        logger.error('❌ Failed to click Vehicle Info tab');
      }
    }

    // Take screenshot for debugging
    await page.screenshot({ path: `test-tab-navigation-${Date.now()}.png` });
    logger.info('📸 Screenshot saved');

  } catch (error) {
    logger.error('❌ Error in tab navigation test:', error);
  }
}

// Run the test
testTabNavigation().catch(console.error);