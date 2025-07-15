import { Page } from 'playwright';

export interface ExtractedFeatures {
  features: string[];
  sections: {
    interior: string[];
    mechanical: string[];
    comfort: string[];
    safety: string[];
    other: string[];
  };
  rawContent: string;
}

export class WindowStickerService {
  /**
   * Extract window sticker content and features from a page
   */
  async extractFeatures(page: Page): Promise<ExtractedFeatures> {
    const rawContent = await this.getWindowStickerContent(page);
    const features = this.parseFeatureText(rawContent);
    const sections = this.categorizeFeatures(features);
    
    return {
      features,
      sections,
      rawContent
    };
  }

  /**
   * Get window sticker content from page using multiple strategies
   */
  private async getWindowStickerContent(page: Page): Promise<string> {
    const selectors = [
      '//div[contains(@class, "window-sticker-details")]',
      '//div[contains(@class, "window-sticker")]',
      '//div[contains(@class, "factory-equipment")]',
      '//div[contains(@class, "sticker-content")]',
      'body'
    ];
    
    for (const selector of selectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          const content = await element.textContent();
          if (content && content.length > 100) {
            return content;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    return await page.textContent('body') || '';
  }

  /**
   * Parse features from raw sticker text
   */
  private parseFeatureText(content: string): string[] {
    const sections = {
      interior: /Interior[:\s]*([\\s\\S]*?)(?=\\n\\s*(?:Mechanical|Comfort|Safety|Exterior|$))/i,
      mechanical: /Mechanical[:\s]*([\\s\\S]*?)(?=\\n\\s*(?:Interior|Comfort|Safety|Exterior|$))/i,
      comfort: /(?:Comfort\\s*&\\s*Convenience|Convenience)[:\s]*([\\s\\S]*?)(?=\\n\\s*(?:Interior|Mechanical|Safety|Exterior|$))/i,
      safety: /Safety[:\s]*([\\s\\S]*?)(?=\\n\\s*(?:Interior|Mechanical|Comfort|Exterior|$))/i
    };
    
    const features: string[] = [];
    
    for (const [, sectionRegex] of Object.entries(sections)) {
      const match = content.match(sectionRegex);
      if (match && match[1]) {
        const items = match[1].split(/[\\n\\r]+|\\s*[•·-]\\s*|\\s*,\\s*/);
        for (const item of items) {
          const cleaned = item.trim().replace(/^[\\d\\.\\)\\-\\*]+\\s*/, '');
          if (cleaned.length > 3 && !cleaned.match(/^[\\s\\d]*$/)) {
            features.push(cleaned);
          }
        }
      }
    }
    
    return [...new Set(features)];
  }

  /**
   * Categorize features into sections
   */
  private categorizeFeatures(features: string[]): ExtractedFeatures['sections'] {
    const sections = {
      interior: [] as string[],
      mechanical: [] as string[],
      comfort: [] as string[],
      safety: [] as string[],
      other: [] as string[]
    };
    
    const keywords = {
      interior: ['seat', 'leather', 'fabric', 'trim', 'console'],
      mechanical: ['engine', 'transmission', 'drivetrain', 'suspension'],
      comfort: ['climate', 'air', 'heated', 'cooled', 'navigation'],
      safety: ['airbag', 'brake', 'stability', 'collision', 'blind']
    };
    
    for (const feature of features) {
      const lower = feature.toLowerCase();
      let categorized = false;
      
      for (const [category, words] of Object.entries(keywords)) {
        if (words.some(word => lower.includes(word))) {
          sections[category as keyof typeof sections].push(feature);
          categorized = true;
          break;
        }
      }
      
      if (!categorized) {
        sections.other.push(feature);
      }
    }
    
    return sections;
  }
}