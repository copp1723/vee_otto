import { Page } from 'playwright';
import { vAutoSelectors } from '../../platforms/vauto/vautoSelectors';
import { TIMEOUTS } from '../config/constants';

export interface VehicleData {
  vin: string;
  year?: string;
  make?: string;
  model?: string;
  stockNumber?: string;
  isValid: boolean;
  validationErrors: string[];
}

export interface ValidationResult {
  success: boolean;
  vehicleData: VehicleData;
  error?: string;
}

/**
 * Service for extracting and validating vehicle data from vAuto pages
 */
export class VehicleValidationService {
  private page: Page;
  private logger: any;

  constructor(page: Page, logger: any) {
    this.page = page;
    this.logger = logger;
  }

  /**
   * Extract vehicle data from the current page
   */
  async extractVehicleData(): Promise<ValidationResult> {
    try {
      const vin = await this.extractVIN();
      const yearMakeModel = await this.extractYearMakeModel();
      const stockNumber = await this.extractStockNumber();

      const vehicleData: VehicleData = {
        vin,
        ...yearMakeModel,
        stockNumber,
        isValid: true,
        validationErrors: []
      };

      // Validate the extracted data
      this.validateVehicleData(vehicleData);

      this.logger.info(`🚗 Extracted vehicle data: VIN=${vin}, ${yearMakeModel.year} ${yearMakeModel.make} ${yearMakeModel.model}`);

      return {
        success: true,
        vehicleData
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to extract vehicle data:', message);
      
      return {
        success: false,
        vehicleData: {
          vin: 'UNKNOWN',
          isValid: false,
          validationErrors: ['Failed to extract vehicle data']
        },
        error: message
      };
    }
  }

  /**
   * Extract VIN from the page
   */
  private async extractVIN(): Promise<string> {
    try {
      // Try multiple selectors for VIN extraction
      const vinSelectors = [
        vAutoSelectors.vehicleDetails.vinField,
        '//div[contains(@class, "vin")]',
        '//span[contains(@class, "vin")]',
        '//td[contains(@class, "vin")]',
        '//*[contains(text(), "VIN:")]/following-sibling::*[1]',
        '//*[contains(text(), "VIN#:")]/following-sibling::*[1]'
      ];

      for (const selector of vinSelectors) {
        try {
          const vinElement = await this.page.locator(selector).first();
          if (await vinElement.isVisible({ timeout: 1000 })) {
            let vinText = await vinElement.textContent() || '';
            
            // Clean up VIN text
            vinText = vinText.replace(/VIN[:#]?\s*/i, '').trim();
            
            // Validate VIN format (17 characters, alphanumeric)
            if (this.isValidVIN(vinText)) {
              this.logger.info(`✅ Found valid VIN: ${vinText}`);
              return vinText;
            }
          }
        } catch {
          // Try next selector
        }
      }

      // If no VIN found in specific elements, try to find it in the page text
      const pageText = await this.page.textContent('body') || '';
      const vinMatch = pageText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
      
      if (vinMatch && this.isValidVIN(vinMatch[0])) {
        this.logger.info(`✅ Found VIN in page text: ${vinMatch[0]}`);
        return vinMatch[0];
      }

      this.logger.warn('❌ No valid VIN found on page');
      return 'UNKNOWN';
    } catch (error) {
      this.logger.error('Error extracting VIN:', error);
      return 'UNKNOWN';
    }
  }

  /**
   * Extract Year, Make, and Model from the page
   */
  private async extractYearMakeModel(): Promise<{ year?: string; make?: string; model?: string }> {
    try {
      // Try to find year/make/model in common locations
      const selectors = [
        '//div[contains(@class, "year-make-model")]',
        '//span[contains(@class, "vehicle-info")]',
        '//h1[contains(@class, "vehicle")]',
        '//h2[contains(@class, "vehicle")]',
        '//*[contains(@class, "vehicle-title")]'
      ];

      for (const selector of selectors) {
        try {
          const element = await this.page.locator(selector).first();
          if (await element.isVisible({ timeout: 1000 })) {
            const text = await element.textContent() || '';
            const parsed = this.parseYearMakeModel(text);
            if (parsed.year || parsed.make || parsed.model) {
              return parsed;
            }
          }
        } catch {
          // Try next selector
        }
      }

      // Try to extract from title or page content
      const title = await this.page.title();
      const titleParsed = this.parseYearMakeModel(title);
      if (titleParsed.year || titleParsed.make || titleParsed.model) {
        return titleParsed;
      }

      return {};
    } catch (error) {
      this.logger.error('Error extracting year/make/model:', error);
      return {};
    }
  }

  /**
   * Extract stock number from the page
   */
  private async extractStockNumber(): Promise<string | undefined> {
    try {
      const stockSelectors = [
        '//*[contains(text(), "Stock:")]/following-sibling::*[1]',
        '//*[contains(text(), "Stock#:")]/following-sibling::*[1]',
        '//*[contains(text(), "Stock Number:")]/following-sibling::*[1]',
        '//div[contains(@class, "stock")]',
        '//span[contains(@class, "stock")]'
      ];

      for (const selector of stockSelectors) {
        try {
          const element = await this.page.locator(selector).first();
          if (await element.isVisible({ timeout: 1000 })) {
            let stockText = await element.textContent() || '';
            stockText = stockText.replace(/Stock[:#]?\s*/i, '').trim();
            if (stockText) {
              return stockText;
            }
          }
        } catch {
          // Try next selector
        }
      }

      return undefined;
    } catch (error) {
      this.logger.error('Error extracting stock number:', error);
      return undefined;
    }
  }

  /**
   * Validate VIN format
   */
  private isValidVIN(vin: string): boolean {
    // VIN should be 17 characters, alphanumeric, excluding I, O, Q
    const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/;
    return vinRegex.test(vin);
  }

  /**
   * Parse year, make, and model from text
   */
  private parseYearMakeModel(text: string): { year?: string; make?: string; model?: string } {
    const result: { year?: string; make?: string; model?: string } = {};

    // Clean up text
    text = text.trim();

    // Try to find a 4-digit year (1990-2099)
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      result.year = yearMatch[0];
    }

    // Common makes to look for
    const makes = [
      'Acura', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler',
      'Dodge', 'Ford', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jeep', 'Kia',
      'Lexus', 'Lincoln', 'Mazda', 'Mercedes-Benz', 'Mitsubishi', 'Nissan',
      'Ram', 'Subaru', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo'
    ];

    for (const make of makes) {
      if (text.toLowerCase().includes(make.toLowerCase())) {
        result.make = make;
        break;
      }
    }

    // If we have year and make, try to extract model
    if (result.year && result.make) {
      const pattern = new RegExp(`${result.year}\\s+${result.make}\\s+([\\w\\s-]+)`, 'i');
      const modelMatch = text.match(pattern);
      if (modelMatch && modelMatch[1]) {
        result.model = modelMatch[1].trim().split(/\s+/).slice(0, 3).join(' '); // Take first 3 words
      }
    }

    return result;
  }

  /**
   * Validate extracted vehicle data
   */
  private validateVehicleData(data: VehicleData): void {
    const errors: string[] = [];

    // Check VIN
    if (data.vin === 'UNKNOWN' || !this.isValidVIN(data.vin)) {
      errors.push('Invalid or missing VIN');
      data.isValid = false;
    }

    // Check year
    if (data.year) {
      const year = parseInt(data.year);
      const currentYear = new Date().getFullYear();
      if (year < 1990 || year > currentYear + 1) {
        errors.push(`Invalid year: ${data.year}`);
        data.isValid = false;
      }
    }

    // Check make
    if (!data.make) {
      errors.push('Missing vehicle make');
    }

    data.validationErrors = errors;
  }

  /**
   * Check if a link is likely a vehicle detail link (not VIN or stock number)
   */
  async isVehicleDetailLink(link: any): Promise<boolean> {
    try {
      const href = await link.getAttribute('href') || '';
      const text = await link.textContent() || '';
      const onclick = await link.getAttribute('onclick') || '';

      // Skip if it's a VIN link
      if (text.match(/^[A-HJ-NPR-Z0-9]{17}$/)) {
        return false;
      }

      // Skip if it's likely a stock number
      if (text.match(/^[A-Z0-9]{2,10}$/) && !text.includes(' ')) {
        return false;
      }

      // Good signs it's a vehicle detail link
      if (onclick.includes('Open') || onclick.includes('View') || onclick.includes('Show')) {
        return true;
      }

      // If it has year/make/model format
      if (text.match(/\b(19|20)\d{2}\b/)) {
        return true;
      }

      // If text is long enough and contains spaces (likely description)
      if (text.length > 5 && text.includes(' ')) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }
}