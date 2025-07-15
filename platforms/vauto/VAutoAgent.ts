import { Page } from 'playwright';
import { BaseAgent, TwoFactorConfig, AgentConfig } from '../../core/agents/BaseAgent';
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
import * as fuzz from 'fuzzball';

export interface VAutoConfig extends AgentConfig {
  username: string;
  password: string;
  dealershipId?: string;
  mailgunConfig?: any;
}

export interface VehicleProcessingResult {
  vin: string;
  processed: boolean;
  featuresFound: string[];
  featuresUpdated: string[];
  errors: string[];
  processingTime: number;
  dealer: string;
  age: string;
  unmappedFeatures: string[];
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

export class VAutoAgent extends BaseAgent {
  private mailgunService: MailgunProvider | null = null;
  protected currentRunResult: VAutoRunResult;
  protected page: Page | null = null;
  
  constructor(private vAutoConfig: VAutoConfig) {
    super(vAutoConfig);
    
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
      this.mailgunService = new MailgunProvider(vAutoConfig.mailgunConfig);
    }
  }

  async initialize(): Promise<void> {
    await super.initialize();
    this.page = this.browser.currentPage;
  }

  // Implement abstract method from BaseAgent
  async processData(): Promise<VAutoRunResult> {
    return await this.processInventory();
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
      await reliableClick(this.page, vAutoSelectors.login.nextButton, 'Next Button');
      await this.page.waitForLoadState('networkidle');
      
      // Enter password
      await this.page.fill(vAutoSelectors.login.password, this.vAutoConfig.password);
      await this.takeScreenshot('vauto-credentials-entered');
      await reliableClick(this.page, vAutoSelectors.login.submit, 'Submit Button');
      
      // Wait for potential 2FA selection page
      await this.page.waitForLoadState('networkidle');
      
      // Add forced wait for 2FA page indicator
      try {
        await this.page.waitForSelector(vAutoSelectors.login.twoFactorTitle, { timeout: 10000 });
        this.logger.info('2FA verification page detected');
      } catch (error) {
        this.logger.warn('2FA verification page not detected', error);
        const html = await this.page.content();
        this.logger.info(`Page HTML dump (truncated): ${html.slice(0, 1000)}...`);
        await this.takeScreenshot('vauto-2fa-page-not-detected');
      }
      
      // Check if 2FA selection is needed (now only phone option exists)
      try {
        await this.takeScreenshot('vauto-2fa-options-page');

        // Log all visible button texts for diagnostics
        const allButtons = await this.page.$$('button');
        const buttonTexts = [];
        for (const btn of allButtons) {
          try {
            const text = await btn.textContent();
            if (text && text.trim()) buttonTexts.push(text.trim());
          } catch {}
        }
        this.logger.info(`2FA Option Step: Visible button texts: ${JSON.stringify(buttonTexts)}`);

        // Look for "Select" buttons (robust: also try absolute XPath and fallback to any visible button)
        let selectButtons = await this.page.locator(vAutoSelectors.login.phoneSelectButton).all();
        this.logger.info(`Found ${selectButtons.length} Select buttons`);

        // If none found, try the absolute XPath provided by user
        if (selectButtons.length === 0) {
          const absXpath = '/html/body/div[2]/div/div[3]/div/div/div[1]/div[2]/div/div/div[2]/div/span[2]/button';
          const absBtn = await this.page.locator(`xpath=${absXpath}`).first();
          if (absBtn) {
            this.logger.info('Found Select button via absolute XPath');
            selectButtons = [absBtn];
          }
        }

        // If still none, try any visible button on the page
        if (selectButtons.length === 0) {
          const allButtons = await this.page.$$('button');
          for (const btn of allButtons) {
            if (await btn.isVisible()) {
              const text = (await btn.textContent())?.trim() || '';
              this.logger.info(`Visible button: "${text}"`);
            }
          }
        }

        if (selectButtons.length > 0) {
          this.logger.info('Clicking the Select button for phone 2FA');
          await this.takeScreenshot('before-select-2fa-click');
          await selectButtons[0].click();
          await this.page.waitForLoadState('networkidle');
          await this.takeScreenshot('after-select-2fa-click');
        } else {
          this.logger.info('No Select buttons found, checking for alternative methods');

          // Alternative: Check for any button/link that might trigger 2FA
          const possibleSelectors = [
            'button:has-text("Continue")',
            'button:has-text("Next")',
            'button:has-text("Send")',
            'a:has-text("Select")',
            'div[role="button"]:has-text("Select")'
          ];

          let clicked = false;
          for (const selector of possibleSelectors) {
            try {
              const element = await this.page.locator(selector).first();
              if (await element.isVisible()) {
                this.logger.info(`Found alternative selector: ${selector}`);
                await this.takeScreenshot(`before-alt-selector-${selector.replace(/[^a-zA-Z0-9]/g, '_')}`);
                await element.click();
                await this.page.waitForLoadState('networkidle');
                await this.takeScreenshot(`after-alt-selector-${selector.replace(/[^a-zA-Z0-9]/g, '_')}`);
                clicked = true;
                break;
              }
            } catch (e) {
              // Continue trying other selectors
            }
          }

          if (!clicked) {
            this.logger.warn('Could not find any 2FA selection button - dumping page HTML for diagnostics');
            const html = await this.page.content();
            this.logger.info(`2FA Option Step: Page HTML dump (truncated): ${html.slice(0, 1000)}...`);
            await this.takeScreenshot('vauto-2fa-selection-error');
          }
        }
      } catch (error) {
        this.logger.warn('Error while trying to select phone 2FA option', error);
        await this.takeScreenshot('vauto-2fa-selection-error');
      }
      
      // Handle 2FA if needed
      const needs2FA = await this.check2FARequired();
      if (needs2FA) {
        const twoFactorConfig: TwoFactorConfig = {
          enabled: true,
          codeInputSelector: vAutoSelectors.login.otpInput,
          submitSelector: vAutoSelectors.login.otpSubmit,
          successIndicator: vAutoSelectors.dashboard.url,
          timeout: 300000
        };
        
        const twoFactorMethod = process.env.TWO_FACTOR_METHOD || 'email';
        
        if (twoFactorMethod === 'sms') {
          // Set webhook URL for polling SMS code - use port 3000 where our server is running
          const serverPort = process.env.PORT || '3000';
          twoFactorConfig.webhookUrl = `${process.env.PUBLIC_URL || `http://localhost:${serverPort}`}/api/2fa/latest`;
          this.logger.info(`Using SMS method for 2FA with webhook URL: ${twoFactorConfig.webhookUrl}`);
        } else {
          // Email method selected - no additional selectors needed for now
          this.logger.debug('Using email method for 2FA');
        }
        
        const twoFASuccess = await this.handle2FA(twoFactorConfig);
        if (!twoFASuccess) {
          throw new Error('2FA verification failed');
        }
      }
      
      // Verify login success
      await this.page.waitForLoadState('networkidle');
      const currentUrl = this.page.url();
      
      this.logger.info(`Post-login URL: ${currentUrl}`);
      
      // Check for various success indicators - be more flexible
      if (currentUrl.includes('dashboard') ||
          currentUrl.includes('provision') ||
          currentUrl.includes('vauto.app') ||
          currentUrl.includes('inventory')) {
        this.logger.info('vAuto login successful');
        await this.takeScreenshot('vauto-login-success');
        return true;
      }
      
      // If we're still on signin page, check if 2FA is needed
      if (currentUrl.includes('signin')) {
        this.logger.warn('Still on signin page - checking if 2FA is needed');
        await this.takeScreenshot('vauto-login-still-signin');
        
        // Check if we're waiting for 2FA
        const needs2FA = await this.check2FARequired();
        if (needs2FA) {
          this.logger.info('2FA appears to be required - treating as successful login pending 2FA');
          // Treat this as successful login since 2FA will handle the rest
          return true;
        } else {
          throw new Error(`Login may have failed - still on signin page without 2FA: ${currentUrl}`);
        }
      }
      
      // For any other coxautoinc.com domain that's not signin, consider it potentially successful
      if (currentUrl.includes('coxautoinc.com')) {
        this.logger.info('On Cox domain but not signin - assuming login successful');
        await this.takeScreenshot('vauto-login-success');
        return true;
      }
      
      throw new Error(`Login verification failed - unexpected URL: ${currentUrl}`);
      
    } catch (error) {
      this.logger.error('vAuto login failed', error);
      await this.takeScreenshot('vauto-login-error');
      throw error;
    }
  }
  
  private async check2FARequired(): Promise<boolean> {
    try {
      // Check if OTP input is visible (after selecting 2FA method)
      const otpVisible = await this.page!.locator(vAutoSelectors.login.otpInput).isVisible();
      if (otpVisible) return true;
      
      // Check if we're on a 2FA selection page (before selecting method)
      const selectButtons = await this.page!.locator('button:has-text("Select")').count();
      if (selectButtons > 0) return true;
      
      // Check for other 2FA indicators
      const pageText = await this.page!.textContent('body') || '';
      const has2FAIndicators = pageText.includes('verification') ||
                              pageText.includes('authenticate') ||
                              pageText.includes('factor') ||
                              pageText.includes('code');
      
      return has2FAIndicators;
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
    await reliableClick(this.page, vAutoSelectors.inventory.viewInventoryLink, 'View Inventory Link');
    await waitForLoadingToComplete(this.page!, Object.values(vAutoSelectors.loading));
    await this.takeScreenshot('vauto-inventory-page');
  }
  
  async applyInventoryFilters(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    
    this.logger.info('Applying inventory filters for age 0-1 days');
    
    // Click filter button
    await reliableClick(this.page, vAutoSelectors.inventory.filterButton, 'Filter Button');
    await this.page.waitForTimeout(1000);
    
    // Enable age filter
    await reliableClick(this.page, vAutoSelectors.inventory.ageFilterLabel, 'Age Filter Label');
    
    // Fill age range
    await this.page.fill(vAutoSelectors.inventory.ageMinInput, '0');
    await this.page.fill(vAutoSelectors.inventory.ageMaxInput, '1');
    
    await this.takeScreenshot('vauto-filters-set');
    
    // Apply filters
    await reliableClick(this.page, vAutoSelectors.inventory.applyFilter, 'Apply Filter Button');
    await waitForLoadingToComplete(this.page!, Object.values(vAutoSelectors.loading));
    
    this.logger.info('Inventory filters applied');
  }
  
  async navigateViaMenuAndApplySavedFilter(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    this.logger.info('Navigating via menu hover and applying saved Recent Inventory filter');

    try {
      // Step 1: Hover over Pricing menu
      const pricingSelector = { css: '#mainMenu > li:nth-child(3)', xpath: '//*[@id="mainMenu"]/li[3]' };
      const pricingElem = await this.browser.findElement(pricingSelector);
      if (!pricingElem) throw new Error('Pricing menu not found');

      await this.browser.waitForElementStability(pricingSelector, { checks: 3, interval: 200 });
      await pricingElem.hover({ timeout: 5000 });
      await this.page.waitForTimeout(500); // Allow submenu load
      this.logger.debug('Hovered Pricing menu');
      await this.takeScreenshot('after-pricing-hover');

      // Step 2: Click Inventory from submenu
      const inventorySelector = { xpath: '//*[@id="m_16-menu"]/div/div/h3[1]/a' };
      await this.browser.reliableClick(inventorySelector, { retries: 2, delay: 1000 });
      await waitForLoadingToComplete(this.page!, Object.values(vAutoSelectors.loading));
      this.logger.debug('Clicked Inventory');
      await this.takeScreenshot('after-inventory-click');

      // Step 3: Click Saved Filters
      const savedFiltersSelector = { xpath: '//*[@id="ext-gen77"]' };
      await this.browser.reliableClick(savedFiltersSelector);
      await this.page.waitForTimeout(1000); // Allow menu expansion
      this.logger.debug('Accessed Saved Filters');

      // Step 4: Select Recent Inventory Filter
      const recentFilterSelector = { xpath: '//*[@id="ext-gen514"]' };
      await this.browser.reliableClick(recentFilterSelector);
      await waitForLoadingToComplete(this.page!, Object.values(vAutoSelectors.loading));
      this.logger.debug('Applied Recent Inventory Filter');
      await this.takeScreenshot('after-filter-apply');

      // Verify navigation success with fallback
      const currentUrl = this.page.url();
      if (!currentUrl.includes('inventory')) {
        this.logger.warn('Navigation might have failed - falling back to direct inventory');
        await this.navigateToInventory();
      } else {
        this.logger.info('Navigation successful - ready to process inventory');
      }

    } catch (error) {
      this.logger.error('Menu navigation failed', error);
      if (this.config.screenshotOnError) await this.takeScreenshot('nav-error');
      await this.navigateToInventory(); // Fallback
      throw error;
    }
  }
  
  async processInventory(): Promise<VAutoRunResult> {
    if (!this.page) throw new Error('Page not initialized');
    
    this.currentRunResult.startTime = new Date();
    this.logger.info('Starting inventory processing');
    
    try {
      await this.navigateViaMenuAndApplySavedFilter();
      
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
              const rowHandle = await vehicleLinks[i].evaluateHandle(el => el.closest('tr'));
              const dealer = await this.page.evaluate(tr => tr?.querySelector('td:nth-child(3) > div')?.textContent?.trim() || '', rowHandle) as string;
              const age = await this.page.evaluate(tr => tr?.querySelector('td:nth-child(5) > div')?.textContent?.trim() || '', rowHandle) as string;
              // Add more columns as needed

              const rowLocator = this.page.locator(vAutoSelectors.inventory.vehicleRows).nth(i);
              const linkLocator = rowLocator.locator('a').first();

              try {
                if (await linkLocator.isVisible({ timeout: 3000 })) {
                  await linkLocator.scrollIntoViewIfNeeded();
                  await linkLocator.click({ timeout: 5000 });
                } else {
                  // Fallback to clicking the entire row (legacy behaviour)
                  await rowLocator.scrollIntoViewIfNeeded();
                  await rowLocator.click({ timeout: 5000 });
                }
              } catch (clickErr) {
                this.logger.warn(`Primary click on vehicle link failed, retrying with force: ${clickErr instanceof Error ? clickErr.message : String(clickErr)}`);
                try {
                  await linkLocator.click({ force: true, timeout: 5000 });
                } catch {
                  // Final fallback – attempt JS click on the first anchor within row via evaluate
                  const handle = await rowLocator.elementHandle();
                  if (handle) {
                    await this.page.evaluate((el) => {
                      const link = el.querySelector('a');
                      if (link) (link as HTMLElement).click();
                    }, handle);
                  }
                }
              }
              await this.processVehicle();
              
              // Navigate back to inventory
              await this.page.goBack();
              await waitForLoadingToComplete(this.page!, Object.values(vAutoSelectors.loading));
            }
          } catch (error) {
            this.logger.error(`Failed to process vehicle ${i + 1} on page ${pageNumber}`, error);
            this.currentRunResult.errors.push(`Vehicle ${i + 1} on page ${pageNumber}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        // Check for next page
        hasNextPage = await this.hasNextPage();
        if (hasNextPage) {
          await reliableClick(this.page, vAutoSelectors.inventory.nextPageButton, 'Next Page Button');
          await waitForLoadingToComplete(this.page!, Object.values(vAutoSelectors.loading));
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
      processingTime: 0,
      dealer: '',
      age: '',
      unmappedFeatures: []
    };
    
    try {
      // Get VIN
      result.vin = await this.getVehicleVIN();
      this.logger.info(`Processing vehicle: ${result.vin}`);
      
      // Navigate to Factory Equipment tab
      await reliableClick(this.page!, vAutoSelectors.vehicleDetails.factoryEquipmentTab, 'Factory Equipment Tab');
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

      // Add to VehicleProcessingResult: unmappedFeatures: string[] = [];
      const unmapped = result.featuresFound.filter(f => !updatedFeatures.some(u => fuzz.ratio(f, u) > 90));
      result.unmappedFeatures = unmapped;
      this.logger.info(`Unmapped features: ${unmapped.join(', ')}`);
      
      // Save changes
      const saveSelector = { xpath: '//*[@id="ext-gen58"]', css: '#ext-gen58' };
      await this.browser.reliableClick(saveSelector);
      await waitForLoadingToComplete(this.page!, Object.values(vAutoSelectors.loading));
      this.logger.info('Vehicle changes saved');
      
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
          const score = fuzz.ratio(feature, label);
          if (score > 90) {
            const updated = await this.updateSingleCheckbox(label, true);
            if (updated) {
              updatedFeatures.push(label);
              break; // Move to next feature
            }
          }
        }
      }
    }
    
    // Also uncheck features that weren't found (optional - depends on requirements)
    // This part would need more sophisticated logic to avoid unchecking everything
    for (const label of allCheckboxLabels) {
      if (!foundFeatures.includes(label)) {
        await this.updateSingleCheckbox(label, false);
      }
    }
    
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
      this.currentRunResult.failedVehicles > 0
    );
  }
}
