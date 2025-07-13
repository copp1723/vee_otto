import * as cron from 'node-cron';
import { VAutoAgent, VAutoConfig } from './VAutoAgent';
import { Logger } from '../../core/utils/Logger';
import { EmailProvider } from '../../integrations/email/EmailProvider';

export interface DealershipConfig {
  id: string;
  name: string;
  timezone: string;
  username: string;
  password: string;
  recipientEmails: string[];
  enabled: boolean;
}

export interface SchedulerConfig {
  dealerships: DealershipConfig[];
  cronSchedule?: string; // Default: "0 7,14 * * *" (7am and 2pm)
  mailgunConfig?: any;
  testMode?: boolean; // If true, runs immediately instead of waiting for schedule
}

export class VAutoScheduler {
  private logger: Logger;
  private jobs: cron.ScheduledTask[] = [];
  
  constructor(private config: SchedulerConfig) {
    this.logger = new Logger('VAutoScheduler');
  }
  
  /**
   * Initialize and start the scheduler
   */
  async start(): Promise<void> {
    this.logger.info('Starting vAuto scheduler');
    
    // Validate configuration
    if (!this.config.dealerships || this.config.dealerships.length === 0) {
      throw new Error('No dealerships configured');
    }
    
    const cronSchedule = this.config.cronSchedule || '0 7,14 * * *';
    
    // Create a job for each dealership
    for (const dealership of this.config.dealerships) {
      if (!dealership.enabled) {
        this.logger.info(`Skipping disabled dealership: ${dealership.name}`);
        continue;
      }
      
      this.logger.info(`Scheduling jobs for dealership: ${dealership.name} (${dealership.timezone})`);
      
      if (this.config.testMode) {
        // In test mode, run immediately
        this.logger.info('Test mode enabled - running immediately');
        await this.runDealershipJob(dealership);
      } else {
        // Create scheduled job
        const job = cron.schedule(
          cronSchedule,
          async () => {
            await this.runDealershipJob(dealership);
          },
          {
            timezone: dealership.timezone,
            scheduled: true
          }
        );
        
        this.jobs.push(job);
        this.logger.info(`Scheduled job for ${dealership.name} at ${cronSchedule} ${dealership.timezone}`);
      }
    }
    
    if (!this.config.testMode) {
      this.logger.info(`Scheduler started with ${this.jobs.length} active jobs`);
    }
  }
  
  /**
   * Stop all scheduled jobs
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping vAuto scheduler');
    
    for (const job of this.jobs) {
      job.stop();
    }
    
    this.jobs = [];
    
    this.logger.info('vAuto scheduler stopped');
  }
  
  /**
   * Run automation for a specific dealership
   */
  private async runDealershipJob(dealership: DealershipConfig): Promise<void> {
    const startTime = new Date();
    this.logger.info(`Starting vAuto automation for ${dealership.name}`);
    
    const agent = new VAutoAgent({
      username: dealership.username,
      password: dealership.password,
      dealershipId: dealership.id,
      mailgunConfig: this.config.mailgunConfig,
      headless: process.env.HEADLESS === 'true',
      screenshotOnError: true
    });
    
    try {
      // Initialize browser
      await agent.initialize();
      
      // Login to vAuto
      await agent.login();
      
      // Process inventory
      const results = await agent.processInventory();
      
      // Generate and send report
      await agent.sendReport(dealership.recipientEmails);
      
      // Log success
      const duration = (Date.now() - startTime.getTime()) / 1000;
      this.logger.info(`Completed vAuto automation for ${dealership.name} in ${duration.toFixed(1)}s`);
      
      // Log completion status
      if (results.failedVehicles > 0) {
        this.logger.warn(`vAuto run completed with issues for ${dealership.name}: ${results.failedVehicles}/${results.totalVehicles} failed`);
      }
      
    } catch (error) {
      // Log error
      this.logger.error(`vAuto automation failed for ${dealership.name}`, error);
      
    } finally {
      // Always cleanup
      await agent.cleanup();
    }
  }
  
  /**
   * Get all unique recipient emails across all dealerships
   */
  private getAllRecipientEmails(): string[] {
    const emails = new Set<string>();
    
    for (const dealership of this.config.dealerships) {
      if (dealership.enabled) {
        dealership.recipientEmails.forEach(email => emails.add(email));
      }
    }
    
    return Array.from(emails);
  }
  
  /**
   * Run a specific dealership immediately (for testing or manual runs)
   */
  async runDealershipNow(dealershipId: string): Promise<void> {
    const dealership = this.config.dealerships.find(d => d.id === dealershipId);
    
    if (!dealership) {
      throw new Error(`Dealership not found: ${dealershipId}`);
    }
    
    if (!dealership.enabled) {
      throw new Error(`Dealership is disabled: ${dealership.name}`);
    }
    
    await this.runDealershipJob(dealership);
  }
  
  /**
   * Get scheduler status
   */
  getStatus(): { active: boolean; jobs: number; dealerships: string[] } {
    return {
      active: this.jobs.length > 0,
      jobs: this.jobs.length,
      dealerships: this.config.dealerships
        .filter(d => d.enabled)
        .map(d => `${d.name} (${d.id})`)
    };
  }
}

/**
 * Initialize scheduler from environment variables or config file
 */
export async function initializeScheduler(configPath?: string): Promise<VAutoScheduler> {
  let config: SchedulerConfig;
  
  if (configPath) {
    // Load from file
    const fs = await import('fs-extra');
    config = await fs.readJson(configPath);
  } else {
    // Load from environment variables (example)
    config = {
      dealerships: [
        {
          id: process.env.DEALERSHIP_ID || 'dealer1',
          name: process.env.DEALERSHIP_NAME || 'Test Dealership',
          timezone: process.env.DEALERSHIP_TIMEZONE || 'America/New_York',
          username: process.env.VAUTO_USERNAME || '',
          password: process.env.VAUTO_PASSWORD || '',
          recipientEmails: (process.env.REPORT_EMAILS || '').split(',').filter(e => e),
          enabled: process.env.DEALERSHIP_ENABLED !== 'false'
        }
      ],
      cronSchedule: process.env.CRON_SCHEDULE,
      testMode: process.env.TEST_MODE === 'true',
      mailgunConfig: process.env.MAILGUN_API_KEY ? {
        apiKey: process.env.MAILGUN_API_KEY,
        domain: process.env.MAILGUN_DOMAIN,
        fromEmail: process.env.MAILGUN_FROM_EMAIL,
        fromName: process.env.MAILGUN_FROM_NAME
      } : undefined
    };
  }
  
  const scheduler = new VAutoScheduler(config);
  await scheduler.start();
  
  return scheduler;
}
