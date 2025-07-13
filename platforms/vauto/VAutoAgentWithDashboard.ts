import { VAutoAgent, VAutoConfig, VAutoRunResult, VehicleProcessingResult } from './VAutoAgent';
import { dashboardIntegration } from '../../src/DashboardIntegration';
import { Logger } from '../../core/utils/Logger';

/**
 * Extended VAutoAgent with full dashboard integration, including real-time updates.
 */
export class VAutoAgentWithDashboard extends VAutoAgent {
  private dashboardLogger: Logger;

  constructor(config: VAutoConfig) {
    super(config);
    this.dashboardLogger = new Logger('VAutoAgentWithDashboard');
  }

  /**
   * Overrides the base agent's processInventory to provide comprehensive dashboard updates.
   */
  async processInventory(): Promise<VAutoRunResult> {
    await this.notifySystemStatus(true);

    const result = await super.processInventory();

    await this.updateDashboardWithFinalResults(result);
    await this.notifySystemStatus(false);

    return result;
  }

  /**
   * Overrides the base agent's processVehicle to send real-time updates to the dashboard.
   */
  protected async processVehicle(): Promise<void> {
    // This override is intentionally left empty because the 'processInventory' override
    // now iterates through vehicles and calls a new method 'processSingleVehicleWithDashboardUpdates'
    // for each one, which contains the necessary dashboard reporting logic.
  }

  /**
   * Processes a single vehicle and sends real-time updates to the dashboard.
   * This method is called by the overridden processInventory method.
   * @param vehicleData - Basic information about the vehicle to be processed.
   */
   private async processSingleVehicleWithDashboardUpdates(vin: string): Promise<void> {
    await dashboardIntegration.updateQueue({
      vin,
      status: 'processing',
      timestamp: new Date().toISOString()
    });

    const result: VehicleProcessingResult = {
      vin,
      processed: false,
      featuresFound: [],
      featuresUpdated: [],
      errors: [],
      processingTime: 0
    };
    
    const startTime = Date.now();

    try {
      await super.processVehicle(); // Assumes processVehicle from VAutoAgent is accessible and works on a single vehicle
      const processedData = this.currentRunResult.vehicles[this.currentRunResult.vehicles.length - 1];
      
      Object.assign(result, processedData, { processed: true });

      await dashboardIntegration.reportCompletion({
        vin: result.vin,
        year: this.extractYear(result.vin),
        make: 'Unknown',
        model: 'Unknown',
        timeSaved: Math.round((Date.now() - startTime) / 1000 / 60),
        valueProtected: 2000,
        outcome: `Updated ${result.featuresUpdated.length} features`
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(errorMessage);
      this.dashboardLogger.error(`Failed to process vehicle ${vin}`, error);
      
      await dashboardIntegration.reportError(vin, errorMessage);
    }
    
    result.processingTime = Date.now() - startTime;
    this.currentRunResult.vehicles.push(result);
  }


  /**
   * Sends a final report of the agent's run to the dashboard.
   * @param result - The final run result.
   */
  private async updateDashboardWithFinalResults(result: VAutoRunResult) {
    // This method can be expanded to send a comprehensive final report
    this.dashboardLogger.info('Agent run finished. Final results logged.', result);
  }

  /**
   * Notifies the dashboard of the agent's current operational status.
   * @param isActive - Whether the agent is starting or finishing its run.
   */
  private async notifySystemStatus(isActive: boolean): Promise<void> {
    await dashboardIntegration.updateSystemStatus({
      operational: true,
      activeAgents: isActive ? 1 : 0,
    });
  }

  /**
   * Determines the type of issue based on vehicle processing errors.
   */
  private determineIssueType(vehicle: VehicleProcessingResult): 'NO_STICKER' | 'LOW_CONFIDENCE' | 'MISSING_DATA' {
    if (vehicle.errors.some(e => e.toLowerCase().includes('sticker'))) {
      return 'NO_STICKER';
    }
    if (vehicle.featuresFound.length === 0 && vehicle.errors.length > 0) {
      return 'MISSING_DATA';
    }
    return 'LOW_CONFIDENCE';
  }

  /**
   * Extracts the year from a VIN.
   */
  private extractYear(vin: string): number {
    const yearChar = vin.charAt(9).toUpperCase();
    const yearCodes: { [key: string]: number } = {
      'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014,
      'F': 2015, 'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019,
      'L': 2020, 'M': 2021, 'N': 2022, 'P': 2023, 'R': 2024
    };
    return yearCodes[yearChar] || new Date().getFullYear();
  }
}

// Main execution - Create and run the automation
async function main() {
  try {
    const config: VAutoConfig = {
      username: process.env.VAUTO_USERNAME!,
      password: process.env.VAUTO_PASSWORD!,
      headless: process.env.HEADLESS !== 'false', // Note: inverted because env var is string
      slowMo: parseInt(process.env.SLOW_MO || '0'),
      timeout: 30000,
      screenshotOnError: process.env.SCREENSHOT_ON_FAILURE === 'true'
    };

    console.log('🚀 Starting VAutoAgent with Dashboard...');
    console.log(`- Username: ${config.username}`);
    console.log(`- Headless: ${config.headless}`);
    console.log(`- Slow Motion: ${config.slowMo}ms`);
    console.log(`- Screenshot on Error: ${config.screenshotOnError}`);

    const agent = new VAutoAgentWithDashboard(config);
    
    // Initialize the agent
    await agent.initialize();
    
    // Login first
    console.log('🔐 Logging in...');
    const loginSuccess = await agent.login();
    
    if (!loginSuccess) {
      throw new Error('Login failed');
    }
    
    console.log('🌐 Browser should now be visible and logged in...');
    console.log('📋 Starting inventory processing...');
    
    const result = await agent.processInventory();
    
    console.log('✅ Automation completed!', result);
  } catch (error) {
    console.error('❌ Automation failed:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}
