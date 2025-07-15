import { Logger } from '../utils/Logger';
import { SMS2FAService } from './SMS2FAService';

// Simple linear regression implementation
class SimpleLinearRegression {
  private slope: number = 0;
  private intercept: number = 0;

  constructor(x: number[], y: number[]) {
    if (x.length !== y.length || x.length === 0) {
      throw new Error('Invalid input data for regression');
    }

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    this.slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    this.intercept = (sumY - this.slope * sumX) / n;
  }

  predict(x: number): number {
    return this.slope * x + this.intercept;
  }
}

export interface VehicleAnomalyData {
  vin: string;
  year?: number;
  make?: string;
  model?: string;
  price?: number;
  mileage?: number;
  features?: string[];
  bookValues?: {
    jdPower?: number;
    blackBook?: number;
    kbb?: number;
  };
}

export interface AnomalyResult {
  isAnomaly: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: 'PRICING' | 'FEATURE' | 'MILEAGE' | 'BOOK_VALUE';
  message: string;
  suggestedAction: string;
  confidence: number;
  actualValue?: number;
  expectedValue?: number;
}

export interface AnomalyDetectionReport {
  vin: string;
  timestamp: string;
  anomalies: AnomalyResult[];
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  totalAnomalies: number;
  estimatedLoss?: number;
}

export interface AnomalyDetectorConfig {
  pricingThreshold: number;
  mileageThreshold: number;
  bookValueVarianceThreshold: number;
  featureCountThreshold: number;
  enableSMSAlerts: boolean;
  smsService?: SMS2FAService;
  logger?: Logger;
}

/**
 * Intelligent Anomaly Detection Service
 * Detects pricing, feature, and data anomalies in vehicle records
 */
export class IntelligentAnomalyDetector {
  private config: AnomalyDetectorConfig;
  private logger: Logger;
  private smsService?: SMS2FAService;
  private pricingModel?: SimpleLinearRegression;
  private historicalData: VehicleAnomalyData[] = [];

  constructor(config: Partial<AnomalyDetectorConfig> = {}) {
    this.config = {
      pricingThreshold: 0.35, // Increased from 0.25 to reduce false positives
      mileageThreshold: 0.4,  // Increased from 0.3
      bookValueVarianceThreshold: 0.2, // Increased from 0.15
      featureCountThreshold: 3, // Reduced from 5 to be less strict
      enableSMSAlerts: false,
      ...config
    };
    
    this.logger = config.logger || new Logger('AnomalyDetector');
    this.smsService = config.smsService;
    
    this.initializePricingModel();
  }

  /**
   * Analyze vehicle data for anomalies
   */
  async analyzeVehicle(vehicleData: VehicleAnomalyData): Promise<AnomalyDetectionReport> {
    const timestamp = new Date().toISOString();
    const anomalies: AnomalyResult[] = [];

    try {
      // Pricing anomaly detection
      const pricingAnomaly = this.detectPricingAnomaly(vehicleData);
      if (pricingAnomaly) anomalies.push(pricingAnomaly);

      // Feature anomaly detection
      const featureAnomaly = this.detectFeatureAnomaly(vehicleData);
      if (featureAnomaly) anomalies.push(featureAnomaly);

      // Mileage anomaly detection
      const mileageAnomaly = this.detectMileageAnomaly(vehicleData);
      if (mileageAnomaly) anomalies.push(mileageAnomaly);

      // Book value variance detection
      const bookValueAnomaly = this.detectBookValueAnomaly(vehicleData);
      if (bookValueAnomaly) anomalies.push(bookValueAnomaly);

      // Calculate overall risk and estimated loss
      const overallRisk = this.calculateOverallRisk(anomalies);
      const estimatedLoss = this.calculateEstimatedLoss(anomalies);

      const report: AnomalyDetectionReport = {
        vin: vehicleData.vin,
        timestamp,
        anomalies,
        overallRisk,
        totalAnomalies: anomalies.length,
        estimatedLoss
      };

      // Log and alert if necessary
      await this.processAnomalyReport(report);

      // Update historical data for model improvement
      this.updateHistoricalData(vehicleData);

      return report;

    } catch (error) {
      this.logger.error(`Error analyzing vehicle ${vehicleData.vin}:`, error);
      return {
        vin: vehicleData.vin,
        timestamp,
        anomalies: [],
        overallRisk: 'LOW',
        totalAnomalies: 0
      };
    }
  }

  /**
   * Detect pricing anomalies using regression model
   */
  private detectPricingAnomaly(vehicle: VehicleAnomalyData): AnomalyResult | null {
    if (!vehicle.price || !vehicle.year || !vehicle.mileage) return null;

    try {
      const expectedPrice = this.predictPrice(vehicle.year, vehicle.mileage);
      const variance = Math.abs(vehicle.price - expectedPrice) / expectedPrice;

      if (variance > this.config.pricingThreshold) {
        const severity = this.calculateSeverity(variance, [0.35, 0.6, 0.8]); // Adjusted thresholds
        
        return {
          isAnomaly: true,
          severity,
          type: 'PRICING',
          message: `Price ${vehicle.price > expectedPrice ? 'significantly higher' : 'significantly lower'} than expected`,
          suggestedAction: vehicle.price > expectedPrice 
            ? 'Review pricing strategy - potential overpricing'
            : 'Verify vehicle condition - potential underpricing',
          confidence: Math.min(variance * 100, 95),
          actualValue: vehicle.price,
          expectedValue: Math.round(expectedPrice)
        };
      }
    } catch (error) {
      this.logger.warn(`Error in pricing anomaly detection for ${vehicle.vin}:`, error);
    }

    return null;
  }

  /**
   * Detect feature-related anomalies
   */
  private detectFeatureAnomaly(vehicle: VehicleAnomalyData): AnomalyResult | null {
    if (!vehicle.features) return null;

    const featureCount = vehicle.features.length;
    const expectedFeatures = this.getExpectedFeatureCount(vehicle);

    if (featureCount < expectedFeatures * 0.5) {
      return {
        isAnomaly: true,
        severity: 'HIGH',
        type: 'FEATURE',
        message: `Unusually low feature count: ${featureCount} (expected ~${expectedFeatures})`,
        suggestedAction: 'Review feature extraction - potential missing features worth $500-2,200',
        confidence: 85,
        actualValue: featureCount,
        expectedValue: expectedFeatures
      };
    }

    return null;
  }

  /**
   * Detect mileage anomalies
   */
  private detectMileageAnomaly(vehicle: VehicleAnomalyData): AnomalyResult | null {
    if (!vehicle.mileage || !vehicle.year) return null;

    const currentYear = new Date().getFullYear();
    const vehicleAge = currentYear - vehicle.year;
    const expectedMileage = vehicleAge * 12000; // Average 12k miles/year
    const variance = Math.abs(vehicle.mileage - expectedMileage) / expectedMileage;

    if (variance > this.config.mileageThreshold) {
      const severity = this.calculateSeverity(variance, [0.4, 0.7, 1.2]); // Adjusted thresholds
      
      return {
        isAnomaly: true,
        severity,
        type: 'MILEAGE',
        message: `Mileage ${vehicle.mileage > expectedMileage ? 'unusually high' : 'unusually low'} for vehicle age`,
        suggestedAction: 'Verify mileage accuracy and adjust pricing accordingly',
        confidence: Math.min(variance * 80, 90),
        actualValue: vehicle.mileage,
        expectedValue: Math.round(expectedMileage)
      };
    }

    return null;
  }

  /**
   * Detect book value variance anomalies
   */
  private detectBookValueAnomaly(vehicle: VehicleAnomalyData): AnomalyResult | null {
    if (!vehicle.bookValues) return null;

    const values = Object.values(vehicle.bookValues).filter(v => v !== undefined) as number[];
    if (values.length < 2) return null;

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const maxVariance = Math.max(...values.map(v => Math.abs(v - avg) / avg));

    if (maxVariance > this.config.bookValueVarianceThreshold) {
      return {
        isAnomaly: true,
        severity: 'MEDIUM',
        type: 'BOOK_VALUE',
        message: `Significant variance between book values (${Math.round(maxVariance * 100)}%)`,
        suggestedAction: 'Review book value synchronization and pricing strategy',
        confidence: 75,
        actualValue: Math.round(maxVariance * 100),
        expectedValue: Math.round(this.config.bookValueVarianceThreshold * 100)
      };
    }

    return null;
  }

  /**
   * Initialize pricing prediction model
   */
  private initializePricingModel(): void {
    // More realistic baseline model with better sample data
    const sampleData = [
      { year: 2020, mileage: 30000, price: 25000 },
      { year: 2019, mileage: 45000, price: 22000 },
      { year: 2018, mileage: 60000, price: 19000 },
      { year: 2021, mileage: 15000, price: 28000 },
      { year: 2017, mileage: 75000, price: 16000 },
      { year: 2022, mileage: 10000, price: 30000 },
      { year: 2016, mileage: 90000, price: 14000 },
      { year: 2023, mileage: 5000, price: 32000 }
    ];

    // Create features (age and mileage) and targets (price)
    const currentYear = new Date().getFullYear();
    const features = sampleData.map(d => [currentYear - d.year, d.mileage / 1000]);
    const targets = sampleData.map(d => d.price);

    // Use a more balanced weighting for age vs mileage
    const combinedFeatures = features.map(f => f[0] * 1000 + f[1] * 50); // Age has more impact
    this.pricingModel = new SimpleLinearRegression(combinedFeatures, targets);
  }

  /**
   * Predict expected price based on year and mileage
   */
  private predictPrice(year: number, mileage: number): number {
    if (!this.pricingModel) return 25000; // More reasonable fallback

    const currentYear = new Date().getFullYear();
    const age = currentYear - year;
    const combinedFeature = age * 1000 + (mileage / 1000) * 50;
    
    const predicted = this.pricingModel.predict(combinedFeature);
    return Math.max(predicted, 8000); // Minimum $8k instead of $5k
  }

  /**
   * Get expected feature count based on vehicle characteristics
   */
  private getExpectedFeatureCount(vehicle: VehicleAnomalyData): number {
    let expected = this.config.featureCountThreshold;
    
    if (vehicle.year && vehicle.year > 2018) expected += 3; // Newer cars have more features
    if (vehicle.price && vehicle.price > 30000) expected += 5; // Luxury features
    
    return expected;
  }

  /**
   * Calculate severity based on variance and thresholds
   */
  private calculateSeverity(variance: number, thresholds: number[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (variance > thresholds[2]) return 'CRITICAL';
    if (variance > thresholds[1]) return 'HIGH';
    if (variance > thresholds[0]) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Calculate overall risk level
   */
  private calculateOverallRisk(anomalies: AnomalyResult[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (anomalies.some(a => a.severity === 'CRITICAL')) return 'CRITICAL';
    if (anomalies.some(a => a.severity === 'HIGH')) return 'HIGH';
    if (anomalies.some(a => a.severity === 'MEDIUM')) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Calculate estimated financial loss from anomalies
   */
  private calculateEstimatedLoss(anomalies: AnomalyResult[]): number {
    let loss = 0;
    
    for (const anomaly of anomalies) {
      switch (anomaly.type) {
        case 'PRICING':
          if (anomaly.actualValue && anomaly.expectedValue) {
            loss += Math.abs(anomaly.actualValue - anomaly.expectedValue);
          }
          break;
        case 'FEATURE':
          loss += 1350; // Average feature value loss ($500-2200)
          break;
        case 'MILEAGE':
          loss += 500; // Potential pricing adjustment needed
          break;
        case 'BOOK_VALUE':
          loss += 300; // Synchronization cost
          break;
      }
    }
    
    return Math.round(loss);
  }

  /**
   * Process anomaly report with logging and alerts
   */
  private async processAnomalyReport(report: AnomalyDetectionReport): Promise<void> {
    if (report.totalAnomalies === 0) {
      this.logger.info(`✅ No anomalies detected for vehicle ${report.vin}`);
      return;
    }

    const logLevel = report.overallRisk === 'CRITICAL' || report.overallRisk === 'HIGH' ? 'error' : 'warn';
    this.logger[logLevel](`🚨 ${report.totalAnomalies} anomalies detected for vehicle ${report.vin}:`, {
      overallRisk: report.overallRisk,
      estimatedLoss: report.estimatedLoss,
      anomalies: report.anomalies.map(a => ({
        type: a.type,
        severity: a.severity,
        message: a.message
      }))
    });

    // Send SMS alert for high-severity issues
    if (this.config.enableSMSAlerts && this.smsService && 
        (report.overallRisk === 'CRITICAL' || report.overallRisk === 'HIGH')) {
      await this.sendSMSAlert(report);
    }
  }

  /**
   * Send SMS alert for critical anomalies
   */
  private async sendSMSAlert(report: AnomalyDetectionReport): Promise<void> {
    try {
      const message = `🚨 VEHICLE ANOMALY ALERT\nVIN: ${report.vin}\nRisk: ${report.overallRisk}\nAnomalies: ${report.totalAnomalies}\nEst. Loss: $${report.estimatedLoss || 0}\nReview immediately.`;
      
      // Note: SMS2FAService is designed for receiving SMS, not sending
      // In a real implementation, you'd use Twilio client to send SMS
      this.logger.info(`SMS Alert would be sent: ${message}`);
    } catch (error) {
      this.logger.error('Failed to send SMS alert:', error);
    }
  }

  /**
   * Update historical data for model improvement
   */
  private updateHistoricalData(vehicle: VehicleAnomalyData): void {
    this.historicalData.push(vehicle);
    
    // Keep only last 1000 records to prevent memory issues
    if (this.historicalData.length > 1000) {
      this.historicalData = this.historicalData.slice(-1000);
    }
  }

  /**
   * Get detection statistics
   */
  getStats(): { totalAnalyzed: number; historicalDataSize: number; modelTrained: boolean } {
    return {
      totalAnalyzed: this.historicalData.length,
      historicalDataSize: this.historicalData.length,
      modelTrained: !!this.pricingModel
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AnomalyDetectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Anomaly detector configuration updated');
  }
}