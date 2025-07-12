import { Page } from 'playwright';
import { BaseAgent as BaseAutomationAgent, TwoFactorConfig } from '../../core/agents/BaseAgent';
import { vAutoSelectors } from './vautoSelectors';
import { findFeaturesInStickerText, getCheckboxLabels, parseWindowStickerText } from './featureMapping';
import {
  reliableClick,
  scrapeInlineContent,
  setCheckbox,
  waitForLoadingToComplete
} from '../../core/utils/reliabilityUtils';
import { Logger } from '../../core/utils/Logger';
import { MailgunProvider } from '../../integrations/email/MailgunProvider';
import { SMTPProvider } from '../../integrations/email/SMTPProvider';
import * as process from 'process';

export interface VAutoConfig {
  username: string;
  password: string;
  dealershipId?: string;
  headless?: boolean;
  slowMo?: number;
  screenshotOnError?: boolean;
  mailgunConfig?: any;
}

export interface VehicleProcessingResult {
  vin: string;
  processed: boolean;
  featuresFound: string[];
  featuresUpdated: string[];
  errors: string[];
  processingTime: number;
}

export interface VAutoRunResult {
  startTime: Date;
  endTime: Date;
  totalVehicles: number;
  successfulVehicles: number;
  failedVehicles: number;
  vehicles: VehicleProcessingResult[];
  errors: string[];
}

export class VAutoAgent extends BaseAutomationAgent {
  private mailgunService: MailgunService | null = null;
  protected currentRunResult: VAutoRunResult;
  
  constructor(private vAutoConfig: VAutoConfig) {
    super({
      headless: vAutoConfig.headless || false,
      slowMo: vAutoConfig.slowMo || 100,
      screenshotOnError: vAutoConfig.screenshotOnError !== false,
      notificationsEnabled: true
    });
    
    this.logger = new Logger('VAutoAgent');
    
    // Initialize run result
    this.currentRunResult = {
      startTime: new Date(),
      endTime: new Date(),
      totalVehicles: 0,
      successfulVehicles: 0,
      failedVehicles: 0,
      vehicles: [],
      errors: []
    };
    
    // Initialize Mailgun if config provided
    if (vAutoConfig.mailgunConfig) {
      this.mailgunService = new MailgunService(vAutoConfig.mailgunConfig);
    }
  }
  
  async login(): Promise<boolean> {
    if (!this.page) {
      throw new Error('Page not initialized. Call initialize() first.');
    }
    
    try {
      this.logger.info('Starting vAuto login process');
      
      // Navigate to login page
      await this.page.goto(vAutoSelectors.login.url);
      await this.page.waitForLoadState('networkidle');
      await this.takeScreenshot('vauto-login-page');
      
      // Enter username
      await this.page.fill(vAutoSelectors.login.username, this.vAutoConfig.username);
      await reliableClick(this.page, vAutoSelectors.login.nextButton);
      await this.page.waitForLoadState('networkidle');
      
      // Enter password
      await this.page.fill(vAutoSelectors.login.password, this.vAutoConfig.password);
      await this.takeScreenshot('vauto-credentials-entered');
      await reliableClick(this.page, vAutoSelectors.login.submit);
      
      // Handle 2FA if needed
      const needs2FA = await this.check2FARequired();
      if (needs2FA) {
        const twoFactorConfig: TwoFactorConfig = {
          enabled: true,
          codeInputSelector: vAutoSelectors.login.otpInput,
          submitSelector: vAutoSelectors.login.otpSubmit,
          successIndicator: vAutoSelectors.login.successIndicator || vAutoSelectors.dashboard.url,
          timeout: 300000
        };
        
        const twoFactorMethod = process.env.TWO_FACTOR_METHOD || 'email';
        
        if (twoFactorMethod === 'sms') {
          // Set webhook URL for polling SMS code
          twoFactorConfig.webhookUrl = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/api/2fa/latest`;
          
          // Optionally select SMS option if there's a choice
          try {
            await reliableClick(this.page, vAutoSelectors.login.smsOptionSelector); // Add this selector in vautoSelectors.ts if needed
          } catch (e) {
            this.logger.debug('No SMS option selector found or not needed');
          }
        } else {
          // For email, set email selector if needed
          twoFactorConfig.emailSelector = vAutoSelectors.login.emailOptionSelector; // Add if necessary
        }
        
        const twoFASuccess = await this.handle2FA(twoFactorConfig);
        if (!twoFASuccess) {
          throw new Error('2FA verification failed');
        }
      }
      
      // Verify login success
      await this.page.waitForLoadState('networkidle');
      const currentUrl = this.page.url();
      
      if (currentUrl.includes('dashboard') || currentUrl.includes('provision')) {
        this.logger.info('vAuto login successful');
        await this.takeScreenshot('vauto-login-success');
        return true;
      }
      
      throw new Error('Login verification failed - not on dashboard');
      
    } catch (error) {
      this.logger.error('vAuto login failed', error);
      await this.takeScreenshot('vauto-login-error');
      throw error;
    }
  }
  
  private async check2FARequired(): Promise<boolean> {
    try {
      // Check if OTP input is visible
      const otpVisible = await this.page!.locator(vAutoSelectors.login.otpInput).isVisible();
      return otpVisible;
    } catch {
      return false;
    }
  }
  
  async navigateToInventory(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    this.logger.info('Navigating to inventory');
    
    // Go to dashboard if not already there
    const currentUrl = this.page.url();
    if (!currentUrl.includes('provision')) {
      await this.page.goto(vAutoSelectors.dashboard.url);
      await this.page.waitForLoadState('networkidle');
    }
    
    // Click View Inventory
    await reliableClick(this.page, vAutoSelectors.inventory.viewInventoryLink);
    await waitForLoadingToComplete(this.page, Object.values(vAutoSelectors.loading));
    await this.takeScreenshot('vauto-inventory-page');
  }
  
  async applyInventoryFilters(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    this.logger.info('Applying inventory filters for age 0-1 days');
    
    // Click filter button
    await reliableClick(this.page, vAutoSelectors.inventory.filterButton);
    await this.page.waitForTimeout(1000);
    
    // Enable age filter
    await reliableClick(this.page, vAutoSelectors.inventory.ageFilterLabel);
    
    // Fill age range
    await this.page.fill(vAutoSelectors.inventory.ageMinInput, '0');
    await this.page.fill(vAutoSelectors.inventory.ageMaxInput, '1');
    
    await this.takeScreenshot('vauto-filters-set');
    
    // Apply filters
    await reliableClick(this.page, vAutoSelectors.inventory.applyFilter);
    await waitForLoadingToComplete(this.page, Object.values(vAutoSelectors.loading));
    
    this.logger.info('Inventory filters applied');
  }
  
  async processInventory(): Promise<VAutoRunResult> {
    if (!this.page) throw new Error('Page not initialized');
    
    this.currentRunResult.startTime = new Date();
    this.logger.info('Starting inventory processing');
    
    try {
      await this.navigateToInventory();
      await this.applyInventoryFilters();
      
      let pageNumber = 1;
      let hasNextPage = true;
      
      while (hasNextPage) {
        this.logger.info(`Processing inventory page ${pageNumber}`);
        
        // Get all vehicle links on current page
        const vehicleElements = await this.page.$$(vAutoSelectors.inventory.vehicleRows);
        const vehicleCount = vehicleElements.length;
        
        this.logger.info(`Found ${vehicleCount} vehicles on page ${pageNumber}`);
        
        // Process each vehicle
        for (let i = 0; i < vehicleCount; i++) {
          try {
            // Re-query elements after navigation
            const vehicleLinks = await this.page.$$(vAutoSelectors.inventory.vehicleRows);
            if (i < vehicleLinks.length) {
              await vehicleLinks[i].click();
              await this.processVehicle();
              
              // Navigate back to inventory
              await this.page.goBack();
              await waitForLoadingToComplete(this.page, Object.values(vAutoSelectors.loading));
            }
          } catch (error) {
            this.logger.error(`Failed to process vehicle ${i + 1} on page ${pageNumber}`, error);
            this.currentRunResult.errors.push(`Vehicle ${i + 1} on page ${pageNumber}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        // Check for next page
        hasNextPage = await this.hasNextPage();
        if (hasNextPage) {
          await reliableClick(this.page, vAutoSelectors.inventory.nextPageButton);
          await waitForLoadingToComplete(this.page, Object.values(vAutoSelectors.loading));
          pageNumber++;
        }
      }
      
    } catch (error) {
      this.logger.error('Inventory processing failed', error);
      this.currentRunResult.errors.push(`Inventory processing: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Finalize results
    this.currentRunResult.endTime = new Date();
    this.currentRunResult.totalVehicles = this.currentRunResult.vehicles.length;
    this.currentRunResult.successfulVehicles = this.currentRunResult.vehicles.filter(v => v.processed).length;
    this.currentRunResult.failedVehicles = this.currentRunResult.totalVehicles - this.currentRunResult.successfulVehicles;
    
    return this.currentRunResult;
  }
  
  protected async processVehicle(): Promise<void> {
    const startTime = Date.now();
    const result: VehicleProcessingResult = {
      vin: '',
      processed: false,
      featuresFound: [],
      featuresUpdated: [],
      errors: [],
      processingTime: 0
    };
    
    try {
      // Get VIN
      result.vin = await this.getVehicleVIN();
      this.logger.info(`Processing vehicle: ${result.vin}`);
      
      // Navigate to Factory Equipment tab
      await reliableClick(this.page!, vAutoSelectors.vehicleDetails.factoryEquipmentTab);
      await waitForLoadingToComplete(this.page!, Object.values(vAutoSelectors.loading));
      
      // Get window sticker content
      const stickerText = await this.getWindowStickerContent();
      
      if (!stickerText) {
        throw new Error('Could not retrieve window sticker content');
      }
      
      // Parse features from sticker
      const { features } = parseWindowStickerText(stickerText);
      result.featuresFound = features;
      
      this.logger.info(`Found ${features.length} features in window sticker for ${result.vin}`);
      
      // Update checkboxes based on features
      const updatedFeatures = await this.updateFeatureCheckboxes(features);
      result.featuresUpdated = updatedFeatures;
      
      // Save changes
      await reliableClick(this.page!, vAutoSelectors.vehicleDetails.saveButton);
      await this.page!.waitForTimeout(2000); // Wait for save to complete
      
      result.processed = true;
      this.logger.info(`Successfully processed vehicle ${result.vin}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
      this.logger.error(`Failed to process vehicle ${result.vin}`, error);
      
      if (this.config.screenshotOnError) {
        await this.takeScreenshot(`vehicle-error-${result.vin || 'unknown'}`);
      }
    }
    
    result.processingTime = Date.now() - startTime;
    this.currentRunResult.vehicles.push(result);
  }
  
  private async getVehicleVIN(): Promise<string> {
    try {
      const vinText = await scrapeInlineContent(this.page!, vAutoSelectors.vehicleDetails.vinField);
      // Extract VIN from text (usually format: "VIN: XXXXXXXXXXXXXXXXX")
      const vinMatch = vinText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
      return vinMatch ? vinMatch[0] : vinText.substring(0, 17);
    } catch {
      return 'UNKNOWN';
    }
  }
  
  private async getWindowStickerContent(): Promise<string> {
    try {
      // Try primary selector first
      let content = await scrapeInlineContent(
        this.page!, 
        vAutoSelectors.vehicleDetails.stickerContentContainer,
        { timeout: 5000, waitForText: true }
      );
      
      if (!content || content === '[IFRAME: Cross-origin content]') {
        // Try alternative selectors
        this.logger.debug('Trying alternative window sticker selectors');
        
        content = await scrapeInlineContent(
          this.page!,
          vAutoSelectors.vehicleDetails.stickerContentAlt1,
          { timeout: 5000, waitForText: true }
        );
        
        if (!content) {
          // Check if there's an iframe we need to handle differently
          const iframeElement = await this.page!.$(vAutoSelectors.vehicleDetails.stickerContentAlt2);
          if (iframeElement) {
            // Switch to iframe context
            const frame = await iframeElement.contentFrame();
            if (frame) {
              content = await frame.evaluate(() => document.body.innerText);
            }
          }
        }
      }
      
      return content || '';
    } catch (error) {
      this.logger.error('Failed to get window sticker content', error);
      return '';
    }
  }
  
  private async updateFeatureCheckboxes(foundFeatures: string[]): Promise<string[]> {
    const updatedFeatures: string[] = [];
    const allCheckboxLabels = new Set<string>();
    
    // First, get all checkbox labels on the page
    try {
      const labels = await this.page!.$$eval('label', (elements) => 
        elements.map(el => el.textContent?.trim() || '').filter(text => text.length > 0)
      );
      labels.forEach(label => allCheckboxLabels.add(label));
    } catch (error) {
      this.logger.warn('Could not enumerate all checkbox labels', error);
    }
    
    // Process each found feature
    for (const feature of foundFeatures) {
      const possibleLabels = getCheckboxLabels(feature);
      
      for (const label of possibleLabels) {
        // Try exact match first
        if (allCheckboxLabels.has(label)) {
          const updated = await this.updateSingleCheckbox(label, true);
          if (updated) {
            updatedFeatures.push(label);
            break; // Move to next feature
          }
        }
      }
    }
    
    // Also uncheck features that weren't found (optional - depends on requirements)
    // This part would need more sophisticated logic to avoid unchecking everything
    
    return updatedFeatures;
  }
  
  private async updateSingleCheckbox(label: string, shouldBeChecked: boolean): Promise<boolean> {
    try {
      // Try primary selector
      let selector = vAutoSelectors.vehicleDetails.checkboxByLabel(label);
      let success = await setCheckbox(this.page!, selector, shouldBeChecked);
      
      if (!success) {
        // Try alternative selector
        selector = vAutoSelectors.vehicleDetails.checkboxByLabelAlt(label);
        success = await setCheckbox(this.page!, selector, shouldBeChecked);
      }
      
      if (success) {
        this.logger.debug(`Updated checkbox "${label}" to ${shouldBeChecked}`);
      }
      
      return success;
    } catch (error) {
      this.logger.warn(`Failed to update checkbox "${label}"`, error);
      return false;
    }
  }
  
  private async hasNextPage(): Promise<boolean> {
    try {
      // Check if next button exists and is not disabled
      const nextButton = await this.page!.$(vAutoSelectors.inventory.nextPageButton);
      if (!nextButton) return false;
      
      const isDisabled = await this.page!.$(vAutoSelectors.inventory.nextPageDisabled) !== null;
      return !isDisabled;
    } catch {
      return false;
    }
  }
  
  async generateReport(): Promise<string> {
    const result = this.currentRunResult;
    const duration = (result.endTime.getTime() - result.startTime.getTime()) / 1000; // seconds
    
    const report = `
vAuto Automation Report
======================
Run Date: ${result.startTime.toLocaleString()}
Duration: ${duration.toFixed(1)} seconds

Summary
-------
Total Vehicles Processed: ${result.totalVehicles}
Successful: ${result.successfulVehicles}
Failed: ${result.failedVehicles}
Success Rate: ${result.totalVehicles > 0 ? ((result.successfulVehicles / result.totalVehicles) * 100).toFixed(1) : 0}%

Vehicle Details
--------------
${result.vehicles.map(v => `
VIN: ${v.vin}
Status: ${v.processed ? 'SUCCESS' : 'FAILED'}
Features Found: ${v.featuresFound.length}
Features Updated: ${v.featuresUpdated.length}
Processing Time: ${(v.processingTime / 1000).toFixed(1)}s
${v.errors.length > 0 ? `Errors: ${v.errors.join(', ')}` : ''}
`).join('\n')}

${result.errors.length > 0 ? `
General Errors
--------------
${result.errors.map(e => `- ${e}`).join('\n')}
` : ''}

Generated by vAuto Automation Agent
`;
    
    return report;
  }
  
  async sendReport(recipients: string[]): Promise<void> {
    if (!this.mailgunService) {
      this.logger.warn('Mailgun service not configured - cannot send report');
      return;
    }
    
    const report = await this.generateReport();
    
    await this.mailgunService.sendNotificationEmail(
      'vAuto Automation Report',
      report,
      recipients,
      this.currentRunResult.failedVehicles > 0
    );
  }
}
