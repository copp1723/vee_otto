import { TaskDefinition, TaskContext } from '../../../core/services/TaskOrchestrator';
import { Auth2FAService, Auth2FAConfig } from '../../../core/services/Auth2FAService';
import { WindowStickerService } from '../../../core/services/WindowStickerService';
import { InventoryFilterService } from '../../../core/services/InventoryFilterService';
import { VehicleValidationService } from '../../../core/services/VehicleValidationService';
import { CheckboxMappingService } from '../../../core/services/CheckboxMappingService';
import { SemanticFeatureMappingService } from '../../../core/services/SemanticFeatureMappingService';
import { IntelligentAnomalyDetector, VehicleAnomalyData } from '../../../core/services/IntelligentAnomalyDetector';
import { Page, Locator } from 'playwright';
import { reliableClick } from '../../../core/utils/reliabilityUtils';
import { vAutoSelectors } from '../vautoSelectors';
import { TIMEOUTS, LIMITS, URLS } from '../../../core/config/constants';
import {
  mapFeaturesToCheckboxes,
  determineCheckboxActions,
  generateFeatureReport,
  FeatureUpdateReport
} from '../featureMapping';
import { ReportingService, RunSummary, VehicleProcessingResult as ReportVehicleResult } from '../../../core/services/ReportingService';
import { NavigationMetrics } from '../../../core/metrics/NavigationMetrics';
import { VehicleLink, NavigationStrategy, NavigationResult } from '../../../core/types';

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
  timeout: TIMEOUTS.LOGIN,
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
  timeout: TIMEOUTS.TWO_FACTOR,
  retryCount: 1, // Don't retry 2FA to avoid code expiration
  critical: true,
  
  async execute(context: TaskContext): Promise<any> {
    const { page, config, logger } = context;
    
    logger.info('🔐 Starting 2FA authentication...');
    
    // Configure 2FA service with your working settings
    const auth2FAConfig: Auth2FAConfig = {
      webhookUrl: config.webhookUrl || `${process.env.PUBLIC_URL || 'http://localhost:3000'}/api/2fa/latest`,
      timeout: TIMEOUTS.TWO_FACTOR,
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
  timeout: TIMEOUTS.LOGIN,
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
  timeout: TIMEOUTS.LOGIN * 2, // Double timeout for navigation
  retryCount: 2,
  critical: true,
  
  async execute(context: TaskContext): Promise<any> {
    const { page, config, logger } = context;
    
    const filterService = new InventoryFilterService(page, logger);
    const result = await filterService.applyFilters();
    
    if (!result.success) {
      throw new Error(`Filter application failed: ${result.error}`);
    }
    
    return {
      vehicleCount: result.vehicleCount,
      filterMethod: result.filterMethod,
      appliedFilter: result.appliedFilter,
      timestamp: new Date()
    };
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
  timeout: TIMEOUTS.TWO_FACTOR * 2, // 10 minutes for full vehicle processing
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
      let detailedLinks: VehicleLink[] = [];
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
            // Use validation service to identify vehicle detail links
            const validationService = new VehicleValidationService(page, logger);
            for (const link of rowLinks) {
              if (await validationService.isVehicleDetailLink(link)) {
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
      
      // ENHANCEMENT 1: Enhanced vehicle link metadata collection
      for (let i = 0; i < vehicleLinks.length; i++) {
        const link = vehicleLinks[i];
        detailedLinks.push({
          locator: link,
          text: await link.textContent() || '',
          href: await link.getAttribute('href') || '',
          onclick: await link.getAttribute('onclick') || '',
          index: i
        });
      }
      
      // Enhanced debugging info with metadata
      if (detailedLinks.length > 0) {
        const firstLink = detailedLinks[0];
        logger.info(`📋 Enhanced Sample Link - Text: "${firstLink.text}", Href: "${firstLink.href}", Onclick: "${firstLink.onclick}"`);
        logger.info(`📊 Link Quality Assessment: ${detailedLinks.filter(link => link.onclick !== '').length}/${detailedLinks.length} links have onclick handlers`);
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
        let vehicleData: any = null;

        try {
          logger.info(`Processing vehicle ${i + 1}/${vehiclesToProcess}...`);
          
          // Store current URL to verify navigation
          const beforeClickUrl = page.url();
          
          // Record navigation start time
          const navStartTime = Date.now();
          
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
          const detailsLoaded = await page.locator('//a[contains(text(), "Vehicle Info")] | //div[contains(@class, "vehicle-details")] | //*[@id="GaugePageIFrame"]').first().isVisible({ timeout: TIMEOUTS.PAGE_LOAD }).catch(() => false);
          
          // Record navigation metrics
          NavigationMetrics.recordNavigationAttempt(i, navStartTime, {
            success: detailsLoaded,
            navigationMethod: navigationSuccess ? 'primary' : 'fallback',
            url: afterClickUrl,
            error: detailsLoaded ? undefined : 'Vehicle details page not loaded'
          });
          NavigationMetrics.recordOperationTime(i, 'navigation', Date.now() - navStartTime);
          
          if (!detailsLoaded) {
            logger.warn('Vehicle details page may not have loaded properly');
            // Take debug screenshot
            await page.screenshot({ path: `screenshots/vehicle-${i + 1}-navigation-issue.png` });
          }
          
          await page.screenshot({ path: `screenshots/vehicle-${i + 1}-details-page.png` });

          // Extract vehicle data
          const validationService = new VehicleValidationService(page, logger);
          const vehicleResult = await validationService.extractVehicleData();
          vehicleData = vehicleResult.vehicleData;
          
          // Initialize anomaly detector for this vehicle
          const anomalyDetector = new IntelligentAnomalyDetector({
            pricingThreshold: 0.25,
            enableSMSAlerts: false,
            logger
          });
          
          if (!vehicleResult.success) {
            errors.push(`Failed to extract vehicle data: ${vehicleResult.error}`);
          }

          logger.info(`📋 On Vehicle Info page for ${vehicleData.vin}, preparing to access Factory Equipment...`);
          
          // Record tab access start time
          const tabStartTime = Date.now();
          
          // STEP 1: Select the GaugePageIFrame as per workflow
          logger.info('🖼️ Selecting GaugePageIFrame...');
          let factoryFrame: import('playwright').FrameLocator | null = null;
          try {
            // Try iframe by ID first
            factoryFrame = page.frameLocator('#GaugePageIFrame');
            // Verify frame exists by trying to access an element
            if (factoryFrame) {
              await factoryFrame.locator('body').waitFor({ timeout: TIMEOUTS.NAVIGATION });
            }
            logger.info('✅ Successfully selected GaugePageIFrame');
          } catch (frameError) {
            logger.warn('Could not access GaugePageIFrame, continuing without frame context');
            // Continue without frame - some implementations might not use iframe
          }
          
          await page.screenshot({ path: `screenshots/before-factory-tab.png` });
          logger.info('🛢 Navigating to Factory Equipment tab...');
          
          // ENHANCEMENT 2: Named navigation strategies for better debugging/metrics
          const tabNavigationStrategies: NavigationStrategy[] = [
            {
              name: 'iframe-id-selector',
              execute: async () => {
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
              }
            },
            
            {
              name: 'direct-id-selector',
              execute: async () => {
                // The workflow specifies id=ext-gen201
                return await reliableClick(page, '#ext-gen201', 'Factory Equipment Tab');
              }
            },
            
            {
              name: 'alternative-selectors',
              execute: async () => {
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
              }
            },
            
            {
              name: 'javascript-extjs-click',
              execute: async () => {
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
              }
            },
            
            {
              name: 'position-based-click',
              execute: async () => {
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
            }
          ];
          
          let usedStrategy = '';
          for (const strategy of tabNavigationStrategies) {
            try {
              tabSuccess = await strategy.execute();
              if (tabSuccess) {
                usedStrategy = strategy.name;
                NavigationMetrics.recordNavigationStrategy(i, strategy.name);
                await page.waitForTimeout(2000);
                await page.screenshot({ path: `screenshots/after-factory-tab.png` });
                logger.info(`✅ Successfully navigated to Factory Equipment tab using strategy: ${strategy.name}`);
                
                // Record tab access time
                NavigationMetrics.recordOperationTime(i, 'tabAccess', Date.now() - tabStartTime);
                break;
              }
            } catch (e) {
              logger.debug(`Strategy ${strategy.name} failed: ${e}`);
              continue;
            }
          }
          
          if (tabSuccess) {
            await page.waitForTimeout(2000);
            
            // STEP 2: Check if a new window opened with title=factory-equipment-details
            logger.info('🪟 Checking for factory-equipment-details window...');
            const pages = page.context().pages();
            let factoryWindow: Page | null = null;
            
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
              // Only assign if not null
              if (factoryWindow) {
                page = factoryWindow;
                await page.waitForLoadState('networkidle');
                await page.screenshot({ path: `screenshots/vehicle-${i + 1}-factory-window.png` });
              }
            } else {
              // STEP 3: Look for View Window Sticker button (inline content scenario)
              logger.info('📄 No separate window found. Looking for View Window Sticker button...');
              
              // Try within iframe first if available
              let stickerButton;
              if (factoryFrame) {
                stickerButton = factoryFrame.locator('//button[contains(text(), "View Window Sticker")] | //a[contains(text(), "Window Sticker")]').first();
              } else {
                stickerButton = page.locator('//button[contains(text(), "View Window Sticker")] | //a[contains(text(), "Window Sticker")]').first();
              }
              if (stickerButton && await stickerButton.isVisible({ timeout: TIMEOUTS.NAVIGATION })) {
                logger.info('Found window sticker button, clicking...');
                await stickerButton.click();
                await page.waitForTimeout(2000);
                // Check again for new window after button click
                const pagesAfterClick = page.context().pages();
                for (const p of pagesAfterClick) {
                  const title = await p.title();
                  if (title === 'factory-equipment-details' || title.includes('factory-equipment')) {
                    factoryWindow = p;
                    if (factoryWindow) {
                      page = factoryWindow;
                      await page.waitForLoadState('networkidle');
                    }
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
            
            if (await directStickerLink.isVisible({ timeout: TIMEOUTS.NAVIGATION })) {
              logger.info('Found direct window sticker link in Vehicle Info tab');
              const [newPage] = await Promise.all([
                page.context().waitForEvent('page', { timeout: TIMEOUTS.PAGE_LOAD }),
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
            // Record window sticker extraction start time
            const windowStickerStartTime = Date.now();
            
            // STEP 4: Extract window sticker content using service
            logger.info('📄 Extracting window sticker content...');
            const windowStickerService = new WindowStickerService();
            const extractedData = await windowStickerService.extractFeatures(page);
            
            // Record window sticker extraction time
            NavigationMetrics.recordOperationTime(i, 'windowSticker', Date.now() - windowStickerStartTime);
            
            if (extractedData.features.length > 0) {
              logger.info(`✅ Successfully extracted ${extractedData.features.length} features from window sticker`);
              featuresFound = extractedData.features;
              logger.info('Features found: ' + featuresFound.slice(0, 5).join(', ') + (featuresFound.length > 5 ? '...' : ''));
              processed = true;
              
              // Map features to checkboxes and update them
              const checkboxStartTime = Date.now();
              const useSemantic = config.useSemanticFeatureMapping === true;
              const checkboxService = useSemantic
                ? new SemanticFeatureMappingService(page, logger, {
                    similarityThreshold: config.semanticSimilarityThreshold || 0.8,
                    useSemanticMatching: true,
                    maxResults: config.semanticMaxResults || 5
                  })
                : new CheckboxMappingService(page, logger);
              const checkboxResult = await checkboxService.mapAndUpdateCheckboxes(featuresFound);
              
              if (checkboxResult.success) {
                featuresUpdated = checkboxResult.actions
                  .filter(action => action.action !== 'none')
                  .map(action => `${action.label} (${action.action})`);
                logger.info(`✅ Updated ${checkboxResult.checkboxesUpdated} checkboxes`);
                
                // Run anomaly detection on processed vehicle data
                try {
                  const anomalyData: VehicleAnomalyData = {
                    vin: vehicleData.vin,
                    year: vehicleData.year ? parseInt(vehicleData.year) : undefined,
                    make: vehicleData.make,
                    model: vehicleData.model,
                    features: featuresFound,
                    // Note: Price and mileage would need to be extracted from additional sources
                    // This is a minimal implementation focusing on feature anomalies
                  };
                  
                  const anomalyReport = await anomalyDetector.analyzeVehicle(anomalyData);
                  
                  if (anomalyReport.totalAnomalies > 0) {
                    logger.warn(`🚨 ${anomalyReport.totalAnomalies} anomalies detected for ${vehicleData.vin}:`);
                    anomalyReport.anomalies.forEach(anomaly => {
                      logger.warn(`  - ${anomaly.type}: ${anomaly.message} (${anomaly.severity})`);
                    });
                    
                    // Add anomaly info to errors for reporting
                    errors.push(`Anomalies detected: ${anomalyReport.overallRisk} risk level`);
                  } else {
                    logger.info(`✅ No anomalies detected for ${vehicleData.vin}`);
                  }
                } catch (anomalyError) {
                  logger.warn('Anomaly detection failed:', anomalyError);
                }
              } else {
                errors.push(...checkboxResult.errors);
              }
              
              NavigationMetrics.recordOperationTime(i, 'checkboxUpdate', Date.now() - checkboxStartTime);
            } else {
              logger.warn('No features extracted from window sticker content');
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
          logger.error(`Failed to process vehicle ${i + 1} (${vehicleData?.vin || 'UNKNOWN'}):`, error);
          
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
          vin: vehicleData?.vin || 'UNKNOWN',
          processed,
          featuresFound,
          featuresUpdated,
          errors,
          windowStickerScraped: processed,
          factoryEquipmentAccessed: tabSuccess,
          featureUpdateReport: null,
          processingTime: Date.now() - vehicleStartTime,
          timestamp: new Date(),
          vehicleData, // Include full vehicle data
          success: processed
        });
      }
      
      logger.info(`✅ Vehicle processing completed. Processed: ${results.processedVehicles}, Failed: ${results.failedVehicles}`);
      
      // Log navigation performance metrics
      const navMetrics = NavigationMetrics.generateReport();
      logger.info('📊 Navigation Performance Summary:');
      logger.info(`  Success Rate: ${navMetrics.successRate.toFixed(1)}%`);
      logger.info(`  Avg Navigation Time: ${(navMetrics.avgNavigationTime / 1000).toFixed(2)}s`);
      logger.info(`  Avg Tab Access Time: ${(navMetrics.timeBreakdown.tabAccess / 1000).toFixed(2)}s`);
      logger.info(`  Avg Window Sticker Time: ${(navMetrics.timeBreakdown.windowSticker / 1000).toFixed(2)}s`);
      logger.info(`  Total Avg Time per Vehicle: ${(navMetrics.timeBreakdown.total / 1000).toFixed(2)}s`);
      
      // Log failure patterns if any
      if (Object.keys(navMetrics.failurePatterns).length > 0) {
        logger.info('🔍 Top Failure Patterns:');
        Object.entries(navMetrics.failurePatterns)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .forEach(([pattern, count]) => {
            logger.info(`  - ${pattern}: ${count} occurrences`);
          });
      }
      
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
      
      // ENHANCEMENT 3: Structured result objects with error context
      const navigationResult: NavigationResult = {
        success: results.processedVehicles > 0,
        strategy: usedSelector || 'unknown',
        metadata: {
          totalVehicles: results.totalVehicles,
          processedVehicles: results.processedVehicles,
          failedVehicles: results.failedVehicles,
          windowStickersScraped: results.windowStickersScraped,
          totalFeaturesFound: results.totalFeaturesFound,
          totalCheckboxesUpdated: results.totalCheckboxesUpdated,
          reportPaths,
          navigationMetrics: NavigationMetrics.generateReport()
        },
        processingTime: Date.now() - startTime.getTime(),
        error: results.errors.length > 0 ? `${results.errors.length} errors occurred` : undefined
      };
      
      return navigationResult;
      
    } catch (error) {
      logger.error('Vehicle processing failed:', error);
      throw error;
    }
  }
};

// REMOVED: getVehicleVIN function - moved to VehicleValidationService

/**
 * Helper function to process vehicle features including factory equipment
 */
async function processVehicleFeatures(page: Page, vehicleIndex: number, config: any, logger: any): Promise<any> {
  // Extract vehicle data first
  const validationService = new VehicleValidationService(page, logger);
  const vehicleDataResult = await validationService.extractVehicleData();
  const vin = vehicleDataResult.vehicleData.vin;
  
  const result = {
    vin,
    vehicleData: vehicleDataResult.vehicleData,
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
              
              // Use semantic or fuzzy mapping for checkbox updates
              const useSemantic = config.useSemanticFeatureMapping === true;
              const checkboxService = useSemantic
                ? new SemanticFeatureMappingService(page, logger, {
                    similarityThreshold: config.semanticSimilarityThreshold || 0.8,
                    useSemanticMatching: true,
                    maxResults: config.semanticMaxResults || 5
                  })
                : new CheckboxMappingService(page, logger);
              const checkboxResult = await checkboxService.mapAndUpdateCheckboxes(result.featuresFound);
              
              if (checkboxResult.success) {
                result.featuresUpdated = checkboxResult.actions
                  .filter(action => action.action !== 'none')
                  .map(action => `${action.label} (${action.action})`);
                logger.info(`📊 Updated ${checkboxResult.checkboxesUpdated} checkboxes`);
              } else {
                result.errors.push(...checkboxResult.errors);
              }
              
              // Save changes if any updates were made
              if (checkboxResult.checkboxesUpdated > 0) {
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
                [], // FeatureMatch[] - not available in this context
                checkboxResult.actions || [],
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
      const windowStickerService = new WindowStickerService();
      const extractedData = await windowStickerService.extractFeatures(page);
      result.featuresFound = extractedData.features;
      logger.info(`Found ${result.featuresFound.length} features in window sticker`);
    } catch (error) {
      result.errors.push(`Window sticker processing failed: ${error}`);
    }
    
    // Update checkboxes based on features (if not in read-only mode)
    if (!config.readOnlyMode && result.factoryEquipmentAccessed) {
      try {
        const useSemantic = config.useSemanticFeatureMapping === true;
        const checkboxService = useSemantic
          ? new SemanticFeatureMappingService(page, logger, {
              similarityThreshold: config.semanticSimilarityThreshold || 0.8,
              useSemanticMatching: true,
              maxResults: config.semanticMaxResults || 5
            })
          : new CheckboxMappingService(page, logger);
        const checkboxResult = await checkboxService.mapAndUpdateCheckboxes(result.featuresFound);
        
        if (checkboxResult.success) {
          result.featuresUpdated = checkboxResult.actions
            .filter(action => action.action !== 'none')
            .map(action => `${action.label} (${action.action})`);
          logger.info(`Updated ${checkboxResult.checkboxesUpdated} feature checkboxes`);
        } else {
          result.errors.push(...checkboxResult.errors);
        }
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

// REMOVED: Fuzzy matching and checkbox update functions - moved to CheckboxMappingService

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