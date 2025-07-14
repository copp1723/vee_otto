import { MailgunProvider } from '../integrations/email/MailgunProvider';
import dotenv from 'dotenv';
import { Logger } from '../core/utils/Logger';

// Load environment variables
dotenv.config();

const logger = new Logger('MailgunTest');

async function testMailgun() {
  logger.info('🧪 Testing Mailgun Service');
  logger.info('===========================');

  // Check for Mailgun environment variables
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const fromEmail = process.env.MAILGUN_FROM_EMAIL;

  if (!apiKey || !domain || !fromEmail) {
    logger.warn('❌ Missing Mailgun configuration. Please set:');
    logger.info('   MAILGUN_API_KEY=your-api-key');
    logger.info('   MAILGUN_DOMAIN=your-domain.com');
    logger.info('   MAILGUN_FROM_EMAIL=ai-agent@your-domain.com');
    logger.info('');
    logger.info('Or provide them when I ask...');
    return;
  }

  logger.info(`🔑 API Key: ${apiKey.substring(0, 20)}...`);
  logger.info(`🌐 Domain: ${domain}`);
  logger.info(`📧 From Email: ${fromEmail}`);
  logger.info('');

  try {
    const mailgunService = new MailgunProvider({
      apiKey,
      domain,
      from: {
        email: fromEmail,
        name: 'Automation Agent'
      }
    });

    logger.info('🔧 Testing Mailgun connection...');
    const isConnected = await mailgunService.testConnection();
    
    if (isConnected) {
      logger.info('✅ Mailgun connection successful!');
      logger.info('');

      // Test notification email
      logger.info('📤 Testing notification email...');
      await mailgunService.sendNotificationEmail(
        'Mailgun Test Successful',
        'Your Mailgun configuration is working correctly! The AI agent can now send professional emails for report delivery and notifications.',
        [fromEmail] // Send to self for testing
      );
      logger.info('✅ Notification email sent!');
      logger.info('');

      logger.info('🎉 All Mailgun tests passed!');
      logger.info('');
      logger.info('Mailgun is ready for:');
      logger.info('✅ Professional report delivery');
      logger.info('✅ Success/failure notifications');
      logger.info('✅ File attachments (Excel, PDF, CSV)');
      logger.info('✅ HTML formatted emails');
      logger.info('✅ Email tracking and analytics');
      logger.info('');
      logger.info('Check your email inbox to confirm delivery!');

    } else {
      logger.error('❌ Mailgun connection failed');
    }

  } catch (error: any) {
    logger.error(`💥 Mailgun test failed: ${error.message}`);
    logger.info('');
    logger.info('Troubleshooting:');
    logger.info('1. Verify your Mailgun API key is correct');
    logger.info('2. Check that your domain is verified in Mailgun');
    logger.info('3. Ensure the from email is authorized for your domain');
    logger.info('4. Check your Mailgun account has credits/is not suspended');
  }
}

testMailgun().catch(error => logger.error('Unhandled error:', error));

