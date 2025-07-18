#!/usr/bin/env node

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from '../core/utils/Logger';
import * as dotenv from 'dotenv';

dotenv.config();

const logger = new Logger('Error-Recovery');

interface RecoveryState {
  lastProcessedVehicleIndex?: number;
  lastSuccessfulVIN?: string;
  totalProcessed?: number;
  sessionFile?: string;
  timestamp?: Date;
}

class ErrorRecoveryService {
  private stateFile = './recovery-state.json';
  private sessionDir = './session';
  private reportDir = './reports/mvp';
  
  async diagnoseAndRecover() {
    logger.info('🔍 Starting Error Diagnosis and Recovery...\n');
    
    // 1. Check system state
    const state = await this.checkSystemState();
    
    // 2. Diagnose common issues
    const issues = await this.diagnoseIssues();
    
    // 3. Apply recovery procedures
    for (const issue of issues) {
      await this.applyRecovery(issue);
    }
    
    // 4. Verify recovery
    const verified = await this.verifyRecovery();
    
    if (verified) {
      logger.info('✅ Recovery procedures applied successfully');
      logger.info('You can now resume automation with: npm run production');
    } else {
      logger.error('❌ Some issues could not be resolved automatically');
      logger.info('Please check the manual recovery steps below');
    }
  }
  
  private async checkSystemState(): Promise<RecoveryState> {
    logger.info('📊 Checking system state...');
    
    const state: RecoveryState = {};
    
    // Check recovery state file
    if (await fs.pathExists(this.stateFile)) {
      state.lastProcessedVehicleIndex = (await fs.readJson(this.stateFile)).lastProcessedVehicleIndex;
      logger.info(`  Last processed vehicle: ${state.lastProcessedVehicleIndex || 'Unknown'}`);
    }
    
    // Check session
    const sessionFiles = await fs.readdir(this.sessionDir).catch(() => []);
    const latestSession = sessionFiles
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => {
        const statA = fs.statSync(path.join(this.sessionDir, a));
        const statB = fs.statSync(path.join(this.sessionDir, b));
        return statB.mtime.getTime() - statA.mtime.getTime();
      })[0];
    
    if (latestSession) {
      state.sessionFile = path.join(this.sessionDir, latestSession);
      const sessionAge = Date.now() - fs.statSync(state.sessionFile).mtime.getTime();
      logger.info(`  Session found: ${latestSession} (${Math.floor(sessionAge / 60000)} minutes old)`);
    } else {
      logger.warn('  No session found');
    }
    
    // Check latest report
    const reports = await fs.readdir(this.reportDir).catch(() => []);
    const latestReport = reports
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a))[0];
    
    if (latestReport) {
      const report = await fs.readJson(path.join(this.reportDir, latestReport));
      state.totalProcessed = report.results?.length || 0;
      state.lastSuccessfulVIN = report.results?.filter((r: any) => r.success).pop()?.vin;
      logger.info(`  Last report: ${latestReport}`);
      logger.info(`  Vehicles processed: ${state.totalProcessed}`);
      logger.info(`  Last successful VIN: ${state.lastSuccessfulVIN || 'None'}`);
    }
    
    return state;
  }
  
  private async diagnoseIssues(): Promise<string[]> {
    logger.info('\n🔍 Diagnosing issues...');
    
    const issues: string[] = [];
    
    // Check for common error patterns in logs
    const logFiles = await fs.readdir('./logs').catch(() => []);
    const recentLog = logFiles
      .filter(f => f.endsWith('.log'))
      .sort((a, b) => b.localeCompare(a))[0];
    
    if (recentLog) {
      const logContent = await fs.readFile(path.join('./logs', recentLog), 'utf-8');
      
      // Common error patterns
      if (logContent.includes('TimeoutError')) {
        issues.push('timeout');
        logger.warn('  ⏱️  Timeout errors detected');
      }
      
      if (logContent.includes('net::ERR_NAME_NOT_RESOLVED')) {
        issues.push('network');
        logger.warn('  🌐 Network connectivity issues detected');
      }
      
      if (logContent.includes('Session expired') || logContent.includes('401')) {
        issues.push('session');
        logger.warn('  🔑 Session expiration detected');
      }
      
      if (logContent.includes('Failed to click Factory Equipment')) {
        issues.push('selectors');
        logger.warn('  🎯 Selector issues detected');
      }
      
      if (logContent.includes('out of memory')) {
        issues.push('memory');
        logger.warn('  💾 Memory issues detected');
      }
    }
    
    // Check disk space
    try {
      const stats = await fs.statfs('.');
      const freePercent = (stats.bavail / stats.blocks * 100);
      if (freePercent < 10) {
        issues.push('disk');
        logger.warn(`  💿 Low disk space: ${freePercent.toFixed(1)}% free`);
      }
    } catch (error) {
      // Ignore on systems without statfs
    }
    
    if (issues.length === 0) {
      logger.info('  ✅ No obvious issues detected');
    }
    
    return issues;
  }
  
  private async applyRecovery(issue: string) {
    logger.info(`\n🔧 Applying recovery for: ${issue}`);
    
    switch (issue) {
      case 'timeout':
        logger.info('  Recommendation: Increase SLOW_MO and timeout values');
        logger.info('  export SLOW_MO=3000');
        logger.info('  export BROWSER_TIMEOUT=60000');
        break;
        
      case 'network':
        logger.info('  Testing network connectivity...');
        try {
          const response = await fetch('https://app.vauto.com');
          if (response.ok) {
            logger.info('  ✅ Network connection is working');
          }
        } catch (error) {
          logger.error('  ❌ Cannot reach VAuto. Check your internet connection');
        }
        break;
        
      case 'session':
        logger.info('  Clearing expired session...');
        const sessionFiles = await fs.readdir(this.sessionDir).catch(() => []);
        for (const file of sessionFiles) {
          await fs.remove(path.join(this.sessionDir, file));
        }
        logger.info('  ✅ Session cleared. Next run will require fresh login');
        break;
        
      case 'selectors':
        logger.info('  Selector issues may indicate VAuto UI changes');
        logger.info('  Recommendations:');
        logger.info('  1. Run in headed mode to verify UI: HEADLESS=false');
        logger.info('  2. Update selectors in platforms/vauto/vautoSelectors.ts');
        logger.info('  3. Check screenshots in screenshots/mvp/ for clues');
        break;
        
      case 'memory':
        logger.info('  Clearing temporary files...');
        // Clear old screenshots
        const screenshots = await fs.readdir('./screenshots/mvp').catch(() => []);
        const oldScreenshots = screenshots.filter(f => {
          const stat = fs.statSync(path.join('./screenshots/mvp', f));
          return Date.now() - stat.mtime.getTime() > 86400000; // Older than 1 day
        });
        
        for (const screenshot of oldScreenshots) {
          await fs.remove(path.join('./screenshots/mvp', screenshot));
        }
        logger.info(`  ✅ Removed ${oldScreenshots.length} old screenshots`);
        
        logger.info('  Recommendation: Process fewer vehicles per run');
        logger.info('  export MAX_VEHICLES=10');
        break;
        
      case 'disk':
        logger.info('  Cleaning up old files...');
        // Clean old reports
        const reports = await fs.readdir(this.reportDir).catch(() => []);
        const oldReports = reports
          .filter(f => f.endsWith('.json'))
          .sort((a, b) => a.localeCompare(b))
          .slice(0, -10); // Keep only last 10
        
        for (const report of oldReports) {
          await fs.remove(path.join(this.reportDir, report));
        }
        logger.info(`  ✅ Removed ${oldReports.length} old reports`);
        break;
    }
  }
  
  private async verifyRecovery(): Promise<boolean> {
    logger.info('\n🔍 Verifying recovery...');
    
    // Quick connectivity test
    try {
      logger.info('  Testing VAuto connectivity...');
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      
      await page.goto('https://login.vauto.com/', { timeout: 10000 });
      const hasLoginForm = await page.locator('input[type="password"]').isVisible({ timeout: 5000 });
      
      await browser.close();
      
      if (hasLoginForm) {
        logger.info('  ✅ Can reach VAuto login page');
        return true;
      }
    } catch (error) {
      logger.error('  ❌ Cannot verify VAuto connectivity');
      return false;
    }
    
    return false;
  }
  
  async createRecoveryCheckpoint() {
    logger.info('💾 Creating recovery checkpoint...');
    
    const checkpoint = {
      timestamp: new Date(),
      reports: await fs.readdir(this.reportDir).catch(() => []),
      sessions: await fs.readdir(this.sessionDir).catch(() => []),
      lastReport: null as any
    };
    
    // Get last report details
    const reports = checkpoint.reports.filter(f => f.endsWith('.json'));
    if (reports.length > 0) {
      const latestReport = reports.sort((a, b) => b.localeCompare(a))[0];
      checkpoint.lastReport = await fs.readJson(path.join(this.reportDir, latestReport));
    }
    
    await fs.writeJson('./recovery-checkpoint.json', checkpoint, { spaces: 2 });
    logger.info('✅ Checkpoint created: recovery-checkpoint.json');
  }
  
  async showManualRecoverySteps() {
    console.log(`
📋 Manual Recovery Steps:

1. Clear Browser Data:
   rm -rf ~/.cache/ms-playwright
   npx playwright install chromium

2. Reset Environment:
   rm -rf session/* screenshots/mvp/* 
   export HEADLESS=false
   export MAX_VEHICLES=1
   export SLOW_MO=3000

3. Test Login:
   npx ts-node scripts/test-login-only.ts

4. Test Single Vehicle:
   ./scripts/run-mvp.sh

5. If selectors changed:
   - Run in headed mode
   - Use browser DevTools to find new selectors
   - Update platforms/vauto/vautoSelectors.ts

6. Resume from checkpoint:
   npx ts-node scripts/resume-from-checkpoint.ts

For persistent issues, check:
- DEVELOPER_HANDOFF_GUIDE.md
- QUICK_DEBUG_COMMANDS.md
    `);
  }
}

// Main execution
async function main() {
  const recovery = new ErrorRecoveryService();
  
  const args = process.argv.slice(2);
  
  if (args.includes('--checkpoint')) {
    await recovery.createRecoveryCheckpoint();
  } else if (args.includes('--manual')) {
    await recovery.showManualRecoverySteps();
  } else {
    await recovery.diagnoseAndRecover();
    await recovery.showManualRecoverySteps();
  }
}

main().catch(error => {
  logger.error('Recovery failed:', error);
  process.exit(1);
});