import { VAutoAgent } from '../platforms/vauto/VAutoAgent';
import { MailgunProvider } from '../integrations/email/MailgunProvider';
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
  const agent = new VAutoAgent({
    username: config.platform.username,
    password: config.platform.password,
    headless: process.env.HEADLESS === 'true',
    screenshotOnError: true
  });
  
  // Set up Mailgun service if configured
  if (config.mailgun) {
    const mailgunService = new MailgunProvider(config.mailgun);
    
    // You can inject the mailgun service into the agent if needed for 2FA
    (agent as any).mailgunService = mailgunService;
  }
  
  try {
    await agent.initialize();
    
    // Example automation workflow
    console.log('🔐 Attempting login...');
    
    // Note: BaseAgent doesn't have login method - this needs to be implemented
    // in a concrete agent class like VAutoAgent
    console.log('✅ Agent initialized - extend with specific automation logic');
    
    console.log('✨ Automation setup completed successfully!');
    
  } catch (error) {
    console.error('💥 Automation failed:', error);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(console.error);
}