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
   * Parse features from raw sticker text with enhanced section detection
   */
  private parseFeatureText(content: string): string[] {
    const features: string[] = [];
    const uniqueFeatures = new Set<string>();
    
    // Strategy 1: Structured section parsing (as per workflow)
    const structuredFeatures = this.parseStructuredSections(content);
    structuredFeatures.forEach(f => {
      if (!this.isDuplicateFeature(f, uniqueFeatures)) {
        features.push(f);
        uniqueFeatures.add(f.toLowerCase());
      }
    });
    
    // Strategy 2: Line-by-line parsing for unstructured content
    if (features.length === 0) {
      const lineFeatures = this.parseLineByLine(content);
      lineFeatures.forEach(f => {
        if (!this.isDuplicateFeature(f, uniqueFeatures)) {
          features.push(f);
          uniqueFeatures.add(f.toLowerCase());
        }
      });
    }
    
    // Strategy 3: Bullet point and list parsing
    const listFeatures = this.parseBulletPoints(content);
    listFeatures.forEach(f => {
      if (!this.isDuplicateFeature(f, uniqueFeatures)) {
        features.push(f);
        uniqueFeatures.add(f.toLowerCase());
      }
    });
    
    return features.filter(f => f.length > 3);
  }

  /**
   * Check if a feature is a duplicate or substring of existing features
   */
  private isDuplicateFeature(feature: string, existingFeatures: Set<string>): boolean {
    const lowerFeature = feature.toLowerCase();
    
    // Check exact match
    if (existingFeatures.has(lowerFeature)) {
      return true;
    }
    
    // Check if new feature is substring of existing
    for (const existing of existingFeatures) {
      if (existing.includes(lowerFeature) || lowerFeature.includes(existing)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Parse structured sections: Interior, Comfort & Convenience, Mechanical
   */
  private parseStructuredSections(content: string): string[] {
    const features: string[] = [];
    
    const sectionPatterns = {
      interior: /Interior[:\s]*([\s\S]*?)(?=\n\s*(?:Comfort\s*&\s*Convenience|Mechanical|Safety|Exterior|Engine|Transmission|$))/i,
      comfort: /(?:Comfort\s*&\s*Convenience|Convenience)[:\s]*([\s\S]*?)(?=\n\s*(?:Interior|Mechanical|Safety|Exterior|Engine|Transmission|$))/i,
      mechanical: /Mechanical[:\s]*([\s\S]*?)(?=\n\s*(?:Interior|Comfort|Safety|Exterior|Engine|Transmission|$))/i,
      engine: /Engine[:\s]*([\s\S]*?)(?=\n\s*(?:Interior|Comfort|Safety|Exterior|Mechanical|Transmission|$))/i,
      transmission: /Transmission[:\s]*([\s\S]*?)(?=\n\s*(?:Interior|Comfort|Safety|Exterior|Mechanical|Engine|$))/i,
      safety: /Safety[:\s]*([\s\S]*?)(?=\n\s*(?:Interior|Comfort|Mechanical|Exterior|Engine|Transmission|$))/i
    };
    
    for (const [sectionName, pattern] of Object.entries(sectionPatterns)) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const sectionContent = match[1].trim();
        const sectionFeatures = this.extractFeaturesFromSection(sectionContent);
        features.push(...sectionFeatures);
      }
    }
    
    return features;
  }
  
  /**
   * Extract features from a section's content
   */
  private extractFeaturesFromSection(sectionContent: string): string[] {
    const features: string[] = [];
    
    // Split by common delimiters (only use bullet points and line breaks, not hyphens)
    const delimiters = /[\n\r]+|\s*[•·]\s*|\s*;\s*/;
    const items = sectionContent.split(delimiters);
    
    for (const item of items) {
      const cleaned = item.trim()
        .replace(/^[\d\.\)\-\*]+\s*/, '') // Remove leading numbers/bullets
        .replace(/^[\s•·]+/, '') // Remove leading bullets (not hyphens)
        .replace(/[\s•·]+$/, '') // Remove trailing bullets (not hyphens)
      
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
   * Parse content line by line for unstructured format
   */
  private parseLineByLine(content: string): string[] {
    const features: string[] = [];
    const lines = content.split(/[\n\r]+/);
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip headers and short lines
      if (trimmed.length < 4 || 
          trimmed.match(/^[\d\s]*$/) ||
          trimmed.toLowerCase().includes('section') ||
          trimmed.toLowerCase().includes('category') ||
          trimmed.endsWith(':')) {
        continue;
      }
      
      // Clean and add feature
      const cleaned = trimmed.replace(/^[\d\.\)\-\*•·]+\s*/, '');
      if (cleaned.length > 3) {
        features.push(cleaned);
      }
    }
    
    return features;
  }
  
  /**
   * Parse bullet points and lists
   */
  private parseBulletPoints(content: string): string[] {
    const features: string[] = [];
    
    // Match bullet point patterns (excluding hyphens to avoid breaking hyphenated words)
    const bulletPatterns = [
      /[•·]\s*([^\n\r•·]+)/g,
      /^\s*-\s*([^\n\r]+)/gm,  // Only match hyphens at start of line
      /\*\s*([^\n\r\*]+)/g,
      /\d+\.\s*([^\n\r\d\.]+)/g
    ];
    
    for (const pattern of bulletPatterns) {
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