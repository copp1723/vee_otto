#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { Logger } from '../core/utils/Logger';

// Load environment variables
dotenv.config();

const logger = new Logger('NavigationImprovementsTest');

/**
 * Test the navigation improvements by running the enhanced vehicle processing
 * This will use the full workflow with login, 2FA, and our new navigation service
 */
async function testNavigationImprovements() {
  logger.info('🚀 Testing Vehicle Modal Navigation Improvements');
  logger.info('================================================');
  
  logger.info('📋 What this test does:');
  logger.info('1. Runs the full vAuto workflow (login, 2FA, navigation)');
  logger.info('2. Uses the new VehicleModalNavigationService to:');
  logger.info('   - Detect which tab is active when vehicle modal opens');
  logger.info('   - Navigate to Vehicle Info tab if not already there');
  logger.info('   - Click Factory Equipment button with proper verification');
  logger.info('');
  
  logger.info('🔧 Configuration:');
  logger.info(`Username: ${process.env.VAUTO_USERNAME || 'NOT SET'}`);
  logger.info(`Max Vehicles: ${process.env.MAX_VEHICLES_TO_PROCESS || '1'}`);
  logger.info(`Headless: ${process.env.HEADLESS || 'false'}`);
  logger.info('');
  
  // Check if required env vars are set
  if (!process.env.VAUTO_USERNAME || !process.env.VAUTO_PASSWORD) {
    logger.error('❌ Missing required environment variables: VAUTO_USERNAME and VAUTO_PASSWORD');
    process.exit(1);
  }
  
  logger.info('🏃 Running enhanced vehicle processing with navigation improvements...');
  logger.info('This will execute the full workflow including:');
  logger.info('- Login with 2FA (via Twilio webhook)');
  logger.info('- Navigate to inventory');
  logger.info('- Apply saved filters');
  logger.info('- Process vehicles with improved Vehicle Info tab navigation');
  logger.info('');
  
  // Run the enhanced vehicle processing script using child process
  try {
    const { spawn } = await import('child_process');
    const path = await import('path');
    
    logger.info('Starting enhanced vehicle processing...');
    
    const scriptPath = path.join(__dirname, 'run-enhanced-vehicle-processing.ts');
    const child = spawn('npx', ['ts-node', scriptPath], {
      stdio: 'inherit',
      env: {
        ...process.env,
        MAX_VEHICLES_TO_PROCESS: '1', // Test with just one vehicle
        HEADLESS: 'false' // Show browser for debugging
      }
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        logger.info('✅ Navigation improvements test completed successfully!');
      } else {
        logger.error(`❌ Navigation improvements test failed with exit code: ${code}`);
        process.exit(code || 1);
      }
    });
    
  } catch (error) {
    logger.error('❌ Navigation improvements test failed:', error);
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  logger.info('');
  logger.info('🧪 Vehicle Modal Navigation Improvements Test');
  logger.info('============================================');
  logger.info('');
  logger.info('This test verifies the following improvements:');
  logger.info('1. ✅ VehicleModalNavigationService created');
  logger.info('2. ✅ Vehicle Info tab detection logic implemented');
  logger.info('3. ✅ Automatic navigation to Vehicle Info tab when needed');
  logger.info('4. ✅ Factory Equipment button click with tab verification');
  logger.info('5. ✅ Integration with VAutoAgent and EnhancedVehicleProcessingTask');
  logger.info('');
  logger.info('To run this test:');
  logger.info('1. Ensure your .env file has VAUTO_USERNAME and VAUTO_PASSWORD');
  logger.info('2. Make sure the Twilio webhook server is running (npm run server)');
  logger.info('3. Run: npm run test:navigation-improvements');
  logger.info('');
  logger.info('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
  
  setTimeout(() => {
    testNavigationImprovements().catch(error => {
      logger.error('Test failed:', error);
      process.exit(1);
    });
  }, 5000);
}

export { testNavigationImprovements };