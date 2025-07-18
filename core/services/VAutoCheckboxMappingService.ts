import { CheckboxMappingService, CheckboxMappingResult, CheckboxState, CheckboxAction } from './CheckboxMappingService';
import { Page } from 'playwright';

/**
 * VAuto-specific checkbox mapping with enhanced feature-to-checkbox mapping
 */
export class VAutoCheckboxMappingService extends CheckboxMappingService {
  private featureMapping: Map<string, string[]>;

  constructor(page: Page, logger: any) {
    super(page, logger);
    this.featureMapping = this.initializeFeatureMapping();
  }

  /**
   * Initialize VAuto-specific feature mapping dictionary
   */
  private initializeFeatureMapping(): Map<string, string[]> {
    const mapping = new Map<string, string[]>();
    
    // Direct mappings (exact matches)
    mapping.set('Adjustable Pedals', ['Adjustable Pedals', 'Power Adjustable Pedals']);
    mapping.set('Auto-Dimming Rearview Mirror', ['Auto-Dimming Rearview Mirror', 'Auto Dimming Mirror']);
    mapping.set('Power Steering', ['Power Steering', 'Power Assist Steering']);
    mapping.set('Leather Seats', ['Leather Seats', 'Leather Seating', 'Leather Interior']);
    mapping.set('Navigation System', ['Navigation System', 'GPS Navigation', 'Navigation']);
    mapping.set('Sunroof', ['Sunroof', 'Power Sunroof', 'Moonroof']);
    mapping.set('Heated Seats', ['Heated Seats', 'Heated Front Seats']);
    mapping.set('Backup Camera', ['Backup Camera', 'Rear View Camera', 'Rearview Camera']);
    mapping.set('Bluetooth', ['Bluetooth', 'Bluetooth Connectivity']);
    mapping.set('Cruise Control', ['Cruise Control', 'Adaptive Cruise Control']);
    
    // Engine/Mechanical mappings
    mapping.set('6.7L I-6 Diesel Turbocharged', ['Turbocharged Engine', 'Diesel Engine', '6.7L Engine']);
    mapping.set('Turbocharged', ['Turbocharged Engine', 'Turbo']);
    mapping.set('All-Wheel Drive', ['All-Wheel Drive', 'AWD', '4WD']);
    mapping.set('Four-Wheel Drive', ['Four-Wheel Drive', '4WD', 'AWD']);
    
    // Safety mappings
    mapping.set('Airbags', ['Airbags', 'Side Airbags', 'Front Airbags']);
    mapping.set('Anti-Lock Brakes', ['Anti-Lock Brakes', 'ABS', 'Anti-lock Braking System']);
    mapping.set('Stability Control', ['Stability Control', 'Electronic Stability Control', 'ESC']);
    
    // Comfort mappings
    mapping.set('Air Conditioning', ['Air Conditioning', 'A/C', 'Climate Control']);
    mapping.set('Power Windows', ['Power Windows', 'Electric Windows', 'Windows']);
    mapping.set('Power Locks', ['Power Locks', 'Power Door Locks', 'Electric Locks', 'Locks']);
    mapping.set('Remote Start', ['Remote Start', 'Remote Engine Start']);
    
    // Additional mappings from handoff guide
    mapping.set('Power Door Locks', ['Power Locks', 'Power Door Locks']);
    mapping.set('Bluetooth Connectivity', ['Bluetooth']);
    mapping.set('Front Airbags', ['Airbags', 'Front Airbags']);
    mapping.set('Side Airbags', ['Airbags', 'Side Airbags']);
    
    // Engine-specific mappings for better coverage
    mapping.set('6.7L I-6 Diesel Turbocharged', ['Diesel Engine', 'Turbocharged Engine', '6.7L Engine', 'Turbo Diesel']);
    mapping.set('6.7L Cummins Turbo Diesel', ['Diesel Engine', 'Cummins Engine', '6.7L Engine', 'Cummins Diesel']);
    mapping.set('Heavy Duty Transmission', ['Heavy Duty Trans', 'HD Transmission', 'Heavy-Duty Transmission']);
    mapping.set('Engine Block Heater', ['Block Heater', 'Engine Heater']);
    
    // Seat mappings
    mapping.set('Power Driver Seat', ['Power Seats', 'Power Driver Seat', 'Power Front Seats', 'Power Drivers Seat']);
    mapping.set('Heated Front Seats', ['Heated Seats', 'Heated Front Seats', 'Front Heated Seats']);
    mapping.set('Cooled Seats', ['Ventilated Seats', 'Cooled Seats', 'Air Conditioned Seats']);
    
    // Technology mappings
    mapping.set('Remote Start System', ['Remote Start', 'Remote Engine Start', 'Remote Starter']);
    mapping.set('Keyless Entry', ['Keyless Entry', 'Remote Keyless Entry', 'RKE']);
    mapping.set('Push Button Start', ['Push Button Start', 'Push-Button Start', 'Pushbutton Start']);
    
    // Towing/Utility mappings
    mapping.set('Trailer Hitch', ['Trailer Hitch', 'Tow Hitch', 'Hitch Receiver']);
    mapping.set('Tow Package', ['Towing Package', 'Tow Package', 'Trailer Tow Package']);
    
    return mapping;
  }

  /**
   * Enhanced feature-to-checkbox mapping with VAuto-specific logic
   */
  protected mapFeaturesToCheckboxes(features: string[], checkboxStates: CheckboxState[]): CheckboxAction[] {
    const actions: CheckboxAction[] = [];
    const processedCheckboxes = new Set<string>();

    this.logger.info(`🔄 Mapping ${features.length} features to ${checkboxStates.length} checkboxes...`);

    for (const feature of features) {
      const mappedActions = this.mapSingleFeature(feature, checkboxStates, processedCheckboxes);
      actions.push(...mappedActions);
    }

    // Log mapping summary
    const checkActions = actions.filter(a => a.action === 'check').length;
    const uncheckActions = actions.filter(a => a.action === 'uncheck').length;
    this.logger.info(`📊 Mapping complete: ${checkActions} to check, ${uncheckActions} to uncheck`);

    return actions;
  }

  /**
   * Map a single feature to checkbox actions
   */
  private mapSingleFeature(feature: string, checkboxStates: CheckboxState[], processedCheckboxes: Set<string>): CheckboxAction[] {
    const actions: CheckboxAction[] = [];

    // Strategy 1: Direct mapping lookup
    const directMappings = this.featureMapping.get(feature);
    if (directMappings) {
      for (const mapping of directMappings) {
        const matchingCheckbox = this.findCheckboxByLabel(mapping, checkboxStates);
        if (matchingCheckbox && !processedCheckboxes.has(matchingCheckbox.id)) {
          actions.push(this.createCheckboxAction(matchingCheckbox, 'check', 1.0));
          processedCheckboxes.add(matchingCheckbox.id);
          this.logger.info(`✅ Direct mapping: "${feature}" → "${matchingCheckbox.label}"`);
          return actions; // Return early for direct matches
        }
      }
    }

    // Strategy 2: Fuzzy matching with enhanced similarity
    const bestMatch = this.findBestFuzzyMatch(feature, checkboxStates, processedCheckboxes);
    if (bestMatch) {
      actions.push(this.createCheckboxAction(bestMatch.checkbox, 'check', bestMatch.confidence));
      processedCheckboxes.add(bestMatch.checkbox.id);
      this.logger.info(`🔍 Fuzzy match: "${feature}" → "${bestMatch.checkbox.label}" (${(bestMatch.confidence * 100).toFixed(1)}%)`);
    } else {
      this.logger.warn(`❌ No mapping found for feature: "${feature}"`);
    }

    return actions;
  }

  /**
   * Find checkbox by exact label match
   */
  private findCheckboxByLabel(label: string, checkboxStates: CheckboxState[]): CheckboxState | null {
    return checkboxStates.find(cb => 
      cb.label.toLowerCase() === label.toLowerCase() ||
      cb.label.toLowerCase().includes(label.toLowerCase()) ||
      label.toLowerCase().includes(cb.label.toLowerCase())
    ) || null;
  }

  /**
   * Enhanced fuzzy matching with VAuto-specific logic
   */
  private findBestFuzzyMatch(feature: string, checkboxStates: CheckboxState[], processedCheckboxes: Set<string>): { checkbox: CheckboxState; confidence: number } | null {
    let bestMatch: { checkbox: CheckboxState; confidence: number } | null = null;
    const minThreshold = 0.6; // Lower threshold for more matches

    for (const checkbox of checkboxStates) {
      if (processedCheckboxes.has(checkbox.id)) continue;

      const confidence = this.calculateEnhancedSimilarity(feature, checkbox.label);
      
      if (confidence >= minThreshold && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = { checkbox, confidence };
      }
    }

    return bestMatch;
  }

  /**
   * Enhanced similarity calculation with keyword matching
   */
  private calculateEnhancedSimilarity(feature: string, checkboxLabel: string): number {
    // Base Levenshtein similarity
    const baseSimilarity = this.calculateSimilarity(feature, checkboxLabel);
    
    // Keyword matching bonus
    const keywordBonus = this.calculateKeywordSimilarity(feature, checkboxLabel);
    
    // Combine scores with weighting
    return Math.min(1.0, baseSimilarity * 0.7 + keywordBonus * 0.3);
  }

  /**
   * Calculate keyword-based similarity
   */
  private calculateKeywordSimilarity(feature: string, checkboxLabel: string): number {
    const featureWords = this.extractKeywords(feature);
    const labelWords = this.extractKeywords(checkboxLabel);
    
    if (featureWords.length === 0 || labelWords.length === 0) return 0;
    
    let matchingWords = 0;
    for (const featureWord of featureWords) {
      for (const labelWord of labelWords) {
        if (featureWord === labelWord || 
            featureWord.includes(labelWord) || 
            labelWord.includes(featureWord)) {
          matchingWords++;
          break;
        }
      }
    }
    
    return matchingWords / Math.max(featureWords.length, labelWords.length);
  }

  /**
   * Extract meaningful keywords from text
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set(['the', 'and', 'or', 'with', 'for', 'to', 'of', 'in', 'on', 'at']);
    
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .filter(word => !word.match(/^\d+$/)); // Remove pure numbers
  }

  /**
   * Create checkbox action with proper state management
   */
  private createCheckboxAction(checkbox: CheckboxState, action: 'check' | 'uncheck', confidence: number): CheckboxAction {
    // Only create action if state change is needed
    const needsAction = (action === 'check' && !checkbox.checked) || (action === 'uncheck' && checkbox.checked);
    
    return {
      id: checkbox.id,
      label: checkbox.label,
      action: needsAction ? action : 'none',
      confidence
    };
  }

  /**
   * Enhanced checkbox state detection for VAuto ExtJS interface
   */
  protected async getAllCheckboxStates(): Promise<CheckboxState[]> {
    const checkboxStates: CheckboxState[] = [];

    try {
      // VAuto uses ExtJS checkboxes with specific pattern
      const vAutoCheckboxes = await this.page.locator('input[id*="ext-va-feature-checkbox-"]').all();
      
      if (vAutoCheckboxes.length > 0) {
        this.logger.info(`Found ${vAutoCheckboxes.length} VAuto feature checkboxes`);
        
        for (const checkbox of vAutoCheckboxes) {
          const id = await checkbox.getAttribute('id') || 'unknown';
          const label = await this.getVAutoCheckboxLabel(checkbox);
          const checked = await this.getVAutoCheckboxState(checkbox);
          
          if (label && label !== 'Unknown Label') {
            checkboxStates.push({ id, label, checked, locator: checkbox });
          }
        }
      } else {
        // Fallback to parent implementation
        return await super.getAllCheckboxStates();
      }

    } catch (error) {
      this.logger.error('Failed to get VAuto checkbox states:', error);
      return await super.getAllCheckboxStates();
    }

    return checkboxStates;
  }

  /**
   * Get VAuto-specific checkbox label
   */
  private async getVAutoCheckboxLabel(checkbox: any): Promise<string> {
    try {
      // VAuto ExtJS checkboxes often have labels in specific DOM structure
      const strategies = [
        // Strategy 1: Following sibling span/div
        async () => {
          const sibling = checkbox.locator('xpath=following-sibling::span[1] | xpath=following-sibling::div[1]');
          return await sibling.textContent();
        },
        
        // Strategy 2: Parent container text
        async () => {
          const parent = checkbox.locator('xpath=parent::div | xpath=parent::td');
          const text = await parent.textContent();
          return text?.replace(/^\s*\[\s*\]\s*/, ''); // Remove checkbox indicator
        },
        
        // Strategy 3: Associated label by ID
        async () => {
          const id = await checkbox.getAttribute('id');
          if (id) {
            const label = this.page.locator(`label[for="${id}"]`);
            return await label.textContent();
          }
          return null;
        }
      ];

      for (const strategy of strategies) {
        try {
          const label = await strategy();
          if (label && label.trim().length > 0) {
            return label.trim();
          }
        } catch (e) {
          continue;
        }
      }

    } catch (error) {
      this.logger.warn('Error getting VAuto checkbox label:', error);
    }

    return 'Unknown Label';
  }

  /**
   * Get VAuto-specific checkbox state (ExtJS may use different indicators)
   */
  private async getVAutoCheckboxState(checkbox: any): Promise<boolean> {
    try {
      // Try standard checked property first
      const standardChecked = await checkbox.isChecked();
      if (standardChecked !== undefined) {
        return standardChecked;
      }

      // VAuto ExtJS might use image-based checkboxes
      const id = await checkbox.getAttribute('id');
      if (id) {
        const checkboxImg = this.page.locator(`//div[@id="${id}"]/img`);
        if (await checkboxImg.isVisible()) {
          const src = await checkboxImg.getAttribute('src');
          return src?.includes('checked') || src?.includes('true') || false;
        }
      }

      return false;
    } catch (error) {
      this.logger.warn('Error getting VAuto checkbox state:', error);
      return false;
    }
  }
}