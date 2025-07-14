import { Page } from 'playwright';
import { Logger } from '../utils/Logger';
import { BrowserAutomation } from '../utils/BrowserAutomation';

export interface KeepAliveConfig {
  enabled: boolean;
  intervalMinutes: number;
  maxDurationHours: number;
  mouseWiggleDistance: number;
  sessionTimeoutSelectors: string[];
  loginRequiredSelectors: string[];
}

export interface KeepAliveStatus {
  isActive: boolean;
  startTime: Date;
  lastActivity: Date;
  activityCount: number;
  sessionExpired: boolean;
}

/**
 * Session Keep-Alive Service
 * 
 * Maintains browser sessions by simulating minimal user activity
 * to prevent automatic logouts and reduce 2FA requirements.
 * 
 * SECURITY NOTE: This bypasses intended session timeouts.
 * Use with caution and ensure compliance with platform ToS.
 */
export class SessionKeepAliveService {
  private logger: Logger;
  private interval: NodeJS.Timeout | null = null;
  private status: KeepAliveStatus;
  private config: KeepAliveConfig;

  constructor(config: KeepAliveConfig) {
    this.logger = new Logger('SessionKeepAlive');
    this.config = config;
    this.status = {
      isActive: false,
      startTime: new Date(),
      lastActivity: new Date(),
      activityCount: 0,
      sessionExpired: false
    };
  }

  /**
   * Start the keep-alive service
   */
  async start(page: Page): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('Keep-alive service is disabled');
      return;
    }

    if (this.interval) {
      this.logger.warn('Keep-alive service already running');
      return;
    }

    this.logger.info('Starting session keep-alive service', {
      intervalMinutes: this.config.intervalMinutes,
      maxDurationHours: this.config.maxDurationHours
    });

    this.status = {
      isActive: true,
      startTime: new Date(),
      lastActivity: new Date(),
      activityCount: 0,
      sessionExpired: false
    };

    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    const maxDurationMs = this.config.maxDurationHours * 60 * 60 * 1000;

    this.interval = setInterval(async () => {
      try {
        // Check if maximum duration exceeded
        const elapsed = Date.now() - this.status.startTime.getTime();
        if (elapsed > maxDurationMs) {
          this.logger.info('Maximum keep-alive duration reached, stopping service');
          this.stop();
          return;
        }

        // Check if session is still valid
        const sessionValid = await this.checkSessionValidity(page);
        if (!sessionValid) {
          this.logger.warn('Session appears to be expired, stopping keep-alive');
          this.status.sessionExpired = true;
          this.stop();
          return;
        }

        // Perform keep-alive activity
        await this.performKeepAliveActivity(page);
        
        this.status.lastActivity = new Date();
        this.status.activityCount++;

        this.logger.debug('Keep-alive activity completed', {
          activityCount: this.status.activityCount,
          elapsed: Math.round(elapsed / 1000 / 60) + 'm'
        });

      } catch (error) {
        this.logger.error('Keep-alive activity failed', error);
      }
    }, intervalMs);
  }

  /**
   * Stop the keep-alive service
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.status.isActive = false;
      this.logger.info('Keep-alive service stopped');
    }
  }

  /**
   * Check if session is still valid
   */
  private async checkSessionValidity(page: Page): Promise<boolean> {
    try {
      // Check for session timeout indicators
      for (const selector of this.config.sessionTimeoutSelectors) {
        try {
          const element = await page.locator(selector).first();
          if (await element.isVisible()) {
            this.logger.warn(`Session timeout detected: ${selector}`);
            return false;
          }
        } catch {
          // Selector not found, continue checking
        }
      }

      // Check for login required indicators
      for (const selector of this.config.loginRequiredSelectors) {
        try {
          const element = await page.locator(selector).first();
          if (await element.isVisible()) {
            this.logger.warn(`Login required detected: ${selector}`);
            return false;
          }
        } catch {
          // Selector not found, continue checking
        }
      }

      // Check current URL for login/signin patterns
      const currentUrl = page.url();
      if (currentUrl.includes('signin') || currentUrl.includes('login')) {
        this.logger.warn(`Session expired - redirected to login: ${currentUrl}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Session validity check failed', error);
      return false;
    }
  }

  /**
   * Perform minimal activity to maintain session
   */
  private async performKeepAliveActivity(page: Page): Promise<void> {
    const activities = [
      () => this.mouseWiggle(page),
      () => this.scrollActivity(page),
      () => this.focusActivity(page),
      () => this.keyboardActivity(page)
    ];

    // Randomly select an activity to appear more natural
    const randomActivity = activities[Math.floor(Math.random() * activities.length)];
    await randomActivity();
  }

  /**
   * Simulate mouse movement
   */
  private async mouseWiggle(page: Page): Promise<void> {
    try {
      const viewport = page.viewportSize();
      if (!viewport) return;

      const centerX = viewport.width / 2;
      const centerY = viewport.height / 2;
      const distance = this.config.mouseWiggleDistance;

      // Small circular mouse movement
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * 2 * Math.PI;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        
        await page.mouse.move(x, y);
        await page.waitForTimeout(100);
      }

      this.logger.debug('Mouse wiggle completed');
    } catch (error) {
      this.logger.warn('Mouse wiggle failed', error);
    }
  }

  /**
   * Simulate scroll activity
   */
  private async scrollActivity(page: Page): Promise<void> {
    try {
      await page.evaluate(() => {
        window.scrollBy(0, 10);
        setTimeout(() => window.scrollBy(0, -10), 100);
      });
      this.logger.debug('Scroll activity completed');
    } catch (error) {
      this.logger.warn('Scroll activity failed', error);
    }
  }

  /**
   * Simulate focus activity
   */
  private async focusActivity(page: Page): Promise<void> {
    try {
      await page.evaluate(() => {
        // Focus on body element
        document.body.focus();
      });
      this.logger.debug('Focus activity completed');
    } catch (error) {
      this.logger.warn('Focus activity failed', error);
    }
  }

  /**
   * Simulate minimal keyboard activity
   */
  private async keyboardActivity(page: Page): Promise<void> {
    try {
      // Press and release a non-visible key
      await page.keyboard.press('Shift');
      await page.waitForTimeout(50);
      this.logger.debug('Keyboard activity completed');
    } catch (error) {
      this.logger.warn('Keyboard activity failed', error);
    }
  }

  /**
   * Get current status
   */
  getStatus(): KeepAliveStatus {
    return { ...this.status };
  }

  /**
   * Check if service is running
   */
  isRunning(): boolean {
    return this.interval !== null;
  }
}