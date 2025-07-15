import { EnhancedOCRService } from '../../integrations/ocr/EnhancedOCRService';
import { enhancedOCRConfig } from '../../config/enhanced-ocr-config';

// ... existing code ...
private ocrService: OCRService | EnhancedOCRService;
private useEnhancedOCR: boolean;

constructor() {
  // ... existing constructor code ...
  this.useEnhancedOCR = process.env.ENHANCED_OCR_ENABLED === 'true';
  
  if (this.useEnhancedOCR) {
    this.ocrService = new EnhancedOCRService(enhancedOCRConfig);
  } else {
    this.ocrService = new OCRService(); // Original service
  }
}

// ... existing code ...
async extractWindowStickerData(imagePath: string): Promise<any> {
  const result = await this.ocrService.extractText(imagePath);
  
  // Enhanced OCR provides structured data
  if (result.structuredData) {
    return {
      ...result,
      enhancedExtraction: true,
      structuredFeatures: result.structuredData.features,
      pricingData: result.structuredData.pricing,
      specifications: result.structuredData.specifications
    };
  }
  
  // Fallback to original parsing
  return this.parseTraditionalOCRResult(result);
}
// ... existing code ...
