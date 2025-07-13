#!/usr/bin/env npx tsx

/**
 * Simple validation script to ensure Stagehand experimental integration
 * modules can be imported and basic functionality works
 */

import { StagehandService } from '../core/services/StagehandService';
import { StagehandAdapter } from '../core/adapters/StagehandAdapter';
import { ExperimentalVAutoAgent } from '../core/agents/ExperimentalVAutoAgent';
import { Logger } from '../core/utils/Logger';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = new Logger('StagehandValidation');

async function validateIntegration(): Promise<void> {
  logger.info('🔍 Starting Stagehand Integration Validation...');

  try {
    // Test 1: Configuration file exists and is valid JSON
    logger.info('📋 Test 1: Validating configuration file...');
    const configPath = path.join(process.cwd(), 'config/experimental.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    if (!config.stagehand || !config.experimental) {
      throw new Error('Invalid configuration structure');
    }
    logger.info('✅ Configuration file is valid');

    // Test 2: StagehandService can be instantiated
    logger.info('🔧 Test 2: Validating StagehandService instantiation...');
    const stagehandService = new StagehandService({
      model: 'openai/gpt-4o',
      headless: true,
      env: 'LOCAL',
      cacheEnabled: true,
      timeout: 30000,
      enableCaching: true,
      verbose: false
    });
    
    if (!stagehandService.isInitialized()) {
      logger.info('✅ StagehandService created successfully (not initialized)');
    } else {
      logger.warn('⚠️ StagehandService unexpectedly initialized');
    }

    // Test 3: Package dependencies
    logger.info('📦 Test 3: Validating package dependencies...');
    try {
      const stagehandPkg = require('@browserbasehq/stagehand');
      logger.info('✅ Stagehand package is available');
    } catch (error) {
      throw new Error('Stagehand package not found - run npm install');
    }

    // Test 4: Metrics structure
    logger.info('📊 Test 4: Validating metrics structure...');
    const metrics = stagehandService.getMetrics();
    const expectedMetricsFields = ['totalActions', 'successfulActions', 'failedActions', 'averageResponseTime'];
    
    for (const field of expectedMetricsFields) {
      if (!(field in metrics)) {
        throw new Error(`Missing metrics field: ${field}`);
      }
    }
    logger.info('✅ Metrics structure is valid');

    // Test 5: Scripts are available
    logger.info('🚀 Test 5: Validating npm scripts...');
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageData = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageData);
    
    const expectedScripts = ['stagehand:test', 'stagehand:compare', 'stagehand:metrics', 'experimental:vauto'];
    for (const script of expectedScripts) {
      if (!packageJson.scripts[script]) {
        throw new Error(`Missing npm script: ${script}`);
      }
    }
    logger.info('✅ All expected npm scripts are available');

    // Test 6: Documentation files exist
    logger.info('📚 Test 6: Validating documentation...');
    const docFiles = [
      'docs/STAGEHAND_EXPERIMENTAL_GUIDE.md',
      'docs/IMPLEMENTATION_SUMMARY.md'
    ];
    
    for (const docFile of docFiles) {
      const docPath = path.join(process.cwd(), docFile);
      await fs.access(docPath);
    }
    logger.info('✅ All documentation files are present');

    // Test 7: Test script exists and is executable
    logger.info('🧪 Test 7: Validating test scripts...');
    const testScript = path.join(process.cwd(), 'scripts/test-stagehand-experimental.ts');
    await fs.access(testScript);
    logger.info('✅ Test script is available');

    // Summary
    logger.info('🎉 ALL VALIDATION TESTS PASSED!');
    logger.info('✨ Stagehand experimental integration is ready for testing');
    logger.info('');
    logger.info('Next steps:');
    logger.info('1. Set up your OpenAI API key: export OPENAI_API_KEY="your_key"');
    logger.info('2. Run the experimental test: npm run experimental:test');
    logger.info('3. Review the results and documentation');

  } catch (error) {
    logger.error('❌ Validation failed:', error);
    logger.error('');
    logger.error('Please check the error above and fix any issues before proceeding.');
    process.exit(1);
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  validateIntegration().catch(error => {
    console.error('💥 Validation crashed:', error);
    process.exit(1);
  });
}

export { validateIntegration };