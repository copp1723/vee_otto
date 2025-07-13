import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { Logger } from '../core/utils/Logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = new Logger('vAuto-Test-Monitor');

class VAutoTestMonitor {
  private server: ChildProcessWithoutNullStreams | null = null;
  private logFile: fs.WriteStream;
  private errorLog: string[] = [];
  
  constructor() {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir);
    }
    
    // Create log file for this session
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = fs.createWriteStream(path.join(logsDir, `vauto-test-${timestamp}.log`));
  }
  
  private log(type: string, message: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type}] ${message}`;
    console.log(logEntry);
    this.logFile.write(logEntry + '\n');
    
    if (type === 'ERROR') {
      this.errorLog.push(logEntry);
    }
  }
  
  async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.log('INFO', 'Starting vAuto mockup server...');
      
      this.server = spawn('node', ['tests/serve-vauto-mockup.js'], {
        cwd: process.cwd()
      });
      
      this.server.stdout.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        if (output) {
          this.log('SERVER', output);
          if (output.includes('vAuto Mockup Server running')) {
            resolve();
          }
        }
      });
      
      this.server.stderr.on('data', (data: Buffer) => {
        const error = data.toString().trim();
        if (error) {
          this.log('ERROR', `Server error: ${error}`);
        }
      });
      
      this.server.on('error', (err) => {
        this.log('ERROR', `Failed to start server: ${err.message}`);
        reject(err);
      });
      
      // Timeout if server doesn't start
      setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 10000);
    });
  }
  
  async runTests(): Promise<void> {
    this.log('INFO', 'Running vAuto mockup tests...');
    
    const testProcess = spawn('npx', ['ts-node', 'tests/test-vauto-mockup.ts'], {
      cwd: process.cwd(),
      shell: true
    });
    
    testProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        this.log('TEST', output);
      }
    });
    
    testProcess.stderr.on('data', (data: Buffer) => {
      const error = data.toString().trim();
      if (error) {
        this.log('ERROR', `Test error: ${error}`);
      }
    });
    
    return new Promise((resolve) => {
      testProcess.on('close', (code) => {
        this.log('INFO', `Tests completed with exit code: ${code}`);
        resolve();
      });
    });
  }
  
  async runManualServer(): Promise<void> {
    this.log('INFO', 'Starting server for manual testing...');
    this.log('INFO', 'Server will be available at http://localhost:3001');
    this.log('INFO', 'You can also access it through the Dashboard at http://localhost:5173 (in dev mode)');
    this.log('INFO', 'Press Ctrl+C to stop');
    
    // Keep the process running
    process.stdin.resume();
  }
  
  cleanup(): void {
    if (this.server) {
      this.log('INFO', 'Stopping server...');
      this.server.kill();
    }
    
    if (this.errorLog.length > 0) {
      this.log('INFO', '\n=== ERROR SUMMARY ===');
      this.errorLog.forEach(error => console.log(error));
    }
    
    this.logFile.end();
  }
  
  printUsage(): void {
    console.log(`
vAuto Mockup Test Runner with Monitoring
=======================================

Usage: npx ts-node tests/run-vauto-mockup-with-monitoring.ts [mode]

Modes:
  test     - Run automated tests with monitoring (default)
  manual   - Start server for manual testing
  both     - Start server and run tests

The server runs on http://localhost:3001
Logs are saved to logs/vauto-test-[timestamp].log

Examples:
  npx ts-node tests/run-vauto-mockup-with-monitoring.ts
  npx ts-node tests/run-vauto-mockup-with-monitoring.ts manual
  npx ts-node tests/run-vauto-mockup-with-monitoring.ts test
`);
  }
}

async function main() {
  const monitor = new VAutoTestMonitor();
  const mode = process.argv[2] || 'test';
  
  if (mode === 'help') {
    monitor.printUsage();
    return;
  }
  
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\nShutting down...');
    monitor.cleanup();
    process.exit(0);
  });
  
  try {
    await monitor.startServer();
    
    // Wait a bit for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    switch (mode) {
      case 'manual':
        await monitor.runManualServer();
        break;
      case 'both':
        await monitor.runTests();
        await monitor.runManualServer();
        break;
      case 'test':
      default:
        await monitor.runTests();
        monitor.cleanup();
        process.exit(0);
    }
  } catch (error) {
    logger.error('Fatal error:', error);
    monitor.cleanup();
    process.exit(1);
  }
}

main(); 