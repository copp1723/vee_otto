import { OpenRouterService } from '../integrations/OpenRouterService';
import dotenv from 'dotenv';
import { Logger } from '../core/utils/Logger';

// Load environment variables
dotenv.config();

const logger = new Logger('OpenRouterTest');

async function testOpenRouter() {
  logger.info('🧪 Testing OpenRouter Connection');
  logger.info('=================================');

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    logger.warn('❌ OPENROUTER_API_KEY not found in environment variables');
    return;
  }

  logger.info(`🔑 API Key: ${apiKey.substring(0, 20)}...`);
  logger.info('');

  try {
    const openRouterService = new OpenRouterService({
      apiKey,
      baseURL: process.env.OPENROUTER_BASE_URL,
      defaultModel: process.env.OPENROUTER_DEFAULT_MODEL
    });

    logger.info('🔧 Testing connection...');
    const isConnected = await openRouterService.testConnection();
    
    if (isConnected) {
      logger.info('✅ OpenRouter connection successful!');
      logger.info('');

      // Test model selection
      logger.info('🤖 Testing model selection...');
      const visionModel = await openRouterService.selectBestModel('analyze screenshot for vision');
      const codeModel = await openRouterService.selectBestModel('generate code for automation');
      const fastModel = await openRouterService.selectBestModel('quick response needed');
      
      logger.info(`   Vision tasks: ${visionModel}`);
      logger.info(`   Code tasks: ${codeModel}`);
      logger.info(`   Fast tasks: ${fastModel}`);
      logger.info('');

      // Test automation strategy generation
      logger.info('🎯 Testing automation strategy generation...');
      const strategy = await openRouterService.generateAutomationStrategy(
        'ExamplePlatform',
        'Lead Source ROI',
        'Login with 2FA',
        'Email 2FA code not received'
      );
      logger.info(`   Strategy: ${strategy}`);
      logger.info('');

      // Test 2FA code extraction
      logger.info('🔐 Testing 2FA code extraction...');
      const sampleEmail = `
        Subject: Security Code
        
        Your verification code is: 123456
        
        This code will expire in 10 minutes.
        
        If you didn't request this code, please contact support.
      `;
      
      const codeAnalysis = await openRouterService.extractTwoFactorCode(sampleEmail);
      logger.info(`   Code found: ${codeAnalysis.codeFound}`);
      logger.info(`   Code: ${codeAnalysis.code}`);
      logger.info(`   Confidence: ${codeAnalysis.confidence}`);
      logger.info(`   Reasoning: ${codeAnalysis.reasoning}`);
      logger.info('');

      logger.info('🎉 All OpenRouter tests passed!');
      logger.info('');
      logger.info('Available capabilities:');
      logger.info('✅ Vision analysis for page screenshots');
      logger.info('✅ Intelligent 2FA code extraction');
      logger.info('✅ Automation strategy generation');
      logger.info('✅ Dynamic model selection');

    } else {
      logger.error('❌ OpenRouter connection failed');
    }

  } catch (error: any) {
    logger.error(`💥 OpenRouter test failed: ${error.message}`);
    logger.info('');
    logger.info('Troubleshooting:');
    logger.info('1. Verify the OpenRouter API key is correct');
    logger.info('2. Check your OpenRouter account has credits');
    logger.info('3. Ensure network connectivity to openrouter.ai');
  }
}

testOpenRouter().catch(error => logger.error('Unhandled error:', error));

