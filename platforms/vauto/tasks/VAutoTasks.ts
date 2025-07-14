import { TaskDefinition, TaskContext } from '../../../core/services/TaskOrchestrator';
import { Auth2FAService, Auth2FAConfig } from '../../../core/services/Auth2FAService';
import { Page } from 'playwright';
import { reliableClick } from '../../../core/utils/reliabilityUtils';
import { vAutoSelectors } from '../vautoSelectors';
import { Locator } from '@playwright/test';
import { 
  mapFeaturesToCheckboxes, 
  determineCheckboxActions, 
  generateFeatureReport,
  FeatureUpdateReport 
} from '../featureMapping';
import { ReportingService, RunSummary, VehicleProcessingResult as ReportVehicleResult } from '../../../core/services/ReportingService';

/**
 * VAuto Task Definitions
 * 
 * These are modular tasks that can be run independently or in sequence.
 * Each task is self-contained and can be tested/debugged separately.
 */

/**
 * Task 1: Basic Login (Username/Password only)
 * This task handles ONLY the basic login without 2FA
 */
export const basicLoginTask: TaskDefinition = {
  id: 'basic-login',
  name: 'Basic Login',
  description: 'Login with username and password (no 2FA)',
  dependencies: [],
  timeout: 60000, // 1 minute
  retryCount: 2,
  critical: true,
  
  async execute(context: TaskContext): Promise<any> {
    const { page, config, logger } = context;
    
    logger.info('🔐 Starting basic login...');
    
    // Navigate to login page
    await page.goto(vAutoSelectors.login.url);
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, 'vauto-login-page');
    
    // Enter username
    await page.fill(vAutoSelectors.login.username, config.username);
    await reliableClick(page, vAutoSelectors.login.nextButton, 'Next Button');
    await page.waitForLoadState('networkidle');
    
    // Enter password
    await page.fill(vAutoSelectors.login.password, config.password);
    await takeScreenshot(page, 'vauto-credentials-entered');
    await reliableClick(page, vAutoSelectors.login.submit, 'Submit Button');
    
    // Wait for response
    await page.waitForLoadState('networkidle');
    
    logger.info('✅ Basic login completed');
    
    return {
      url: page.url(),
      timestamp: new Date()
    };
  }
};

/**
 * Task 2: 2FA Authentication
 * This task handles ONLY the 2FA process using the isolated service
 */
export const twoFactorAuthTask: TaskDefinition = {
  id: '2fa-auth',
  name: '2FA Authentication',
  description: 'Handle 2FA authentication via SMS',
  dependencies: ['basic-login'],
  timeout: 300000, // 5 minutes
  retryCount: 1, // Don't retry 2FA to avoid code expiration
  critical: true,
  
  async execute(context: TaskContext): Promise<any> {
    const { page, config, logger } = context;
    
    logger.info('🔐 Starting 2FA authentication...');
    
    // Configure 2FA service with your working settings
    const auth2FAConfig: Auth2FAConfig = {
      webhookUrl: config.webhookUrl || `${process.env.PUBLIC_URL || 'http://localhost:3000'}/api/2fa/latest`,
      timeout: 300000,
      codeInputSelector: vAutoSelectors.login.otpInput,
      submitSelector: vAutoSelectors.login.otpSubmit,
      phoneSelectButton: vAutoSelectors.login.phoneSelectButton,
      twoFactorTitle: vAutoSelectors.login.twoFactorTitle
    };
    
    // Use the isolated 2FA service
    const auth2FAService = new Auth2FAService(auth2FAConfig);
    const result = await auth2FAService.authenticate(page);
    
    if (!result.success) {
      throw new Error(`2FA authentication failed: ${result.error}`);
    }
    
    logger.info('✅ 2FA authentication completed successfully');
    
    return {
      code: result.code,
      timestamp: result.timestamp,
      url: page.url()
    };
  }
};

/**
 * Task 3: Navigate to Inventory
 * This task navigates to the inventory page after successful login
 */
export const navigateToInventoryTask: TaskDefinition = {
  id: 'navigate-inventory',
  name: 'Navigate to Inventory',
  description: 'Navigate to the inventory page',
  dependencies: ['2fa-auth'],
  timeout: 60000,
  retryCount: 2,
  critical: true,
  
  async execute(context: TaskContext): Promise<any> {
    const { page, config, logger } = context;
    
    logger.info('🧭 Navigating to inventory...');
    
    // Wait for page to be ready
    await page.waitForLoadState('networkidle');
    await takeScreenshot(page, 'vauto-post-login-page');
    
    // Get current URL to construct proper inventory URL
    const currentUrl = page.url();
    logger.info(`Current URL: ${currentUrl}`);
    
    try {
      // Method 1: Try to expand menu and find visible View Inventory link
      logger.info('Attempting to expand navigation menu...');
      
      // Look for menu toggles or expandable sections
      const menuToggles = [
        '//button[contains(@class, "menu") or contains(@class, "toggle")]',
        '//a[contains(@class, "dropdown") or contains(@class, "menu")]',
        '//div[contains(@class, "menu-toggle")]',
        '//span[contains(text(), "Menu") or contains(text(), "Navigation")]'
      ];
      
      for (const toggle of menuToggles) {
        try {
          const menuElement = page.locator(toggle).first();
          if (await menuElement.isVisible()) {
            logger.info(`Clicking menu toggle: ${toggle}`);
            await menuElement.click();
            await page.waitForTimeout(2000);
            break;
          }
        } catch (error) {
          // Continue to next toggle
        }
      }
      
      // Try to click View Inventory link (now hopefully visible)
      const inventoryLink = page.locator(vAutoSelectors.inventory.viewInventoryLink).first();
      if (await inventoryLink.isVisible()) {
        logger.info('Found visible View Inventory link, clicking...');
        await inventoryLink.click();
        await page.waitForLoadState('networkidle');
        await takeScreenshot(page, 'vauto-inventory-via-menu');
        
        logger.info('✅ Successfully navigated to inventory via menu');
        return {
          url: page.url(),
          timestamp: new Date(),
          method: 'menu'
        };
      }
      
    } catch (error) {
      logger.warn('Menu navigation failed:', error);
    }
    
    try {
      // Method 2: Direct navigation using correct domain
      logger.info('Trying direct navigation...');
      
      // Extract domain from current URL and construct inventory URL
      const url = new URL(currentUrl);
      const inventoryUrl = `${url.protocol}//${url.hostname}/Va/Inventory/`;
      
      logger.info(`Navigating directly to: ${inventoryUrl}`);
      await page.goto(inventoryUrl);
      await page.waitForLoadState('networkidle');
      await takeScreenshot(page, 'vauto-inventory-direct');
      
      logger.info('✅ Successfully navigated to inventory directly');
      return {
        url: page.url(),
        timestamp: new Date(),
        method: 'direct'
      };
      
    } catch (error) {
      logger.error('Direct navigation failed:', error);
    }
    
    try {
      // Method 3: Alternative inventory URLs
      const alternativeUrls = [
        `${new URL(currentUrl).origin}/Va/Inventory/Default.aspx`,
        `${new URL(currentUrl).origin}/Inventory/`,
        `${new URL(currentUrl).origin}/Va/Dashboard/ProvisionEnterprise/Inventory.aspx`
      ];
      
      for (const altUrl of alternativeUrls) {
        try {
          logger.info(`Trying alternative URL: ${altUrl}`);
          await page.goto(altUrl);
          await page.waitForLoadState('networkidle');
          
          // Check if we're on an inventory-like page
          const pageTitle = await page.title();
          const pageContent = await page.content();
          
          if (pageTitle.toLowerCase().includes('inventory') ||
              pageContent.toLowerCase().includes('inventory') ||
              page.url().toLowerCase().includes('inventory')) {
            
            await takeScreenshot(page, 'vauto-inventory-alternative');
            logger.info('✅ Successfully navigated to inventory via alternative URL');
            return {
              url: page.url(),
              timestamp: new Date(),
              method: 'alternative'
            };
          }
        } catch (error) {
          logger.warn(`Alternative URL failed: ${altUrl}`);
        }
      }
      
    } catch (error) {
      logger.error('All navigation methods failed:', error);
    }
    
    throw new Error('Unable to navigate to inventory page using any method');
  }
};

/**
 * Task 4: Apply Inventory Filters
 * This task applies the 0-1 days filter to the inventory
 */
export const applyInventoryFiltersTask: TaskDefinition = {
  id: 'apply-filters',
  name: 'Apply Inventory Filters',
  description: 'Apply 0-1 days age filter to inventory',
  dependencies: ['navigate-inventory'],
  timeout: 120000,
  retryCount: 2,
  critical: true,
  
  async execute(context: TaskContext): Promise<any> {
    const { page, config, logger } = context;
    
    logger.info('🔍 Applying inventory filters using SAVED FILTERS approach...');
    
    try {
      // Wait for any ExtJS loading masks to disappear first
      await waitForExtJSMasksToDisappear(page, logger);
      
      // STRATEGY 1: Use SAVED FILTERS (Much more reliable!)
      logger.info('🎯 Attempting to use "RECENT INVENTORY" saved filter...');
      
      await takeScreenshot(page, 'vauto-before-saved-filter');
      
      // DEBUG: Log current page state
      const currentUrl = page.url();
      logger.info(`📍 Current URL: ${currentUrl}`);
      
      // DEBUG: Check if we can find any elements related to saved filters
      const debugSelectors = [
        { name: 'FILTERS button', selector: vAutoSelectors.inventory.filtersButton },
        { name: 'SAVED FILTERS dropdown', selector: vAutoSelectors.inventory.savedFiltersDropdown },
        { name: 'SAVED FILTERS arrow', selector: vAutoSelectors.inventory.savedFiltersArrow },
        { name: 'Recent inventory filter', selector: vAutoSelectors.inventory.recentInventoryFilter }
      ];
      
      for (const { name, selector } of debugSelectors) {
        const element = page.locator(selector).first();
        const isVisible = await element.isVisible();
        const count = await page.locator(selector).count();
        logger.info(`🔍 ${name}: visible=${isVisible}, count=${count}`);
        
        // Also try to get the text content for debugging
        if (isVisible) {
          try {
            const textContent = await element.textContent();
            logger.info(`📝 ${name} text: "${textContent}"`);
          } catch (e) {
            logger.info(`📝 ${name} text: Unable to get text content`);
          }
        }
      }
      
      // DEBUG: Look for any elements containing "Saved Filters" text
      const savedFiltersElements = page.locator('//*[contains(text(), "Saved Filters")]');
      const savedFiltersCount = await savedFiltersElements.count();
      logger.info(`🔍 Elements containing "Saved Filters": ${savedFiltersCount}`);
      
      if (savedFiltersCount > 0) {
        for (let i = 0; i < Math.min(savedFiltersCount, 3); i++) {
          const element = savedFiltersElements.nth(i);
          const tagName = await element.evaluate(el => el.tagName);
          const className = await element.getAttribute('class');
          const textContent = await element.textContent();
          logger.info(`📋 Saved Filters element ${i}: <${tagName}> class="${className}" text="${textContent}"`);
        }
      }
      
      // STEP 1: Try to find and click the SAVED FILTERS dropdown trigger
      logger.info('🔍 Looking for SAVED FILTERS dropdown trigger...');
      
      const savedFiltersSelectors = [
        vAutoSelectors.inventory.savedFiltersDropdownButton,
        vAutoSelectors.inventory.savedFiltersDropdown,
        vAutoSelectors.inventory.savedFiltersArrow,
        vAutoSelectors.inventory.savedFiltersDropdownTrigger
      ];
      
      let dropdownOpened = false;
      
      for (const selector of savedFiltersSelectors) {
        const dropdownTrigger = page.locator(selector).first();
        
        if (await dropdownTrigger.isVisible()) {
          logger.info(`📂 Found SAVED FILTERS dropdown trigger with selector: ${selector}`);
          await dropdownTrigger.click();
          await page.waitForTimeout(1500); // Give dropdown time to open
          await waitForExtJSMasksToDisappear(page, logger);
          
          await takeScreenshot(page, 'vauto-saved-filters-dropdown-opened');
          dropdownOpened = true;
          break;
        }
      }
      
      if (!dropdownOpened) {
        logger.info('⚠️ Could not find SAVED FILTERS dropdown trigger, trying FILTERS button...');
        
        // Fallback: try the main FILTERS button
        const filtersButton = page.locator(vAutoSelectors.inventory.filtersButton).first();
        
        if (await filtersButton.isVisible()) {
          logger.info('📂 Found FILTERS button, clicking...');
          await filtersButton.click();
          await page.waitForTimeout(1500);
          await waitForExtJSMasksToDisappear(page, logger);
          
          await takeScreenshot(page, 'vauto-filters-button-clicked');
          dropdownOpened = true;
        }
      }
      
      let dropdownItemCount = 0; // Renamed to avoid conflict
      
      if (dropdownOpened) {
        // STEP 2: Try to find and click "RECENT INVENTORY" in the opened dropdown
        logger.info('🔍 Looking for "RECENT INVENTORY" option in dropdown...');
        
        // Wait for dropdown to actually appear
        await page.waitForTimeout(1000); // Give dropdown time to render
        
        // Try multiple selectors for dropdown items
        const dropdownSelectors = [
          vAutoSelectors.inventory.savedFilterItem,
          vAutoSelectors.inventory.extjsDropdownItem,
          '//div[contains(@class, "x-layer")]//div[contains(@class, "x-combo-list-inner")]/div',
          '//div[contains(@class, "x-combo-list")]//div[contains(@class, "x-combo-list-inner")]/div',
          '//div[@class="x-combo-list-inner"]/div',
          '//ul[contains(@class, "x-menu-list")]//li',
          '//div[contains(@style, "visibility: visible")]//div[contains(@class, "x-combo-list-item")]'
        ];
        
        let allDropdownItems: Locator | null = null;
        dropdownItemCount = 0; // Use the outer declaration
        
        // Try each selector until we find items
        for (const selector of dropdownSelectors) {
          try {
            const items = page.locator(selector);
            const count = await items.count();
            if (count > 0) {
              allDropdownItems = items;
              dropdownItemCount = count;
              logger.info(`📋 Found ${dropdownItemCount} dropdown items using selector: ${selector}`);
              break;
            }
          } catch (e) {
            // Continue to next selector
          }
        }
        
        // If still no items, wait a bit more and try again
        if (dropdownItemCount === 0) {
          logger.info('⏳ No dropdown items found yet, waiting longer...');
          await page.waitForTimeout(2000);
          
          // Try one more time with the most likely selector
          allDropdownItems = page.locator('//div[contains(@class, "x-layer")]//div[contains(@class, "x-combo-list-inner")]/div | //div[@class="x-combo-list-inner"]/div');
          dropdownItemCount = await allDropdownItems.count();
        }
        
        logger.info(`📋 Found ${dropdownItemCount} dropdown items total`);
        
        if (dropdownItemCount > 0 && allDropdownItems) {
          type DropdownItem = { index: number; text: string; locator: Locator };
          const dropdownItems: DropdownItem[] = [];
          for (let i = 0; i < Math.min(dropdownItemCount, 10); i++) {
            const item = allDropdownItems.nth(i);
            try {
              const isVisible = await item.isVisible();
              const textContent = (await item.textContent())?.trim();
              logger.info(`📋 Dropdown item ${i + 1}: visible=${isVisible}, text="${textContent}"`);
              if (isVisible && textContent) {
                dropdownItems.push({ index: i, text: textContent, locator: item });
              }
            } catch (e) {
              logger.info(`📋 Dropdown item ${i + 1}: Error getting details - ${e}`);
            }
          }
          
          // NEW: Smart dropdown selection - avoid "Manage Filters" and find "RECENT INVENTORY"
          logger.info('🎯 Using smart dropdown selection to avoid menu conflicts...');
          
          // Filter out problematic items and find target
          const safeItems = dropdownItems.filter(item => 
            !item.text.toUpperCase().includes('MANAGE FILTERS') &&
            !item.text.toUpperCase().includes('MANAGE') &&
            item.text.trim().length > 0
          );
          
          logger.info(`Found ${safeItems.length} safe dropdown items (excluding Manage Filters)`);
          safeItems.forEach((item, idx) => {
            logger.info(`  ${idx + 1}. "${item.text}"`);
          });
          
          // Look for exact "RECENT INVENTORY" match first
          let targetItem = safeItems.find(item => item.text.toUpperCase() === 'RECENT INVENTORY');
          
          // If not found, look for partial matches
          if (!targetItem) {
            targetItem = safeItems.find(item => 
              item.text.toUpperCase().includes('RECENT') ||
              item.text.toUpperCase().includes('INVENTORY')
            );
          }
          
          // If still not found, use first safe item (assuming limited options)
          if (!targetItem && safeItems.length > 0) {
            targetItem = safeItems[0];
            logger.info(`No RECENT INVENTORY found, using first safe item: "${targetItem.text}"`);
          }
          
          if (targetItem) {
            logger.info(`🎯 Targeting dropdown item: "${targetItem.text}" at index ${targetItem.index + 1}`);
            
            try {
              // Enhanced click strategy with multiple fallbacks
              await targetItem.locator.hover();
              await page.waitForTimeout(500);
              
              // Try force click first
              await targetItem.locator.click({ force: true });
              logger.info('✅ Clicked via force click');
              
            } catch (clickError) {
              logger.warn('⚠️ Force click failed, trying JavaScript click...');
              
              try {
                // JavaScript click fallback
                await page.evaluate((text) => {
                  const items = Array.from(document.querySelectorAll('.x-combo-list-item, .x-menu-item'));
                  const targetItem = items.find(item => 
                    item.textContent && item.textContent.trim().toUpperCase() === text.toUpperCase()
                  );
                  if (targetItem) {
                    (targetItem as HTMLElement).click();
                    return true;
                  }
                  return false;
                }, targetItem.text);
                
                logger.info('✅ Clicked via JavaScript');
                
              } catch (jsError) {
                logger.warn('⚠️ JavaScript click failed, trying coordinate click...');
                
                // Coordinate click as final fallback
                const box = await targetItem.locator.boundingBox();
                if (box) {
                  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                  logger.info('✅ Clicked via coordinates');
                } else {
                  throw new Error('All click methods failed');
                }
              }
            }
            
            await page.waitForLoadState('networkidle');
            await waitForExtJSMasksToDisappear(page, logger);
            await takeScreenshot(page, 'vauto-saved-filter-applied');
            
            // Wait for grid to populate after filter
            await page.waitForTimeout(3000); // Give grid time to load
            
            // Try multiple approaches to count vehicles
            let vehicleCount = await page.locator(vAutoSelectors.inventory.vehicleRows).count();
            
            // If no vehicles found with default selector, try alternatives
            if (vehicleCount === 0) {
              logger.info('⚠️ No vehicles found with default selector, trying alternatives...');
              
              const alternativeSelectors = [
                '//div[contains(@class, "x-grid3-scroller")]//tr[contains(@class, "x-grid3-row")]',
                '//div[contains(@class, "x-grid")]//tbody//tr[position() > 1]',
                '//tr[@class="x-grid3-row"]',
                '//tr[contains(@class, "x-grid3-row-first")]',
                '//tr[contains(@class, "x-grid3-row-last")]'
              ];
              
              for (const selector of alternativeSelectors) {
                const count = await page.locator(selector).count();
                if (count > 0) {
                  vehicleCount = count;
                  logger.info(`✅ Found ${count} vehicles with selector: ${selector}`);
                  break;
                }
              }
            }
            
            logger.info(`✅ Saved filter "${targetItem.text}" applied successfully. Found ${vehicleCount} vehicles`);
            
            return { 
              vehicleCount, 
              filterMethod: 'saved-filter-smart-selection', 
              appliedFilter: targetItem.text,
              timestamp: new Date() 
            };
          }
          
          logger.info('⚠️ No suitable dropdown items found via text matching');
        }
        
        logger.info('⚠️ Could not find suitable dropdown item via any method');
      }
      
      // NEW: Try JavaScript evaluation as last resort
      if (!dropdownOpened || dropdownItemCount === 0) {
        logger.info('🔧 Attempting JavaScript evaluation to find dropdown items...');
        
        const dropdownData = await page.evaluate(() => {
          // Look for ExtJS combo list items
          const items: Array<{text: string, index: number, selector: string}> = [];
          
          // Try various selectors
          const selectors = [
            'div.x-combo-list-inner > div',
            'div.x-layer div.x-combo-list-item',
            'ul.x-menu-list li',
            'div[class*="combo-list"] div[class*="item"]'
          ];
          
          for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              elements.forEach((el, idx) => {
                const text = el.textContent?.trim();
                if (text && text.length > 0) {
                  items.push({
                    text,
                    index: idx,
                    selector: `${selector}:nth-child(${idx + 1})`
                  });
                }
              });
              break; // Use first selector that finds items
            }
          }
          
          return items;
        });
        
        logger.info(`📋 JavaScript found ${dropdownData.length} dropdown items`);
        
        if (dropdownData.length > 0) {
          // Log all items
          dropdownData.forEach((item, idx) => {
            logger.info(`  ${idx + 1}. "${item.text}"`);
          });
          
          // Find "RECENT INVENTORY" or similar
          const targetItem = dropdownData.find(item => 
            item.text.toUpperCase().includes('RECENT') || 
            item.text.toUpperCase().includes('INVENTORY')
          ) || dropdownData[0]; // Use first item as fallback
          
          if (targetItem) {
            logger.info(`🎯 Clicking item via JavaScript: "${targetItem.text}"`);
            
            await page.evaluate((selector) => {
              const element = document.querySelector(selector);
              if (element) {
                (element as HTMLElement).click();
              }
            }, targetItem.selector);
            
            await page.waitForLoadState('networkidle');
            await waitForExtJSMasksToDisappear(page, logger);
            
            const vehicleCount = await page.locator(vAutoSelectors.inventory.vehicleRows).count();
            logger.info(`✅ Filter applied via JavaScript. Found ${vehicleCount} vehicles`);
            
            return {
              vehicleCount,
              filterMethod: 'javascript-evaluation',
              appliedFilter: targetItem.text,
              timestamp: new Date()
            };
          }
        }
      }
      
      // STRATEGY 1.5: Try alternative approach - look for any saved filter items
      logger.info('🔍 Trying alternative approach - looking for any saved filter items...');
      
      const savedFilterItems = page.locator(vAutoSelectors.inventory.savedFilterItem);
      const itemCount = await savedFilterItems.count();
      
      logger.info(`📋 Found ${itemCount} saved filter items`);
      
      if (itemCount > 0) {
        for (let i = 0; i < itemCount; i++) {
          const item = savedFilterItems.nth(i);
          const itemText = await item.textContent();
          
          logger.info(`📋 Saved filter item ${i}: "${itemText}"`);
          
          if (itemText && itemText.toLowerCase().includes('recent')) {
            logger.info(`✅ Found potential "recent inventory" filter: "${itemText}"`);
            await item.click();
            await page.waitForLoadState('networkidle');
            await waitForExtJSMasksToDisappear(page, logger);
            
            await takeScreenshot(page, 'vauto-recent-inventory-alternative-applied');
            
            const vehicleCount = await page.locator(vAutoSelectors.inventory.vehicleRows).count();
            
            logger.info(`✅ Saved filter "${itemText}" applied successfully. Found ${vehicleCount} vehicles`);
            
            return {
              vehicleCount,
              filterMethod: 'saved-filter-alternative',
              appliedFilter: itemText,
              timestamp: new Date()
            };
          }
        }
      }
      
      // STRATEGY 2: Manual filter as fallback (only if saved filters fail)
      logger.info('⚠️ Saved filters not available, falling back to manual 0-1 day filter...');
      
      await takeScreenshot(page, 'vauto-manual-filter-fallback');
      
      // Simple approach: try to set age filter directly
      try {
        await page.fill(vAutoSelectors.inventory.ageMinInput, '0');
        await page.fill(vAutoSelectors.inventory.ageMaxInput, '1');
        
        // Try to find apply button
        const applyButton = page.locator('//button[contains(text(), "Search") or contains(text(), "Apply") or contains(text(), "Filter")]').first();
        if (await applyButton.isVisible()) {
          await applyButton.click();
          await page.waitForLoadState('networkidle');
          await waitForExtJSMasksToDisappear(page, logger);
        }
        
        await takeScreenshot(page, 'vauto-manual-fallback-applied');
        
        const vehicleCount = await page.locator(vAutoSelectors.inventory.vehicleRows).count();
        
        logger.info(`✅ Manual filter applied as fallback. Found ${vehicleCount} vehicles`);
        
        return {
          vehicleCount,
          filterMethod: 'manual-fallback',
          timestamp: new Date()
        };
        
      } catch (manualError) {
        logger.error('Manual filter fallback also failed:', manualError);
        throw new Error('Both saved filters and manual filters failed');
      }
      
    } catch (error) {
      logger.error('Filter application failed:', error);
      throw error;
    }
  }
};

/**
 * Task 5: Process Vehicle Inventory
 * This task processes the filtered vehicles
 */
export const processVehicleInventoryTask: TaskDefinition = {
  id: 'process-vehicles',
  name: 'Process Vehicle Inventory',
  description: 'Process filtered vehicles for feature updates',
  dependencies: ['apply-filters'],
  timeout: 600000, // 10 minutes
  retryCount: 1,
  critical: false, // Not critical - partial success is okay
  
  async execute(context: TaskContext): Promise<any> {
    const { page, config, logger } = context;
    
    logger.info('🚗 Processing vehicle inventory...');
    
    // Initialize reporting service
    const reportingService = new ReportingService();
    await reportingService.initialize();
    
    const runId = `run-${Date.now()}`;
    const startTime = new Date();
    
    const results = {
      totalVehicles: 0,
      processedVehicles: 0,
      failedVehicles: 0,
      windowStickersScraped: 0,
      totalFeaturesFound: 0,
      totalCheckboxesUpdated: 0,
      vehicles: [] as ReportVehicleResult[],
      errors: [] as Array<{ vin: string; error: string }>
    };
    
    try {
      // Get all vehicle rows
      // Wait for grid to be ready
      await page.waitForTimeout(2000);
      await waitForExtJSMasksToDisappear(page, logger);
      
      let vehicleRows = await page.locator(vAutoSelectors.inventory.vehicleRows).all();
      
      // If no vehicles found with default selector, try alternatives
      if (vehicleRows.length === 0) {
        logger.info('⚠️ No vehicles found with default selector in process-vehicles, trying alternatives...');
        
        const alternativeSelectors = [
          '//div[contains(@class, "x-grid3-scroller")]//tr[contains(@class, "x-grid3-row")]',
          '//div[contains(@class, "x-grid")]//tbody//tr[position() > 1]',
          '//tr[@class="x-grid3-row"]',
          '//tr[contains(@class, "x-grid3-row-first")]',
          '//tr[contains(@class, "x-grid3-row-last")]'
        ];
        
        for (const selector of alternativeSelectors) {
          const rows = await page.locator(selector).all();
          if (rows.length > 0) {
            vehicleRows = rows;
            logger.info(`✅ Found ${rows.length} vehicles with selector: ${selector}`);
            break;
          }
        }
      }
      
      results.totalVehicles = vehicleRows.length;
      
      logger.info(`Found ${results.totalVehicles} vehicles to process`);
      
      // Process each vehicle (limit for testing)
      const maxVehicles = config.maxVehiclesToProcess || results.totalVehicles;
      const vehiclesToProcess = Math.min(vehicleRows.length, maxVehicles);
      
      for (let i = 0; i < vehiclesToProcess; i++) {
        const vehicleStartTime = Date.now();
        let currentVin = 'UNKNOWN';
        
        try {
          logger.info(`Processing vehicle ${i + 1}/${vehiclesToProcess}...`);
          
          // Click on vehicle link instead of row
          // Re-query to avoid stale element references
          let vehicleLinks = await page.locator(vAutoSelectors.inventory.vehicleLink).all();
          
          if (vehicleLinks.length === 0) {
            logger.warn('No vehicle links found with primary selector, trying alternatives...');
            
            // Try multiple selectors for vehicle links
            const alternativeSelectors = [
              vAutoSelectors.inventory.vehicleLinkInGrid,
              vAutoSelectors.inventory.vehicleFirstColumnLink,
              vAutoSelectors.inventory.vehicleYearMakeModelLink,
              '//div[@class="x-grid3-scroller"]//tr[contains(@class, "x-grid3-row")]//td[1]//a',
              '//div[contains(@class, "x-grid")]//tbody//tr//td//a',
              '//table[contains(@class, "x-grid")]//tbody//tr//td//a'
            ];
            
            for (const selector of alternativeSelectors) {
              logger.info(`Trying selector: ${selector}`);
              vehicleLinks = await page.locator(selector).all();
              if (vehicleLinks.length > 0) {
                logger.info(`Found ${vehicleLinks.length} vehicle links with selector: ${selector}`);
                break;
              }
            }
          }
          
          if (vehicleLinks.length === 0) {
            logger.warn('Still no vehicle links found, trying row-based approach...');
            // Try to find any clickable link in the row
            const rows = await page.locator(vAutoSelectors.inventory.vehicleRows).all();
            if (rows.length > i) {
              const row = rows[i];
              // Find first link in the row
              const linkInRow = await row.locator('a').first();
              if (await linkInRow.isVisible()) {
                logger.info('Found vehicle link in row, clicking...');
                await linkInRow.click();
              } else {
                // Fallback to clicking the row itself
                logger.info('No link found, clicking row directly...');
                await row.click();
              }
            }
          } else if (vehicleLinks.length > i) {
            logger.info(`Clicking vehicle link ${i + 1}...`);
            await vehicleLinks[i].click();
          } else {
            logger.warn(`Vehicle link ${i + 1} not found, skipping...`);
            continue;
          }
          
          await page.waitForLoadState('networkidle');
          await waitForExtJSMasksToDisappear(page, logger);
          
          // Make sure we're on Vehicle Info tab
          const vehicleInfoTab = page.locator(vAutoSelectors.vehicleDetails.vehicleInfoTab).first();
          if (await vehicleInfoTab.isVisible()) {
            const isActive = await page.locator(vAutoSelectors.vehicleDetails.vehicleInfoTabActive).count() > 0;
            if (!isActive) {
              logger.info('Clicking Vehicle Info tab to ensure it\'s active...');
              await vehicleInfoTab.click();
              await page.waitForTimeout(1000);
            }
          }
          
          // Get VIN
          currentVin = await getVehicleVIN(page);
          logger.info(`Processing VIN: ${currentVin}`);
          
          // Process vehicle features
          const vehicleResult = await processVehicleFeatures(page, currentVin, config, logger);
          
          // Convert to report format
          const reportResult: ReportVehicleResult = {
            vin: currentVin,
            processed: vehicleResult.processed,
            featuresFound: vehicleResult.featuresFound,
            featuresUpdated: vehicleResult.featuresUpdated,
            windowStickerScraped: vehicleResult.windowStickerScraped,
            factoryEquipmentAccessed: vehicleResult.factoryEquipmentAccessed,
            featureUpdateReport: vehicleResult.featureUpdateReport,
            errors: vehicleResult.errors,
            processingTime: Date.now() - vehicleStartTime,
            timestamp: new Date()
          };
          
          results.vehicles.push(reportResult);
          
          if (vehicleResult.processed) {
            results.processedVehicles++;
            if (vehicleResult.windowStickerScraped) {
              results.windowStickersScraped++;
            }
            results.totalFeaturesFound += vehicleResult.featuresFound.length;
            results.totalCheckboxesUpdated += vehicleResult.featureUpdateReport?.checkboxesUpdated || 0;
          } else {
            results.failedVehicles++;
          }
          
          logger.info(`✅ Vehicle ${i + 1} processing completed`);
          
          // Go back to inventory list
          await page.goBack();
          await page.waitForLoadState('networkidle');
          await waitForExtJSMasksToDisappear(page, logger);
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`❌ Failed to process vehicle ${i + 1} (VIN: ${currentVin}):`, error);
          
          results.failedVehicles++;
          results.errors.push({ vin: currentVin, error: errorMessage });
          
          // Add failed vehicle to results
          results.vehicles.push({
            vin: currentVin,
            processed: false,
            featuresFound: [],
            featuresUpdated: [],
            windowStickerScraped: false,
            factoryEquipmentAccessed: false,
            featureUpdateReport: null,
            errors: [errorMessage],
            processingTime: Date.now() - vehicleStartTime,
            timestamp: new Date()
          });
          
          // Try to recover by going back to inventory list
          try {
            const currentUrl = page.url();
            if (!currentUrl.includes('inventory')) {
              logger.info('Attempting to navigate back to inventory...');
              await page.goBack();
              await page.waitForLoadState('networkidle');
              await waitForExtJSMasksToDisappear(page, logger);
            }
          } catch (backError) {
            logger.warn('Failed to go back to inventory list, continuing anyway...');
          }
        }
      }
      
      logger.info(`✅ Vehicle processing completed. Processed: ${results.processedVehicles}, Failed: ${results.failedVehicles}`);
      
      // Generate reports
      const endTime = new Date();
      const summary: RunSummary = {
        runId,
        startTime,
        endTime,
        totalDuration: (endTime.getTime() - startTime.getTime()) / 1000,
        totalVehicles: results.totalVehicles,
        successfulVehicles: results.processedVehicles,
        failedVehicles: results.failedVehicles,
        windowStickersScraped: results.windowStickersScraped,
        totalFeaturesFound: results.totalFeaturesFound,
        totalCheckboxesUpdated: results.totalCheckboxesUpdated,
        errors: results.errors
      };
      
      // Generate all report formats
      const reportPaths = await reportingService.generateAllReports(runId, summary, results.vehicles);
      logger.info('📊 Reports generated:', reportPaths);
      
      // Log unmatched features for future improvements
      await reportingService.logUnmatchedFeatures(results.vehicles);
      
      return {
        ...results,
        reportPaths
      };
      
    } catch (error) {
      logger.error('Vehicle processing failed:', error);
      throw error;
    }
  }
};

/**
 * Helper function to take screenshots
 */
async function takeScreenshot(page: Page, name: string): Promise<void> {
  try {
    await page.screenshot({ 
      path: `screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  } catch (error) {
    console.warn(`Failed to take screenshot: ${name}`, error);
  }
}

/**
 * Helper function to get vehicle VIN
 */
async function getVehicleVIN(page: Page): Promise<string> {
  try {
    const vinElement = await page.locator(vAutoSelectors.vehicleDetails.vinField).first();
    return await vinElement.textContent() || 'UNKNOWN';
  } catch (error) {
    return 'UNKNOWN';
  }
}

/**
 * Helper function to process vehicle features including factory equipment
 */
async function processVehicleFeatures(page: Page, vin: string, config: any, logger: any): Promise<any> {
  const result = {
    vin,
    processed: true,
    featuresFound: [] as string[],
    featuresUpdated: [] as string[],
    checkboxesTested: [] as any[],
    factoryEquipmentAccessed: false,
    windowStickerScraped: false,
    windowStickerContent: '',
    featureUpdateReport: null as FeatureUpdateReport | null,
    errors: [] as string[],
    processingTime: 0
  };
  
  const startTime = Date.now();
  
  try {
    await takeScreenshot(page, `vehicle-${vin}-details`);
    
    // First, try to access Factory Equipment through iframe
    try {
      logger.info('🏭 Accessing Factory Equipment through iframe...');
      
      // Check if we need to switch to iframe
      const gaugeIframe = page.frameLocator(vAutoSelectors.vehicleDetails.gaugePageIFrame);
      
      // Try to find Factory Equipment tab within iframe
      const factoryTabInFrame = gaugeIframe.locator('#ext-gen201').first();
      
      if (await factoryTabInFrame.isVisible()) {
        logger.info('Found Factory Equipment tab in iframe, clicking...');
        await factoryTabInFrame.click();
        await page.waitForTimeout(2000);
        
        // Check if a new window opened with title "factory-equipment-details"
        const pages = page.context().pages();
        logger.info(`Currently open pages: ${pages.length}`);
        
        let factoryEquipmentPage: Page | null = null;
        for (const p of pages) {
          const title = await p.title();
          logger.info(`Page title: "${title}"`);
          if (title.includes('factory-equipment-details') || p.url().includes('factory-equipment')) {
            factoryEquipmentPage = p;
            logger.info('Found factory equipment details window!');
            break;
          }
        }
        
        if (factoryEquipmentPage) {
          result.factoryEquipmentAccessed = true;
          
          // Wait for the window sticker to load
          await factoryEquipmentPage.waitForLoadState('networkidle');
          await takeScreenshot(factoryEquipmentPage, `vehicle-${vin}-factory-equipment-window`);
          
          // Scrape window sticker content
          logger.info('📋 Scraping window sticker content...');
          
          // Try multiple selectors to find the window sticker content
          const contentSelectors = [
            'body', // Sometimes the entire page is the sticker
            '//div[contains(@class, "window-sticker")]',
            '//div[contains(@class, "factory-equipment")]',
            '//div[contains(@class, "content")]',
            '//table[contains(@class, "equipment")]'
          ];
          
          let stickerContent = '';
          for (const selector of contentSelectors) {
            try {
              const element = factoryEquipmentPage.locator(selector).first();
              if (await element.isVisible()) {
                const content = await element.textContent();
                if (content && content.length > 50) { // Make sure we got meaningful content
                  stickerContent = content;
                  logger.info(`Found window sticker content with selector: ${selector}`);
                  break;
                }
              }
            } catch (e) {
              // Continue to next selector
            }
          }
          
          if (!stickerContent) {
            // Get all text content as fallback
            stickerContent = await factoryEquipmentPage.textContent('body') || '';
          }
          
          result.windowStickerContent = stickerContent;
          result.windowStickerScraped = true;
          
          // Extract specific sections
          const sections: {
            interior: string[],
            mechanical: string[],
            comfort: string[],
            safety: string[],
            other: string[]
          } = {
            interior: [],
            mechanical: [],
            comfort: [],
            safety: [],
            other: []
          };
          
          // Parse content into sections
          const lines = stickerContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
          let currentSection: keyof typeof sections = 'other';
          
          for (const line of lines) {
            const lowerLine = line.toLowerCase();
            
            // Detect section headers
            if (lowerLine.includes('interior')) {
              currentSection = 'interior';
            } else if (lowerLine.includes('mechanical')) {
              currentSection = 'mechanical';
            } else if (lowerLine.includes('comfort') || lowerLine.includes('convenience')) {
              currentSection = 'comfort';
            } else if (lowerLine.includes('safety') || lowerLine.includes('security')) {
              currentSection = 'safety';
            } else if (line.length > 3 && !line.includes(':')) {
              // Add non-header lines to current section
              sections[currentSection].push(line);
            }
          }
          
          // Extract features from all sections
          result.featuresFound = [
            ...sections.interior,
            ...sections.mechanical,
            ...sections.comfort,
            ...sections.safety,
            ...sections.other
          ].filter(feature => feature.length > 3);
          
          logger.info(`✅ Scraped window sticker. Found ${result.featuresFound.length} features`);
          logger.info(`Features: ${result.featuresFound.slice(0, 10).join(', ')}${result.featuresFound.length > 10 ? '...' : ''}`);
          
          // Close the factory equipment window
          await factoryEquipmentPage.close();
          
          // Return to main page and update checkboxes if not in read-only mode
          if (!config.readOnlyMode && result.featuresFound.length > 0) {
            logger.info('📋 Updating factory equipment checkboxes based on window sticker...');
            
            // Get all checkboxes on the factory equipment tab
            const checkboxStates = await getAllCheckboxStates(page, logger);
            
            if (checkboxStates.length > 0) {
              logger.info(`Found ${checkboxStates.length} checkboxes to process`);
              
              // Determine which checkboxes to update
              const availableLabels = checkboxStates.map(cb => cb.label);
              const featureMatches = mapFeaturesToCheckboxes(result.featuresFound, availableLabels);
              const checkboxActions = determineCheckboxActions(result.featuresFound, checkboxStates);
              
              // Apply checkbox updates
              let updatedCount = 0;
              for (const action of checkboxActions) {
                if (action.action !== 'none') {
                  try {
                    const success = await updateCheckbox(page, action.id, action.action === 'check', logger);
                    if (success) {
                      updatedCount++;
                      result.featuresUpdated.push(`${action.label} (${action.action})`);
                      logger.info(`✅ ${action.action === 'check' ? 'Checked' : 'Unchecked'}: ${action.label}`);
                    }
                  } catch (error) {
                    logger.warn(`Failed to update checkbox ${action.label}:`, error);
                    result.errors.push(`Checkbox update failed: ${action.label}`);
                  }
                }
              }
              
              logger.info(`📊 Updated ${updatedCount} checkboxes`);
              
              // Save changes if any updates were made
              if (updatedCount > 0) {
                try {
                  logger.info('💾 Saving factory equipment changes...');
                  
                  // Try multiple save button selectors
                  const saveSelectors = [
                    vAutoSelectors.vehicleDetails.saveButton,
                    vAutoSelectors.vehicleDetails.saveButtonCSS,
                    vAutoSelectors.vehicleDetails.saveButtonAlt,
                    '//button[contains(text(), "Save")]',
                    '//button[contains(@class, "save")]'
                  ];
                  
                  let saved = false;
                  for (const selector of saveSelectors) {
                    try {
                      const saveButton = page.locator(selector).first();
                      if (await saveButton.isVisible()) {
                        await saveButton.click();
                        await page.waitForLoadState('networkidle');
                        await page.waitForTimeout(2000);
                        saved = true;
                        logger.info('✅ Changes saved successfully');
                        break;
                      }
                    } catch (e) {
                      // Try next selector
                    }
                  }
                  
                  if (!saved) {
                    throw new Error('Could not find save button');
                  }
                  
                } catch (error) {
                  logger.error('Failed to save changes:', error);
                  result.errors.push('Failed to save changes');
                }
              }
              
              // Generate feature update report
              result.featureUpdateReport = generateFeatureReport(
                vin,
                result.featuresFound,
                featureMatches,
                checkboxActions,
                result.errors
              );
              
            } else {
              logger.warn('No checkboxes found on factory equipment page');
              result.errors.push('No checkboxes found');
            }
          }
          
        } else {
          logger.warn('Factory equipment window did not open as expected');
          result.errors.push('Factory equipment window not found');
        }
        
      } else {
        logger.warn('Factory Equipment tab not visible in iframe');
        
        // Try alternative approach - look for Factory Equipment tab outside iframe
        const factoryTab = page.locator(vAutoSelectors.vehicleDetails.factoryEquipmentTab).first();
        if (await factoryTab.isVisible()) {
          logger.info('Found Factory Equipment tab outside iframe, clicking...');
          await factoryTab.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);
          result.factoryEquipmentAccessed = true;
        }
      }
      
    } catch (error) {
      result.errors.push(`Factory Equipment access failed: ${error}`);
      logger.warn('Factory Equipment tab access failed:', error);
    }
    
    // Get window sticker content if available
    try {
      const stickerContent = await getWindowStickerContent(page);
      
      if (stickerContent) {
        result.featuresFound = extractFeaturesFromSticker(stickerContent);
        logger.info(`Found ${result.featuresFound.length} features in window sticker`);
      }
    } catch (error) {
      result.errors.push(`Window sticker processing failed: ${error}`);
    }
    
    // Update checkboxes based on features (if not in read-only mode)
    if (!config.readOnlyMode && result.factoryEquipmentAccessed) {
      try {
        result.featuresUpdated = await updateFeatureCheckboxes(page, result.featuresFound);
        logger.info(`Updated ${result.featuresUpdated.length} feature checkboxes`);
      } catch (error) {
        result.errors.push(`Checkbox update failed: ${error}`);
      }
    } else {
      logger.info('Read-only mode or no Factory Equipment access: Skipping checkbox updates');
    }
    
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
    logger.error(`Error processing vehicle ${vin}:`, error);
  }
  
  result.processingTime = Date.now() - startTime;
  return result;
}

/**
 * Test checkboxes on factory equipment page using real ExtJS patterns
 */
async function testFactoryEquipmentCheckboxes(page: Page, logger: any): Promise<any[]> {
  const checkboxResults: any[] = [];
  
  try {
    logger.info('🧪 Testing factory equipment checkboxes with ExtJS patterns...');
    
    // Try to find ExtJS feature checkboxes first (ext-va-feature-checkbox-XXXX pattern)
    const extjsFeatureCheckboxes = await page.locator(vAutoSelectors.vehicleDetails.checkboxPattern).all();
    logger.info(`Found ${extjsFeatureCheckboxes.length} ExtJS feature checkboxes`);
    
    // Also find regular checkboxes as fallback
    const regularCheckboxes = await page.locator('input[type="checkbox"]').all();
    logger.info(`Found ${regularCheckboxes.length} total checkboxes on the page`);
    
    // Prefer ExtJS checkboxes, fall back to regular ones
    const checkboxes = extjsFeatureCheckboxes.length > 0 ? extjsFeatureCheckboxes : regularCheckboxes;
    
    if (checkboxes.length === 0) {
      logger.warn('No checkboxes found on factory equipment page');
      return checkboxResults;
    }
    
    // Test up to 5 checkboxes to avoid taking too long
    const maxCheckboxesToTest = Math.min(5, checkboxes.length);
    
    for (let i = 0; i < maxCheckboxesToTest; i++) {
      try {
        const checkbox = checkboxes[i];
        
        // Get checkbox ID for ExtJS pattern identification
        const checkboxId = await checkbox.getAttribute('id') || 'unknown';
        
        // Get checkbox label
        const label = await getCheckboxLabel(page, checkbox);
        
        // Get initial state
        const initialState = await checkbox.isChecked();
        
        logger.info(`Testing checkbox ${i + 1}: "${label}" (ID: ${checkboxId}, initially ${initialState ? 'checked' : 'unchecked'})`);
        
        // Test clicking the checkbox
        await checkbox.click();
        await page.waitForTimeout(500);
        
        // Get state after first click
        const afterFirstClick = await checkbox.isChecked();
        
        // Click again to test toggle
        await checkbox.click();
        await page.waitForTimeout(500);
        
        // Get state after second click
        const afterSecondClick = await checkbox.isChecked();
        
        const testResult = {
          index: i + 1,
          id: checkboxId,
          label,
          initialState,
          afterFirstClick,
          afterSecondClick,
          toggleWorking: initialState !== afterFirstClick && afterFirstClick !== afterSecondClick,
          responsive: true,
          isExtJSCheckbox: checkboxId.includes('ext-va-feature-checkbox')
        };
        
        checkboxResults.push(testResult);
        
        logger.info(`Checkbox "${label}": ${initialState ? 'checked' : 'unchecked'} → ${afterFirstClick ? 'checked' : 'unchecked'} → ${afterSecondClick ? 'checked' : 'unchecked'} (${testResult.toggleWorking ? 'Working' : 'Not Working'})`);
        
        // Take screenshot after testing this checkbox
        await takeScreenshot(page, `checkbox-test-${i + 1}-${label.replace(/[^a-zA-Z0-9]/g, '_')}`);
        
      } catch (error) {
        logger.warn(`Failed to test checkbox ${i + 1}:`, error);
        checkboxResults.push({
          index: i + 1,
          label: 'Unknown',
          error: error instanceof Error ? error.message : String(error),
          responsive: false
        });
      }
    }
    
    // Summary
    const workingCheckboxes = checkboxResults.filter(r => r.toggleWorking).length;
    const extjsCheckboxCount = checkboxResults.filter(r => r.isExtJSCheckbox).length;
    logger.info(`📊 Checkbox Test Summary: ${workingCheckboxes}/${checkboxResults.length} checkboxes working correctly (${extjsCheckboxCount} ExtJS checkboxes)`);
    
  } catch (error) {
    logger.error('Checkbox testing failed:', error);
  }
  
  return checkboxResults;
}

/**
 * Get checkbox label text
 */
async function getCheckboxLabel(page: Page, checkbox: any): Promise<string> {
  try {
    // Try to find associated label by 'for' attribute
    const checkboxId = await checkbox.getAttribute('id');
    if (checkboxId) {
      const label = await page.locator(`label[for="${checkboxId}"]`).first();
      if (await label.isVisible()) {
        const text = await label.textContent();
        if (text) return text.trim();
      }
    }
    
    // Try to find parent label
    const parentLabel = await checkbox.evaluateHandle((el: Element) => {
      let parent = el.parentElement;
      while (parent && parent.tagName !== 'LABEL') {
        parent = parent.parentElement;
      }
      return parent;
    });
    
    if (parentLabel) {
      const text = await parentLabel.evaluate((el: Element) => el.textContent);
      if (text) return text.trim();
    }
    
    // Try to find nearby text
    const nearbyText = await checkbox.evaluateHandle((el: Element) => {
      const next = el.nextSibling;
      if (next && next.nodeType === Node.TEXT_NODE) {
        return next.textContent;
      }
      const nextElement = el.nextElementSibling;
      if (nextElement) {
        return nextElement.textContent;
      }
      return null;
    });
    
    if (nearbyText) {
      const text = await nearbyText.evaluate((node: any) => node);
      if (text) return String(text).trim();
    }
    
    return 'Unknown Label';
  } catch {
    return 'Unknown Label';
  }
}

/**
 * Helper function to get window sticker content
 */
async function getWindowStickerContent(page: Page): Promise<string> {
  try {
    // Look for window sticker link
    const stickerLink = await page.locator(vAutoSelectors.vehicleDetails.windowStickerButton).first();
    if (await stickerLink.isVisible()) {
      await stickerLink.click();
      await page.waitForLoadState('networkidle');
      
      // Get sticker content
      const content = await page.locator(vAutoSelectors.vehicleDetails.stickerContentContainer).textContent();
      return content || '';
    }
  } catch (error) {
    // Window sticker not available
  }
  
  return '';
}

/**
 * Helper function to extract features from sticker content with fuzzy matching examples
 */
function extractFeaturesFromSticker(content: string): string[] {
  const features: string[] = [];
  
  // Enhanced feature extraction with more comprehensive patterns
  const featurePatterns = [
    // Safety features
    { pattern: /adaptive\s*cruise\s*control/i, feature: 'Adaptive Cruise Control' },
    { pattern: /blind\s*spot\s*(monitoring|warning|system)/i, feature: 'Blind Spot Monitoring System' },
    { pattern: /lane\s*(keeping|departure\s*warning)/i, feature: 'Lane Keeping Assist' },
    { pattern: /collision\s*(warning|avoidance)/i, feature: 'Collision Warning' },
    { pattern: /automatic\s*emergency\s*braking/i, feature: 'Automatic Emergency Braking' },
    
    // Comfort features
    { pattern: /heated\s*(front\s*)?seats/i, feature: 'Heated Front Seats' },
    { pattern: /heated\s*rear\s*seats/i, feature: 'Heated Rear Seats' },
    { pattern: /ventilated\s*seats/i, feature: 'Ventilated Seats' },
    { pattern: /leather\s*(seats|trim)/i, feature: 'Leather' },
    { pattern: /sunroof|moonroof/i, feature: 'Sunroof' },
    { pattern: /navigation\s*system/i, feature: 'Navigation' },
    { pattern: /premium\s*audio/i, feature: 'Premium Audio' },
    
    // Technology features
    { pattern: /wireless\s*charging/i, feature: 'Wireless Charging' },
    { pattern: /apple\s*carplay/i, feature: 'Apple CarPlay' },
    { pattern: /android\s*auto/i, feature: 'Android Auto' },
    { pattern: /backup\s*camera/i, feature: 'Backup Camera' },
    { pattern: /360\s*camera/i, feature: '360 Camera' },
    
    // Engine/Performance
    { pattern: /turbo(charged)?/i, feature: 'Turbocharged' },
    { pattern: /all\s*wheel\s*drive|awd/i, feature: 'All Wheel Drive' },
    { pattern: /four\s*wheel\s*drive|4wd/i, feature: 'Four Wheel Drive' }
  ];
  
  // Extract features based on patterns
  for (const { pattern, feature } of featurePatterns) {
    if (pattern.test(content)) {
      features.push(feature);
    }
  }
  
  return features;
}

/**
 * Fuzzy string matching utility functions
 */
function calculateSimilarity(str1: string, str2: string): number {
  // Simple fuzzy matching using Levenshtein distance ratio
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator   // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

function findBestMatch(target: string, candidates: string[], threshold: number = 0.75): string | null {
  let bestMatch: string | null = null;
  let bestScore = 0;
  
  for (const candidate of candidates) {
    const score = calculateSimilarity(target, candidate);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = candidate;
    }
  }
  
  return bestMatch;
}

/**
 * Helper function to update feature checkboxes with fuzzy matching
 */
async function updateFeatureCheckboxes(page: Page, features: string[]): Promise<string[]> {
  const updatedFeatures: string[] = [];
  
  try {
    // Get all available checkbox labels on the page
    const checkboxLabels = await getAllCheckboxLabels(page);
    
    for (const feature of features) {
      try {
        // First try exact match
        let matchingLabel = checkboxLabels.find(label =>
          label.toLowerCase().includes(feature.toLowerCase()) ||
          feature.toLowerCase().includes(label.toLowerCase())
        );
        
        // If no exact match, try fuzzy matching
        if (!matchingLabel) {
          const fuzzyMatch = findBestMatch(feature, checkboxLabels, 0.75);
          if (fuzzyMatch) {
            matchingLabel = fuzzyMatch;
          }
        }
        
        if (matchingLabel) {
          // Find and update the checkbox
          const success = await updateCheckboxByLabel(page, matchingLabel);
          if (success) {
            updatedFeatures.push(`${feature} → ${matchingLabel}`);
          }
        }
        
      } catch (error) {
        console.warn(`Failed to update feature ${feature}:`, error);
      }
    }
    
  } catch (error) {
    console.error('Feature checkbox update failed:', error);
  }
  
  return updatedFeatures;
}

/**
 * Get all checkbox labels on the page
 */
async function getAllCheckboxLabels(page: Page): Promise<string[]> {
  const labels: string[] = [];
  
  try {
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    
    for (const checkbox of checkboxes) {
      const label = await getCheckboxLabel(page, checkbox);
      if (label && label !== 'Unknown Label') {
        labels.push(label);
      }
    }
  } catch (error) {
    console.warn('Failed to get checkbox labels:', error);
  }
  
  return labels;
}

/**
 * Update a specific checkbox by its label
 */
async function updateCheckboxByLabel(page: Page, labelText: string): Promise<boolean> {
  try {
    // Try different selector patterns for finding checkbox by label
    const selectors = [
      `//label[contains(text(), "${labelText}")]/input[@type="checkbox"]`,
      `//label[contains(text(), "${labelText}")]/preceding-sibling::input[@type="checkbox"]`,
      `//label[contains(text(), "${labelText}")]/following-sibling::input[@type="checkbox"]`,
      `//input[@type="checkbox" and following-sibling::*[contains(text(), "${labelText}")]]`,
      `//div[contains(text(), "${labelText}")]/preceding-sibling::input[@type="checkbox"]`,
      `//div[contains(text(), "${labelText}")]/following-sibling::input[@type="checkbox"]`
    ];
    
    for (const selector of selectors) {
      try {
        const checkbox = page.locator(selector).first();
        if (await checkbox.isVisible()) {
          const isChecked = await checkbox.isChecked();
          if (!isChecked) {
            await checkbox.click();
            await page.waitForTimeout(500);
            return true;
          }
          return true; // Already checked
        }
      } catch (error) {
        // Continue to next selector
      }
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Wait for ExtJS loading masks to disappear before proceeding
 */
async function waitForExtJSMasksToDisappear(page: Page, logger: any, timeout: number = 10000): Promise<void> {
  try {
    logger.info('🔍 Checking for ExtJS loading masks...');
    
    // Wait for any visible ExtJS masks to disappear
    const maskSelectors = [
      vAutoSelectors.loading.extjsMaskVisible,
      vAutoSelectors.loading.extjsMask,
      vAutoSelectors.loading.loadingMask
    ];
    
    for (const selector of maskSelectors) {
      try {
        await page.waitForSelector(selector, { state: 'hidden', timeout: 2000 });
        logger.info(`✅ ExtJS mask disappeared: ${selector}`);
      } catch (error) {
        // Mask not present or already hidden - this is good
      }
    }
    
    // Additional wait for any remaining ExtJS processing
    await page.waitForTimeout(500);
    
    logger.info('✅ ExtJS masks check complete');
  } catch (error) {
    logger.warn('ExtJS mask check failed, proceeding anyway:', error);
  }
}

/**
 * All VAuto tasks in dependency order
 */
export const allVAutoTasks = [
  basicLoginTask,
  twoFactorAuthTask,
  navigateToInventoryTask,
  applyInventoryFiltersTask,
  processVehicleInventoryTask
];

/**
 * Get all checkbox states on the current page
 */
async function getAllCheckboxStates(page: Page, logger: any): Promise<Array<{ id: string; label: string; checked: boolean }>> {
  const checkboxStates: Array<{ id: string; label: string; checked: boolean }> = [];
  
  try {
    // Find all checkboxes using ExtJS pattern
    const checkboxes = await page.locator(vAutoSelectors.vehicleDetails.checkboxPattern).all();
    
    if (checkboxes.length === 0) {
      // Fallback to regular checkboxes
      const regularCheckboxes = await page.locator('input[type="checkbox"]').all();
      logger.info(`Found ${regularCheckboxes.length} regular checkboxes`);
      
      for (const checkbox of regularCheckboxes) {
        try {
          const id = await checkbox.getAttribute('id') || '';
          const label = await getCheckboxLabel(page, checkbox);
          const checked = await checkbox.isChecked();
          
          if (id && label && label !== 'Unknown Label') {
            checkboxStates.push({ id, label, checked });
          }
        } catch (e) {
          // Skip problematic checkbox
        }
      }
    } else {
      logger.info(`Found ${checkboxes.length} ExtJS checkboxes`);
      
      for (const checkbox of checkboxes) {
        try {
          const id = await checkbox.getAttribute('id') || '';
          const label = await getCheckboxLabel(page, checkbox);
          const checked = await checkbox.isChecked();
          
          if (id && label && label !== 'Unknown Label') {
            checkboxStates.push({ id, label, checked });
          }
        } catch (e) {
          // Skip problematic checkbox
        }
      }
    }
    
  } catch (error) {
    logger.error('Failed to get checkbox states:', error);
  }
  
  return checkboxStates;
}

/**
 * Update a checkbox to the desired state
 */
async function updateCheckbox(page: Page, checkboxId: string, shouldBeChecked: boolean, logger: any): Promise<boolean> {
  try {
    const checkbox = page.locator(`#${checkboxId}`);
    
    if (!await checkbox.isVisible()) {
      logger.warn(`Checkbox ${checkboxId} not visible`);
      return false;
    }
    
    const isCurrentlyChecked = await checkbox.isChecked();
    
    // Only click if state needs to change
    if (isCurrentlyChecked !== shouldBeChecked) {
      await checkbox.click();
      await page.waitForTimeout(500); // Small delay for state change
      
      // Verify the change
      const newState = await checkbox.isChecked();
      if (newState === shouldBeChecked) {
        return true;
      } else {
        logger.warn(`Checkbox ${checkboxId} did not change state as expected`);
        return false;
      }
    }
    
    return true; // Already in correct state
    
  } catch (error) {
    logger.error(`Failed to update checkbox ${checkboxId}:`, error);
    return false;
  }
}