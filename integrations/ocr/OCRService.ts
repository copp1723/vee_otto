import { createWorker, Worker } from 'tesseract.js';
import { Logger } from '../../core/utils/Logger';
import fs from 'fs-extra';
import path from 'path';
import { withRetry } from '../../core/utils/retryUtils';

export interface OCRConfig {
  language?: string;
  cacheDir?: string;
  logger?: boolean;
}

export interface OCRResult {
  text: string;
  confidence: number;
  words?: Array<{
    text: string;
    confidence: number;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
}

export class OCRService {
  private logger: Logger;
  private worker: Worker | null = null;
  private config: OCRConfig;
  private isInitialized: boolean = false;

  constructor(config: OCRConfig = {}) {
    this.logger = new Logger('OCRService');
    this.config = {
      language: config.language || 'eng',
      cacheDir: config.cacheDir || './ocr-cache',
      logger: config.logger || false
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.logger.info('Initializing OCR service...');
      
      // Ensure cache directory exists
      await fs.ensureDir(this.config.cacheDir!);

      // Create worker
      this.worker = await createWorker();

      // Load language and initialize
      await (this.worker as any).load();
      await (this.worker as any).loadLanguage(this.config.language!);
      await (this.worker as any).initialize(this.config.language!);

      this.isInitialized = true;
      this.logger.info('OCR service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OCR service', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async extractText(imagePath: string): Promise<OCRResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.info(`Extracting text from image: ${imagePath}`);

      const { data } = await withRetry<{ data: any }>(() => (this.worker as any).recognize(imagePath), { retries: 3 });

      const result: OCRResult = {
        text: data.text,
        confidence: data.confidence,
        words: (data as any).words?.map((word: any) => ({
          text: word.text,
          confidence: word.confidence,
          bbox: word.bbox
        })) || []
      };

      this.logger.info(`OCR extraction complete. Confidence: ${result.confidence}%`);
      return result;

    } catch (error) {
      this.logger.error('OCR extraction failed', {
        error: error instanceof Error ? error.message : String(error),
        imagePath
      });
      throw error;
    }
  }

  async extractFromScreenshot(
    screenshotBuffer: Buffer,
    options: {
      region?: { x: number; y: number; width: number; height: number };
      enhance?: boolean;
    } = {}
  ): Promise<OCRResult> {
    const tempPath = path.join(this.config.cacheDir!, `temp_${Date.now()}.png`);
    
    try {
      // Save buffer to temp file
      await fs.writeFile(tempPath, screenshotBuffer);

      // Extract text
      const result = await withRetry(() => this.extractText(tempPath), { retries: 3 });

      return result;

    } finally {
      // Clean up temp file
      await fs.remove(tempPath).catch(() => {});
    }
  }

  async findTextInImage(
    imagePath: string,
    searchText: string,
    options: {
      caseSensitive?: boolean;
      fuzzyMatch?: boolean;
      threshold?: number;
    } = {}
  ): Promise<{ found: boolean; location?: any }> {
    const { caseSensitive = false, fuzzyMatch = false, threshold = 80 } = options;

    try {
      const result = await this.extractText(imagePath);
      
      const searchLower = caseSensitive ? searchText : searchText.toLowerCase();
      const textLower = caseSensitive ? result.text : result.text.toLowerCase();

      let found = false;
      let location = null;

      if (fuzzyMatch) {
        // Use fuzzy matching for each word
        if (result.words) {
          for (const word of result.words) {
            const wordText = caseSensitive ? word.text : word.text.toLowerCase();
            const similarity = this.calculateSimilarity(searchLower, wordText);
            
            if (similarity >= threshold) {
              found = true;
              location = word.bbox;
              break;
            }
          }
        }
      } else {
        // Exact match
        found = textLower.includes(searchLower);
        
        // Find location if words data is available
        if (found && result.words) {
          for (const word of result.words) {
            const wordText = caseSensitive ? word.text : word.text.toLowerCase();
            if (wordText.includes(searchLower)) {
              location = word.bbox;
              break;
            }
          }
        }
      }

      return { found, location };

    } catch (error) {
      this.logger.error('Failed to find text in image', {
        error: error instanceof Error ? error.message : String(error),
        searchText
      });
      return { found: false };
    }
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 100;
    
    const distance = this.levenshteinDistance(str1, str2);
    return Math.round(((maxLen - distance) / maxLen) * 100);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.logger.info('OCR service terminated');
    }
  }
}