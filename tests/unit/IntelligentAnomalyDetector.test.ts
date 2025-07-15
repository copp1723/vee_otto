/**
 * Unit tests for IntelligentAnomalyDetector
 * Tests anomaly detection with synthetic data injection
 */

import { IntelligentAnomalyDetector, VehicleAnomalyData } from '../../core/services/IntelligentAnomalyDetector';
import { Logger } from '../../core/utils/Logger';

// Simple test runner
class TestRunner {
  private tests: Array<{ name: string; fn: () => Promise<void> | void }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => Promise<void> | void) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('Running IntelligentAnomalyDetector tests...\n');
    
    for (const test of this.tests) {
      try {
        await test.fn();
        console.log(`✓ ${test.name}`);
        this.passed++;
      } catch (error) {
        console.error(`✗ ${test.name}`);
        console.error(`  ${error instanceof Error ? error.message : String(error)}`);
        this.failed++;
      }
    }

    console.log(`\nResults: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }

  assert(condition: any, message = 'Assertion failed') {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertEqual(actual: any, expected: any, message?: string) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  assertGreaterThan(actual: number, expected: number, message?: string) {
    if (actual <= expected) {
      throw new Error(message || `Expected ${actual} to be greater than ${expected}`);
    }
  }
}

// Mock logger
const mockLogger = new Logger('AnomalyDetectorTest');

// Helper to create test vehicle data
function createTestVehicle(overrides: Partial<VehicleAnomalyData> = {}): VehicleAnomalyData {
  return {
    vin: 'TEST123456789ABCD',
    year: 2020,
    make: 'Toyota',
    model: 'Camry',
    price: 25000,
    mileage: 30000,
    features: ['Bluetooth', 'Backup Camera', 'Heated Seats', 'Navigation System', 'Sunroof'],
    bookValues: {
      jdPower: 24800,  // Closer values to avoid variance anomaly
      blackBook: 25100,
      kbb: 24900
    },
    ...overrides
  };
}

async function runTests() {
  const runner = new TestRunner();
  let detector: IntelligentAnomalyDetector;

  // Initialize detector
  detector = new IntelligentAnomalyDetector({
    pricingThreshold: 0.25,
    mileageThreshold: 0.3,
    bookValueVarianceThreshold: 0.15,
    featureCountThreshold: 5,
    enableSMSAlerts: false,
    logger: mockLogger
  });

  runner.test('should initialize successfully', () => {
    runner.assert(detector instanceof IntelligentAnomalyDetector);
    const stats = detector.getStats();
    runner.assertEqual(stats.totalAnalyzed, 0);
    runner.assert(stats.modelTrained);
  });

  runner.test('should detect no anomalies in normal vehicle', async () => {
    const normalVehicle = createTestVehicle();
    const report = await detector.analyzeVehicle(normalVehicle);
    
    runner.assertEqual(report.totalAnomalies, 0);
    runner.assertEqual(report.overallRisk, 'LOW');
    runner.assert(report.estimatedLoss === undefined || report.estimatedLoss === 0);
  });

  runner.test('should detect pricing anomaly - overpriced vehicle', async () => {
    const overpricedVehicle = createTestVehicle({
      price: 50000, // Significantly overpriced for a 2020 Camry with 30k miles
      vin: 'OVERPRICED123456'
    });
    
    const report = await detector.analyzeVehicle(overpricedVehicle);
    
    runner.assertGreaterThan(report.totalAnomalies, 0, 'Should detect pricing anomaly');
    const pricingAnomaly = report.anomalies.find(a => a.type === 'PRICING');
    runner.assert(pricingAnomaly, 'Should have pricing anomaly');
    runner.assert(['HIGH', 'CRITICAL'].includes(pricingAnomaly!.severity), 'Should be high severity');
    runner.assertGreaterThan(report.estimatedLoss || 0, 10000, 'Should estimate significant loss');
  });

  runner.test('should detect pricing anomaly - underpriced vehicle', async () => {
    const underpricedVehicle = createTestVehicle({
      price: 8000, // Significantly underpriced
      vin: 'UNDERPRICED12345'
    });
    
    const report = await detector.analyzeVehicle(underpricedVehicle);
    
    runner.assertGreaterThan(report.totalAnomalies, 0, 'Should detect pricing anomaly');
    const pricingAnomaly = report.anomalies.find(a => a.type === 'PRICING');
    runner.assert(pricingAnomaly, 'Should have pricing anomaly');
    runner.assert(pricingAnomaly!.message.includes('lower'), 'Should indicate underpricing');
  });

  runner.test('should detect feature anomaly - too few features', async () => {
    const lowFeatureVehicle = createTestVehicle({
      features: ['Radio'], // Only 1 feature, well below threshold
      vin: 'LOWFEATURES12345'
    });
    
    const report = await detector.analyzeVehicle(lowFeatureVehicle);
    
    runner.assertGreaterThan(report.totalAnomalies, 0, 'Should detect feature anomaly');
    const featureAnomaly = report.anomalies.find(a => a.type === 'FEATURE');
    runner.assert(featureAnomaly, 'Should have feature anomaly');
    runner.assertEqual(featureAnomaly!.severity, 'HIGH');
    runner.assertGreaterThan(report.estimatedLoss || 0, 1000, 'Should estimate feature loss');
  });

  runner.test('should detect mileage anomaly - high mileage', async () => {
    const highMileageVehicle = createTestVehicle({
      year: 2022, // Recent year
      mileage: 150000, // Extremely high mileage for a 2-year-old car
      vin: 'HIGHMILEAGE12345'
    });
    
    const report = await detector.analyzeVehicle(highMileageVehicle);
    
    runner.assertGreaterThan(report.totalAnomalies, 0, 'Should detect mileage anomaly');
    const mileageAnomaly = report.anomalies.find(a => a.type === 'MILEAGE');
    runner.assert(mileageAnomaly, 'Should have mileage anomaly');
    runner.assert(mileageAnomaly!.message.includes('high'), 'Should indicate high mileage');
  });

  runner.test('should detect book value variance anomaly', async () => {
    const inconsistentBookValues = createTestVehicle({
      bookValues: {
        jdPower: 20000,
        blackBook: 30000, // 50% higher than JD Power
        kbb: 25000
      },
      vin: 'BOOKVARIANCE1234'
    });
    
    const report = await detector.analyzeVehicle(inconsistentBookValues);
    
    runner.assertGreaterThan(report.totalAnomalies, 0, 'Should detect book value anomaly');
    const bookValueAnomaly = report.anomalies.find(a => a.type === 'BOOK_VALUE');
    runner.assert(bookValueAnomaly, 'Should have book value anomaly');
    runner.assertEqual(bookValueAnomaly!.severity, 'MEDIUM');
  });

  runner.test('should calculate overall risk correctly', async () => {
    const criticalVehicle = createTestVehicle({
      price: 60000, // Extreme overpricing
      features: [], // No features
      mileage: 200000, // Extreme mileage
      vin: 'CRITICAL12345678'
    });
    
    const report = await detector.analyzeVehicle(criticalVehicle);
    
    runner.assertGreaterThan(report.totalAnomalies, 2, 'Should detect multiple anomalies');
    runner.assert(['HIGH', 'CRITICAL'].includes(report.overallRisk), 'Should be high/critical risk');
    runner.assertGreaterThan(report.estimatedLoss || 0, 15000, 'Should estimate high loss');
  });

  runner.test('should handle missing data gracefully', async () => {
    const incompleteVehicle: VehicleAnomalyData = {
      vin: 'INCOMPLETE123456',
      // Missing most fields
    };
    
    const report = await detector.analyzeVehicle(incompleteVehicle);
    
    // Should not crash and should return a valid report
    runner.assert(report.vin === 'INCOMPLETE123456');
    runner.assert(typeof report.totalAnomalies === 'number');
    runner.assert(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(report.overallRisk));
  });

  runner.test('should update configuration', () => {
    detector.updateConfig({
      pricingThreshold: 0.5,
      enableSMSAlerts: true
    });
    
    // Configuration should be updated (we can't directly test private config,
    // but we can test that the method doesn't throw)
    runner.assert(true, 'Configuration update should not throw');
  });

  runner.test('should track statistics', async () => {
    const testVehicle = createTestVehicle({ vin: 'STATS123456789' });
    await detector.analyzeVehicle(testVehicle);
    
    const stats = detector.getStats();
    runner.assertGreaterThan(stats.totalAnalyzed, 0, 'Should track analyzed vehicles');
    runner.assert(stats.modelTrained, 'Model should be trained');
  });

  runner.test('should achieve >95% detection rate on injected anomalies', async () => {
    const testCases = [
      createTestVehicle({ price: 80000, vin: 'INJECT001' }), // Overpriced
      createTestVehicle({ price: 5000, vin: 'INJECT002' }), // Underpriced
      createTestVehicle({ features: [], vin: 'INJECT003' }), // No features
      createTestVehicle({ mileage: 300000, year: 2023, vin: 'INJECT004' }), // High mileage
      createTestVehicle({ 
        bookValues: { jdPower: 15000, blackBook: 35000, kbb: 25000 }, 
        vin: 'INJECT005' 
      }), // Book value variance
    ];
    
    let detectedAnomalies = 0;
    
    for (const testCase of testCases) {
      const report = await detector.analyzeVehicle(testCase);
      if (report.totalAnomalies > 0) {
        detectedAnomalies++;
      }
    }
    
    const detectionRate = (detectedAnomalies / testCases.length) * 100;
    runner.assertGreaterThan(detectionRate, 95, `Detection rate should be >95%, got ${detectionRate}%`);
  });

  runner.test('should have <5% false positives on normal vehicles', async () => {
    const normalVehicles = [
      createTestVehicle({ vin: 'NORMAL001', price: 24000, mileage: 25000, bookValues: { jdPower: 23900, blackBook: 24100, kbb: 24000 } }),
      createTestVehicle({ vin: 'NORMAL002', price: 26000, mileage: 35000, bookValues: { jdPower: 25900, blackBook: 26100, kbb: 26000 } }),
      createTestVehicle({ vin: 'NORMAL003', price: 25500, mileage: 28000, bookValues: { jdPower: 25400, blackBook: 25600, kbb: 25500 } }),
      createTestVehicle({ vin: 'NORMAL004', price: 24500, mileage: 32000, bookValues: { jdPower: 24400, blackBook: 24600, kbb: 24500 } }),
      createTestVehicle({ vin: 'NORMAL005', price: 25200, mileage: 30500, bookValues: { jdPower: 25100, blackBook: 25300, kbb: 25200 } }),
    ];
    
    let falsePositives = 0;
    
    for (const vehicle of normalVehicles) {
      const report = await detector.analyzeVehicle(vehicle);
      if (report.totalAnomalies > 0) {
        falsePositives++;
      }
    }
    
    const falsePositiveRate = (falsePositives / normalVehicles.length) * 100;
    runner.assert(falsePositiveRate <= 5, `False positive rate should be ≤5%, got ${falsePositiveRate}%`);
  });

  return await runner.run();
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runTests };