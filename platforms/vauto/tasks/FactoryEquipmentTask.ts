import { Page } from 'playwright';
import { BaseTask, TaskContext, TaskResult } from '../../../core/tasks/BaseTask';
import { Logger } from '../../../core/utils/Logger';

export class FactoryEquipmentTask extends BaseTask {
  constructor() {
    super(
      'FactoryEquipment',
      'Access and extract data from Factory Equipment section',
      [],
      60000, // 60 second timeout
      2 // 2 retries
    );
  }

  async execute(context: TaskContext): Promise<TaskResult> {
    const { page, logger } = context;
    
    try {
      logger.info('Starting Factory Equipment task execution');

      // Wait for the page to be ready
      await page.waitForLoadState('networkidle');

      // Look for Factory Equipment button/link with multiple strategies
      const factoryEquipmentSelectors = [
        'a[href*="factory"]',
        'button:has-text("Factory Equipment")',
        'a:has-text("Factory Equipment")',
        '[data-qtip*="Factory Equipment"]',
        'a[onclick*="factory"]'
      ];

      let factoryEquipmentElement = null;
      for (const selector of factoryEquipmentSelectors) {
        try {
          factoryEquipmentElement = await page.locator(selector).first();
          if (await factoryEquipmentElement.isVisible()) {
            logger.info(`Found Factory Equipment element with selector: ${selector}`);
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }

      if (!factoryEquipmentElement || !(await factoryEquipmentElement.isVisible())) {
        return {
          success: false,
          error: 'Factory Equipment button/link not found or not visible'
        };
      }

      // Click the Factory Equipment element
      await factoryEquipmentElement.click();
      logger.info('Clicked Factory Equipment element');

      // Wait for popup window or new content
      await page.waitForTimeout(2000);

      // Check if a new window/popup opened
      const pages = page.context().pages();
      if (pages.length > 1) {
        const popup = pages[pages.length - 1];
        await popup.waitForLoadState('networkidle');
        
        // Extract content from popup
        const content = await popup.textContent('body');
        logger.info('Extracted content from Factory Equipment popup');
        
        // Close popup
        await popup.close();
        
        return {
          success: true,
          data: { content },
          message: 'Successfully accessed Factory Equipment popup and extracted content'
        };
      } else {
        // Content might have loaded in the same page
        await page.waitForTimeout(1000);
        const content = await page.textContent('body');
        
        return {
          success: true,
          data: { content },
          message: 'Successfully accessed Factory Equipment content in same page'
        };
      }

    } catch (error: any) {
      logger.error(`Factory Equipment task failed: ${error.message}`);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }
}