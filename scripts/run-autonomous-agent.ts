import { BaseAutomationAgent } from './src/agents/BaseAutomationAgent';
import { MailgunService } from './src/services/MailgunService';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';

// Load environment variables
dotenv.config();

async function loadConfig() {
  // Try to load configuration from files
  let emailConfig = null;
  let mailgunConfig = null;
  
  try {
    if (await fs.pathExists('email-config.json')) {
      emailConfig = await fs.readJson('email-config.json');
    }
  } catch (error) {
    console.warn('Could not load email-config.json');
  }
  
  try {
    if (await fs.pathExists('mailgun-config.json')) {
      mailgunConfig = await fs.readJson('mailgun-config.json');
    }
  } catch (error) {
    console.warn('Could not load mailgun-config.json');
  }
  
  return {
    email: emailConfig,
    mailgun: mailgunConfig,
    // You can add platform-specific configurations here
    platform: {
      url: process.env.PLATFORM_URL || 'https://example.com/login',
      username: process.env.PLATFORM_USERNAME || '',
      password: process.env.PLATFORM_PASSWORD || ''
    }
  };
}

async function main() {
  console.log('🤖 Starting Automation Agent...');
  
  const config = await loadConfig();
  
  // Create the agent
  const agent = new BaseAutomationAgent({
    headless: process.env.HEADLESS === 'true',
    screenshotOnError: true,
    notificationsEnabled: !!config.email || !!config.mailgun
  });
  
  // Set up Mailgun service if configured
  if (config.mailgun) {
    const mailgunService = new MailgunService({
      apiKey: config.mailgun.apiKey,
      domain: config.mailgun.domain,
      fromEmail: config.mailgun.fromEmail,
      fromName: config.mailgun.fromName || 'Automation Agent'
    });
    
    // You can inject the mailgun service into the agent if needed for 2FA
    (agent as any).mailgunService = mailgunService;
  }
  
  try {
    await agent.execute(async () => {
      // Example automation workflow
      console.log('🔐 Attempting login...');
      
      const loginSuccess = await agent.login({
        url: config.platform.url,
        usernameSelector: process.env.USERNAME_SELECTOR || 'input[name="username"]',
        passwordSelector: process.env.PASSWORD_SELECTOR || 'input[name="password"]',
        submitSelector: process.env.SUBMIT_SELECTOR || 'button[type="submit"]',
        username: config.platform.username,
        password: config.platform.password,
        successIndicator: process.env.SUCCESS_INDICATOR || 'div.dashboard'
      });
      
      if (!loginSuccess) {
        throw new Error('Login failed');
      }
      
      console.log('✅ Login successful!');
      
      // Handle 2FA if needed
      if (process.env.ENABLE_2FA === 'true') {
        console.log('🔑 Handling 2FA...');
        const twoFactorSuccess = await agent.handle2FA({
          enabled: true,
          emailSelector: process.env.TFA_EMAIL_SELECTOR,
          codeInputSelector: process.env.TFA_CODE_SELECTOR,
          submitSelector: process.env.TFA_SUBMIT_SELECTOR,
          successIndicator: process.env.TFA_SUCCESS_INDICATOR
        });
        
        if (twoFactorSuccess) {
          console.log('✅ 2FA completed successfully!');
        }
      }
      
      // Add your custom automation logic here
      console.log('🚀 Ready for custom automation tasks...');
      
      // Example: Navigate to a specific page
      if (process.env.TARGET_URL) {
        await agent.navigateTo(process.env.TARGET_URL);
        await agent.takeScreenshot('target-page');
      }
      
      // Example: Extract some data
      if (process.env.DATA_SELECTOR) {
        const data = await agent.getText(process.env.DATA_SELECTOR);
        console.log('📊 Extracted data:', data);
      }
      
      console.log('✨ Automation completed successfully!');
    });
    
  } catch (error) {
    console.error('💥 Automation failed:', error);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(console.error);
}