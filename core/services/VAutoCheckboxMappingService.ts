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
    mapping.set('Power Windows', ['Power Windows', 'Electric Windows']);
    mapping.set('Power Locks', ['Power Locks', 'Power Door Locks', 'Electric Locks']);
    mapping.set('Remote Start', ['Remote Start', 'Remote Engine Start']);
    
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
      }\n    }\n\n    // Strategy 2: Fuzzy matching with enhanced similarity\n    const bestMatch = this.findBestFuzzyMatch(feature, checkboxStates, processedCheckboxes);\n    if (bestMatch) {\n      actions.push(this.createCheckboxAction(bestMatch.checkbox, 'check', bestMatch.confidence));\n      processedCheckboxes.add(bestMatch.checkbox.id);\n      this.logger.info(`🔍 Fuzzy match: "${feature}" → "${bestMatch.checkbox.label}" (${(bestMatch.confidence * 100).toFixed(1)}%)`);\n    } else {\n      this.logger.warn(`❌ No mapping found for feature: "${feature}"`);\n    }\n\n    return actions;\n  }\n\n  /**\n   * Find checkbox by exact label match\n   */\n  private findCheckboxByLabel(label: string, checkboxStates: CheckboxState[]): CheckboxState | null {\n    return checkboxStates.find(cb => \n      cb.label.toLowerCase() === label.toLowerCase() ||\n      cb.label.toLowerCase().includes(label.toLowerCase()) ||\n      label.toLowerCase().includes(cb.label.toLowerCase())\n    ) || null;\n  }\n\n  /**\n   * Enhanced fuzzy matching with VAuto-specific logic\n   */\n  private findBestFuzzyMatch(feature: string, checkboxStates: CheckboxState[], processedCheckboxes: Set<string>): { checkbox: CheckboxState; confidence: number } | null {\n    let bestMatch: { checkbox: CheckboxState; confidence: number } | null = null;\n    const minThreshold = 0.6; // Lower threshold for more matches\n\n    for (const checkbox of checkboxStates) {\n      if (processedCheckboxes.has(checkbox.id)) continue;\n\n      const confidence = this.calculateEnhancedSimilarity(feature, checkbox.label);\n      \n      if (confidence >= minThreshold && (!bestMatch || confidence > bestMatch.confidence)) {\n        bestMatch = { checkbox, confidence };\n      }\n    }\n\n    return bestMatch;\n  }\n\n  /**\n   * Enhanced similarity calculation with keyword matching\n   */\n  private calculateEnhancedSimilarity(feature: string, checkboxLabel: string): number {\n    // Base Levenshtein similarity\n    const baseSimilarity = this.calculateSimilarity(feature, checkboxLabel);\n    \n    // Keyword matching bonus\n    const keywordBonus = this.calculateKeywordSimilarity(feature, checkboxLabel);\n    \n    // Combine scores with weighting\n    return Math.min(1.0, baseSimilarity * 0.7 + keywordBonus * 0.3);\n  }\n\n  /**\n   * Calculate keyword-based similarity\n   */\n  private calculateKeywordSimilarity(feature: string, checkboxLabel: string): number {\n    const featureWords = this.extractKeywords(feature);\n    const labelWords = this.extractKeywords(checkboxLabel);\n    \n    if (featureWords.length === 0 || labelWords.length === 0) return 0;\n    \n    let matchingWords = 0;\n    for (const featureWord of featureWords) {\n      for (const labelWord of labelWords) {\n        if (featureWord === labelWord || \n            featureWord.includes(labelWord) || \n            labelWord.includes(featureWord)) {\n          matchingWords++;\n          break;\n        }\n      }\n    }\n    \n    return matchingWords / Math.max(featureWords.length, labelWords.length);\n  }\n\n  /**\n   * Extract meaningful keywords from text\n   */\n  private extractKeywords(text: string): string[] {\n    const stopWords = new Set(['the', 'and', 'or', 'with', 'for', 'to', 'of', 'in', 'on', 'at']);\n    \n    return text.toLowerCase()\n      .replace(/[^a-z0-9\\s]/g, ' ')\n      .split(/\\s+/)\n      .filter(word => word.length > 2 && !stopWords.has(word))\n      .filter(word => !word.match(/^\\d+$/)); // Remove pure numbers\n  }\n\n  /**\n   * Create checkbox action with proper state management\n   */\n  private createCheckboxAction(checkbox: CheckboxState, action: 'check' | 'uncheck', confidence: number): CheckboxAction {\n    // Only create action if state change is needed\n    const needsAction = (action === 'check' && !checkbox.checked) || (action === 'uncheck' && checkbox.checked);\n    \n    return {\n      id: checkbox.id,\n      label: checkbox.label,\n      action: needsAction ? action : 'none',\n      confidence\n    };\n  }\n\n  /**\n   * Enhanced checkbox state detection for VAuto ExtJS interface\n   */\n  protected async getAllCheckboxStates(): Promise<CheckboxState[]> {\n    const checkboxStates: CheckboxState[] = [];\n\n    try {\n      // VAuto uses ExtJS checkboxes with specific pattern\n      const vAutoCheckboxes = await this.page.locator('input[id*=\"ext-va-feature-checkbox-\"]').all();\n      \n      if (vAutoCheckboxes.length > 0) {\n        this.logger.info(`Found ${vAutoCheckboxes.length} VAuto feature checkboxes`);\n        \n        for (const checkbox of vAutoCheckboxes) {\n          const id = await checkbox.getAttribute('id') || 'unknown';\n          const label = await this.getVAutoCheckboxLabel(checkbox);\n          const checked = await this.getVAutoCheckboxState(checkbox);\n          \n          if (label && label !== 'Unknown Label') {\n            checkboxStates.push({ id, label, checked, locator: checkbox });\n          }\n        }\n      } else {\n        // Fallback to parent implementation\n        return await super.getAllCheckboxStates();\n      }\n\n    } catch (error) {\n      this.logger.error('Failed to get VAuto checkbox states:', error);\n      return await super.getAllCheckboxStates();\n    }\n\n    return checkboxStates;\n  }\n\n  /**\n   * Get VAuto-specific checkbox label\n   */\n  private async getVAutoCheckboxLabel(checkbox: any): Promise<string> {\n    try {\n      // VAuto ExtJS checkboxes often have labels in specific DOM structure\n      const strategies = [\n        // Strategy 1: Following sibling span/div\n        async () => {\n          const sibling = checkbox.locator('xpath=following-sibling::span[1] | xpath=following-sibling::div[1]');\n          return await sibling.textContent();\n        },\n        \n        // Strategy 2: Parent container text\n        async () => {\n          const parent = checkbox.locator('xpath=parent::div | xpath=parent::td');\n          const text = await parent.textContent();\n          return text?.replace(/^\\s*\\[\\s*\\]\\s*/, ''); // Remove checkbox indicator\n        },\n        \n        // Strategy 3: Associated label by ID\n        async () => {\n          const id = await checkbox.getAttribute('id');\n          if (id) {\n            const label = this.page.locator(`label[for=\"${id}\"]`);\n            return await label.textContent();\n          }\n          return null;\n        }\n      ];\n\n      for (const strategy of strategies) {\n        try {\n          const label = await strategy();\n          if (label && label.trim().length > 0) {\n            return label.trim();\n          }\n        } catch (e) {\n          continue;\n        }\n      }\n\n    } catch (error) {\n      this.logger.warn('Error getting VAuto checkbox label:', error);\n    }\n\n    return 'Unknown Label';\n  }\n\n  /**\n   * Get VAuto-specific checkbox state (ExtJS may use different indicators)\n   */\n  private async getVAutoCheckboxState(checkbox: any): Promise<boolean> {\n    try {\n      // Try standard checked property first\n      const standardChecked = await checkbox.isChecked();\n      if (standardChecked !== undefined) {\n        return standardChecked;\n      }\n\n      // VAuto ExtJS might use image-based checkboxes\n      const id = await checkbox.getAttribute('id');\n      if (id) {\n        const checkboxImg = this.page.locator(`//div[@id=\"${id}\"]/img`);\n        if (await checkboxImg.isVisible()) {\n          const src = await checkboxImg.getAttribute('src');\n          return src?.includes('checked') || src?.includes('true') || false;\n        }\n      }\n\n      return false;\n    } catch (error) {\n      this.logger.warn('Error getting VAuto checkbox state:', error);\n      return false;\n    }\n  }\n}