// integrations/ocr/EnhancedOCRService.ts
import { OCRService, OCRResult } from './OCRService';
import { Logger } from '../../core/utils/Logger';

export interface EnhancedOCRResult extends OCRResult {
  structuredData?: {
    features: string[];
    pricing?: {
      msrp?: number;
      invoice?: number;
      discounts?: number;
    };
    specifications?: {
      engine?: string;
      transmission?: string;
      drivetrain?: string;
    };
  };
  processingTime: number;
  modelUsed: string;
}

export class EnhancedOCRService extends OCRService {
  private olmOCRModel: any;
  private enhancedLogger: Logger;
  private fallbackToTesseract: boolean;

  constructor(config: any) {
    super(config);
    this.enhancedLogger = new Logger('EnhancedOCRService');
    this.fallbackToTesseract = config.fallbackToTesseract || true;
  }

  async initialize(): Promise<void> {
    try {
      this.enhancedLogger.info('Initializing enhanced OCR service...');
      
      // Initialize base Tesseract service as fallback
      await super.initialize();
      
      // Load olmOCR model
      this.olmOCRModel = await this.loadOlmOCRModel();
      
      this.enhancedLogger.info('Enhanced OCR service initialized successfully');
    } catch (error) {
      this.enhancedLogger.error('Failed to initialize enhanced OCR service', { error });
      throw error;
    }
  }

  private async loadOlmOCRModel(): Promise<any> {
    // Use Ollama for local deployment
    const ollama = await import('ollama');
    return ollama.default;
  }

  async extractText(imagePath: string): Promise<EnhancedOCRResult> {
    const startTime = Date.now();
    
    try {
      // Try enhanced OCR first
      const result = await this.extractWithOlmOCR(imagePath);
      
      return {
        ...result,
        processingTime: Date.now() - startTime,
        modelUsed: 'olmOCR'
      };
      
    } catch (error) {
      this.enhancedLogger.warn('Enhanced OCR failed, falling back to Tesseract', { error });
      
      if (this.fallbackToTesseract) {
        const fallbackResult = await super.extractText(imagePath);
        return {
          ...fallbackResult,
          processingTime: Date.now() - startTime,
          modelUsed: 'tesseract-fallback'
        };
      }
      
      throw error;
    }
  }

  private async extractWithOlmOCR(imagePath: string): Promise<EnhancedOCRResult> {
    // Prepare the prompt for structured extraction
    const prompt = this.buildExtractionPrompt();
    
    // Process image with olmOCR
    const response = await this.olmOCRModel.generate({
      model: 'olmocr',
      prompt: prompt,
      images: [imagePath],
      format: 'json',
      options: {
        temperature: 0.1,
        top_p: 0.9
      }
    });

    // Parse structured response
    const structuredData = this.parseStructuredResponse(response.response);
    
    return {
      text: structuredData.fullText,
      confidence: structuredData.confidence,
      structuredData: structuredData.structured,
      words: structuredData.words,
      processingTime: 0, // Will be set by caller
      modelUsed: 'olmOCR'
    };
  }

  private buildExtractionPrompt(): string {
    return `
You are an expert at extracting structured information from vehicle window stickers.

Extract the following information from this vehicle window sticker image:

1. **Features**: List all vehicle features, options, and packages
2. **Pricing**: Extract MSRP, invoice price, and any discounts
3. **Specifications**: Engine details, transmission, drivetrain
4. **Full Text**: Complete text content

Return the information in this JSON format:
{
  "fullText": "complete text from the sticker",
  "confidence": 0.95,
  "structured": {
    "features": ["feature1", "feature2", ...],
    "pricing": {
      "msrp": 35000,
      "invoice": 32000,
      "discounts": 2000
    },
    "specifications": {
      "engine": "2.0L Turbo",
      "transmission": "8-Speed Automatic",
      "drivetrain": "AWD"
    }
  },
  "words": [
    {"text": "word", "confidence": 0.98, "bbox": {"x0": 10, "y0": 20, "x1": 50, "y1": 40}}
  ]
}

Focus on accuracy and completeness. If information is unclear, indicate lower confidence.
`;
  }

  private parseStructuredResponse(response: string): any {
    try {
      const parsed = JSON.parse(response);
      
      // Validate the structure
      if (!parsed.fullText || !parsed.structured) {
        throw new Error('Invalid response structure');
      }
      
      return parsed;
      
    } catch (error) {
      this.enhancedLogger.error('Failed to parse structured response', { error, response });
      throw error;
    }
  }
} 