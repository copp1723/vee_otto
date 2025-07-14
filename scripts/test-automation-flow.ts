#!/usr/bin/env ts-node

import { systemHealthCheck } from '../core/utils/SystemHealthCheck';
import { BrowserAutomation } from '../core/utils/BrowserAutomation';
import { Logger } from '../core/utils/Logger';
import { VAutoAgentWithDashboard } from '../platforms/vauto/VAutoAgentWithDashboard';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const logger = new Logger('AutomationFlowTest');

interface TestResult {
  test: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  duration: number;
  details?: any;
}

class AutomationFlowTest {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    logger.info('🧪 Starting comprehensive automation flow test...');
    
    // Test 1: System Health Check
    await this.runTest('System Health Check', async () => {
      const healthResults = await systemHealthCheck.runFullHealthCheck();
      const errors = healthResults.filter(r => r.status === 'error');
      
      if (errors.length > 0) {
        throw new Error(`System health check failed with ${errors.length} errors: ${errors.map(e => e.message).join(', ')}`);
      }
      
      const warnings = healthResults.filter(r => r.status === 'warning');
      return {
        message: `System health check passed with ${warnings.length} warnings`,
        details: { healthResults }
      };
    });

    // Test 2: Browser Automation Initialization
    await this.runTest('Browser Automation Initialization', async () => {
      const browser = new BrowserAutomation({
        headless: true,
        validateOnStart: true,
        retries: 3
      });
      
      await browser.initialize();
      
      const isHealthy = await browser.isHealthy();
      if (!isHealthy) {
        throw new Error('Browser health check failed after initialization');
      }
      
      await browser.cleanup();
      
      return {
        message: 'Browser automation initialized and validated successfully',
        details: { healthy: isHealthy }
      };
    });

    // Test 3: Browser Fallback Mechanisms
    await this.runTest('Browser Fallback Mechanisms', async () => {
      const browser = new BrowserAutomation({
        headless: true,
        validateOnStart: false, // Force fallback testing
        retries: 3,
        args: ['--invalid-arg'] // Force initial failure
      });
      
      await browser.initialize();
      
      const isHealthy = await browser.isHealthy();
      if (!isHealthy) {
        throw new Error('Browser fallback mechanisms failed');
      }
      
      await browser.cleanup();
      
      return {
        message: 'Browser fallback mechanisms working correctly',
        details: { healthy: isHealthy }
      };
    });

    // Test 4: VAutoAgent Initialization
    await this.runTest('VAutoAgent Initialization', async () => {
      if (!process.env.VAUTO_USERNAME || !process.env.VAUTO_PASSWORD) {
        throw new Error('VAUTO_USERNAME and VAUTO_PASSWORD environment variables required');
      }
      
      const agent = new VAutoAgentWithDashboard({
        username: process.env.VAUTO_USERNAME,
        password: process.env.VAUTO_PASSWORD,
        headless: true,
        screenshotOnError: true
      });
      
      await agent.initialize();
      
      // Verify agent is properly initialized
      const browser = (agent as any).browser;
      const isHealthy = await browser.isHealthy();
      
      if (!isHealthy) {
        throw new Error('Agent browser is not healthy after initialization');
      }
      
      await agent.cleanup();
      
      return {
        message: 'VAutoAgent initialized successfully',
        details: { browserHealthy: isHealthy }
      };
    });

    // Test 5: Error Handling and Recovery
    await this.runTest('Error Handling and Recovery', async () => {
      const browser = new BrowserAutomation({
        headless: true,
        validateOnStart: true,
        retries: 2
      });
      
      await browser.initialize();
      
      // Simulate browser crash
      await browser.cleanup();
      
      // Test recovery
      const wasHealthy = await browser.isHealthy();
      if (wasHealthy) {
        throw new Error('Browser should not be healthy after cleanup');
      }
      
      // Test restart
      await browser.restartIfNeeded();
      
      const isHealthyAfterRestart = await browser.isHealthy();
      if (!isHealthyAfterRestart) {
        throw new Error('Browser should be healthy after restart');
      }
      
      await browser.cleanup();
      
      return {
        message: 'Error handling and recovery mechanisms working correctly',
        details: { 
          healthyAfterCleanup: wasHealthy,
          healthyAfterRestart: isHealthyAfterRestart 
        }
      };
    });

    // Test 6: Memory and Resource Management
    await this.runTest('Memory and Resource Management', async () => {
      const initialMemory = process.memoryUsage();
      
      // Create and destroy multiple browser instances
      for (let i = 0; i < 3; i++) {
        const browser = new BrowserAutomation({ headless: true });
        await browser.initialize();
        await browser.cleanup();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = Math.round(memoryIncrease / 1024 / 1024);
      
      // Allow some memory increase but flag if excessive
      if (memoryIncreaseMB > 100) {
        throw new Error(`Excessive memory increase detected: ${memoryIncreaseMB}MB`);
      }
      
      return {
        message: `Memory management test passed. Memory increase: ${memoryIncreaseMB}MB`,
        details: { 
          initialMemoryMB: Math.round(initialMemory.heapUsed / 1024 / 1024),
          finalMemoryMB: Math.round(finalMemory.heapUsed / 1024 / 1024),
          increaseMB: memoryIncreaseMB
        }
      };
    });

    // Test 7: Configuration Validation
    await this.runTest('Configuration Validation', async () => {
      const requiredEnvVars = ['VAUTO_USERNAME', 'VAUTO_PASSWORD'];
      const missing = requiredEnvVars.filter(v => !process.env[v]);
      
      if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
      }
      
      // Test different browser configurations
      const configs = [
        { headless: true, args: ['--no-sandbox'] },
        { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
        { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] }
      ];
      
      for (const config of configs) {
        const browser = new BrowserAutomation(config);
        await browser.initialize();
        await browser.cleanup();
      }
      
      return {
        message: 'Configuration validation passed for all browser configurations',
        details: { testedConfigs: configs.length }
      };
    });

    // Generate and display results
    this.displayResults();
  }

  private async runTest(testName: string, testFunction: () => Promise<{ message: string; details?: any }>): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info(`Running test: ${testName}`);
      const result = await testFunction();
      const duration = Date.now() - startTime;
      
      this.results.push({
        test: testName,
        status: 'pass',
        message: result.message,
        duration,
        details: result.details
      });
      
      logger.info(`✅ ${testName}: PASSED (${duration}ms)`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      
      this.results.push({
        test: testName,
        status: 'fail',
        message,
        duration,
        details: { error: message }
      });
      
      logger.error(`❌ ${testName}: FAILED (${duration}ms) - ${message}`);
    }
  }

  private displayResults(): void {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    logger.info('\n' + '='.repeat(60));
    logger.info('🧪 AUTOMATION FLOW TEST RESULTS');
    logger.info('='.repeat(60));
    logger.info(`Total Tests: ${this.results.length}`);
    logger.info(`✅ Passed: ${passed}`);
    logger.info(`❌ Failed: ${failed}`);
    logger.info(`⏭️ Skipped: ${skipped}`);
    logger.info(`⏱️ Total Time: ${totalTime}ms`);
    logger.info('='.repeat(60));
    
    if (failed > 0) {
      logger.info('\n❌ FAILED TESTS:');
      this.results
        .filter(r => r.status === 'fail')
        .forEach(r => {
          logger.info(`- ${r.test}: ${r.message}`);
        });
    }
    
    if (passed === this.results.length) {
      logger.info('\n🎉 ALL TESTS PASSED! Automation flow is ready for production.');
    } else {
      logger.error('\n💥 Some tests failed. Please fix the issues before deploying.');
      process.exit(1);
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  const test = new AutomationFlowTest();
  test.runAllTests().catch(error => {
    logger.error('Test runner failed:', error);
    process.exit(1);
  });
}

export { AutomationFlowTest }; 