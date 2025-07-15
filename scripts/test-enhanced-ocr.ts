// scripts/test-enhanced-ocr.ts
import { EnhancedOCRService } from '../integrations/ocr/EnhancedOCRService';
import { OCRService } from '../integrations/ocr/OCRService';

async function compareOCRPerformance() {
  const enhancedOCR = new EnhancedOCRService({});
  const originalOCR = new OCRService({});
  
  await enhancedOCR.initialize();
  await originalOCR.initialize();
  
  const testImages = [
    './test-images/sticker1.png',
    './test-images/sticker2.png',
    './test-images/sticker3.png'
  ];
  
  const results: any[] = [];
  
  for (const imagePath of testImages) {
    console.log(`Testing ${imagePath}...`);
    
    // Test enhanced OCR
    const enhancedStart = Date.now();
    const enhancedResult = await enhancedOCR.extractText(imagePath);
    const enhancedTime = Date.now() - enhancedStart;
    
    // Test original OCR
    const originalStart = Date.now();
    const originalResult = await originalOCR.extractText(imagePath);
    const originalTime = Date.now() - originalStart;
    
    results.push({
      image: imagePath,
      enhanced: {
        confidence: enhancedResult.confidence,
        features: enhancedResult.structuredData?.features?.length || 0,
        processingTime: enhancedTime,
        hasStructuredData: !!enhancedResult.structuredData
      },
      original: {
        confidence: originalResult.confidence,
        features: 0, // Original doesn't extract features
        processingTime: originalTime,
        hasStructuredData: false
      }
    });
  }
  
  console.table(results);
}

compareOCRPerformance().catch(console.error); 