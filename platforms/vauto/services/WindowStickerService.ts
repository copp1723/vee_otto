import { Page } from 'playwright';
import { vautoSelectors } from '../vautoSelectors';

export class WindowStickerService {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async accessFactoryEquipmentTab(): Promise<boolean> {
    try {
      console.log('Accessing Factory Equipment tab...');
      
      // Wait for the tab to be available
      await this.page.waitForSelector('#ext-gen201', { timeout: 10000 });
      
      // Click the Factory Equipment tab
      await this.page.click('#ext-gen201');
      
      // Wait for the content to load
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(2000);
      
      console.log('Successfully accessed Factory Equipment tab');
      return true;
    } catch (error) {
      console.error('Failed to access Factory Equipment tab:', error);
      return false;
    }
  }

  async extractWindowStickerFeatures(): Promise<string[]> {
    try {
      console.log('Extracting window sticker features...');
      
      // Look for window sticker button or link
      const windowStickerButton = await this.page.locator('button:has-text("Window Sticker"), button:has-text("View Sticker"), a:has-text("Window Sticker")').first();
      
      if (!windowStickerButton) {
        console.log('Window sticker button not found, checking for embedded content...');
        return await this.extractEmbeddedFeatures();
      }

      // Handle popup window
      const [newPage] = await Promise.all([
        this.page.waitForEvent('popup'),
        windowStickerButton.click()
      ]);

      await newPage.waitForLoadState('networkidle');
      
      // Extract features from the popup
      const features = await this.extractFeaturesFromPage(newPage);
      
      await newPage.close();
      return features;
      
    } catch (error) {
      console.error('Failed to extract window sticker features:', error);
      return await this.extractEmbeddedFeatures();
    }
  }

  private async extractEmbeddedFeatures(): Promise<string[]> {
    try {
      // Try to extract features from embedded content
      const features = await this.page.evaluate(() => {
        const features: string[] = [];
        
        // Common selectors for window sticker content
        const selectors = [
          '.window-sticker-section',
          '.sticker-section',
          '[data-section="features"]',
          '.feature-list',
          '.equipment-list'
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach(element => {
            const text = element.textContent?.trim();
            if (text && text.length > 0) {
              features.push(text);
            }
          });
        }

        // Also look for specific feature items
        const featureItems = document.querySelectorAll('.feature-item, .equipment-item, li');
        featureItems.forEach(item => {
          const text = item.textContent?.trim();
          if (text && text.length > 2 && !text.includes('$')) {
            features.push(text);
          }
        });

        return [...new Set(features)]; // Remove duplicates
      });

      console.log(`Extracted ${features.length} embedded features`);
      return features;
    } catch (error) {
      console.error('Failed to extract embedded features:', error);
      return [];
    }
  }

  private async extractFeaturesFromPage(page: Page): Promise<string[]> {
    return await page.evaluate(() => {
      const features: string[] = [];
      
      // Look for structured feature data
      const sections = ['Interior', 'Exterior', 'Mechanical', 'Safety', 'Comfort'];
      
      sections.forEach(section => {
        const sectionElements = document.querySelectorAll(`*:has-text("${section}")`);
        sectionElements.forEach(element => {
          const siblings = element.parentElement?.querySelectorAll('li, .feature, .item');
          siblings?.forEach(sibling => {
            const text = sibling.textContent?.trim();
            if (text && text.length > 2) {
              features.push(text);
            }
          });
        });
      });

      // Fallback: extract all text that looks like features
      const allText = document.body.innerText;
      const lines = allText.split('\n').filter(line => 
        line.length > 2 && 
        line.length < 100 && 
        !line.includes('$') && 
        !line.match(/^\d+$/)
      );

      return [...new Set([...features, ...lines])];
    });
  }

  async waitForFactoryEquipmentLoad(): Promise<boolean> {
    try {
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(1000);
      return true;
    } catch (error) {
      console.error('Timeout waiting for factory equipment:', error);
      return false;
    }
  }
}