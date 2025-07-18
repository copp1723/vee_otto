import { Page } from 'playwright';
import { Logger } from '../../../core/utils/Logger';
import * as fuzz from 'fuzzball';

export interface WindowStickerContent {
  rawContent: string;
  sections: {
    interior: string[];
    comfortConvenience: string[];
    mechanical: string[];
    safety: string[];
    exterior: string[];
    packages: string[];
  };
  allFeatures: string[];
  pricedOptions: Map<string, number>; // Feature -> Dollar amount
}

export class EnhancedWindowStickerService {
  private logger: Logger;

  constructor(private page: Page) {
    this.logger = new Logger('WindowStickerService');
  }

  /**
   * Extract window sticker content from popup (not download)
   */
  async extractFromPopup(): Promise<WindowStickerContent> {
    this.logger.info('Extracting window sticker from popup...');
    
    try {
      // Wait for popup to appear
      const popupSelectors = [
        '//div[contains(@class, "window-sticker-popup")]',
        '//div[contains(@class, "sticker-popup")]',
        '//div[contains(@class, "factory-equipment-popup")]',
        '//div[@id="window-sticker-popup"]',
        '//div[contains(@class, "modal") and contains(@style, "display: block")]'
      ];

      let content = '';
      for (const selector of popupSelectors) {
        try {
          const element = this.page.locator(selector).first();
          if (await element.isVisible({ timeout: 5000 })) {
            content = await element.textContent() || '';
            this.logger.info(`Found window sticker popup using selector: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!content) {
        throw new Error('Window sticker popup not found');
      }

      return this.parseWindowStickerContent(content);
    } catch (error) {
      this.logger.error('Failed to extract window sticker:', error);
      throw error;
    }
  }

  /**
   * Parse structured content from window sticker text
   */
  private parseWindowStickerContent(rawContent: string): WindowStickerContent {
    const result: WindowStickerContent = {
      rawContent,
      sections: {
        interior: [],
        comfortConvenience: [],
        mechanical: [],
        safety: [],
        exterior: [],
        packages: []
      },
      allFeatures: [],
      pricedOptions: new Map()
    };

    // Extract sections with improved regex
    const sectionPatterns = {
      interior: /Interior[:\s]*([\s\S]*?)(?=\n\s*(?:Comfort|Mechanical|Safety|Exterior|Packages|$))/i,
      comfortConvenience: /(?:Comfort\s*&\s*Convenience|Comfort\s*and\s*Convenience)[:\s]*([\s\S]*?)(?=\n\s*(?:Interior|Mechanical|Safety|Exterior|Packages|$))/i,
      mechanical: /Mechanical[:\s]*([\s\S]*?)(?=\n\s*(?:Interior|Comfort|Safety|Exterior|Packages|$))/i,
      safety: /(?:Safety\s*&\s*Security|Safety)[:\s]*([\s\S]*?)(?=\n\s*(?:Interior|Comfort|Mechanical|Exterior|Packages|$))/i,
      exterior: /Exterior[:\s]*([\s\S]*?)(?=\n\s*(?:Interior|Comfort|Mechanical|Safety|Packages|$))/i,
      packages: /Packages[:\s]*([\s\S]*?)(?=\n\s*(?:Interior|Comfort|Mechanical|Safety|Exterior|$))/i
    };

    // Extract features from each section
    for (const [section, pattern] of Object.entries(sectionPatterns)) {
      const match = rawContent.match(pattern);
      if (match && match[1]) {
        const features = this.extractFeaturesFromSection(match[1]);
        result.sections[section as keyof typeof result.sections] = features;
        result.allFeatures.push(...features);
      }
    }

    // Extract priced options (e.g., "$2,900" or "$295.00")
    const pricePattern = /([^$\n]+?)\s*\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
    let priceMatch;
    while ((priceMatch = pricePattern.exec(rawContent)) !== null) {
      const feature = priceMatch[1].trim();
      const price = parseFloat(priceMatch[2].replace(/,/g, ''));
      if (feature.length > 3 && !feature.match(/total|msrp|price/i)) {
        result.pricedOptions.set(feature, price);
        // Add priced options to features if not already present
        if (!result.allFeatures.includes(feature)) {
          result.allFeatures.push(feature);
        }
      }
    }

    // Extract any remaining features using bullet points, dashes, etc.
    const bulletFeatures = this.extractBulletPointFeatures(rawContent);
    for (const feature of bulletFeatures) {
      if (!result.allFeatures.includes(feature)) {
        result.allFeatures.push(feature);
      }
    }

    // Remove duplicates
    result.allFeatures = [...new Set(result.allFeatures)];

    this.logger.info(`Extracted ${result.allFeatures.length} total features from window sticker`);
    this.logger.info(`Found ${result.pricedOptions.size} priced options`);

    return result;
  }

  /**
   * Extract features from a section
   */
  private extractFeaturesFromSection(sectionContent: string): string[] {
    const features: string[] = [];
    
    // Split by common delimiters
    const lines = sectionContent.split(/[\n\r]+|(?:•)|(?:·)|(?:■)|(?:□)/);
    
    for (const line of lines) {
      const cleaned = line
        .trim()
        .replace(/^[\d\.\)\-\*]+\s*/, '') // Remove leading numbers/bullets
        .replace(/\s*\$[\d,]+(?:\.\d{2})?\s*$/, ''); // Remove trailing prices
      
      if (cleaned.length > 3 && 
          !cleaned.match(/^[\s\d]*$/) &&
          !cleaned.toLowerCase().includes('section') &&
          !cleaned.toLowerCase().includes('category')) {
        features.push(cleaned);
      }
    }
    
    return features;
  }

  /**
   * Extract bullet point features
   */
  private extractBulletPointFeatures(content: string): string[] {
    const features: string[] = [];
    
    const patterns = [
      /[•·■□]\s*([^\n•·■□]+)/g,
      /\n\s*[-*]\s*([^\n-*]+)/g,
      /\n\s*\d+\.\s*([^\n\d\.]+)/g
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const feature = match[1].trim();
        if (feature.length > 3 && !feature.match(/^[\s\d]*$/)) {
          features.push(feature);
        }
      }
    }
    
    return features;
  }

  /**
   * Close the window sticker popup
   */
  async closePopup(): Promise<void> {
    try {
      const closeSelectors = [
        '//button[contains(@class, "close")]',
        '//button[contains(text(), "Close")]',
        '//span[contains(@class, "close")]',
        '//a[contains(@onclick, "closePopup")]'
      ];

      for (const selector of closeSelectors) {
        try {
          const element = this.page.locator(selector).first();
          if (await element.isVisible({ timeout: 1000 })) {
            await element.click();
            this.logger.info('Closed window sticker popup');
            return;
          }
        } catch (e) {
          continue;
        }
      }

      // If no close button found, try ESC key
      await this.page.keyboard.press('Escape');
    } catch (error) {
      this.logger.warn('Failed to close popup:', error);
    }
  }
}