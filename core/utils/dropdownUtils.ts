import { ElementHandle, Page } from 'playwright';
import { createEnhancedLogger } from './EnhancedLogger';

const logger = createEnhancedLogger('DropdownUtils');

/**
 * Smart dropdown utilities for safer, more reliable dropdown interactions
 * Zero-risk utility that can be used alongside existing dropdown code
 */

export interface DropdownItem {
  element: ElementHandle;
  text: string;
  index: number;
  visible: boolean;
}

/**
 * Configuration for smart dropdown selection
 */
export interface SmartDropdownConfig {
  /** Items to exclude from selection (e.g., 'Manage Filters') */
  excludeTexts?: string[];
  /** Only include items containing these texts */
  includeTexts?: string[];
  /** Case sensitive matching */
  caseSensitive?: boolean;
  /** Log dropdown analysis */
  logDetails?: boolean;
}

/**
 * Default items to exclude that commonly cause issues
 */
const DEFAULT_EXCLUDE_TEXTS = [
  'Manage Filters',
  'Settings',
  'Preferences',
  'Admin',
  'Delete All',
  'Clear All'
];

/**
 * Analyze dropdown items and return safe selections
 */
export async function analyzeDropdownItems(
  items: ElementHandle[],
  config: SmartDropdownConfig = {}
): Promise<DropdownItem[]> {
  const {
    excludeTexts = DEFAULT_EXCLUDE_TEXTS,
    includeTexts = [],
    caseSensitive = false,
    logDetails = true
  } = config;

  const dropdownItems: DropdownItem[] = [];

  // Analyze each item
  for (let i = 0; i < items.length; i++) {
    const element = items[i];
    try {
      const text = (await element.textContent() || '').trim();
      const visible = await element.isVisible();

      dropdownItems.push({
        element,
        text,
        index: i + 1, // 1-based index for logging
        visible
      });
    } catch (error) {
      // Element might be stale or removed
      logger.debug(`Could not analyze dropdown item ${i + 1}`, { error });
    }
  }

  if (logDetails) {
    logger.logDropdownItems(dropdownItems.map(item => ({
      index: item.index,
      text: item.text,
      visible: item.visible
    })));
  }

  // Filter out unsafe items
  const safeItems = dropdownItems.filter(item => {
    // Skip empty items
    if (!item.text) return false;

    // Skip invisible items
    if (!item.visible) return false;

    const itemText = caseSensitive ? item.text : item.text.toLowerCase();

    // Check exclusions
    const isExcluded = excludeTexts.some(excludeText => {
      const checkText = caseSensitive ? excludeText : excludeText.toLowerCase();
      return itemText.includes(checkText);
    });

    if (isExcluded) return false;

    // Check inclusions (if specified)
    if (includeTexts.length > 0) {
      const isIncluded = includeTexts.some(includeText => {
        const checkText = caseSensitive ? includeText : includeText.toLowerCase();
        return itemText.includes(checkText);
      });
      return isIncluded;
    }

    return true;
  });

  if (logDetails && safeItems.length !== dropdownItems.length) {
    logger.logSmartDropdownSelection(
      dropdownItems.map(item => ({ text: item.text, index: item.index })),
      safeItems.map(item => ({ text: item.text, index: item.index })),
      safeItems[0] || { text: 'none', index: 0 }
    );
  }

  return safeItems;
}

/**
 * Find and click a dropdown item by text, using smart selection
 */
export async function clickDropdownItemSmart(
  page: Page,
  dropdownSelector: string,
  targetText: string,
  config: SmartDropdownConfig = {}
): Promise<boolean> {
  try {
    // Get all dropdown items
    const items = await page.$$(dropdownSelector);
    
    if (items.length === 0) {
      logger.warn('No dropdown items found', { selector: dropdownSelector });
      return false;
    }

    // Analyze items
    const safeItems = await analyzeDropdownItems(items, {
      ...config,
      includeTexts: [targetText], // Focus on target text
      logDetails: true
    });

    // Find exact or partial match
    let targetItem = safeItems.find(item => 
      item.text.toLowerCase() === targetText.toLowerCase()
    );

    if (!targetItem) {
      // Try partial match
      targetItem = safeItems.find(item => 
        item.text.toLowerCase().includes(targetText.toLowerCase())
      );
    }

    if (!targetItem) {
      logger.warn(`Target item "${targetText}" not found in safe dropdown items`);
      return false;
    }

    // Click the item
    logger.logTarget(`Clicking dropdown item: "${targetItem.text}"`);
    await targetItem.element.click();
    return true;

  } catch (error) {
    logger.error('Error in smart dropdown selection', { error, targetText });
    return false;
  }
}

/**
 * Wait for dropdown to be ready and return items
 */
export async function waitForDropdownReady(
  page: Page,
  dropdownSelector: string,
  options: {
    timeout?: number;
    minItems?: number;
    stabilizationDelay?: number;
  } = {}
): Promise<ElementHandle[]> {
  const {
    timeout = 5000,
    minItems = 1,
    stabilizationDelay = 500
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const items = await page.$$(dropdownSelector);
      
      if (items.length >= minItems) {
        // Wait a bit for dropdown to stabilize
        await page.waitForTimeout(stabilizationDelay);
        
        // Check again to ensure stability
        const itemsAfterDelay = await page.$$(dropdownSelector);
        if (itemsAfterDelay.length >= minItems) {
          logger.logList(`Dropdown ready with ${itemsAfterDelay.length} items`);
          return itemsAfterDelay;
        }
      }
    } catch (error) {
      // Continue waiting
    }

    await page.waitForTimeout(100);
  }

  throw new Error(`Dropdown not ready after ${timeout}ms`);
}

/**
 * Safely open a dropdown and wait for it to be ready
 */
export async function openDropdownSafely(
  page: Page,
  triggerSelector: string,
  itemsSelector: string,
  options: {
    retries?: number;
    retryDelay?: number;
  } = {}
): Promise<ElementHandle[]> {
  const {
    retries = 3,
    retryDelay = 1000
  } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.logSearch(`Opening dropdown (attempt ${attempt}/${retries})`);
      
      // Click the trigger
      const trigger = await page.$(triggerSelector);
      if (!trigger) {
        throw new Error('Dropdown trigger not found');
      }

      await trigger.click();

      // Wait for dropdown items
      const items = await waitForDropdownReady(page, itemsSelector, {
        timeout: 3000,
        minItems: 1
      });

      logger.logSuccess('Dropdown opened successfully');
      return items;

    } catch (error) {
      logger.warn(`Failed to open dropdown on attempt ${attempt}`, { error });
      
      if (attempt < retries) {
        await page.waitForTimeout(retryDelay);
        
        // Try to close any open dropdowns
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        throw error;
      }
    }
  }

  throw new Error('Failed to open dropdown after all retries');
}

/**
 * Export a simple helper for backward compatibility
 */
export async function selectSafeDropdownOption(
  page: Page,
  dropdownTriggerSelector: string,
  dropdownItemsSelector: string,
  targetText: string
): Promise<boolean> {
  try {
    // Open dropdown
    const items = await openDropdownSafely(page, dropdownTriggerSelector, dropdownItemsSelector);
    
    // Click target item
    return await clickDropdownItemSmart(page, dropdownItemsSelector, targetText);
    
  } catch (error) {
    logger.error('Failed to select dropdown option', { error, targetText });
    return false;
  }
} 