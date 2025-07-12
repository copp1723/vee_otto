import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
import { Logger } from './Logger';

const logger = new Logger('ConfigManager');

export interface BaseConfig {
  browser?: {
    headless?: boolean;
    slowMo?: number;
    timeout?: number;
    viewport?: { width: number; height: number };
  };
  email?: {
    provider: 'smtp' | 'mailgun';
    smtp?: {
      host: string;
      port: number;
      secure: boolean;
      auth: { user: string; pass: string };
    };
    mailgun?: {
      apiKey: string;
      domain: string;
      baseUrl?: string;
    };
    from: {
      email: string;
      name?: string;
    };
    recipients: string[];
  };
  notifications?: {
    enabled: boolean;
    webhookUrl?: string;
  };
}

export interface PlatformConfig extends BaseConfig {
  platform: {
    name: string;
    url: string;
    credentials: {
      username: string;
      password: string;
    };
    selectors: Record<string, any>;
  };
  features?: {
    twoFactorAuth?: boolean;
    scheduling?: boolean;
    reporting?: boolean;
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  private configs: Map<string, any> = new Map();
  private configDir: string;

  private constructor(configDir: string = './config') {
    this.configDir = configDir;
    this.loadEnvironmentVariables();
  }

  static getInstance(configDir?: string): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(configDir);
    }
    return ConfigManager.instance;
  }

  private loadEnvironmentVariables(): void {
    // Load from multiple possible .env files
    const envFiles = ['.env', '.env.local', '.env.vauto'];
    
    for (const envFile of envFiles) {
      if (fs.existsSync(envFile)) {
        dotenv.config({ path: envFile });
        logger.debug(`Loaded environment variables from ${envFile}`);
      }
    }
  }

  async loadConfig(configName: string, configPath?: string): Promise<any> {
    if (this.configs.has(configName)) {
      return this.configs.get(configName);
    }

    let config: any = {};

    // Try to load from file
    if (configPath) {
      config = await this.loadConfigFromFile(configPath);
    } else {
      // Try standard locations
      const standardPaths = [
        path.join(this.configDir, `${configName}.json`),
        path.join(this.configDir, 'examples', `${configName}.example.json`),
        `./${configName}-config.json`,
        `./${configName}.config.json`
      ];

      for (const filePath of standardPaths) {
        if (await fs.pathExists(filePath)) {
          config = await this.loadConfigFromFile(filePath);
          break;
        }
      }
    }

    // Merge with environment variables
    config = this.mergeWithEnvironment(config, configName);

    // Validate configuration
    this.validateConfig(config, configName);

    // Cache the config
    this.configs.set(configName, config);

    logger.info(`Configuration loaded: ${configName}`);
    return config;
  }

  private async loadConfigFromFile(filePath: string): Promise<any> {
    try {
      const config = await fs.readJson(filePath);
      logger.debug(`Loaded config from file: ${filePath}`);
      return config;
    } catch (error) {
      logger.warn(`Failed to load config from ${filePath}`, { error });
      return {};
    }
  }

  private mergeWithEnvironment(config: any, configName: string): any {
    // Base configuration from environment
    const envConfig: any = {
      browser: {
        headless: process.env.HEADLESS === 'true',
        slowMo: parseInt(process.env.SLOW_MO || '100'),
        timeout: parseInt(process.env.TIMEOUT || '30000')
      }
    };

    // Email configuration
    if (process.env.EMAIL_PROVIDER) {
      envConfig.email = {
        provider: process.env.EMAIL_PROVIDER,
        from: {
          email: process.env.FROM_EMAIL || process.env.MAILGUN_FROM_EMAIL || process.env.SMTP_USER,
          name: process.env.FROM_NAME || process.env.MAILGUN_FROM_NAME || 'Automation Agent'
        },
        recipients: (process.env.EMAIL_RECIPIENTS || process.env.REPORT_EMAILS || '').split(',').filter(e => e.trim())
      };

      if (process.env.EMAIL_PROVIDER === 'mailgun') {
        envConfig.email.mailgun = {
          apiKey: process.env.MAILGUN_API_KEY,
          domain: process.env.MAILGUN_DOMAIN,
          baseUrl: process.env.MAILGUN_BASE_URL
        };
      } else if (process.env.EMAIL_PROVIDER === 'smtp') {
        envConfig.email.smtp = {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        };
      }
    }

    // Platform-specific configuration
    if (configName === 'vauto') {
      envConfig.platform = {
        name: 'vAuto',
        url: process.env.VAUTO_URL || process.env.PLATFORM_URL,
        credentials: {
          username: process.env.VAUTO_USERNAME || process.env.PLATFORM_USERNAME,
          password: process.env.VAUTO_PASSWORD || process.env.PLATFORM_PASSWORD
        }
      };
    }

    // Deep merge configurations
    return this.deepMerge(config, envConfig);
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else if (source[key] !== undefined) {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  private validateConfig(config: any, configName: string): void {
    const errors: string[] = [];

    // Validate email configuration
    if (config.email) {
      if (!config.email.provider) {
        errors.push('Email provider is required');
      }
      
      if (!config.email.from?.email) {
        errors.push('From email address is required');
      }

      if (config.email.provider === 'mailgun' && !config.email.mailgun?.apiKey) {
        errors.push('Mailgun API key is required');
      }

      if (config.email.provider === 'smtp' && !config.email.smtp?.host) {
        errors.push('SMTP host is required');
      }
    }

    // Validate platform configuration
    if (config.platform) {
      if (!config.platform.url) {
        errors.push('Platform URL is required');
      }
      
      if (!config.platform.credentials?.username || !config.platform.credentials?.password) {
        errors.push('Platform credentials are required');
      }
    }

    if (errors.length > 0) {
      const errorMessage = `Configuration validation failed for ${configName}:\n${errors.join('\n')}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  // Get specific configuration section
  getEmailConfig(configName: string = 'default'): any {
    const config = this.configs.get(configName);
    return config?.email;
  }

  getBrowserConfig(configName: string = 'default'): any {
    const config = this.configs.get(configName);
    return config?.browser || {
      headless: false,
      slowMo: 100,
      timeout: 30000
    };
  }

  getPlatformConfig(configName: string): any {
    const config = this.configs.get(configName);
    return config?.platform;
  }

  // Create example configuration files
  async createExampleConfigs(): Promise<void> {
    await fs.ensureDir(path.join(this.configDir, 'examples'));

    // Base configuration example
    const baseExample = {
      browser: {
        headless: false,
        slowMo: 100,
        timeout: 30000,
        viewport: { width: 1920, height: 1080 }
      },
      email: {
        provider: "mailgun",
        mailgun: {
          apiKey: "YOUR_MAILGUN_API_KEY",
          domain: "your-domain.com"
        },
        from: {
          email: "agent@your-domain.com",
          name: "Automation Agent"
        },
        recipients: ["user@example.com"]
      },
      notifications: {
        enabled: true,
        webhookUrl: "https://your-webhook-url.com"
      }
    };

    // vAuto configuration example
    const vautoExample = {
      ...baseExample,
      platform: {
        name: "vAuto",
        url: "https://app.vauto.com/login",
        credentials: {
          username: "YOUR_VAUTO_USERNAME",
          password: "YOUR_VAUTO_PASSWORD"
        },
        selectors: {
          // Platform-specific selectors would go here
        }
      },
      features: {
        twoFactorAuth: true,
        scheduling: true,
        reporting: true
      }
    };

    await fs.writeJson(
      path.join(this.configDir, 'examples', 'base.example.json'),
      baseExample,
      { spaces: 2 }
    );

    await fs.writeJson(
      path.join(this.configDir, 'examples', 'vauto.example.json'),
      vautoExample,
      { spaces: 2 }
    );

    logger.info('Example configuration files created');
  }

  // Clear cached configurations
  clearCache(): void {
    this.configs.clear();
    logger.info('Configuration cache cleared');
  }
}