import { Page } from 'playwright';
import { Logger } from '../core/utils/Logger';

/**
 * Enhanced Vehicle Info tab navigation for ExtJS modal structure
 */
export class EnhancedTabNavigator {
  constructor(
    private page: Page,
    private logger: Logger
  ) {}

  /**
   * Detect which tab is currently active based on visible content
   */
  async detectActiveTab(): Promise<string> {
    try {
      // Check for unique content indicators for each tab
      const tabIndicators = [
        { 
          name: 'Vehicle Info', 
          indicators: [
            'label:text("VIN:")',
            'label:text("Stock #:")',
            'text="Factory Equipment"',
            '#ext-gen199', // Factory Equipment button
            'button:has-text("Factory Equipment")'
          ]
        },
        { 
          name: 'Pricing', 
          indicators: [
            'text="List Price"',
            'text="Unit Cost"',
            'text="Competitive Criteria"',
            'text="Market Mode"',
            'div:has-text("Competitive Set")'
          ]
        },
        { 
          name: 'Transfer Adv', 
          indicators: [
            'text="Transfer"',
            'text="Advertising"'
          ]
        },
        { 
          name: 'Book Values', 
          indicators: [
            'text="Book Values"',
            'text="Trade-In"',
            'text="NADA"'
          ]
        },
        { 
          name: 'Media', 
          indicators: [
            'text="Photos"',
            'text="Vehicle Images"',
            'div[class*="media"]'
          ]
        }
      ];

      for (const { name, indicators } of tabIndicators) {
        for (const indicator of indicators) {
          try {
            const element = this.page.locator(indicator).first();
            if (await element.isVisible({ timeout: 500 })) {
              this.logger.info(`📍 Detected active tab: ${name} (via ${indicator})`);
              return name;
            }
          } catch (e) {
            // Continue checking
          }
        }
      }

      // Check iframe content as well
      try {
        const gaugeFrame = this.page.frameLocator('#GaugePageIFrame');
        
        // Check for VIN label in iframe (Vehicle Info specific)
        if (await gaugeFrame.locator('label:text("VIN:")').isVisible({ timeout: 500 })) {
          return 'Vehicle Info';
        }
      } catch (e) {
        // Frame might not exist
      }

      return 'Unknown';
    } catch (error) {
      this.logger.error('Error detecting active tab:', error);
      return 'Unknown';
    }
  }

  /**
   * Navigate to Vehicle Info tab using multiple strategies
   */
  async navigateToVehicleInfoTab(): Promise<boolean> {
    try {
      // First check if we're already there
      const currentTab = await this.detectActiveTab();
      if (currentTab === 'Vehicle Info') {
        this.logger.info('✅ Already on Vehicle Info tab');
        return true;
      }

      this.logger.info(`📑 Currently on "${currentTab}" tab, navigating to Vehicle Info...`);

      // Strategy 1: Click by tab position (Vehicle Info is typically first)
      const tabClicked = await this.clickTabByPosition(0);
      if (tabClicked) {
        await this.page.waitForTimeout(1500);
        if (await this.verifyVehicleInfoTab()) {
          return true;
        }
      }

      // Strategy 2: Click by text content
      const textClicked = await this.clickTabByText('Vehicle Info');
      if (textClicked) {
        await this.page.waitForTimeout(1500);
        if (await this.verifyVehicleInfoTab()) {
          return true;
        }
      }

      // Strategy 3: Use JavaScript to find and click the tab
      const jsClicked = await this.clickTabViaJavaScript();
      if (jsClicked) {
        await this.page.waitForTimeout(1500);
        if (await this.verifyVehicleInfoTab()) {
          return true;
        }
      }

      this.logger.error('❌ All tab navigation strategies failed');
      return false;

    } catch (error) {
      this.logger.error('Error navigating to Vehicle Info tab:', error);
      return false;
    }
  }

  /**
   * Click tab by position in the tab strip
   */
  private async clickTabByPosition(position: number): Promise<boolean> {
    try {
      this.logger.info(`🎯 Attempting to click tab at position ${position}...`);

      // ExtJS tab structure typically uses li elements or divs
      const tabSelectors = [
        `.x-tab-strip li:nth-child(${position + 1})`,
        `.x-tab-strip .x-tab:nth-child(${position + 1})`,
        `.x-tab-panel-header li:nth-child(${position + 1})`,
        `.x-tab-panel-header .x-tab:nth-child(${position + 1})`
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
          // Continue with next selector
        }
      }

      return false;
    } catch (error) {
      this.logger.debug('clickTabByPosition failed:', error);
      return false;
    }
  }

  /**
   * Click tab by text content
   */
  private async clickTabByText(tabText: string): Promise<boolean> {
    try {
      this.logger.info(`🎯 Attempting to click "${tabText}" tab by text...`);

      // Multiple strategies to find the tab by text
      const strategies = [
        // Direct text match
        () => this.page.locator(`text="${tabText}"`).first().click(),
        
        // Contains text
        () => this.page.locator(`*:has-text("${tabText}")`).first().click(),
        
        // Within modal header
        () => this.page.locator(`.x-window >> text="${tabText}"`).first().click(),
        
        // Using evaluate to find and click
        () => this.page.evaluate((text) => {
          const elements = Array.from(document.querySelectorAll('*'));
          const tabElement = elements.find(el => 
            el.textContent?.trim() === text && 
            !el.children.length &&
            el.getBoundingClientRect().top < 200 // In header area
          );
          
          if (tabElement) {
            // Click on the element or its parent
            let clickTarget = tabElement as HTMLElement;
            while (clickTarget && !clickTarget.onclick && clickTarget.parentElement) {
              clickTarget = clickTarget.parentElement;
            }
            clickTarget.click();
            return true;
          }
          return false;
        }, tabText)
      ];

      for (const strategy of strategies) {
        try {
          await strategy();
          this.logger.info('✅ Tab clicked successfully');
          return true;
        } catch (e) {
          // Continue with next strategy
        }
      }

      return false;
    } catch (error) {
      this.logger.debug('clickTabByText failed:', error);
      return false;
    }
  }

  /**
   * Use JavaScript to find and click the Vehicle Info tab
   */
  private async clickTabViaJavaScript(): Promise<boolean> {
    try {
      this.logger.info('🎯 Attempting to click Vehicle Info tab via JavaScript...');

      const clicked = await this.page.evaluate(() => {
        // Find all potential tab elements
        const tabTexts = ['Vehicle Info', 'VEHICLE INFO'];
        
        for (const tabText of tabTexts) {
          // Find elements containing the tab text
          const elements = Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent?.trim() === tabText && 
            !el.children.length // Leaf nodes only
          );

          for (const textElement of elements) {
            // Walk up to find clickable parent
            let current = textElement as HTMLElement;
            let attempts = 0;
            
            while (current && attempts < 10) {
              // Check if this element looks like a tab
              const className = current.className || '';
              const isTab = className.includes('x-tab') || 
                           className.includes('tab-') ||
                           current.tagName === 'LI' ||
                           current.role === 'tab';
              
              if (isTab || current.onclick) {
                // Try multiple click methods
                try {
                  // Method 1: Direct click
                  current.click();
                  
                  // Method 2: Dispatch click event
                  const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                  });
                  current.dispatchEvent(clickEvent);
                  
                  // Method 3: If it's a link or has onclick
                  if (current.onclick) {
                    current.onclick(clickEvent as any);
                  }
                  
                  console.log(`Clicked on ${current.tagName} with class: ${className}`);
                  return true;
                } catch (e) {
                  console.error('Click failed:', e);
                }
              }
              
              current = current.parentElement as HTMLElement;
              attempts++;
            }
          }
        }
        
        return false;
      });

      if (clicked) {
        this.logger.info('✅ JavaScript tab click successful');
        return true;
      }

      return false;
    } catch (error) {
      this.logger.debug('clickTabViaJavaScript failed:', error);
      return false;
    }
  }

  /**
   * Verify we're on the Vehicle Info tab
   */
  private async verifyVehicleInfoTab(): Promise<boolean> {
    const currentTab = await this.detectActiveTab();
    const isOnVehicleInfo = currentTab === 'Vehicle Info';
    
    if (isOnVehicleInfo) {
      this.logger.info('✅ Successfully navigated to Vehicle Info tab');
    } else {
      this.logger.warn(`⚠️ Navigation result unclear, detected tab: ${currentTab}`);
    }
    
    return isOnVehicleInfo;
  }

  /**
   * Click Factory Equipment button after ensuring we're on Vehicle Info tab
   */
  async clickFactoryEquipment(): Promise<boolean> {
    try {
      // Ensure we're on Vehicle Info tab first
      const onVehicleInfo = await this.navigateToVehicleInfoTab();
      if (!onVehicleInfo) {
        this.logger.error('❌ Cannot click Factory Equipment - not on Vehicle Info tab');
        return false;
      }

      this.logger.info('🏭 Clicking Factory Equipment button...');

      // Factory Equipment selectors
      const selectors = [
        '#ext-gen199', // Exact ID from user
        '#ext-gen201', // Alternative ID
        'button:has-text("Factory Equipment")',
        'button:text("Factory Equipment")',
        'a:has-text("Factory Equipment")',
        '//button[contains(text(), "Factory Equipment")]',
        '//a[contains(text(), "Factory Equipment")]'
      ];

      for (const selector of selectors) {
        try {
          const element = this.page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            await element.scrollIntoViewIfNeeded();
            await element.click();
            this.logger.info(`✅ Clicked Factory Equipment using selector: ${selector}`);
            
            // Wait for new window/tab or content change
            await this.page.waitForTimeout(2000);
            
            // Check if new window opened
            const pages = this.page.context().pages();
            if (pages.length > 1) {
              this.logger.info('✅ Factory Equipment window opened in new tab');
            }
            
            return true;
          }
        } catch (e) {
          // Continue with next selector
        }
      }

      this.logger.error('❌ Failed to click Factory Equipment button');
      return false;

    } catch (error) {
      this.logger.error('Error clicking Factory Equipment:', error);
      return false;
    }
  }
}

// Export for use in other scripts
export async function ensureVehicleInfoTabAndClickFactoryEquipment(page: Page, logger: Logger): Promise<boolean> {
  const navigator = new EnhancedTabNavigator(page, logger);
  return await navigator.clickFactoryEquipment();
}