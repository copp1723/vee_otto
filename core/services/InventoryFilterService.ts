import { Page } from 'playwright';
import { vAutoSelectors } from '../../platforms/vauto/vautoSelectors';
import { TIMEOUTS } from '../config/constants';

export interface FilterResult {
  success: boolean;
  vehicleCount: number;
  filterMethod: string;
  appliedFilter?: string;
  error?: string;
}

export class InventoryFilterService {
  private page: Page;
  private logger: any;

  constructor(page: Page, logger: any) {
    this.page = page;
    this.logger = logger;
  }

  /**
   * Apply inventory filters using saved filters first, manual as fallback
   */
  async applyFilters(): Promise<FilterResult> {
    this.logger.info('🔍 Applying inventory filters...');

    try {
      await this.page.waitForTimeout(5000);

      // Strategy 1: Saved filters (most reliable)
      const savedResult = await this.applySavedFilter();
      if (savedResult.success && savedResult.vehicleCount > 0) {
        return savedResult;
      }

      // Strategy 2: Manual filter fallback
      this.logger.info('⚠️ Saved filters failed, trying manual filter...');
      return await this.applyManualFilter();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Filter application failed: ${errorMessage}`);
      return {
        success: false,
        vehicleCount: 0,
        filterMethod: 'failed',
        error: errorMessage
      };
    }
  }

  /**
   * Apply saved "Recent Inventory" filter
   */
  private async applySavedFilter(): Promise<FilterResult> {
    this.logger.info('🎯 Attempting saved "Recent Inventory" filter...');

    try {
      await this.page.screenshot({ path: 'screenshots/before-saved-filter.png' });

      // Find and click saved filters dropdown
      const dropdownOpened = await this.openSavedFiltersDropdown();
      if (!dropdownOpened) {
        return { success: false, vehicleCount: 0, filterMethod: 'saved-filter', error: 'Could not open dropdown' };
      }

      // Find and click target filter
      const targetItem = await this.findTargetFilterItem();
      if (!targetItem) {
        return { success: false, vehicleCount: 0, filterMethod: 'saved-filter', error: 'No suitable filter found' };
      }

      // Apply the filter
      await this.clickFilterItem(targetItem);
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(5000);

      // Count vehicles after filter
      const vehicleCount = await this.countVehicles();
      
      this.logger.info(`✅ Saved filter applied. Found ${vehicleCount} vehicles`);
      return {
        success: true,
        vehicleCount,
        filterMethod: 'saved-filter',
        appliedFilter: targetItem.text
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, vehicleCount: 0, filterMethod: 'saved-filter', error: errorMessage };
    }
  }

  /**
   * Apply manual age filter as fallback
   */
  private async applyManualFilter(): Promise<FilterResult> {
    this.logger.info('📊 Applying manual age filter (0-30 days)...');

    try {
      await this.page.screenshot({ path: 'screenshots/manual-filter-fallback.png' });

      // Try to set age filter
      await this.page.fill(vAutoSelectors.inventory.ageMinInput, '0');
      await this.page.fill(vAutoSelectors.inventory.ageMaxInput, '30');

      // Find and click apply button
      const applyButton = this.page.locator('//button[contains(text(), "Search") or contains(text(), "Apply") or contains(text(), "Filter")]').first();
      if (await applyButton.isVisible()) {
        await applyButton.click();
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(5000);
      }

      const vehicleCount = await this.countVehicles();
      
      this.logger.info(`✅ Manual filter applied. Found ${vehicleCount} vehicles`);
      return {
        success: true,
        vehicleCount,
        filterMethod: 'manual-fallback'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, vehicleCount: 0, filterMethod: 'manual-fallback', error: errorMessage };
    }
  }

  /**
   * Open saved filters dropdown
   */
  private async openSavedFiltersDropdown(): Promise<boolean> {
    const selectors = [
      vAutoSelectors.inventory.savedFiltersDropdownButton,
      vAutoSelectors.inventory.savedFiltersDropdown,
      vAutoSelectors.inventory.filtersButton
    ];

    for (const selector of selectors) {
      try {
        const element = this.page.locator(selector).first();
        if (await element.isVisible()) {
          await element.click();
          await this.page.waitForTimeout(TIMEOUTS.ACTION_DELAY + 500);
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    return false;
  }

  /**
   * Find target filter item in dropdown
   */
  private async findTargetFilterItem(): Promise<{ text: string; locator: any } | null> {
    await this.page.waitForTimeout(1000);

    const dropdownSelectors = [
      vAutoSelectors.inventory.savedFilterItem,
      '//div[contains(@class, "x-combo-list-inner")]/div',
      '//ul[contains(@class, "x-menu-list")]//li'
    ];

    for (const selector of dropdownSelectors) {
      try {
        const items = await this.page.locator(selector).all();
        if (items.length > 0) {
          for (const item of items) {
            const text = await item.textContent();
            if (text && (text.toUpperCase().includes('RECENT') || text.toUpperCase().includes('INVENTORY'))) {
              return { text: text.trim(), locator: item };
            }
          }
          // If no "recent" found, use first safe item
          const firstText = await items[0].textContent();
          if (firstText && !firstText.toUpperCase().includes('MANAGE')) {
            return { text: firstText.trim(), locator: items[0] };
          }
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  /**
   * Click filter item with multiple strategies
   */
  private async clickFilterItem(item: { text: string; locator: any }): Promise<void> {
    try {
      await item.locator.hover();
      await this.page.waitForTimeout(TIMEOUTS.SCREENSHOT_DELAY);
      await item.locator.click({ force: true });
    } catch (error) {
      // JavaScript fallback
      await this.page.evaluate((text) => {
        const items = Array.from(document.querySelectorAll('.x-combo-list-item, .x-menu-item'));
        const target = items.find(el => el.textContent?.trim().toUpperCase() === text.toUpperCase());
        if (target) (target as HTMLElement).click();
      }, item.text);
    }
  }

  /**
   * Count vehicles in grid
   */
  private async countVehicles(): Promise<number> {
    let count = await this.page.locator(vAutoSelectors.inventory.vehicleRows).count();
    
    if (count === 0) {
      // Try alternative selectors
      const alternatives = [
        '//tr[contains(@class, "x-grid3-row") and not(contains(@style, "display: none"))]',
        '//table[@class="x-grid3-row-table"]'
      ];
      
      for (const selector of alternatives) {
        count = await this.page.locator(selector).count();
        if (count > 0) break;
      }
    }
    
    return count;
  }
}