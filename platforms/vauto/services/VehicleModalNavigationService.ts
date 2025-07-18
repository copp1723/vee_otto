import { Page } from 'playwright';
import { Logger } from '../../../core/utils/Logger';

/**
 * Service to handle navigation within the vehicle modal, ensuring we're on the correct tab
 * before attempting to access features like Factory Equipment
 */
export class VehicleModalNavigationService {
  constructor(
    private page: Page,
    private logger: Logger
  ) {}

  /**
   * Ensures the Vehicle Info tab is active in the vehicle modal
   * @returns Promise<boolean> - true if successfully on Vehicle Info tab
   */
  async ensureVehicleInfoTabActive(): Promise<boolean> {
    try {
      this.logger.info('🔍 Checking current tab in vehicle modal...');
      
      // Wait for modal to be ready
      await this.page.waitForSelector('.x-window', { state: 'visible', timeout: 10000 });
      
      // First detect which tab is currently active
      const currentTab = await this.detectActiveTab();
      if (currentTab === 'Vehicle Info') {
        this.logger.info('✅ Already on Vehicle Info tab');
        return true;
      }
      
      this.logger.info(`📑 Currently on "${currentTab}" tab, need to navigate to Vehicle Info...`);
      
      // Strategy 1: Click by position (Vehicle Info is typically the first tab)
      const positionClicked = await this.clickTabByPosition(0);
      if (positionClicked) {
        await this.page.waitForTimeout(1500);
        if (await this.verifyOnVehicleInfoTab()) {
          return true;
        }
      }
      
      // Strategy 2: Click by finding the text element and its clickable parent
      const textClicked = await this.clickTabByText('Vehicle Info');
      if (textClicked) {
        await this.page.waitForTimeout(1500);
        if (await this.verifyOnVehicleInfoTab()) {
          return true;
        }
      }
      
      // Strategy 3: Simple text click (based on yesterday's working solution)
      try {
        this.logger.info('🎯 Trying simple text selector approach...');
        await this.page.click('text=Vehicle Info', { timeout: 3000 });
        this.logger.info('✅ Clicked Vehicle Info tab with simple selector');
        await this.page.waitForTimeout(1500);
        if (await this.verifyOnVehicleInfoTab()) {
          return true;
        }
      } catch (error) {
        // Try force click
        try {
          await this.page.click('text=Vehicle Info', { force: true, timeout: 3000 });
          this.logger.info('✅ Force clicked Vehicle Info tab');
          await this.page.waitForTimeout(1500);
          if (await this.verifyOnVehicleInfoTab()) {
            return true;
          }
        } catch (forceError) {
          this.logger.debug('Simple text click failed:', forceError);
        }
      }
      
      // Strategy 4: Use JavaScript to find and click
      const jsClicked = await this.page.evaluate(() => {
        const tabTexts = ['Vehicle Info', 'VEHICLE INFO'];
        
        for (const tabText of tabTexts) {
          // Find elements containing the tab text
          const elements = Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent?.trim() === tabText && 
            !el.children.length && // Leaf node
            el.getBoundingClientRect().top < 200 // In header area
          );
          
          for (const textElement of elements) {
            // Walk up to find clickable parent
            let current = textElement as HTMLElement;
            let depth = 0;
            
            while (current && depth < 10) {
              // Try to click
              try {
                current.click();
                
                // Also dispatch mouse event
                const event = new MouseEvent('click', {
                  view: window,
                  bubbles: true,
                  cancelable: true
                });
                current.dispatchEvent(event);
                
                console.log(`Clicked on ${current.tagName} with class: ${current.className}`);
                return true;
              } catch (e) {
                // Continue up the tree
              }
              
              current = current.parentElement as HTMLElement;
              depth++;
            }
          }
        }
        
        return false;
      });
      
      if (jsClicked) {
        this.logger.info('✅ Clicked Vehicle Info tab via JavaScript');
        await this.page.waitForTimeout(1500);
        if (await this.verifyOnVehicleInfoTab()) {
          return true;
        }
      }
      
      this.logger.error('❌ All tab navigation strategies failed');
      await this.page.screenshot({ path: `debug-vehicle-info-tab-failed-${Date.now()}.png` });
      return false;
      
    } catch (error) {
      this.logger.error('❌ Error in ensureVehicleInfoTabActive:', error);
      await this.page.screenshot({ path: `debug-vehicle-info-tab-error-${Date.now()}.png` });
      return false;
    }
  }
  
  /**
   * Click tab by position in the tab strip
   */
  private async clickTabByPosition(position: number): Promise<boolean> {
    try {
      this.logger.info(`🎯 Attempting to click tab at position ${position}...`);
      
      // Try different selectors for tab elements
      const tabSelectors = [
        `.x-tab-strip li:nth-child(${position + 1})`,
        `.x-tab-strip .x-tab:nth-child(${position + 1})`,
        `.x-tab-panel-header li:nth-child(${position + 1})`,
        `.x-window .x-tab:nth-child(${position + 1})`
      ];
      
      for (const selector of tabSelectors) {
        try {
          const tab = this.page.locator(selector).first();
          if (await tab.isVisible({ timeout: 1000 })) {
            await tab.click();
            this.logger.info(`✅ Clicked tab using selector: ${selector}`);
            return true;
          }
        } catch (e) {
          // Continue
        }
      }
      
      return false;
    } catch (error) {
      this.logger.debug('clickTabByPosition failed:', error);
      return false;
    }
  }
  
  /**
   * Click tab by finding text and clicking its parent
   */
  private async clickTabByText(tabText: string): Promise<boolean> {
    try {
      this.logger.info(`🎯 Attempting to click "${tabText}" tab...`);
      
      // Try multiple approaches
      const approaches = [
        // Playwright text selector
        async () => {
          const element = this.page.locator(`text="${tabText}"`).first();
          if (await element.isVisible({ timeout: 1000 })) {
            await element.click();
            return true;
          }
          return false;
        },
        
        // Click on parent of text element
        async () => {
          const element = this.page.locator(`*:has-text("${tabText}")`).first();
          if (await element.isVisible({ timeout: 1000 })) {
            const box = await element.boundingBox();
            if (box) {
              await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
              return true;
            }
          }
          return false;
        }
      ];
      
      for (const approach of approaches) {
        try {
          if (await approach()) {
            this.logger.info('✅ Successfully clicked tab');
            return true;
          }
        } catch (e) {
          // Continue
        }
      }
      
      return false;
    } catch (error) {
      this.logger.debug('clickTabByText failed:', error);
      return false;
    }
  }
  
  /**
   * Verify we're on the Vehicle Info tab
   */
  private async verifyOnVehicleInfoTab(): Promise<boolean> {
    const currentTab = await this.detectActiveTab();
    if (currentTab === 'Vehicle Info') {
      this.logger.info('✅ Successfully navigated to Vehicle Info tab');
      return true;
    } else {
      this.logger.warn(`⚠️ Tab navigation uncertain, detected: ${currentTab}`);
      return false;
    }
  }

  /**
   * Detects which tab is currently active in the vehicle modal
   * @returns Promise<string> - name of the active tab or 'unknown'
   */
  async detectActiveTab(): Promise<string> {
    try {
      // Check for unique elements on each tab - both in iframe and main page
      const tabIndicators = [
        { 
          tab: 'Vehicle Info', 
          selectors: [
            'label:text("VIN:")',
            'label:text("Stock #:")',
            'label:has-text("Stock")',
            'button:has-text("Factory Equipment")',
            '#ext-gen199', // Factory Equipment button ID
            'text="Factory Equipment"',
            '//div[@class="Vehicle_Attributes"]'
          ]
        },
        { 
          tab: 'Pricing', 
          selectors: [
            'text="List Price"',
            'text="Unit Cost"',
            'text="Competitive Criteria"',
            'text="Market Mode"',
            'div:has-text("Competitive Set")',
            'text="Adjusted MMR"'
          ]
        },
        { 
          tab: 'Transfer Adv', 
          selectors: [
            'text="Transfer"',
            'text="Advertising"'
          ]
        },
        { 
          tab: 'Book Values', 
          selectors: [
            'text="Book Values"',
            'text="NADA"',
            'text="Trade-In"'
          ]
        },
        { 
          tab: 'Media', 
          selectors: [
            'text="Photos"',
            'text="Vehicle Images"',
            'div[class*="media"]'
          ]
        },
        {
          tab: 'Window Stickers',
          selectors: [
            'text="Window Stickers"',
            'text="Sticker"'
          ]
        },
        {
          tab: 'Lifecycle',
          selectors: [
            'text="Lifecycle"',
            'text="Vehicle History"'
          ]
        },
        {
          tab: 'Vehicle Log',
          selectors: [
            'text="Vehicle Log"',
            'text="Log Entries"'
          ]
        }
      ];
      
      // Check both iframe and main page
      for (const { tab, selectors } of tabIndicators) {
        for (const selector of selectors) {
          try {
            // Check in main page first
            let element = this.page.locator(selector).first();
            if (await element.isVisible({ timeout: 500 })) {
              this.logger.info(`📑 Detected active tab: ${tab} (via ${selector} in main page)`);
              return tab;
            }
            
            // Check in iframe
            try {
              const gaugeFrame = this.page.frameLocator('#GaugePageIFrame');
              element = gaugeFrame.locator(selector).first();
              if (await element.isVisible({ timeout: 500 })) {
                this.logger.info(`📑 Detected active tab: ${tab} (via ${selector} in iframe)`);
                return tab;
              }
            } catch (frameError) {
              // Frame might not exist for some tabs
            }
          } catch (error) {
            // Continue checking
          }
        }
      }
      
      return 'Unknown';
    } catch (error) {
      this.logger.error('Error detecting active tab:', error);
      return 'Unknown';
    }
  }

  /**
   * Clicks the Factory Equipment button with Vehicle Info tab verification
   * @returns Promise<boolean> - true if button was clicked successfully
   */
  async clickFactoryEquipmentWithTabVerification(maxRetries: number = 3): Promise<boolean> {
    this.logger.info('🎯 Starting Factory Equipment click with tab verification');

    // Ensure we're on the Vehicle Info tab first
    const tabActive = await this.ensureVehicleInfoTabActive();
    if (!tabActive) {
      this.logger.error('❌ Could not activate Vehicle Info tab');
      return false;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.logger.info(`🔄 Attempt ${attempt}/${maxRetries} to click Factory Equipment`);

      try {
        // Wait for the iframe to be ready
        await this.page.waitForSelector('#GaugePageIFrame', { state: 'visible', timeout: 10000 });
        const iframe = this.page.frameLocator('#GaugePageIFrame');

        // Factory Equipment button has a consistent ID (confirmed by user)
        const factoryEquipmentSelectors = [
          // Primary selector - exact ID that's always in the same spot
          '#ext-gen199',
          
          // Fallback text selector (worked yesterday)
          'text="Factory Equipment"',
          
          // Additional fallbacks
          'button:has-text("Factory Equipment")',
          '//button[@id="ext-gen199"]'
        ];

        let factoryButton = null;
        let usedSelector = '';

        // Try each selector to find the Factory Equipment link
        // IMPORTANT: Factory Equipment is in the main modal, NOT in the iframe!
        for (const selector of factoryEquipmentSelectors) {
          try {
            this.logger.info(`🔍 Trying selector: ${selector}`);
            factoryButton = this.page.locator(selector).first();

            // Check if element exists and is visible
            const isVisible = await factoryButton.isVisible({ timeout: 2000 });
            if (isVisible) {
              usedSelector = selector;
              this.logger.info(`✅ Found Factory Equipment link with selector: ${selector}`);
              break;
            }
          } catch (error) {
            this.logger.debug(`❌ Selector ${selector} failed: ${error}`);
            continue;
          }
        }

        if (!factoryButton || !usedSelector) {
          this.logger.error('❌ Factory Equipment link not found with any selector');

          // Take screenshot for debugging
          await this.page.screenshot({ path: `debug-factory-equipment-not-found-${Date.now()}.png` });

          if (attempt === maxRetries) {
            return false;
          }
          continue;
        }

        // Wait for the element to be ready for interaction
        try {
          await factoryButton.waitFor({ state: 'attached', timeout: 5000 });
          await factoryButton.waitFor({ state: 'visible', timeout: 5000 });
        } catch (error) {
          this.logger.error(`❌ Factory Equipment link not ready: ${error}`);
          continue;
        }

        this.logger.info(`🎯 Clicking Factory Equipment link using selector: ${usedSelector}`);

        // Store initial window count
        const initialPages = this.page.context().pages().length;
        this.logger.info(`📊 Initial page count: ${initialPages}`);

        // Try different click strategies
        const clickStrategies = [
          { name: 'normal click', action: () => factoryButton.click({ timeout: 5000 }) },
          { name: 'force click', action: () => factoryButton.click({ force: true, timeout: 5000 }) },
          { name: 'dispatch click', action: () => factoryButton.dispatchEvent('click') }
        ];

        let clickSuccessful = false;
        for (const strategy of clickStrategies) {
          try {
            this.logger.info(`🖱️ Trying ${strategy.name}`);
            await strategy.action();
            clickSuccessful = true;
            this.logger.info(`✅ ${strategy.name} executed successfully`);
            break;
          } catch (error) {
            this.logger.error(`❌ ${strategy.name} failed: ${error}`);
            continue;
          }
        }

        if (!clickSuccessful) {
          this.logger.error('❌ All click strategies failed');
          continue;
        }

        // Wait a moment for the action to take effect
        await this.page.waitForTimeout(2000);

        // Check for new window/tab
        const finalPages = this.page.context().pages().length;
        this.logger.info(`📊 Final page count: ${finalPages}`);

        if (finalPages > initialPages) {
          this.logger.info('✅ New window/tab detected - Factory Equipment click successful!');
          return true;
        }

        // Alternative verification: Check for content changes in the iframe
        try {
          // Look for factory equipment related content
          const factoryContentSelectors = [
            'text="Factory Equipment"',
            'text="Standard Equipment"',
            'text="Optional Equipment"',
            '[class*="equipment"]',
            '[id*="equipment"]'
          ];

          for (const contentSelector of factoryContentSelectors) {
            const content = iframe.locator(contentSelector);
            if (await content.isVisible({ timeout: 3000 })) {
              this.logger.info(`✅ Factory Equipment content detected: ${contentSelector}`);
              return true;
            }
          }
        } catch (error) {
          this.logger.debug(`Content verification failed: ${error}`);
        }

        this.logger.warn(`⚠️ Click appeared successful but no verification found (attempt ${attempt})`);

        if (attempt === maxRetries) {
          // Take final screenshot for debugging
          await this.page.screenshot({ path: `debug-factory-equipment-failed-${Date.now()}.png` });
          return false;
        }

      } catch (error) {
        this.logger.error(`❌ Attempt ${attempt} failed with error: ${error}`);

        if (attempt === maxRetries) {
          await this.page.screenshot({ path: `debug-factory-equipment-error-${Date.now()}.png` });
          return false;
        }

        // Wait before retry
        await this.page.waitForTimeout(1000);
      }
    }

    return false;
  }
}