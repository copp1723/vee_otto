/**
 * Simple test script for anomaly detection
 */

import { IntelligentAnomalyDetector, VehicleAnomalyData } from './core/services/IntelligentAnomalyDetector';
import { Logger } from './core/utils/Logger';

const logger = new Logger('AnomalyTest');

async function testAnomalyDetection() {
  console.log('🧪 Testing Intelligent Anomaly Detection...\n');

  // Initialize detector with relaxed thresholds
  const detector = new IntelligentAnomalyDetector({
    pricingThreshold: 0.5, // 50% threshold - very relaxed
    mileageThreshold: 0.6,
    bookValueVarianceThreshold: 0.3,
    featureCountThreshold: 2,
    enableSMSAlerts: false,
    logger
  });

  // Test 1: Normal vehicle (should have no anomalies)
  console.log('Test 1: Normal Vehicle');
  const normalVehicle: VehicleAnomalyData = {
    vin: 'NORMAL123456789',
    year: 2020,
    make: 'Toyota',
    model: 'Camry',
    price: 25000,
    mileage: 30000,
    features: ['Bluetooth', 'Backup Camera', 'Heated Seats', 'Navigation', 'Sunroof']
  };

  const normalReport = await detector.analyzeVehicle(normalVehicle);
  console.log(`  Anomalies: ${normalReport.totalAnomalies}`);
  console.log(`  Risk Level: ${normalReport.overallRisk}`);
  if (normalReport.anomalies.length > 0) {
    normalReport.anomalies.forEach(a => console.log(`    - ${a.type}: ${a.message}`));
  }
  console.log('');

  // Test 2: Overpriced vehicle (should detect pricing anomaly)
  console.log('Test 2: Overpriced Vehicle');
  const overpricedVehicle: VehicleAnomalyData = {
    vin: 'OVERPRICED12345',
    year: 2020,
    make: 'Toyota',
    model: 'Camry',
    price: 80000, // Extremely overpriced
    mileage: 30000,
    features: ['Bluetooth', 'Backup Camera', 'Heated Seats']
  };

  const overpricedReport = await detector.analyzeVehicle(overpricedVehicle);
  console.log(`  Anomalies: ${overpricedReport.totalAnomalies}`);
  console.log(`  Risk Level: ${overpricedReport.overallRisk}`);
  console.log(`  Estimated Loss: $${overpricedReport.estimatedLoss || 0}`);
  overpricedReport.anomalies.forEach(a => console.log(`    - ${a.type}: ${a.message} (${a.severity})`));
  console.log('');

  // Test 3: Low feature vehicle (should detect feature anomaly)
  console.log('Test 3: Low Feature Vehicle');
  const lowFeatureVehicle: VehicleAnomalyData = {
    vin: 'LOWFEATURE12345',
    year: 2020,
    make: 'Toyota',
    model: 'Camry',
    price: 25000,
    mileage: 30000,
    features: [] // No features
  };

  const lowFeatureReport = await detector.analyzeVehicle(lowFeatureVehicle);
  console.log(`  Anomalies: ${lowFeatureReport.totalAnomalies}`);
  console.log(`  Risk Level: ${lowFeatureReport.overallRisk}`);
  lowFeatureReport.anomalies.forEach(a => console.log(`    - ${a.type}: ${a.message} (${a.severity})`));
  console.log('');

  // Test 4: High mileage vehicle (should detect mileage anomaly)
  console.log('Test 4: High Mileage Vehicle');
  const highMileageVehicle: VehicleAnomalyData = {
    vin: 'HIGHMILEAGE1234',
    year: 2023, // Very new car
    make: 'Toyota',
    model: 'Camry',
    price: 25000,
    mileage: 200000, // Extremely high mileage for new car
    features: ['Bluetooth', 'Backup Camera', 'Heated Seats']
  };

  const highMileageReport = await detector.analyzeVehicle(highMileageVehicle);
  console.log(`  Anomalies: ${highMileageReport.totalAnomalies}`);
  console.log(`  Risk Level: ${highMileageReport.overallRisk}`);
  highMileageReport.anomalies.forEach(a => console.log(`    - ${a.type}: ${a.message} (${a.severity})`));
  console.log('');

  // Summary
  console.log('📊 Test Summary:');
  console.log(`  Normal Vehicle Anomalies: ${normalReport.totalAnomalies} (should be 0)`);
  console.log(`  Overpriced Vehicle Anomalies: ${overpricedReport.totalAnomalies} (should be >0)`);
  console.log(`  Low Feature Vehicle Anomalies: ${lowFeatureReport.totalAnomalies} (should be >0)`);
  console.log(`  High Mileage Vehicle Anomalies: ${highMileageReport.totalAnomalies} (should be >0)`);

  const stats = detector.getStats();
  console.log(`\n📈 Detector Stats:`);
  console.log(`  Total Analyzed: ${stats.totalAnalyzed}`);
  console.log(`  Model Trained: ${stats.modelTrained}`);

  // Success criteria
  const detectionRate = [overpricedReport, lowFeatureReport, highMileageReport]
    .filter(r => r.totalAnomalies > 0).length / 3 * 100;
  
  console.log(`\n✅ Detection Rate: ${detectionRate}% (should be >95%)`);
  console.log(`✅ False Positive Rate: ${normalReport.totalAnomalies > 0 ? 100 : 0}% (should be <5%)`);

  if (detectionRate >= 95 && normalReport.totalAnomalies === 0) {
    console.log('\n🎉 All tests passed! Anomaly detection is working correctly.');
    return true;
  } else {
    console.log('\n❌ Some tests failed. Anomaly detection needs adjustment.');
    return false;
  }
}

// Run the test
if (require.main === module) {
  testAnomalyDetection().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
  });
}

export { testAnomalyDetection };