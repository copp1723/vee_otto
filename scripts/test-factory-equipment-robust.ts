#!/usr/bin/env ts-node

import { BrowserAutomation } from '../core/utils/BrowserAutomation';
import { Logger } from '../core/utils/Logger';
import { Auth2FAService } from '../core/services/Auth2FAService';
import * as dotenv from 'dotenv';

dotenv.config();

const logger = new Logger('FactoryEquipmentRobustTest');

async function testFactoryEquipmentClick() {
  logger.info('🚀 Starting Robust Factory Equipment Click Test');
  
  if (!process.env.VAUTO_USERNAME || !process.env.VAUTO_PASSWORD) {
    logger.error('❌ VAUTO_USERNAME and VAUTO_PASSWORD environment variables required');
    return;
  }

  const browser = new BrowserAutomation({
    headless: false // Keep visible for debugging
  });

  try {
    await browser.initialize();
    const page = browser.currentPage;

    // Step 1: Login with 2FA
    logger.info('🔐 Starting login process...');
    const auth2FA = new Auth2FAService(page);

    await page.goto('https://signin.coxautoinc.com');
    await page.fill('#okta-signin-username', process.env.VAUTO_USERNAME);
    await page.fill('#okta-signin-password', process.env.VAUTO_PASSWORD);
    await page.click('#okta-signin-submit');

    // Handle 2FA
    await auth2FA.handleTwoFactorAuth();
    
    // Step 2: Navigate to inventory
    logger.info('🚗 Navigating to inventory...');
    await page.goto('https://provision.vauto.app.coxautoinc.com/Va/Inventory/');
    await page.waitForLoadState('networkidle');

    // Step 3: Apply Recent Inventory filter
    logger.info('🔍 Applying Recent Inventory filter...');
    await page.click('#ext-gen77'); // Filters button
    await page.waitForTimeout(1000);
    await page.click('#ext-gen514'); // Recent Inventory filter
    await page.waitForLoadState('networkidle');

    // Step 4: Click first vehicle
    logger.info('🎯 Clicking first vehicle...');
    const vehicleSelector = '//a[contains(@class, "YearMakeModel") and @onclick]';
    const vehicleLink = page.locator(vehicleSelector).first();
    
    if (await vehicleLink.isVisible({ timeout: 5000 })) {
      await vehicleLink.click();
      await page.waitForTimeout(3000);
      logger.info('✅ Vehicle clicked successfully');
    } else {
      throw new Error('Vehicle link not found');
    }

    // Step 5: Ensure Vehicle Info tab is active
    logger.info('📋 Ensuring Vehicle Info tab is active...');
    const gaugeFrame = page.frameLocator('#GaugePageIFrame');
    const vehicleInfoTab = gaugeFrame.locator('text=Vehicle Info').first();
    
    if (await vehicleInfoTab.isVisible({ timeout: 5000 })) {
      await vehicleInfoTab.click();
      await page.waitForTimeout(1000);
      logger.info('✅ Vehicle Info tab activated');
    }

    // Step 6: Test Factory Equipment button clicking with robust approach
    logger.info('🏭 Testing Factory Equipment button clicking...');
    
    const factoryButtonSelectors = [
      '#ext-gen199',  // Specific ID from breakthrough
      'button:has-text("Factory Equipment")',
      '//button[contains(text(), "Factory Equipment")]',
      'button[class*="x-btn-text"]:has-text("Factory Equipment")',
      '#ext-gen201',
      '#ext-gen175'
    ];

    let buttonClickSuccess = false;
    
    for (let attempt = 0; attempt < factoryButtonSelectors.length; attempt++) {
      const selector = factoryButtonSelectors[attempt];
      logger.info(`🔍 Testing selector ${attempt + 1}/${factoryButtonSelectors.length}: ${selector}`);
      
      try {
        const factoryButton = gaugeFrame.locator(selector).first();
        
        const isVisible = await factoryButton.isVisible({ timeout: 3000 });
        if (!isVisible) {
          logger.info(`❌ Button not visible with selector: ${selector}`);
          continue;
        }
        
        const isEnabled = await factoryButton.isEnabled();
        const outerHTML = await factoryButton.evaluate((el: Element) => el.outerHTML).catch(() => '[HTML not accessible]');
        
        logger.info(`✅ Found button - Selector: ${selector}, Visible: ${isVisible}, Enabled: ${isEnabled}`);
        logger.info(`Button HTML: ${outerHTML}`);

        if (isVisible && isEnabled) {
          // Test multiple click strategies
          const clickStrategies = [
            { name: 'normal', action: () => factoryButton.click() },
            { name: 'force', action: () => factoryButton.click({ force: true }) },
            { name: 'javascript', action: () => factoryButton.evaluate((el: HTMLElement) => el.click()) }
          ];

          for (const strategy of clickStrategies) {
            try {
              logger.info(`🖱️ Testing ${strategy.name} click`);
              
              const initialPageCount = page.context().pages().length;
              await strategy.action();
              await page.waitForTimeout(2000);
              
              // Check for new window
              const newPageCount = page.context().pages().length;
              if (newPageCount > initialPageCount) {
                const newPage = page.context().pages()[newPageCount - 1];
                const title = await newPage.title();
                logger.info(`✅ SUCCESS! New window opened with title: ${title}`);
                logger.info(`✅ Factory Equipment button click successful with selector: ${selector} and strategy: ${strategy.name}`);
                
                // Take screenshot of the new window
                await newPage.screenshot({ path: `debug-factory-equipment-success-${Date.now()}.png`, fullPage: true });
                
                buttonClickSuccess = true;
                break;
              }
              
              // Check for content change in iframe
              const hasStandardEquipment = await gaugeFrame.locator('//div[contains(text(), "Standard Equipment")]').isVisible({ timeout: 2000 }).catch(() => false);
              if (hasStandardEquipment) {
                logger.info(`✅ SUCCESS! Factory Equipment content loaded in iframe with selector: ${selector} and strategy: ${strategy.name}`);
                buttonClickSuccess = true;
                break;
              }
              
              logger.info(`⚠️ ${strategy.name} click completed but no expected result`);
              
            } catch (clickError) {
              logger.warn(`❌ ${strategy.name} click failed: ${clickError}`);
            }
          }
          
          if (buttonClickSuccess) break;
        }
        
      } catch (error) {
        logger.warn(`❌ Error with selector ${selector}: ${error}`);
      }
    }

    if (buttonClickSuccess) {
      logger.info('🎉 FACTORY EQUIPMENT BUTTON CLICK TEST PASSED!');
    } else {
      logger.error('❌ FACTORY EQUIPMENT BUTTON CLICK TEST FAILED - All selectors and strategies failed');
      await page.screenshot({ path: `debug-factory-equipment-test-failed-${Date.now()}.png`, fullPage: true });
    }

  } catch (error) {
    logger.error(`❌ Test failed: ${error}`);
    await browser.currentPage.screenshot({ path: `debug-test-error-${Date.now()}.png`, fullPage: true });
  } finally {
    await browser.cleanup();
  }
}

if (require.main === module) {
  testFactoryEquipmentClick().catch(console.error);
}