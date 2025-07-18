import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import { Logger } from '../src/core/utils/Logger';
import { vAutoLoginPage } from '../src/platforms/vauto/pages/vAutoLoginPage';
import { VehicleSearchPage } from '../src/platforms/vauto/pages/VehicleSearchPage';
import { VehicleModalNavigationService } from '../src/platforms/vauto/services/VehicleModalNavigationService';

dotenv.config();

const logger = new Logger('FactoryEquipmentDebug');

async function debugFactoryEquipmentButton() {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Login
    const loginPage = new vAutoLoginPage(page, logger);
    await loginPage.login(process.env.VAUTO_USERNAME!, process.env.VAUTO_PASSWORD!);
    logger.info('✅ Logged in successfully');

    // 2. Navigate to a specific vehicle
    const searchPage = new VehicleSearchPage(page, logger);
    const vehicleId = '1234567'; // Replace with a valid vehicle ID for testing
    await searchPage.navigateToVehicleById(vehicleId);
    logger.info(`✅ Navigated to vehicle ID: ${vehicleId}`);

    // 3. Use the navigation service to click the button
    const modalNavService = new VehicleModalNavigationService(page, logger);
    
    logger.info('🔍 Attempting to click "Factory Equipment" button via service...');
    
    const success = await modalNavService.clickFactoryEquipmentWithTabVerification();

    if (success) {
      logger.info('✅ Successfully clicked "Factory Equipment" button!');
      // Add a delay to observe the result
      await page.waitForTimeout(5000); 
    } else {
      logger.error('❌ Failed to click "Factory Equipment" button.');
    }

  } catch (error) {
    logger.error('❌ An error occurred during the debug script:', error);
    await page.screenshot({ path: 'debug-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

debugFactoryEquipmentButton();
