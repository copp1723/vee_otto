#!/usr/bin/env node

import { chromium, Browser, Page } from 'playwright';
import * as dotenv from 'dotenv';
import * as fs from 'fs-extra';
import * as path from 'path';
import { TaskOrchestrator, TaskResult } from '../core/services/TaskOrchestrator';
import { Logger } from '../core/utils/Logger';
import { createEnhancedOrchestrator } from '../core/utils/EnhancedTaskOrchestrator';
import {
  basicLoginTask,
  twoFactorAuthTask,
  navigateToInventoryTask,
  applyInventoryFiltersTask
} from '../platforms/vauto/tasks/VAutoTasks';

// Load environment variables
dotenv.config({ path: '.env.mvp' });

const logger = new Logger('HybridWithSessionPersistence');

interface SessionConfig {
  username: string;
  password: string;
  webhookUrl?: string;
  headless: boolean;
  slowMo: number;
  sessionDir: string;
  wsEndpointFile: string;
  stateFile: string;
}

function createSessionConfig(): SessionConfig {
  const config: SessionConfig = {
    username: process.env.VAUTO_USERNAME || '',
    password: process.env.VAUTO_PASSWORD || '',
    webhookUrl: process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL}/api/2fa/latest` : undefined,
    headless: false, // Always visible for session persistence
    slowMo: 1000,
    sessionDir: './session',
    wsEndpointFile: './session/browser-ws-endpoint.txt',
    stateFile: './session/auth-state.json'
  };

  if (!config.username || !config.password) {
    throw new Error('❌ Missing required environment variables: VAUTO_USERNAME and VAUTO_PASSWORD');
  }

  return config;
}

async function runHybridWithSessionPersistence() {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    logger.info('🚀 Starting Hybrid VAuto with Session Persistence');
    logger.info('💡 This will login, navigate to inventory, and keep the browser alive');

    const config = createSessionConfig();

    // Clean up old session files
    await fs.ensureDir(config.sessionDir);
    await fs.remove(config.wsEndpointFile).catch(() => {});
    await fs.remove(config.stateFile).catch(() => {});

    // Launch browser with debugging port
    logger.info('🌐 Launching browser with session persistence...');
    browser = await chromium.launch({
      headless: config.headless,
      slowMo: config.slowMo,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--remote-debugging-port=9222'
      ]
    });

    // Save WebSocket endpoint immediately
    const wsEndpoint = (browser as any).wsEndpoint();
    await fs.writeFile(config.wsEndpointFile, wsEndpoint);
    logger.info(`💾 Browser WebSocket endpoint saved to: ${config.wsEndpointFile}`);

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    page = await context.newPage();

    // Create orchestrator for login and navigation only
    const orchestrator = createEnhancedOrchestrator('Hybrid-Session-Setup', {
      globalTimeout: 30 * 60 * 1000, // 30 minutes
      enableJsonSummary: true,
      retryConfig: {
        useExponentialBackoff: true,
        baseDelayMs: 1000,
        maxDelayMs: 30000
      }
    });

    // Register only the setup tasks (no vehicle processing)
    const setupTasks = [
      basicLoginTask,
      twoFactorAuthTask,
      navigateToInventoryTask,
      applyInventoryFiltersTask
    ];

    logger.info('📚 Registering session setup tasks...');
    for (const task of setupTasks) {
      orchestrator.registerTask(task);
      logger.info(`  ✅ ${task.id}: ${task.name}`);
    }

    // Execute setup tasks
    logger.info('🎯 Starting session setup...');
    const startTime = Date.now();
    const results = await orchestrator.executeAll(page, config);
    const totalTime = Date.now() - startTime;

    // Save authentication state
    await context.storageState({ path: config.stateFile });
    logger.info(`💾 Authentication state saved to: ${config.stateFile}`);

    // Check if setup was successful
    const successful = Array.from(results.values()).filter(r => r.success).length;
    const total = results.size;

    if (successful === total) {
      logger.info('✅ Session setup completed successfully!');
      logger.info(`📊 Setup Results: ${successful}/${total} tasks completed in ${(totalTime/1000).toFixed(1)}s`);
      
      // Session info
      logger.info('\n✅ VAuto Session Ready for Testing!');
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('📂 Session Files:');
      logger.info(`   - WebSocket: ${config.wsEndpointFile}`);
      logger.info(`   - Auth State: ${config.stateFile}`);
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('\n🔧 Session is now active and ready for testing');
      logger.info('📍 Current page: ' + page.url());
      logger.info('\n🧪 You can now run your test harness:');
      logger.info('   npm run test:factory-equipment');
      logger.info('\n⏰ Session will stay active for 2 hours');
      logger.info('🛑 Press Ctrl+C to end the session\n');

      // Keep alive for 2 hours
      await new Promise(resolve => {
        const timeout = setTimeout(resolve, 2 * 60 * 60 * 1000);
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
          logger.info('\n🛑 Shutting down session...');
          clearTimeout(timeout);
          resolve(undefined);
        });
      });

    } else {
      logger.error(`❌ Session setup failed: ${successful}/${total} tasks completed`);
      const failedTasks = Array.from(results.values())
        .filter(r => !r.success)
        .map(r => r.taskId);
      logger.error(`Failed tasks: ${failedTasks.join(', ')}`);
      process.exit(1);
    }

  } catch (error) {
    logger.error('❌ Session setup failed:', error);
    if (error instanceof Error) {
      logger.error('Error details:', error.message);
      logger.error('Stack:', error.stack);
    }
    throw error;
  } finally {
    // Cleanup
    logger.info('🧹 Cleaning up...');
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    
    // Remove session files on cleanup
    await fs.remove('./session/browser-ws-endpoint.txt').catch(() => {});
    
    logger.info('✅ Session ended');
  }
}

// Run if called directly
if (require.main === module) {
  runHybridWithSessionPersistence().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runHybridWithSessionPersistence };