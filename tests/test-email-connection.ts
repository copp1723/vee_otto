import { EmailFactory } from '../integrations/email/EmailFactory';
import fs from 'fs-extra';
import { Logger } from '../core/utils/Logger';

const logger = new Logger('EmailConnectionTest');

async function testEmailConnection() {
  logger.info('🧪 Testing Email Connection');
  logger.info('===========================');

  try {
    // Load email configuration
    const emailConfig = await fs.readJson('./email-config.json');
    logger.info(`📧 Agent Email: ${emailConfig.agentEmail}`);
    // Note: Assuming emailConfig has provider, smtp or mailgun
    logger.info(`Provider: ${emailConfig.provider}`);
    logger.info('');

    // Initialize email provider using factory
    const emailProvider = EmailFactory.create(emailConfig);
    
    logger.info('🔧 Initializing email service...');
    await emailProvider.initialize();
    logger.info('✅ Email service initialized successfully!');
    logger.info('');

    // Test sending a notification email
    logger.info('📤 Sending test notification email...');
    await emailProvider.sendNotificationEmail(
      'Email Service Test',
      'This is a test email from your Automation Agent. If you receive this, the email configuration is working correctly!',
      // Assuming from is in config, but send to self for test
      [emailConfig.agentEmail]
    );
    logger.info('✅ Test email sent successfully!');
    logger.info('');

    // Test IMAP connection for reading emails
    logger.info('📥 Testing IMAP connection for reading emails...');
    logger.info('   (This will timeout after 10 seconds - that\'s normal for testing)');
    
    try {
      // Try to wait for a 2FA code for 10 seconds (will timeout, but tests IMAP)
      await emailProvider.waitForTwoFactorCode(10000, 'test.com');
    } catch (timeoutError: any) {
      if (timeoutError.message && timeoutError.message.includes('Timeout')) {
        logger.info('✅ IMAP connection working (timeout expected for test)');
      } else {
        throw timeoutError;
      }
    }

    await emailProvider.close();
    logger.info('');
    logger.info('🎉 All email tests passed!');
    logger.info('');
    logger.info('Next steps:');
    logger.info('1. Check your email inbox for the test message');
    logger.info('2. Configure your platform to send 2FA codes to rylie1234@gmail.com');
    logger.info('3. Run: npm run test-email');

  } catch (error: any) {
    logger.error(`❌ Email test failed: ${error.message || error}`);
    logger.info('');
    logger.info('Troubleshooting:');
    logger.info('1. Verify the Gmail App Password is correct');
    logger.info('2. Ensure 2FA is enabled on the Gmail account');
    logger.info('3. Check that IMAP is enabled in Gmail settings');
  }
}

testEmailConnection().catch(error => logger.error('Unhandled error:', error));

