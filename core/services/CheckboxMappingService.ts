import { Page, Locator } from 'playwright';

export interface CheckboxState {
  id: string;
  label: string;
  checked: boolean;
  locator: Locator;
}

export interface CheckboxAction {
  id: string;
  label: string;
  action: 'check' | 'uncheck' | 'none';
  confidence: number;
}

export interface CheckboxMappingResult {
  success: boolean;
  checkboxesFound: number;
  checkboxesUpdated: number;
  actions: CheckboxAction[];
  errors: string[];
}

export class CheckboxMappingService {
  private page: Page;
  private logger: any;

  constructor(page: Page, logger: any) {
    this.page = page;
    this.logger = logger;
  }

  /**
   * Map features to checkboxes and update them
   */
  async mapAndUpdateCheckboxes(features: string[]): Promise<CheckboxMappingResult> {
    this.logger.info(`📋 Mapping ${features.length} features to checkboxes...`);

    const result: CheckboxMappingResult = {
      success: false,
      checkboxesFound: 0,
      checkboxesUpdated: 0,
      actions: [],
      errors: []
    };

    try {
      // Get all checkboxes on the page
      const checkboxStates = await this.getAllCheckboxStates();
      result.checkboxesFound = checkboxStates.length;

      if (checkboxStates.length === 0) {
        result.errors.push('No checkboxes found on page');
        return result;
      }

      this.logger.info(`Found ${checkboxStates.length} checkboxes to process`);

      // Map features to checkboxes
      const actions = this.mapFeaturesToCheckboxes(features, checkboxStates);
      result.actions = actions;

      // Apply checkbox updates
      let updatedCount = 0;
      for (const action of actions) {
        if (action.action !== 'none') {
          try {
            const success = await this.updateCheckbox(action, checkboxStates);
            if (success) {
              updatedCount++;
              this.logger.info(`✅ ${action.action === 'check' ? 'Checked' : 'Unchecked'}: ${action.label}`);
            } else {
              result.errors.push(`Failed to update checkbox: ${action.label}`);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            result.errors.push(`Checkbox update failed for ${action.label}: ${errorMessage}`);
            this.logger.warn(`Failed to update checkbox ${action.label}:`, error);
          }
        }
      }

      result.checkboxesUpdated = updatedCount;
      result.success = true;

      this.logger.info(`📊 Updated ${updatedCount} checkboxes successfully`);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
      this.logger.error(`❌ Checkbox mapping failed: ${errorMessage}`);
      return result;
    }
  }

  /**
   * Get all checkbox states on the page
   */
  private async getAllCheckboxStates(): Promise<CheckboxState[]> {
    const checkboxStates: CheckboxState[] = [];

    try {
      // Try ExtJS checkboxes first (more specific)
      const extjsCheckboxes = await this.page.locator('input[id*="ext-va-feature-checkbox"]').all();
      
      if (extjsCheckboxes.length > 0) {
        this.logger.info(`Found ${extjsCheckboxes.length} ExtJS feature checkboxes`);
        
        for (const checkbox of extjsCheckboxes) {
          const id = await checkbox.getAttribute('id') || 'unknown';
          const label = await this.getCheckboxLabel(checkbox);
          const checked = await checkbox.isChecked();
          
          checkboxStates.push({
            id,
            label,
            checked,
            locator: checkbox
          });
        }
      } else {
        // Fallback to regular checkboxes
        const regularCheckboxes = await this.page.locator('input[type="checkbox"]').all();
        this.logger.info(`Found ${regularCheckboxes.length} regular checkboxes`);
        
        for (const checkbox of regularCheckboxes) {
          const id = await checkbox.getAttribute('id') || 'unknown';
          const label = await this.getCheckboxLabel(checkbox);
          const checked = await checkbox.isChecked();
          
          if (label && label !== 'Unknown Label') {
            checkboxStates.push({
              id,
              label,
              checked,
              locator: checkbox
            });
          }
        }
      }

    } catch (error) {
      this.logger.error('Failed to get checkbox states:', error);
    }

    return checkboxStates;
  }

  /**
   * Get label for a checkbox
   */
  private async getCheckboxLabel(checkbox: Locator): Promise<string> {
    try {
      // Try multiple strategies to find the label
      const strategies = [
        // Strategy 1: Associated label element
        async () => {
          const id = await checkbox.getAttribute('id');
          if (id) {
            const label = this.page.locator(`label[for="${id}"]`);
            if (await label.isVisible()) {
              return await label.textContent();
            }
          }
          return null;
        },

        // Strategy 2: Parent label
        async () => {
          const parentLabel = checkbox.locator('xpath=ancestor::label[1]');
          if (await parentLabel.isVisible()) {
            return await parentLabel.textContent();
          }
          return null;
        },

        // Strategy 3: Following sibling text
        async () => {
          const nextSibling = checkbox.locator('xpath=following-sibling::*[1]');
          if (await nextSibling.isVisible()) {
            const text = await nextSibling.textContent();
            if (text && text.trim().length > 0) {
              return text.trim();
            }
          }
          return null;
        },

        // Strategy 4: Preceding sibling text
        async () => {
          const prevSibling = checkbox.locator('xpath=preceding-sibling::*[1]');
          if (await prevSibling.isVisible()) {
            const text = await prevSibling.textContent();
            if (text && text.trim().length > 0) {
              return text.trim();
            }
          }
          return null;
        },

        // Strategy 5: Parent container text
        async () => {
          const parent = checkbox.locator('xpath=parent::*');
          if (await parent.isVisible()) {
            const text = await parent.textContent();
            if (text && text.trim().length > 0) {
              return text.trim();
            }
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
      this.logger.warn('Error getting checkbox label:', error);
    }

    return 'Unknown Label';
  }

  /**
   * Map features to checkbox actions using fuzzy matching
   */
  private mapFeaturesToCheckboxes(features: string[], checkboxStates: CheckboxState[]): CheckboxAction[] {
    const actions: CheckboxAction[] = [];
    const availableLabels = checkboxStates.map(cb => cb.label);

    for (const feature of features) {
      // Find best matching checkbox
      const bestMatch = this.findBestMatch(feature, availableLabels, 0.75);
      
      if (bestMatch) {
        const matchingCheckbox = checkboxStates.find(cb => cb.label === bestMatch);
        if (matchingCheckbox) {
          // Determine action based on current state
          const action: CheckboxAction = {
            id: matchingCheckbox.id,
            label: matchingCheckbox.label,
            action: matchingCheckbox.checked ? 'none' : 'check', // Only check if not already checked
            confidence: this.calculateSimilarity(feature, bestMatch)
          };
          
          actions.push(action);
        }
      }
    }

    return actions;
  }

  /**
   * Update a specific checkbox
   */
  private async updateCheckbox(action: CheckboxAction, checkboxStates: CheckboxState[]): Promise<boolean> {
    const checkbox = checkboxStates.find(cb => cb.id === action.id);
    if (!checkbox) {
      return false;
    }

    try {
      if (action.action === 'check' && !checkbox.checked) {
        await checkbox.locator.click();
        return true;
      } else if (action.action === 'uncheck' && checkbox.checked) {
        await checkbox.locator.click();
        return true;
      }
      return true; // No action needed
    } catch (error) {
      this.logger.warn(`Failed to click checkbox ${action.label}:`, error);
      return false;
    }
  }

  /**
   * Find best matching string using fuzzy matching
   */
  private findBestMatch(target: string, candidates: string[], threshold: number = 0.75): string | null {
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = this.calculateSimilarity(target, candidate);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}