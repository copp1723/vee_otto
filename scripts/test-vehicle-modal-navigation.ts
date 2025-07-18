import { chromium } from 'playwright';
import { VAutoAgent } from '../platforms/vauto/VAutoAgent';
import { VehicleModalNavigationService } from '../platforms/vauto/services/VehicleModalNavigationService';
import { Logger } from '../core/utils/Logger';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Test script to verify Vehicle Info tab navigation and Factory Equipment button clicking
 */
async function testVehicleModalNavigation() {
  const logger = new Logger('VehicleModalNavigationTest');
  let browser;
  let page;

  try {
    logger.info('🚀 Starting Vehicle Modal Navigation Test...');

    // Launch browser
    browser = await chromium.launch({
      headless: false,
      args: ['--start-maximized']
    });

    const context = await browser.newContext({
      viewport: null
    });

    page = await context.newPage();

    // Initialize VAutoAgent for login
    const agent = new VAutoAgent({
      username: process.env.VAUTO_USERNAME!,
      password: process.env.VAUTO_PASSWORD!,
      headless: false
    });

    // Set up agent with our page
    agent['browser'] = { currentPage: page };
    agent['page'] = page;
    agent['logger'] = logger;

    // Login
    logger.info('📝 Logging into vAuto...');
    await agent.login();

    // Navigate to inventory
    logger.info('📦 Navigating to inventory...');
    await agent.navigateViaMenuAndApplySavedFilter();

    // Wait for inventory to load
    await page.waitForSelector('//tr[contains(@class, "x-grid3-row")]', { timeout: 30000 });
    
    // Get first vehicle link
    const vehicleLinks = await page.locator('//tr[contains(@class, "x-grid3-row")]//a[contains(@class, "YearMakeModel")]').all();
    
    if (vehicleLinks.length === 0) {
      throw new Error('No vehicle links found in inventory');
    }

    logger.info(`Found ${vehicleLinks.length} vehicles. Testing with first vehicle...`);

    // Click first vehicle
    await vehicleLinks[0].click();

    // Wait for modal to appear
    await page.waitForSelector('.x-window', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('#GaugePageIFrame', { state: 'visible', timeout: 10000 });

    logger.info('✅ Vehicle modal opened');

    // Initialize navigation service
    const navigationService = new VehicleModalNavigationService(page, logger);

    // Test 1: Detect current tab
    logger.info('\n🧪 TEST 1: Detecting current active tab...');
    const activeTab = await navigationService.detectActiveTab();
    logger.info(`Current active tab: ${activeTab}`);

    // Test 2: Ensure Vehicle Info tab is active
    logger.info('\n🧪 TEST 2: Ensuring Vehicle Info tab is active...');
    const tabNavigationSuccess = await navigationService.ensureVehicleInfoTabActive();
    
    if (tabNavigationSuccess) {
      logger.info('✅ Successfully ensured Vehicle Info tab is active');
    } else {
      logger.error('❌ Failed to ensure Vehicle Info tab is active');
    }

    // Test 3: Click Factory Equipment button
    logger.info('\n🧪 TEST 3: Clicking Factory Equipment button with tab verification...');
    const factoryButtonSuccess = await navigationService.clickFactoryEquipmentWithTabVerification();
    
    if (factoryButtonSuccess) {
      logger.info('✅ Successfully clicked Factory Equipment button');
      
      // Check if popup opened
      const pages = page.context().pages();
      if (pages.length > 1) {
        logger.info('✅ Factory Equipment popup window detected');
        
        // Close popup
        const popupPage = pages[pages.length - 1];
        await popupPage.close();
        logger.info('✅ Closed Factory Equipment popup');
      }
    } else {
      logger.error('❌ Failed to click Factory Equipment button');
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-vehicle-modal-navigation-final.png', fullPage: true });

    logger.info('\n📊 Test Summary:');
    logger.info(`- Active Tab Detection: ${activeTab !== 'unknown' ? '✅' : '❌'}`);
    logger.info(`- Vehicle Info Tab Navigation: ${tabNavigationSuccess ? '✅' : '❌'}`);
    logger.info(`- Factory Equipment Button Click: ${factoryButtonSuccess ? '✅' : '❌'}`);

  } catch (error) {
    logger.error('Test failed:', error);
    if (page) {
      await page.screenshot({ path: 'test-vehicle-modal-navigation-error.png', fullPage: true });
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testVehicleModalNavigation().catch(console.error);