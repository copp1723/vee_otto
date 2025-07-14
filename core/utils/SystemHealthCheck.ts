import { chromium } from 'playwright';
import { Logger } from './Logger';
import fs from 'fs-extra';
import path from 'path';

const logger = new Logger('SystemHealthCheck');

export interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: any;
}

export class SystemHealthCheck {
  
  async runFullHealthCheck(): Promise<HealthCheckResult[]> {
    logger.info('Starting system health check...');
    
    const results: HealthCheckResult[] = [];
    
    // Check environment variables
    results.push(await this.checkEnvironmentVariables());
    
    // Check file system permissions
    results.push(await this.checkFileSystemPermissions());
    
    // Check Playwright installation
    results.push(await this.checkPlaywrightInstallation());
    
    // Check browser launch capability
    results.push(await this.checkBrowserLaunch());
    
    // Check memory availability
    results.push(await this.checkMemoryAvailability());
    
    // Check network connectivity
    results.push(await this.checkNetworkConnectivity());
    
    logger.info('System health check completed', {
      healthy: results.filter(r => r.status === 'healthy').length,
      warnings: results.filter(r => r.status === 'warning').length,
      errors: results.filter(r => r.status === 'error').length
    });
    
    return results;
  }
  
  private async checkEnvironmentVariables(): Promise<HealthCheckResult> {
    try {
      const requiredVars = ['VAUTO_USERNAME', 'VAUTO_PASSWORD'];
      const optionalVars = ['MAILGUN_API_KEY', 'TWILIO_ACCOUNT_SID'];
      
      const missing = requiredVars.filter(v => !process.env[v]);
      const optionalMissing = optionalVars.filter(v => !process.env[v]);
      
      if (missing.length > 0) {
        return {
          component: 'Environment Variables',
          status: 'error',
          message: `Missing required environment variables: ${missing.join(', ')}`,
          details: { missing, optionalMissing }
        };
      }
      
      if (optionalMissing.length > 0) {
        return {
          component: 'Environment Variables',
          status: 'warning',
          message: `Missing optional environment variables: ${optionalMissing.join(', ')}`,
          details: { missing, optionalMissing }
        };
      }
      
      return {
        component: 'Environment Variables',
        status: 'healthy',
        message: 'All required environment variables are set'
      };
      
    } catch (error) {
      return {
        component: 'Environment Variables',
        status: 'error',
        message: `Environment check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  private async checkFileSystemPermissions(): Promise<HealthCheckResult> {
    try {
      const directories = ['logs', 'screenshots', 'downloads', 'reports'];
      const issues: string[] = [];
      
      for (const dir of directories) {
        try {
          await fs.ensureDir(dir);
          
          // Test write permissions
          const testFile = path.join(dir, 'health-check-test.txt');
          await fs.writeFile(testFile, 'test');
          await fs.remove(testFile);
          
        } catch (error) {
          issues.push(`${dir}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      if (issues.length > 0) {
        return {
          component: 'File System',
          status: 'error',
          message: 'File system permission issues detected',
          details: { issues }
        };
      }
      
      return {
        component: 'File System',
        status: 'healthy',
        message: 'All required directories accessible'
      };
      
    } catch (error) {
      return {
        component: 'File System',
        status: 'error',
        message: `File system check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  private async checkPlaywrightInstallation(): Promise<HealthCheckResult> {
    try {
      const executablePath = chromium.executablePath();
      
      if (!fs.existsSync(executablePath)) {
        return {
          component: 'Playwright',
          status: 'error',
          message: `Browser executable not found at: ${executablePath}`,
          details: { executablePath }
        };
      }
      
      // Check if executable is actually executable
      const stats = await fs.stat(executablePath);
      if (!stats.isFile()) {
        return {
          component: 'Playwright',
          status: 'error',
          message: `Browser executable path is not a file: ${executablePath}`,
          details: { executablePath, stats }
        };
      }
      
      return {
        component: 'Playwright',
        status: 'healthy',
        message: 'Browser executable found and accessible',
        details: { executablePath }
      };
      
    } catch (error) {
      return {
        component: 'Playwright',
        status: 'error',
        message: `Playwright check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  private async checkBrowserLaunch(): Promise<HealthCheckResult> {
    let browser = null;
    
    try {
      // Try different browser configurations
      const configs = [
        { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
        { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] },
        { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process'] }
      ];
      
      let lastError: Error | null = null;
      
      for (let i = 0; i < configs.length; i++) {
        try {
          browser = await chromium.launch(configs[i]);
          const page = await browser.newPage();
          
          // Test basic functionality
          await page.evaluate(() => navigator.userAgent);
          await page.close();
          
          return {
            component: 'Browser Launch',
            status: 'healthy',
            message: `Browser launched successfully with configuration ${i + 1}`,
            details: { config: configs[i] }
          };
          
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (browser) {
            await browser.close().catch(() => {});
            browser = null;
          }
        }
      }
      
      return {
        component: 'Browser Launch',
        status: 'error',
        message: `All browser launch configurations failed. Last error: ${lastError?.message}`,
        details: { lastError: lastError?.message, configs }
      };
      
    } catch (error) {
      return {
        component: 'Browser Launch',
        status: 'error',
        message: `Browser launch check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }
  
  private async checkMemoryAvailability(): Promise<HealthCheckResult> {
    try {
      const memUsage = process.memoryUsage();
      const totalMemMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const usedMemMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const freeMem = totalMemMB - usedMemMB;
      
      // Warn if less than 200MB available
      if (freeMem < 200) {
        return {
          component: 'Memory',
          status: 'warning',
          message: `Low memory available: ${freeMem}MB`,
          details: { totalMemMB, usedMemMB, freeMem }
        };
      }
      
      // Error if less than 100MB available
      if (freeMem < 100) {
        return {
          component: 'Memory',
          status: 'error',
          message: `Critical memory shortage: ${freeMem}MB`,
          details: { totalMemMB, usedMemMB, freeMem }
        };
      }
      
      return {
        component: 'Memory',
        status: 'healthy',
        message: `Memory usage normal: ${usedMemMB}MB used, ${freeMem}MB available`,
        details: { totalMemMB, usedMemMB, freeMem }
      };
      
    } catch (error) {
      return {
        component: 'Memory',
        status: 'error',
        message: `Memory check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  private async checkNetworkConnectivity(): Promise<HealthCheckResult> {
    try {
      // Test connectivity to vAuto
      const targetUrl = process.env.TARGET_URL || 'https://app.vauto.com';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(targetUrl, {
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return {
          component: 'Network',
          status: 'healthy',
          message: `Network connectivity to ${targetUrl} successful`,
          details: { url: targetUrl, status: response.status }
        };
      } else {
        return {
          component: 'Network',
          status: 'warning',
          message: `Network connectivity to ${targetUrl} returned ${response.status}`,
          details: { url: targetUrl, status: response.status }
        };
      }
      
    } catch (error) {
      return {
        component: 'Network',
        status: 'error',
        message: `Network connectivity check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  async generateHealthReport(): Promise<string> {
    const results = await this.runFullHealthCheck();
    
    let report = '# System Health Check Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    
    const healthy = results.filter(r => r.status === 'healthy').length;
    const warnings = results.filter(r => r.status === 'warning').length;
    const errors = results.filter(r => r.status === 'error').length;
    
    report += `## Summary\n`;
    report += `- ✅ Healthy: ${healthy}\n`;
    report += `- ⚠️ Warnings: ${warnings}\n`;
    report += `- ❌ Errors: ${errors}\n\n`;
    
    report += `## Component Details\n\n`;
    
    for (const result of results) {
      const icon = result.status === 'healthy' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      report += `### ${icon} ${result.component}\n`;
      report += `**Status**: ${result.status}\n`;
      report += `**Message**: ${result.message}\n`;
      
      if (result.details) {
        report += `**Details**: ${JSON.stringify(result.details, null, 2)}\n`;
      }
      
      report += '\n';
    }
    
    return report;
  }
}

export const systemHealthCheck = new SystemHealthCheck(); 