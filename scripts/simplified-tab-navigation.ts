import { Page } from 'playwright';
import { Logger } from '../core/utils/Logger';

/**
 * Simplified Vehicle Info tab navigation based on yesterday's working solution
 */
export class SimplifiedTabNavigator {
  constructor(
    private page: Page,
    private logger: Logger
  ) {}

  /**
   * Simple check if we're on Vehicle Info tab
   */
  async isOnVehicleInfoTab(): Promise<boolean> {
    try {
      // Check for Factory Equipment button - it's only visible on Vehicle Info tab
      const factoryButton = this.page.locator('#ext-gen199');
      const isVisible = await factoryButton.isVisible({ timeout: 1000 });
      
      if (isVisible) {
        this.logger.info('✅ Already on Vehicle Info tab (Factory Equipment button visible)');
        return true;
      }
      
      // Secondary check - look for VIN label
      const vinLabel = this.page.locator('label:text("VIN:")');
      if (await vinLabel.isVisible({ timeout: 500 })) {
        this.logger.info('✅ Already on Vehicle Info tab (VIN label visible)');
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Navigate to Vehicle Info tab using the simple approach that worked yesterday
   */
  async navigateToVehicleInfoTab(): Promise<boolean> {
    try {
      // First check if we're already there
      if (await this.isOnVehicleInfoTab()) {
        return true;
      }

      this.logger.info('📑 Need to navigate to Vehicle Info tab...');

      // Wait for modal to be ready
      await this.page.waitForSelector('.x-window', { state: 'visible', timeout: 5000 });

      // Simple approach that worked yesterday - just click the text
      this.logger.info('🎯 Clicking Vehicle Info tab using simple text selector...');
      
      try {
        // Try the simple text selector first
        await this.page.click('text=Vehicle Info', { timeout: 3000 });
        this.logger.info('✅ Clicked Vehicle Info tab');
      } catch (error) {
        // If that fails, try with force
        this.logger.info('⚡ Trying force click...');
        await this.page.click('text=Vehicle Info', { force: true, timeout: 3000 });
        this.logger.info('✅ Force clicked Vehicle Info tab');
      }

      // Wait for tab content to load
      await this.page.waitForTimeout(1500);

      // Verify we're now on Vehicle Info tab
      if (await this.isOnVehicleInfoTab()) {
        this.logger.info('✅ Successfully navigated to Vehicle Info tab');
        return true;
      }

      // If simple approach failed, try alternative selectors
      const alternativeSelectors = [
        'text="VEHICLE INFO"', // Uppercase variant
        ':text("Vehicle Info")', // Playwright text selector
        'span:text("Vehicle Info")', // Span with text
        '*:has-text("Vehicle Info"):not(:has(*))', // Element with text but no children
      ];

      for (const selector of alternativeSelectors) {
        try {
          this.logger.info(`🎯 Trying alternative selector: ${selector}`);
          await this.page.click(selector, { timeout: 2000 });
          await this.page.waitForTimeout(1500);
          
          if (await this.isOnVehicleInfoTab()) {
            this.logger.info('✅ Successfully navigated with alternative selector');
            return true;
          }
        } catch (error) {
          // Continue with next selector
        }
      }

      this.logger.error('❌ Failed to navigate to Vehicle Info tab');
      return false;

    } catch (error) {
      this.logger.error('Error navigating to Vehicle Info tab:', error);
      return false;
    }
  }

  /**
   * Click Factory Equipment button (simplified version)
   */
  async clickFactoryEquipment(): Promise<boolean> {
    try {
      // Ensure we're on Vehicle Info tab first
      if (!await this.navigateToVehicleInfoTab()) {
        this.logger.error('❌ Cannot click Factory Equipment - not on Vehicle Info tab');
        return false;
      }

      this.logger.info('🏭 Clicking Factory Equipment button...');

      // Use the exact ID that's always in the same spot
      const factoryButton = this.page.locator('#ext-gen199');
      
      // Wait for button to be visible
      await factoryButton.waitFor({ state: 'visible', timeout: 5000 });
      
      // Store initial window count
      const initialPages = this.page.context().pages().length;
      
      // Click the button
      try {
        await factoryButton.click({ timeout: 3000 });
        this.logger.info('✅ Clicked Factory Equipment button');
      } catch (error) {
        // Try force click
        this.logger.info('⚡ Trying force click...');
        await factoryButton.click({ force: true, timeout: 3000 });
        this.logger.info('✅ Force clicked Factory Equipment button');
      }

      // Wait for action to complete
      await this.page.waitForTimeout(2000);

      // Check for new window
      const finalPages = this.page.context().pages().length;
      if (finalPages > initialPages) {
        this.logger.info('✅ Factory Equipment window opened in new tab');
        return true;
      }

      // Alternative: Use text selector as fallback
      try {
        await this.page.click('text=Factory Equipment', { timeout: 2000 });
        this.logger.info('✅ Clicked Factory Equipment using text selector');
        return true;
      } catch (error) {
        this.logger.debug('Text selector fallback failed');
      }

      this.logger.warn('⚠️ Factory Equipment clicked but no new window detected');
      return true; // Still return true as click was successful

    } catch (error) {
      this.logger.error('Error clicking Factory Equipment:', error);
      return false;
    }
  }
}

// Export convenience function
export async function ensureVehicleInfoAndClickFactoryEquipment(page: Page, logger: Logger): Promise<boolean> {
  const navigator = new SimplifiedTabNavigator(page, logger);
  return await navigator.clickFactoryEquipment();
}