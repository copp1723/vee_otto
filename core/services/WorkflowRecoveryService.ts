import { Page } from 'playwright';
import { TIMEOUTS } from '../config/constants';

export interface RecoveryResult {
  success: boolean;
  method: string;
  error?: string;
}

export class WorkflowRecoveryService {
  private page: Page;
  private logger: any;

  constructor(page: Page, logger: any) {
    this.page = page;
    this.logger = logger;
  }

  /**
   * Recover from vehicle navigation failures
   */
  async recoverFromNavigationFailure(): Promise<RecoveryResult> {
    this.logger.info('🔄 Attempting navigation recovery...');

    try {
      // Strategy 1: Check if we're still on inventory page
      const currentUrl = this.page.url();
      if (currentUrl.includes('/Inventory/')) {
        this.logger.info('✅ Still on inventory page, no recovery needed');
        return { success: true, method: 'no-recovery-needed' };
      }

      // Strategy 2: Use browser back button
      try {
        await this.page.goBack();
        await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.NAVIGATION });
        
        if (this.page.url().includes('/Inventory/')) {
          this.logger.info('✅ Recovered using browser back button');
          return { success: true, method: 'browser-back' };
        }
      } catch (e) {
        this.logger.warn('Browser back failed:', e);
      }

      // Strategy 3: Direct navigation to inventory
      const inventoryUrl = this.constructInventoryUrl(currentUrl);
      if (inventoryUrl) {
        await this.page.goto(inventoryUrl);
        await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.NAVIGATION });
        
        if (this.page.url().includes('/Inventory/')) {
          this.logger.info('✅ Recovered using direct navigation');
          return { success: true, method: 'direct-navigation' };
        }
      }

      return { success: false, method: 'navigation-recovery', error: 'All recovery methods failed' };

    } catch (error) {
      return { 
        success: false, 
        method: 'navigation-recovery', 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Recover from window sticker access failures
   */
  async recoverFromWindowStickerFailure(vehicleVin: string): Promise<RecoveryResult> {
    this.logger.info(`🔄 Attempting window sticker recovery for ${vehicleVin}...`);

    try {
      // Strategy 1: Look for alternative sticker access methods
      const alternativeSelectors = [
        '//a[contains(text(), "Monroney")]',
        '//a[contains(text(), "MSRP")]',
        '//a[contains(text(), "Sticker")]',
        '//button[contains(text(), "Equipment")]'
      ];

      for (const selector of alternativeSelectors) {
        try {
          const element = this.page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            await element.click();
            await this.page.waitForTimeout(2000);
            
            // Check if content is now available
            const hasContent = await this.checkForStickerContent();
            if (hasContent) {
              this.logger.info(`✅ Recovered window sticker access using: ${selector}`);
              return { success: true, method: 'alternative-selector' };
            }
          }
        } catch (e) {
          continue;
        }
      }

      // Strategy 2: Skip this vehicle and log for manual review
      this.logger.warn(`⚠️ Window sticker unavailable for ${vehicleVin}, marking for manual review`);
      return { success: false, method: 'skip-vehicle', error: 'Window sticker not accessible' };

    } catch (error) {
      return { 
        success: false, 
        method: 'window-sticker-recovery', 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Recover from checkbox update failures
   */
  async recoverFromCheckboxFailure(): Promise<RecoveryResult> {
    this.logger.info('🔄 Attempting checkbox update recovery...');

    try {
      // Strategy 1: Refresh the page and try again
      await this.page.reload({ waitUntil: 'networkidle' });
      await this.page.waitForTimeout(3000);
      
      // Check if checkboxes are now accessible
      const checkboxCount = await this.page.locator('input[type="checkbox"]').count();
      if (checkboxCount > 0) {
        this.logger.info('✅ Checkboxes accessible after page refresh');
        return { success: true, method: 'page-refresh' };
      }

      // Strategy 2: Try to navigate back to Factory Equipment tab
      const factoryTab = this.page.locator('//a[contains(text(), "Factory Equipment")]').first();
      if (await factoryTab.isVisible({ timeout: 2000 })) {
        await factoryTab.click();
        await this.page.waitForTimeout(2000);
        
        const newCheckboxCount = await this.page.locator('input[type="checkbox"]').count();
        if (newCheckboxCount > 0) {
          this.logger.info('✅ Checkboxes accessible after tab navigation');
          return { success: true, method: 'tab-navigation' };
        }
      }

      return { success: false, method: 'checkbox-recovery', error: 'Checkboxes remain inaccessible' };

    } catch (error) {
      return { 
        success: false, 
        method: 'checkbox-recovery', 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Recover from session timeout or authentication issues
   */
  async recoverFromSessionFailure(): Promise<RecoveryResult> {
    this.logger.info('🔄 Attempting session recovery...');

    try {
      // Check for session timeout indicators
      const sessionTimeoutSelectors = [
        '//div[contains(text(), "session") and contains(text(), "expired")]',
        '//div[contains(text(), "Please log in")]',
        '//div[contains(@class, "login")]'
      ];

      let sessionExpired = false;
      for (const selector of sessionTimeoutSelectors) {
        if (await this.page.locator(selector).isVisible({ timeout: 1000 })) {
          sessionExpired = true;
          break;
        }
      }

      if (sessionExpired) {
        this.logger.warn('⚠️ Session expired detected - requires re-authentication');
        return { success: false, method: 'session-recovery', error: 'Session expired - re-authentication required' };
      }

      // Check if we're redirected to login page
      const currentUrl = this.page.url();
      if (currentUrl.includes('signin') || currentUrl.includes('login')) {
        this.logger.warn('⚠️ Redirected to login page - authentication required');
        return { success: false, method: 'session-recovery', error: 'Redirected to login - re-authentication required' };
      }

      return { success: true, method: 'session-check', error: 'Session appears to be valid' };

    } catch (error) {
      return { 
        success: false, 
        method: 'session-recovery', 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Generic recovery for page load failures
   */
  async recoverFromPageLoadFailure(): Promise<RecoveryResult> {
    this.logger.info('🔄 Attempting page load recovery...');

    try {
      // Strategy 1: Wait longer for page to load
      await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.PAGE_LOAD * 2 });
      
      // Strategy 2: Check for loading indicators and wait
      const loadingSelectors = [
        '//div[contains(@class, "loading")]',
        '//div[contains(@class, "spinner")]',
        '//div[contains(@class, "ext-el-mask")]'
      ];

      for (const selector of loadingSelectors) {
        try {
          const loadingElement = this.page.locator(selector);
          if (await loadingElement.isVisible({ timeout: 1000 })) {
            this.logger.info('Waiting for loading indicator to disappear...');
            await loadingElement.waitFor({ state: 'hidden', timeout: TIMEOUTS.PAGE_LOAD });
          }
        } catch (e) {
          continue;
        }
      }

      // Strategy 3: Refresh page if still having issues
      const pageTitle = await this.page.title();
      if (!pageTitle || pageTitle.includes('Error') || pageTitle.includes('404')) {
        this.logger.info('Page appears to have errors, refreshing...');
        await this.page.reload({ waitUntil: 'networkidle' });
        await this.page.waitForTimeout(3000);
      }

      return { success: true, method: 'page-load-recovery' };

    } catch (error) {
      return { 
        success: false, 
        method: 'page-load-recovery', 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Construct inventory URL from current URL
   */
  private constructInventoryUrl(currentUrl: string): string | null {
    try {
      const url = new URL(currentUrl);
      return `${url.protocol}//${url.hostname}/Va/Inventory/`;
    } catch (e) {
      return null;
    }
  }

  /**
   * Check if window sticker content is available
   */
  private async checkForStickerContent(): Promise<boolean> {
    const contentSelectors = [
      '//div[contains(@class, "window-sticker")]',
      '//div[contains(@class, "factory-equipment")]',
      '//div[contains(@class, "sticker-content")]'
    ];

    for (const selector of contentSelectors) {
      try {
        const element = this.page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          const content = await element.textContent();
          if (content && content.length > 50) {
            return true;
          }
        }
      } catch (e) {
        continue;
      }
    }

    return false;
  }
}