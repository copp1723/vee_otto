// config/enhanced-ocr-config.ts
export const enhancedOCRConfig = {
  fallbackToTesseract: true,
  model: {
    name: 'olmocr',
    endpoint: 'http://localhost:11434', // Ollama endpoint
    timeout: 30000
  },
  caching: {
    enabled: true,
    ttl: 3600000 // 1 hour
  },
  performance: {
    batchSize: 1,
    concurrency: 2
  }
}; 