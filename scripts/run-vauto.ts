#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { VAutoScheduler, initializeScheduler } from '../platforms/vauto/VAutoScheduler';
import { Logger } from '../core/utils/Logger';
import { VAutoAgent } from '../platforms/vauto/VAutoAgent';
import { VAutoAgentWithDashboard } from '../platforms/vauto/VAutoAgentWithDashboard';

// Load environment variables
dotenv.config();

const logger = new Logger('vAuto-Main');

async function runSingleExecution() {
  logger.info('Running vAuto automation in single execution mode');
  
  const agentConfig = {
    username: process.env.VAUTO_USERNAME || '',
    password: process.env.VAUTO_PASSWORD || '',
    dealershipId: process.env.DEALERSHIP_ID,
    headless: process.env.HEADLESS === 'true',
    mailgunConfig: process.env.MAILGUN_API_KEY ? {
      apiKey: process.env.MAILGUN_API_KEY,
      domain: process.env.MAILGUN_DOMAIN!,
      fromEmail: process.env.MAILGUN_FROM_EMAIL!,
      fromName: process.env.MAILGUN_FROM_NAME
    } : undefined
  };
  
  // Use dashboard-integrated agent if enabled
  const agent = process.env.DASHBOARD_INTEGRATION === 'true'
    ? new VAutoAgentWithDashboard(agentConfig)
    : new VAutoAgent(agentConfig);
  
  try {
    await agent.initialize();
    await agent.login();
    
    const results = await agent.processInventory();
    
    // Print report to console
    const report = await agent.generateReport();
    console.log(report);
    
    // Send email report if configured
    if (process.env.REPORT_EMAILS) {
      const recipients = process.env.REPORT_EMAILS.split(',').filter(e => e.trim());
      await agent.sendReport(recipients);
    }
    
  } catch (error) {
    logger.error('vAuto automation failed', error);
    process.exit(1);
  } finally {
    await agent.cleanup();
  }
}

async function runScheduler() {
  logger.info('Starting vAuto automation scheduler');
  
  let scheduler: VAutoScheduler | null = null;
  
  try {
    // Check if config file is specified
    const configPath = process.argv[2];
    scheduler = await initializeScheduler(configPath);
    
    // Log status
    const status = scheduler.getStatus();
    logger.info('Scheduler status:', status);
    
    // Keep process running
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      if (scheduler) {
        await scheduler.stop();
      }
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      if (scheduler) {
        await scheduler.stop();
      }
      process.exit(0);
    });
    
    // Keep the process alive
    if (!process.env.TEST_MODE) {
      logger.info('Scheduler is running. Press Ctrl+C to stop.');
    }
    
  } catch (error) {
    logger.error('Failed to start scheduler', error);
    process.exit(1);
  }
}

async function main() {
  const mode = process.argv[2];
  
  if (mode === '--once' || mode === '-o') {
    // Run single execution
    await runSingleExecution();
  } else if (mode === '--help' || mode === '-h') {
    console.log(`
vAuto Automation Tool

Usage:
  npm run vauto                    Start the scheduler (runs at configured times)
  npm run vauto -- --once          Run once immediately and exit
  npm run vauto -- config.json     Start scheduler with custom config file
  
Environment Variables:
  See .env.vauto.example for all available options
  
Examples:
  # Run with scheduler
  npm run vauto
  
  # Run once for testing
  TEST_MODE=true npm run vauto -- --once
  
  # Run with custom config
  npm run vauto -- ./config/production.json
    `);
  } else {
    // Run scheduler
    await runScheduler();
  }
}

// Run main function
main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});
