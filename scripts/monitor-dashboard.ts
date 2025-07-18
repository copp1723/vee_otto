#!/usr/bin/env node

import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from '../core/utils/Logger';
import * as readline from 'readline';

const logger = new Logger('Monitor-Dashboard');

interface VehicleResult {
  vin: string;
  success: boolean;
  featuresFound: number;
  checkboxesUpdated: number;
  error?: string;
  timestamp: Date;
}

interface RunReport {
  totalVehicles: number;
  successful: number;
  failed: number;
  totalFeaturesFound: number;
  totalCheckboxesUpdated: number;
  timestamp: Date;
  results: VehicleResult[];
}

class MonitorDashboard {
  private reportDir = './reports/mvp';
  private screenshotDir = './screenshots/mvp';
  private logDir = './logs';
  private refreshInterval = 5000; // 5 seconds
  private isRunning = true;

  async start() {
    console.clear();
    
    // Set up key press handling
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    
    process.stdin.on('keypress', (str, key) => {
      if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
        this.stop();
      }
    });
    
    // Main monitoring loop
    while (this.isRunning) {
      await this.displayDashboard();
      await this.sleep(this.refreshInterval);
    }
  }
  
  private async displayDashboard() {
    console.clear();
    console.log('='.repeat(80));
    console.log('                        VAuto Automation Monitor Dashboard');
    console.log('='.repeat(80));
    console.log(`Last Updated: ${new Date().toLocaleString()}`);
    console.log('Press "q" to quit\n');
    
    // Get latest report
    const latestReport = await this.getLatestReport();
    if (latestReport) {
      this.displayReportSummary(latestReport);
    } else {
      console.log('No reports found yet...\n');
    }
    
    // Display recent activity
    await this.displayRecentActivity();
    
    // Display system status
    await this.displaySystemStatus();
    
    // Display recent errors
    await this.displayRecentErrors();
  }
  
  private displayReportSummary(report: RunReport) {
    const successRate = report.totalVehicles > 0 
      ? ((report.successful / report.totalVehicles) * 100).toFixed(1)
      : '0';
    
    console.log('📊 Current Run Summary:');
    console.log('─'.repeat(40));
    console.log(`Total Vehicles:    ${report.totalVehicles}`);
    console.log(`✅ Successful:     ${report.successful}`);
    console.log(`❌ Failed:         ${report.failed}`);
    console.log(`📈 Success Rate:   ${successRate}%`);
    console.log(`🔍 Features Found: ${report.totalFeaturesFound}`);
    console.log(`☑️  Checkboxes:     ${report.totalCheckboxesUpdated}`);
    console.log('');
    
    // Show per-vehicle metrics
    if (report.totalVehicles > 0) {
      const avgFeatures = (report.totalFeaturesFound / report.successful).toFixed(1);
      const avgCheckboxes = (report.totalCheckboxesUpdated / report.successful).toFixed(1);
      console.log(`Average per vehicle: ${avgFeatures} features, ${avgCheckboxes} checkboxes\n`);
    }
  }
  
  private async displayRecentActivity() {
    console.log('📋 Recent Activity:');
    console.log('─'.repeat(40));
    
    try {
      // Get recent screenshots
      const screenshots = await fs.readdir(this.screenshotDir);
      const recentScreenshots = screenshots
        .filter(f => f.endsWith('.png'))
        .sort((a, b) => {
          const statA = fs.statSync(path.join(this.screenshotDir, a));
          const statB = fs.statSync(path.join(this.screenshotDir, b));
          return statB.mtime.getTime() - statA.mtime.getTime();
        })
        .slice(0, 3);
      
      if (recentScreenshots.length > 0) {
        console.log('Recent screenshots:');
        recentScreenshots.forEach(screenshot => {
          const stat = fs.statSync(path.join(this.screenshotDir, screenshot));
          const age = this.getTimeAgo(stat.mtime);
          console.log(`  📸 ${screenshot} (${age})`);
        });
      }
    } catch (error) {
      console.log('No recent activity');
    }
    
    console.log('');
  }
  
  private async displaySystemStatus() {
    console.log('🖥️  System Status:');
    console.log('─'.repeat(40));
    
    // Check if automation is running
    const isRunning = await this.isAutomationRunning();
    console.log(`Process Status: ${isRunning ? '🟢 Running' : '🔴 Stopped'}`);
    
    // Disk space
    try {
      const stats = await fs.statfs('.');
      const usedPercent = ((stats.blocks - stats.bavail) / stats.blocks * 100).toFixed(1);
      console.log(`Disk Usage: ${usedPercent}%`);
    } catch (error) {
      // Fallback for systems without statfs
      console.log('Disk Usage: N/A');
    }
    
    // Count files
    try {
      const reportCount = (await fs.readdir(this.reportDir)).filter(f => f.endsWith('.json')).length;
      const screenshotCount = (await fs.readdir(this.screenshotDir)).filter(f => f.endsWith('.png')).length;
      console.log(`Reports: ${reportCount} | Screenshots: ${screenshotCount}`);
    } catch (error) {
      console.log('File counts unavailable');
    }
    
    console.log('');
  }
  
  private async displayRecentErrors() {
    console.log('⚠️  Recent Errors:');
    console.log('─'.repeat(40));
    
    try {
      // Get latest log file
      const logFiles = await fs.readdir(this.logDir);
      const latestLog = logFiles
        .filter(f => f.endsWith('.log'))
        .sort((a, b) => {
          const statA = fs.statSync(path.join(this.logDir, a));
          const statB = fs.statSync(path.join(this.logDir, b));
          return statB.mtime.getTime() - statA.mtime.getTime();
        })[0];
      
      if (latestLog) {
        const logPath = path.join(this.logDir, latestLog);
        const logContent = await fs.readFile(logPath, 'utf-8');
        const lines = logContent.split('\n');
        const errorLines = lines
          .filter(line => line.includes('error') || line.includes('ERROR') || line.includes('❌'))
          .slice(-3);
        
        if (errorLines.length > 0) {
          errorLines.forEach(error => {
            const match = error.match(/\[([\d-TZ:\.]+)\]/);
            const time = match ? new Date(match[1]).toLocaleTimeString() : '';
            const message = error.substring(error.indexOf(']', error.indexOf(']') + 1) + 1).trim();
            console.log(`  ${time} - ${message.substring(0, 60)}...`);
          });
        } else {
          console.log('  No recent errors 🎉');
        }
      }
    } catch (error) {
      console.log('  Unable to read error logs');
    }
    
    console.log('');
  }
  
  private async getLatestReport(): Promise<RunReport | null> {
    try {
      const files = await fs.readdir(this.reportDir);
      const reportFiles = files
        .filter(f => f.startsWith('mvp-report-') && f.endsWith('.json'))
        .sort((a, b) => {
          const timestampA = parseInt(a.match(/mvp-report-(\d+)\.json/)?.[1] || '0');
          const timestampB = parseInt(b.match(/mvp-report-(\d+)\.json/)?.[1] || '0');
          return timestampB - timestampA;
        });
      
      if (reportFiles.length === 0) return null;
      
      const latestFile = path.join(this.reportDir, reportFiles[0]);
      const content = await fs.readJson(latestFile);
      return content;
    } catch (error) {
      return null;
    }
  }
  
  private async isAutomationRunning(): Promise<boolean> {
    // Check if there's a recent screenshot (within last minute)
    try {
      const screenshots = await fs.readdir(this.screenshotDir);
      const recentScreenshot = screenshots.find(f => {
        if (!f.endsWith('.png')) return false;
        const stat = fs.statSync(path.join(this.screenshotDir, f));
        const age = Date.now() - stat.mtime.getTime();
        return age < 60000; // Less than 1 minute old
      });
      return !!recentScreenshot;
    } catch (error) {
      return false;
    }
  }
  
  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private stop() {
    console.clear();
    console.log('Monitor stopped.\n');
    this.isRunning = false;
    process.exit(0);
  }
}

// Run the dashboard
const dashboard = new MonitorDashboard();
dashboard.start().catch(error => {
  logger.error('Dashboard error:', error);
  process.exit(1);
});