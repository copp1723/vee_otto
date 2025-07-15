import { Page, Locator } from 'playwright';
import { CheckboxMappingService, CheckboxState, CheckboxAction, CheckboxMappingResult } from './CheckboxMappingService';
import { pipeline } from '@xenova/transformers';

export interface SemanticMatch {
  feature: string;
  checkboxLabel: string;
  similarity: number;
  confidence: number;
}

export interface SemanticFeatureMappingConfig {
  similarityThreshold: number;
  useSemanticMatching: boolean;
  maxResults: number;
}

export class SemanticFeatureMappingService extends CheckboxMappingService {
  private embedder: any;
  private vectorDB: Map<string, number[]> = new Map();
  private config: SemanticFeatureMappingConfig;
  private isInitialized: boolean = false;

  constructor(
    page: Page, 
    logger: any,
    config: SemanticFeatureMappingConfig = {
      similarityThreshold: 0.8,
      useSemanticMatching: true,
      maxResults: 5
    }
  ) {
    super(page, logger);
    this.config = config;
    this.initializeEmbeddings();
  }

  /**
   * Initialize the sentence transformer model
   */
  private async initializeEmbeddings(): Promise<void> {
    try {
      this.logger.info('🤖 Initializing semantic embeddings...');
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2'
      );
      this.isInitialized = true;
      this.logger.info('✅ Semantic embeddings initialized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize embeddings:', error);
      this.config.useSemanticMatching = false;
    }
  }

  /**
   * Generate embedding for a text string
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isInitialized || !this.embedder) {
      throw new Error('Embeddings not initialized');
    }

    try {
      const output = await this.embedder(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (error) {
      this.logger.error('❌ Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Add new features to the vector database for learning
   */
  async addFeaturesToVectorDB(features: string[]): Promise<void> {
    if (!this.config.useSemanticMatching || !this.isInitialized) {
      return;
    }

    try {
      this.logger.info(`📚 Adding ${features.length} features to vector database...`);
      
      for (const feature of features) {
        if (!this.vectorDB.has(feature)) {
          const embedding = await this.generateEmbedding(feature);
          this.vectorDB.set(feature, embedding);
        }
      }
      
      this.logger.info(`✅ Vector database now contains ${this.vectorDB.size} features`);
    } catch (error) {
      this.logger.error('❌ Failed to add features to vector DB:', error);
    }
  }

  /**
   * Find semantic matches for a feature using vector similarity
   */
  private async findSemanticMatches(
    feature: string, 
    checkboxLabels: string[]
  ): Promise<SemanticMatch[]> {
    if (!this.config.useSemanticMatching || !this.isInitialized) {
      return [];
    }

    try {
      // Generate embedding for the feature
      const featureEmbedding = await this.generateEmbedding(feature);

      // Add checkbox labels to vector DB if not present
      await this.addFeaturesToVectorDB(checkboxLabels);

      // Find best matches
      const matches: SemanticMatch[] = [];
      
      for (const label of checkboxLabels) {
        const labelEmbedding = this.vectorDB.get(label);
        if (labelEmbedding) {
          const similarity = this.calculateCosineSimilarity(featureEmbedding, labelEmbedding);
          
          if (similarity >= this.config.similarityThreshold) {
            matches.push({
              feature,
              checkboxLabel: label,
              similarity,
              confidence: similarity
            });
          }
        }
      }

      // Sort by similarity descending
      return matches.sort((a, b) => b.similarity - a.similarity).slice(0, this.config.maxResults);
    } catch (error) {
      this.logger.error('❌ Failed to find semantic matches:', error);
      return [];
    }
  }

  /**
   * Override the mapping method to use semantic matching
   */
  protected override mapFeaturesToCheckboxes(
    features: string[], 
    checkboxStates: CheckboxState[]
  ): CheckboxAction[] {
    // This method is synchronous, so we'll use the async version in mapAndUpdateCheckboxes
    return super.mapFeaturesToCheckboxes(features, checkboxStates);
  }

  /**
   * Async version of mapFeaturesToCheckboxes for semantic matching
   */
  private async mapFeaturesToCheckboxesAsync(
    features: string[], 
    checkboxStates: CheckboxState[]
  ): Promise<CheckboxAction[]> {
    if (!this.config.useSemanticMatching || !this.isInitialized) {
      return super.mapFeaturesToCheckboxes(features, checkboxStates);
    }

    const actions: CheckboxAction[] = [];
    const availableLabels = checkboxStates.map(cb => cb.label);

    // Add all labels to vector DB
    await this.addFeaturesToVectorDB([...features, ...availableLabels]);

    for (const feature of features) {
      const semanticMatches = await this.findSemanticMatches(feature, availableLabels);
      
      if (semanticMatches.length > 0) {
        const bestMatch = semanticMatches[0];
        const matchingCheckbox = checkboxStates.find(cb => cb.label === bestMatch.checkboxLabel);
        
        if (matchingCheckbox) {
          const action: CheckboxAction = {
            id: matchingCheckbox.id,
            label: matchingCheckbox.label,
            action: matchingCheckbox.checked ? 'none' : 'check',
            confidence: bestMatch.confidence
          };
          
          actions.push(action);
          this.logger.info(`🎯 Semantic match: "${feature}" → "${bestMatch.checkboxLabel}" (${(bestMatch.confidence * 100).toFixed(1)}%)`);
        }
      } else {
        // Fallback to fuzzy matching
        const bestMatch = this.findBestMatch(feature, availableLabels, 0.75);
        
        if (bestMatch) {
          const matchingCheckbox = checkboxStates.find(cb => cb.label === bestMatch);
          if (matchingCheckbox) {
            const action: CheckboxAction = {
              id: matchingCheckbox.id,
              label: matchingCheckbox.label,
              action: matchingCheckbox.checked ? 'none' : 'check',
              confidence: this.calculateSimilarity(feature, bestMatch)
            };
            
            actions.push(action);
            this.logger.info(`📝 Fuzzy match: "${feature}" → "${bestMatch}"`);
          }
        } else {
          this.logger.warn(`❌ No match found for feature: "${feature}"`);
        }
      }
    }

    return actions;
  }

  /**
   * Override mapAndUpdateCheckboxes to use async semantic matching
   */
  override async mapAndUpdateCheckboxes(features: string[]): Promise<CheckboxMappingResult> {
    this.logger.info(`📋 Mapping ${features.length} features to checkboxes with semantic matching...`);

    const result: CheckboxMappingResult = {
      success: false,
      checkboxesFound: 0,
      checkboxesUpdated: 0,
      actions: [],
      errors: []
    };

    try {
      // Ensure embeddings are initialized
      if (!this.isInitialized && this.config.useSemanticMatching) {
        await this.initializeEmbeddings();
      }

      // Get all checkboxes on the page
      const checkboxStates = await this.getAllCheckboxStates();
      result.checkboxesFound = checkboxStates.length;

      if (checkboxStates.length === 0) {
        result.errors.push('No checkboxes found on page');
        return result;
      }

      this.logger.info(`Found ${checkboxStates.length} checkboxes to process`);

      // Map features to checkboxes using semantic matching
      const actions = await this.mapFeaturesToCheckboxesAsync(features, checkboxStates);
      result.actions = actions;

      // Apply checkbox updates
      let updatedCount = 0;
      for (const action of actions) {
        if (action.action !== 'none') {
          try {
            const success = await this.updateCheckbox(action, checkboxStates);
            if (success) {
              updatedCount++;
              this.logger.info(`✅ ${action.action === 'check' ? 'Checked' : 'Unchecked'}: ${action.label} (confidence: ${(action.confidence * 100).toFixed(1)}%)`);
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
      
      // Log summary of matches
      const semanticMatches = actions.filter(a => a.confidence >= this.config.similarityThreshold);
      this.logger.info(`🎯 Semantic matches: ${semanticMatches.length}, Fuzzy matches: ${actions.length - semanticMatches.length}`);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
      this.logger.error(`❌ Checkbox mapping failed: ${errorMessage}`);
      return result;
    }
  }

  /**
   * Get current vector database statistics
   */
  getVectorDBStats(): { size: number; features: string[] } {
    return {
      size: this.vectorDB.size,
      features: Array.from(this.vectorDB.keys())
    };
  }

  /**
   * Clear the vector database
   */
  clearVectorDB(): void {
    this.vectorDB.clear();
    this.logger.info('🗑️ Vector database cleared');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SemanticFeatureMappingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('⚙️ Configuration updated:', this.config);
  }
}