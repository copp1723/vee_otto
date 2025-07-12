import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { Logger } from '../utils/Logger';

const execAsync = promisify(exec);

export interface UIVisionMacro {
  name: string;
  commands: UIVisionCommand[];
}

export interface UIVisionCommand {
  command: string;
  target: string;
  value?: string;
}

export interface UIVisionConfig {
  extensionPath?: string;
  macroPath?: string;
  cliPath?: string;
  timeout?: number;
}

export class UIVisionService {
  private logger: Logger;
  private config: UIVisionConfig;
  private macroDir: string;

  constructor(config: UIVisionConfig = {}) {
    this.logger = new Logger('UIVisionService');
    this.config = {
      extensionPath: config.extensionPath || '/path/to/ui.vision/extension',
      macroPath: config.macroPath || './macros',
      cliPath: config.cliPath || 'ui.vision.cli',
      timeout: config.timeout || 30000,
      ...config
    };
    
    this.macroDir = path.resolve(this.config.macroPath!);
    this.ensureMacroDirectory();
  }

  private async ensureMacroDirectory(): Promise<void> {
    await fs.ensureDir(this.macroDir);
  }

  async createMacro(name: string, commands: UIVisionCommand[]): Promise<string> {
    const macro: UIVisionMacro = { name, commands };
    const macroPath = path.join(this.macroDir, `${name}.json`);
    
    await fs.writeJson(macroPath, macro, { spaces: 2 });
    this.logger.info(`Macro created: ${macroPath}`);
    
    return macroPath;
  }

  async runMacro(macroName: string): Promise<boolean> {
    try {
      const macroPath = path.join(this.macroDir, `${macroName}.json`);
      
      if (!await fs.pathExists(macroPath)) {
        this.logger.error(`Macro not found: ${macroPath}`);
        return false;
      }

      this.logger.info(`Running UI Vision macro: ${macroName}`);
      
      // Execute UI Vision CLI command
      const command = `${this.config.cliPath} run "${macroPath}" --timeout ${this.config.timeout}`;
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.config.timeout
      });

      if (stderr) {
        this.logger.warn(`UI Vision stderr: ${stderr}`);
      }

      this.logger.info(`UI Vision output: ${stdout}`);
      return !stderr || stderr.length === 0;

    } catch (error) {
      this.logger.error('Failed to run UI Vision macro', { 
        error: error instanceof Error ? error.message : String(error),
        macroName 
      });
      return false;
    }
  }

  async visualClick(imageTarget: string, confidence: number = 0.8): Promise<boolean> {
    const macro = await this.createMacro('visual_click', [
      {
        command: 'XClick',
        target: imageTarget,
        value: String(confidence)
      }
    ]);

    return this.runMacro('visual_click');
  }

  async visualType(imageTarget: string, text: string): Promise<boolean> {
    const macro = await this.createMacro('visual_type', [
      {
        command: 'XClick',
        target: imageTarget
      },
      {
        command: 'XType',
        target: text
      }
    ]);

    return this.runMacro('visual_type');
  }

  async captureScreenshot(filename: string): Promise<string> {
    const screenshotPath = path.join(this.macroDir, 'screenshots', filename);
    await fs.ensureDir(path.dirname(screenshotPath));

    const macro = await this.createMacro('capture_screenshot', [
      {
        command: 'captureScreenshot',
        target: filename
      }
    ]);

    const success = await this.runMacro('capture_screenshot');
    return success ? screenshotPath : '';
  }

  async waitForImage(imageTarget: string, timeout: number = 10): Promise<boolean> {
    const macro = await this.createMacro('wait_for_image', [
      {
        command: 'visualAssert',
        target: imageTarget,
        value: String(timeout)
      }
    ]);

    return this.runMacro('wait_for_image');
  }

  getBrowserArgs(): string[] {
    return [
      `--load-extension=${this.config.extensionPath}`,
      '--disable-blink-features=AutomationControlled'
    ];
  }

  // Create common macros for vAuto workflow
  async createVAutoMacros(): Promise<void> {
    // Login button click macro
    await this.createMacro('vauto_login_click', [
      {
        command: 'XClick',
        target: 'vauto_login_button.png',
        value: '0.8'
      }
    ]);

    // Checkbox click macro with visual verification
    await this.createMacro('vauto_checkbox_click', [
      {
        command: 'visualAssert',
        target: 'checkbox_unchecked.png',
        value: '5'
      },
      {
        command: 'XClick',
        target: 'checkbox_unchecked.png',
        value: '0.9'
      },
      {
        command: 'pause',
        target: '1000'
      },
      {
        command: 'visualVerify',
        target: 'checkbox_checked.png'
      }
    ]);

    // Window sticker download macro
    await this.createMacro('vauto_download_sticker', [
      {
        command: 'XClick',
        target: 'window_sticker_link.png',
        value: '0.8'
      },
      {
        command: 'pause',
        target: '2000'
      },
      {
        command: 'XClick',
        target: 'download_button.png',
        value: '0.8'
      }
    ]);

    this.logger.info('vAuto macros created successfully');
  }
}