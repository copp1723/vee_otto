#!/usr/bin/env ts-node

import { VAutoAgent, VAutoConfig } from '../platforms/vauto/VAutoAgent';
import { Logger } from '../core/utils/Logger';
import * as process from 'process';

async function runVAutoAutomation() {
  const logger = new Logger('VAutoRunner');
  
  try {
    logger.info('Starting vAuto automation with visible browser...');
    
    // Configuration
    const config: VAutoConfig = {
      username: process.env.VAUTO_USERNAME || '',
      password: process.env.VAUTO_PASSWORD || '',
      dealershipId: process.env.DEALERSHIP_ID,
      headless: process.env.HEADLESS === 'true',
      screenshotOnError: process.env.SCREENSHOT_ON_FAILURE === 'true',
      slowMo: parseInt(process.env.SLOW_MO || '500'),
      timeout: parseInt(process.env.TIMEOUT || '30000'),
      configName: 'vauto'
    };

    logger.info(`Configuration: ${JSON.stringify({
      username: config.username,
      headless: config.headless,
      screenshotOnError: config.screenshotOnError,
      slowMo: config.slowMo,
      timeout: config.timeout
    }, null, 2)}`);

    // Create and initialize agent
    const agent = new VAutoAgent(config);
    
    logger.info('Initializing VAutoAgent...');
    await agent.initialize();
    
    logger.info('Starting login process...');
    const loginSuccess = await agent.login();
    
    if (!loginSuccess) {
      throw new Error('Login failed');
    }
    
    logger.info('Login successful! Starting inventory processing...');
    const result = await agent.processInventory();
    
    // Generate and log report
    const report = await agent.generateReport();
    logger.info('Automation completed successfully!');
    logger.info('\n' + report);
    
    // Clean up
    await agent.cleanup();
    
    process.exit(0);
    
  } catch (error) {
    logger.error('Automation failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Gracefully shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Gracefully shutting down...');
  process.exit(0);
});

// Start automation
runVAutoAutomation();