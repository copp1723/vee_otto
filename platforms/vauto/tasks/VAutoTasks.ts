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
    await page.screenshot({ path: `screenshots/vauto-login-page.png` });
    
    // Enter username
    await page.fill(vAutoSelectors.login.username, config.username);
    await reliableClick(page, vAutoSelectors.login.nextButton, 'Next Button');
    await page.waitForLoadState('networkidle');
    
    // Enter password
    await page.fill(vAutoSelectors.login.password, config.password);
    await page.screenshot({ path: `screenshots/vauto-credentials-entered.png` });
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
    await page.screenshot({ path: `screenshots/vauto-post-login-page.png` });
    
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
        await page.screenshot({ path: `screenshots/vauto-inventory-via-menu.png` });
        
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
      await page.screenshot({ path: `screenshots/vauto-inventory-direct.png` });
      
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
            
            await page.screenshot({ path: `screenshots/vauto-inventory-alternative.png` });
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
      await page.waitForTimeout(5000);
      
      // STRATEGY 1: Use SAVED FILTERS (Much more reliable!)
      logger.info('🎯 Attempting to use "RECENT INVENTORY" saved filter...');
      
      await page.screenshot({ path: `screenshots/vauto-before-saved-filter.png` });
      
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
          await page.waitForTimeout(5000);
          
          await page.screenshot({ path: `screenshots/vauto-saved-filters-dropdown-opened.png` });
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
          await page.waitForTimeout(5000);
          
          await page.screenshot({ path: `screenshots/vauto-filters-button-clicked.png` });
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
            await page.waitForTimeout(5000);
            await page.screenshot({ path: `screenshots/vauto-saved-filter-applied.png` });
            
            // Wait for grid to populate after filter
            await page.waitForTimeout(3000); // Give grid time to load
            
            // Check for any error messages or "no results" indicators
            const errorMessages = await page.locator('//div[contains(@class, "error") or contains(@class, "alert") or contains(@class, "warning")]').all();
            if (errorMessages.length > 0) {
              for (const errorMsg of errorMessages) {
                const text = await errorMsg.textContent();
                logger.warn(`⚠️ Error/warning on page: ${text}`);
              }
            }
            
            const noResultsMsg = await page.locator('//div[contains(text(), "No records") or contains(text(), "No vehicles") or contains(text(), "No results") or contains(text(), "0 items")]').count();
            if (noResultsMsg > 0) {
              logger.warn('⚠️ "No results" message detected on page');
            }
            
            // Check the grid status/paging info
            const pagingInfo = await page.locator('//div[contains(@class, "x-toolbar")]//span[contains(text(), "of")]').textContent().catch(() => null);
            if (pagingInfo) {
              logger.info(`📊 Grid paging info: ${pagingInfo}`);
            }
            
            // Try multiple approaches to count vehicles
            let vehicleCount = await page.locator(vAutoSelectors.inventory.vehicleRows).count();
            logger.info(`📊 Default selector found ${vehicleCount} vehicles`);
            
            // If no vehicles found with default selector, try alternatives
            if (vehicleCount === 0) {
              logger.info('⚠️ No vehicles found with default selector, trying alternatives...');
              
              const alternativeSelectors = [
                '//div[contains(@class, "x-grid3-scroller")]//tr[contains(@class, "x-grid3-row") and not(contains(@class, "x-grid3-row-checker"))]',
                '//div[contains(@class, "x-grid")]//tbody//tr[contains(@class, "x-grid3-row") and not(contains(@style, "display: none"))]',
                '//tr[@class="x-grid3-row" and not(contains(@style, "display: none"))]',
                '//div[@class="x-grid3-scroller"]//table[@class="x-grid3-row-table"]//tr[contains(@class, "x-grid3-row")]',
                '//table[@class="x-grid3-row-table"]',
                '//div[@class="x-grid3-body"]//tr'
              ];
              
              for (const selector of alternativeSelectors) {
                const count = await page.locator(selector).count();
                logger.info(`📊 Testing selector "${selector}": found ${count} items`);
                if (count > 0) {
                  vehicleCount = count;
                  logger.info(`✅ Found ${count} vehicles with selector: ${selector}`);
                  break;
                }
              }
            }
            
            logger.info(`✅ Saved filter "${targetItem.text}" applied successfully. Found ${vehicleCount} vehicles`);
            
            // If "recent inventory" returns 0 vehicles, log additional debugging info
            if (vehicleCount === 0) {
              logger.warn('⚠️ Filter returned 0 vehicles. This could mean:');
              logger.warn('   1. The "recent inventory" filter criteria has no matching vehicles');
              logger.warn('   2. The filter was not applied correctly');
              logger.warn('   3. The page needs more time to load');
              
              // Try one more wait and recount
              logger.info('⏳ Waiting additional 5 seconds and recounting...');
              await page.waitForTimeout(5000);
              vehicleCount = await page.locator(vAutoSelectors.inventory.vehicleRows).count();
              logger.info(`📊 After additional wait: ${vehicleCount} vehicles found`);
            }
            
            // If we still have 0 vehicles, don't return yet - let it fall through to manual filter
            if (vehicleCount > 0) {
              return { 
                vehicleCount, 
                filterMethod: 'saved-filter-smart-selection', 
                appliedFilter: targetItem.text,
                timestamp: new Date() 
              };
            } else {
              logger.warn('⚠️ Saved filter returned 0 vehicles, will try manual filter fallback...');
            }
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
            await page.waitForTimeout(5000);
            
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
            await page.waitForTimeout(5000);
            
            await page.screenshot({ path: `screenshots/vauto-recent-inventory-alternative-applied.png` });
            
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
      logger.info('⚠️ Saved filters not available or returned 0 vehicles, falling back to manual filter...');
      
      await page.screenshot({ path: `screenshots/vauto-manual-filter-fallback.png` });
      
      // Simple approach: try to set age filter directly
      try {
        // Try a wider range first (0-30 days)
        logger.info('📊 Applying manual age filter: 0-30 days');
        await page.fill(vAutoSelectors.inventory.ageMinInput, '0');
        await page.fill(vAutoSelectors.inventory.ageMaxInput, '30');
        
        // Try to find apply button
        const applyButton = page.locator('//button[contains(text(), "Search") or contains(text(), "Apply") or contains(text(), "Filter")]').first();
        if (await applyButton.isVisible()) {
          await applyButton.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(5000);
        }
        
        await page.screenshot({ path: `screenshots/vauto-manual-fallback-applied.png` });
        
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
    let { page, config, logger } = context; // Change const to let for page
    
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
      await page.waitForTimeout(5000);
      
      // NEW: More specific approach to find clickable vehicle links
      logger.info('🔍 Detecting vehicles using refined selectors...');
      
      // First, try to find the exact column containing the main vehicle link
      // Usually it's the year/make/model column or the first column with a link
      const vehicleLinkSelectors = [
        // Target the specific cell that contains the main vehicle link
        '//tr[contains(@class, "x-grid3-row")]//td[position()=1 or position()=2]//a[contains(@href, "javascript") or contains(@onclick, "OpenVehicle") or contains(@onclick, "viewVehicle")]',
        // Look for links with specific onclick patterns
        '//tr[contains(@class, "x-grid3-row")]//a[contains(@onclick, "OpenVehicle") or contains(@onclick, "viewVehicle") or contains(@onclick, "ShowVehicle")]',
        // Target first link in each row (usually the main one)
        '//tr[contains(@class, "x-grid3-row")]//td[1]//a[1]',
        // Year/Make/Model column specifically
        '//tr[contains(@class, "x-grid3-row")]//td[contains(@class, "x-grid3-col-model") or contains(@class, "x-grid3-col-year")]//a',
        // Fallback: first link that's not a VIN or stock number
        '//tr[contains(@class, "x-grid3-row")]//a[not(contains(@class, "vin")) and not(contains(@class, "stock"))][1]'
      ];
      
      let vehicleLinks: Locator[] = [];
      let usedSelector = '';
      
      for (const selector of vehicleLinkSelectors) {
        const links = await page.locator(selector).all();
        if (links.length > 0 && links.length <= 25) { // Reasonable number of links (1 per vehicle)
          vehicleLinks = links;
          usedSelector = selector;
          logger.info(`✅ Found ${links.length} vehicle links using selector: ${selector}`);
          break;
        }
      }
      
      // If still no links or too many, try row-by-row approach
      if (vehicleLinks.length === 0 || vehicleLinks.length > 25) {
        logger.info('⚠️ Using row-by-row approach to find vehicle links...');
        const rows = await page.locator('//tr[contains(@class, "x-grid3-row")]').all();
        vehicleLinks = [];
        
        for (const row of rows) {
          // Find the first meaningful link in each row
          const rowLinks = await row.locator('a').all();
          if (rowLinks.length > 0) {
            // Skip VIN and stock number links
            for (const link of rowLinks) {
              const href = await link.getAttribute('href') || '';
              const onclick = await link.getAttribute('onclick') || '';
              const text = await link.textContent() || '';
              
              // Check if this is likely the main vehicle link
              if ((onclick.includes('Open') || onclick.includes('View') || onclick.includes('Show')) ||
                  (text.length > 5 && !text.match(/^[A-Z0-9]{17}$/))) { // Not a VIN
                vehicleLinks.push(link);
                break; // Only take first good link per row
              }
            }
            
            // If no good link found, take the first one
            if (vehicleLinks.length < rows.indexOf(row) + 1) {
              vehicleLinks.push(rowLinks[0]);
            }
          }
        }
        logger.info(`✅ Found ${vehicleLinks.length} unique vehicle links (1 per row)`);
      }
      
      // Additional debugging info
      if (vehicleLinks.length > 0) {
        const firstLinkText = await vehicleLinks[0].textContent();
        const firstLinkHref = await vehicleLinks[0].getAttribute('href');
        const firstLinkOnclick = await vehicleLinks[0].getAttribute('onclick');
        logger.info(`📋 Sample link - Text: "${firstLinkText}", Href: "${firstLinkHref}", Onclick: "${firstLinkOnclick}"`);
      }
      
      results.totalVehicles = vehicleLinks.length;
      
      logger.info(`Found ${results.totalVehicles} vehicles to process`);
      
      // Process each vehicle (limit for testing)
      const maxVehicles = config.maxVehiclesToProcess || results.totalVehicles;
      const vehiclesToProcess = Math.min(vehicleLinks.length, maxVehicles);
      
      for (let i = 0; i < vehiclesToProcess; i++) {
        const vehicleStartTime = Date.now();
        let processed = false;
        let featuresFound: string[] = [];
        let featuresUpdated: string[] = [];
        let errors: string[] = [];
        let tabSuccess = false;
        let navigationSuccess = false;

        try {
          logger.info(`Processing vehicle ${i + 1}/${vehiclesToProcess}...`);
          
          // Store current URL to verify navigation
          const beforeClickUrl = page.url();
          
          // Click the vehicle link with improved error handling
          try {
            await vehicleLinks[i].click();
            navigationSuccess = true;
          } catch (clickError) {
            logger.warn('Direct click failed, trying force click...');
            await vehicleLinks[i].click({ force: true });
            navigationSuccess = true;
          }
          
          // Wait for navigation with verification
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(3000);
          
          // Verify we navigated away from the inventory page
          const afterClickUrl = page.url();
          if (afterClickUrl === beforeClickUrl) {
            throw new Error('Navigation failed - still on same page');
          }
          
          // Additional verification: check for vehicle details elements
          const detailsLoaded = await page.locator('//a[contains(text(), "Vehicle Info")] | //div[contains(@class, "vehicle-details")] | //*[@id="GaugePageIFrame"]').first().isVisible({ timeout: 5000 }).catch(() => false);
          
          if (!detailsLoaded) {
            logger.warn('Vehicle details page may not have loaded properly');
            // Take debug screenshot
            await page.screenshot({ path: `screenshots/vehicle-${i + 1}-navigation-issue.png` });
          }
          
          await page.screenshot({ path: `screenshots/vehicle-${i + 1}-details-page.png` });

          logger.info('📋 On Vehicle Info page, preparing to access Factory Equipment...');
          
          // STEP 1: Select the GaugePageIFrame as per workflow
          logger.info('🖼️ Selecting GaugePageIFrame...');
          let factoryFrame = null;
          try {
            // Try iframe by ID first
            factoryFrame = page.frameLocator('#GaugePageIFrame');
            // Verify frame exists by trying to access an element
            await factoryFrame.locator('body').waitFor({ timeout: 3000 });
            logger.info('✅ Successfully selected GaugePageIFrame');
          } catch (frameError) {
            logger.warn('Could not access GaugePageIFrame, continuing without frame context');
            // Continue without frame - some implementations might not use iframe
          }
          
          await page.screenshot({ path: `screenshots/before-factory-tab.png` });
          logger.info('🛢 Navigating to Factory Equipment tab...');
          
          // Enhanced tab navigation with multiple strategies
          const tabNavigationStrategies = [
            // Strategy 1: Try within iframe context first (as per workflow)
            async () => {
              if (factoryFrame) {
                try {
                  // The workflow specifies id=ext-gen201 for Factory Equipment tab
                  await factoryFrame.locator('#ext-gen201').click();
                  return true;
                } catch (e) {
                  // Try text-based selector in iframe
                  await factoryFrame.locator('//a[contains(text(), "Factory Equipment")] | //span[contains(text(), "Factory Equipment")]').first().click();
                  return true;
                }
              }
              return false;
            },
            
            // Strategy 2: Direct page click (if not in iframe)
            async () => {
              // The workflow specifies id=ext-gen201
              return await reliableClick(page, '#ext-gen201', 'Factory Equipment Tab');
            },
            
            // Strategy 3: Alternative selectors
            async () => {
              const selectors = [
                vAutoSelectors.vehicleDetails.factoryEquipmentTab,
                '#ext-gen175', // Alternative ID from selectors
                '//a[contains(text(), "Factory Equipment")]',
                '//span[contains(text(), "Factory Equipment")]',
                '//div[contains(@class, "x-tab") and contains(text(), "Factory Equipment")]'
              ];
              for (const selector of selectors) {
                if (await reliableClick(page, selector, 'Factory Equipment Tab')) {
                  return true;
                }
              }
              return false;
            },
            
            // Strategy 4: JavaScript click for ExtJS
            async () => {
              return await page.evaluate(() => {
                // Try the specific ID from workflow first
                const tabElement = document.querySelector('#ext-gen201') ||
                                  document.querySelector('#ext-gen175') || 
                                  document.querySelector('a[id*="ext-gen"][href*="Factory"]') ||
                                  Array.from(document.querySelectorAll('.x-tab-strip-text')).find(el => el.textContent?.includes('Factory'));
                if (tabElement) {
                  (tabElement as HTMLElement).click();
                  return true;
                }
                return false;
              });
            },
            
            // Strategy 4: Click by position (Factory Equipment is often 3rd or 4th tab)
            async () => {
              const tabs = await page.locator('//ul[contains(@class, "x-tab-strip")]//a').all();
              if (tabs.length >= 3) {
                for (let i = 2; i < Math.min(tabs.length, 5); i++) {
                  const tabText = await tabs[i].textContent();
                  if (tabText?.includes('Factory')) {
                    await tabs[i].click();
                    return true;
                  }
                }
              }
              return false;
            }
          ];
          
          for (const strategy of tabNavigationStrategies) {
            try {
              tabSuccess = await strategy();
              if (tabSuccess) {
                await page.waitForTimeout(2000);
                await page.screenshot({ path: `screenshots/after-factory-tab.png` });
                logger.info('✅ Successfully navigated to Factory Equipment tab');
                break;
              }
            } catch (e) {
              continue;
            }
          }
          
          if (tabSuccess) {
            await page.waitForTimeout(2000);
            
            // STEP 2: Check if a new window opened with title=factory-equipment-details
            logger.info('🪟 Checking for factory-equipment-details window...');
            const pages = page.context().pages();
            let factoryWindow = null;
            
            for (const p of pages) {
              const title = await p.title();
              logger.info(`Found window with title: "${title}"`);
              if (title === 'factory-equipment-details' || title.includes('factory-equipment')) {
                factoryWindow = p;
                logger.info('✅ Found factory-equipment-details window!');
                break;
              }
            }
            
            if (factoryWindow) {
              // Switch context to the factory equipment window
              page = factoryWindow;
              await page.waitForLoadState('networkidle');
              await page.screenshot({ path: `screenshots/vehicle-${i + 1}-factory-window.png` });
            } else {
              // STEP 3: Look for View Window Sticker button (inline content scenario)
              logger.info('📄 No separate window found. Looking for View Window Sticker button...');
              
              // Try within iframe first if available
              const stickerButton = factoryFrame 
                ? factoryFrame.locator('//button[contains(text(), "View Window Sticker")] | //a[contains(text(), "Window Sticker")]').first()
                : page.locator('//button[contains(text(), "View Window Sticker")] | //a[contains(text(), "Window Sticker")]').first();
              
              if (await stickerButton.isVisible({ timeout: 3000 })) {
                logger.info('Found window sticker button, clicking...');
                await stickerButton.click();
                await page.waitForTimeout(2000);
                
                // Check again for new window after button click
                const pagesAfterClick = page.context().pages();
                for (const p of pagesAfterClick) {
                  const title = await p.title();
                  if (title === 'factory-equipment-details' || title.includes('factory-equipment')) {
                    factoryWindow = p;
                    page = factoryWindow;
                    await page.waitForLoadState('networkidle');
                    logger.info('✅ Factory window opened after button click');
                    break;
                  }
                }
              } else {
                logger.info('📄 Window sticker content appears to be inline on current page');
              }
            }
          } else {
            // Alternative: Try to find window sticker link directly in Vehicle Info tab
            logger.warn('Factory Equipment tab navigation failed, looking for direct window sticker link...');
            const directStickerLink = page.locator('//a[contains(text(), "Window Sticker")] | //a[contains(text(), "Monroney")] | //a[contains(@href, "window-sticker")]').first();
            
            if (await directStickerLink.isVisible({ timeout: 3000 })) {
              logger.info('Found direct window sticker link in Vehicle Info tab');
              const [newPage] = await Promise.all([
                page.context().waitForEvent('page', { timeout: 5000 }),
                directStickerLink.click()
              ]).catch(() => [null]);
              
              if (newPage) {
                page = newPage as Page;
                await page.waitForLoadState('networkidle');
                tabSuccess = true;
              }
            } else {
              throw new Error('Failed to access Factory Equipment tab or window sticker');
            }
          }

          if (config.readOnly) {
            logger.info('Read-only mode: Skipping window sticker processing');
          } else {
            // STEP 4: Extract window sticker content (embedded HTML, not PDF)
            logger.info('📄 Extracting window sticker content...');
            const stickerText = await getWindowStickerContent(page);
            
            if (stickerText && stickerText.length > 100) {
              logger.info(`✅ Successfully extracted window sticker content (${stickerText.length} characters)`);
              
              // Extract features from the HTML content
              featuresFound = extractFeaturesFromSticker(stickerText);
              logger.info(`🔍 Extracted ${featuresFound.length} features from window sticker`);
              
              if (featuresFound.length > 0) {
                logger.info('Features found: ' + featuresFound.slice(0, 5).join(', ') + (featuresFound.length > 5 ? '...' : ''));
                processed = true;
                
                // TODO: Map features to checkboxes and update them
                logger.warn('Checkbox mapping and updating not yet implemented');
              } else {
                logger.warn('No features extracted from window sticker content');
              }
            } else {
              logger.warn('Window sticker content not found or too short');
              errors.push('Failed to extract window sticker content');
            }
          }

          // Navigate back to inventory
          if (navigationSuccess) {
            await page.goBack();
            await page.waitForTimeout(3000);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(errorMessage);
          logger.error(`Failed to process vehicle ${i + 1}:`, error);
          
          // Recovery: Try to get back to inventory page
          try {
            const currentUrl = page.url();
            if (!currentUrl.includes('/Inventory/')) {
              logger.info('Attempting to recover - navigating back to inventory...');
              await page.goto(currentUrl.substring(0, currentUrl.indexOf('/Va/')) + '/Va/Inventory/');
              await page.waitForLoadState('networkidle');
              await page.waitForTimeout(3000);
            }
          } catch (recoveryError) {
            logger.error('Recovery failed:', recoveryError);
          }
        }

        // Update results
        if (processed) {
          results.processedVehicles++;
          results.windowStickersScraped++;
          results.totalFeaturesFound += featuresFound.length;
          results.totalCheckboxesUpdated += featuresUpdated.length;
        } else {
          results.failedVehicles++;
        }

        results.vehicles.push({
          vin: 'UNKNOWN', // TODO: Extract VIN from page
          processed,
          featuresFound,
          featuresUpdated,
          errors,
          windowStickerScraped: processed,
          factoryEquipmentAccessed: tabSuccess,
          featureUpdateReport: null,
          processingTime: Date.now() - vehicleStartTime,
          timestamp: new Date()
        });
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
    await page.screenshot({ path: `screenshots/vehicle-${vin}-details.png` });
    
    // Look for Factory Equipment link/button in the Vehicle Info tab
    try {
      logger.info('🏭 Looking for Factory Equipment link in Vehicle Info tab...');
      
      // Try multiple selectors for the Factory Equipment link
      const factoryEquipmentSelectors = [
        '//a[contains(text(), "Factory Equipment")]',
        '//button[contains(text(), "Factory Equipment")]',
        '//a[contains(text(), "Window Sticker")]',
        '//button[contains(text(), "Window Sticker")]',
        '//a[contains(@href, "factory-equipment")]',
        '//a[contains(@href, "window-sticker")]',
        '//div[@class="factory-equipment-link"]//a',
        '//td[contains(text(), "Factory Equipment")]//a'
      ];
      
      let factoryEquipmentLink: any = null;
      for (const selector of factoryEquipmentSelectors) {
        const link = page.locator(selector).first();
        if (await link.isVisible()) {
          factoryEquipmentLink = link;
          logger.info(`Found Factory Equipment link with selector: ${selector}`);
          break;
        }
      }
      
      if (factoryEquipmentLink) {
        logger.info('Clicking Factory Equipment link...');
        await factoryEquipmentLink.click();
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
          await page.screenshot({ path: `screenshots/vehicle-${vin}-factory-equipment-window.png` });
          
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
            const checkboxStates: Array<{id: string, label: string, checked: boolean}> = []; // TODO: Get checkbox states
            // await setCheckbox(...) - comment out if not defined
            
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
                    const success = false; // TODO: Implement checkbox update
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
        logger.warn('Factory Equipment link not found in Vehicle Info tab');
        
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
        await page.screenshot({ path: `screenshots/checkbox-test-${i + 1}-${label.replace(/[^a-zA-Z0-9]/g, '_')}.png` });
        
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
    // Multiple strategies to extract window sticker content
    // Workflow mentions: xpath=//div[contains(@class, 'window-sticker-details')]
    const contentSelectors = [
      // Primary selector from workflow
      '//div[contains(@class, "window-sticker-details")]',
      // Alternative window sticker container selectors
      '//div[contains(@class, "window-sticker")]',
      '//div[contains(@class, "monroney")]',
      '//div[contains(@class, "factory-equipment")]',
      '//div[@id="window-sticker-content"]',
      '//div[contains(@class, "sticker-content")]',
      // Look for sections directly
      '//div[contains(text(), "Interior") and following-sibling::*[contains(text(), "Mechanical")]]/..',
      // Iframe content
      '//iframe[contains(@src, "sticker")]',
      // Generic content containers
      '//div[contains(@class, "content-main")]',
      '//div[contains(@class, "equipment-details")]',
      '//pre', // Sometimes content is in pre tags
      'body' // Last resort - get all text
    ];
    
    for (const selector of contentSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          // Handle iframe content
          if (selector.includes('iframe')) {
            const frame = page.frameLocator(selector).first();
            const content = await frame.locator('body').textContent();
            if (content && content.length > 100) {
              return content;
            }
          } else {
            const content = await element.textContent();
            if (content && content.length > 100) { // Ensure meaningful content
              return content;
            }
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // If no specific container found, get all text
    const bodyText = await page.textContent('body');
    return bodyText || '';
    
  } catch (error) {
    console.warn('Failed to extract window sticker content:', error);
  }
  
  return '';
}

/**
 * Helper function to extract features from sticker content
 * Based on workflow: sections like "Interior," "Mechanical," "Comfort & Convenience"
 */
function extractFeaturesFromSticker(content: string): string[] {
  const features: string[] = [];
  
  // First, try to extract features by section
  const sections = {
    interior: /Interior[:\s]*([\s\S]*?)(?=\n\s*(?:Mechanical|Comfort|Safety|Exterior|$))/i,
    mechanical: /Mechanical[:\s]*([\s\S]*?)(?=\n\s*(?:Interior|Comfort|Safety|Exterior|$))/i,
    comfort: /(?:Comfort\s*&\s*Convenience|Convenience)[:\s]*([\s\S]*?)(?=\n\s*(?:Interior|Mechanical|Safety|Exterior|$))/i,
    safety: /Safety[:\s]*([\s\S]*?)(?=\n\s*(?:Interior|Mechanical|Comfort|Exterior|$))/i
  };
  
  // Extract features from each section
  for (const [sectionName, sectionRegex] of Object.entries(sections)) {
    const match = content.match(sectionRegex);
    if (match && match[1]) {
      const sectionContent = match[1];
      // Split by common delimiters (newlines, bullets, commas)
      const items = sectionContent.split(/[\n\r]+|\s*[•·-]\s*|\s*,\s*/);
      
      for (const item of items) {
        const cleaned = item.trim();
        // Skip empty lines or very short items
        if (cleaned.length > 3 && !cleaned.match(/^[\s\d]*$/)) {
          features.push(cleaned);
        }
      }
    }
  }
  
  // If no sections found, fall back to pattern matching
  if (features.length === 0) {
    // Split content into lines and look for feature-like items
    const lines = content.split(/[\n\r]+/);
    for (const line of lines) {
      const trimmed = line.trim();
      // Look for lines that appear to be features (not headers or prices)
      if (trimmed.length > 5 && 
          trimmed.length < 100 && 
          !trimmed.match(/^(Interior|Mechanical|Comfort|Safety|Exterior|MSRP|Price|Total)\s*:?$/i) &&
          !trimmed.match(/\$[\d,]+/) &&
          !trimmed.match(/^\d+$/)) {
        features.push(trimmed);
      }
    }
  }
  
  // Remove duplicates and clean up
  const uniqueFeatures = [...new Set(features)].map(f => {
    // Remove leading numbers or bullets
    return f.replace(/^[\d\.\)\-\*]+\s*/, '').trim();
  }).filter(f => f.length > 3);
  
  return uniqueFeatures;
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
          await checkbox.click();
          return true;
        }
      } catch (e) {
        // Try next selector
      }
    }
  } catch (error) {
    console.warn(`Failed to update checkbox by label "${labelText}":`, error);
  }
  return false;
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