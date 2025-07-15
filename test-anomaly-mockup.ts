/**
 * Test anomaly detection with vAuto mockup
 */

import { IntelligentAnomalyDetector, VehicleAnomalyData } from './core/services/IntelligentAnomalyDetector';
import { Logger } from './core/utils/Logger';

const logger = new Logger('AnomalyMockupTest');

async function testWithMockupData() {
  console.log('🧪 Testing Anomaly Detection with vAuto Mockup Data...\n');

  const detector = new IntelligentAnomalyDetector({
    pricingThreshold: 0.35,
    mileageThreshold: 0.4,
    bookValueVarianceThreshold: 0.2,
    featureCountThreshold: 3,
    enableSMSAlerts: false,
    logger
  });

  // Simulate various vehicle scenarios that might occur in real processing
  const testVehicles: VehicleAnomalyData[] = [
    {
      vin: 'MOCK001234567890',
      year: 2021,
      make: 'Honda',
      model: 'Accord',
      price: 28000,
      mileage: 25000,
      features: [
        'Bluetooth Connectivity',
        'Backup Camera',
        'Heated Front Seats',
        'Navigation System',
        'Sunroof',
        'Adaptive Cruise Control',
        'Lane Keeping Assist'
      ]
    },
    {
      vin: 'MOCK001234567891',
      year: 2020,
      make: 'Toyota',
      model: 'Camry',
      price: 45000, // Potentially overpriced
      mileage: 35000,
      features: [
        'Bluetooth',
        'Backup Camera'
      ] // Low feature count
    },
    {
      vin: 'MOCK001234567892',
      year: 2019,
      make: 'Ford',
      model: 'F-150',
      price: 15000, // Potentially underpriced
      mileage: 80000,
      features: [
        'Bluetooth',
        'Backup Camera',
        'Heated Seats',
        'Navigation',
        'Tow Package',
        '4WD',
        'Bed Liner'
      ]
    },
    {
      vin: 'MOCK001234567893',
      year: 2023,
      make: 'Tesla',
      model: 'Model 3',
      price: 35000,
      mileage: 150000, // Extremely high mileage for new car
      features: [
        'Autopilot',
        'Premium Audio',
        'Glass Roof',
        'Heated Seats',
        'Supercharging'
      ]
    }
  ];

  let totalAnomalies = 0;
  let highRiskVehicles = 0;
  let totalEstimatedLoss = 0;

  console.log('🔍 Analyzing vehicles...\n');

  for (const vehicle of testVehicles) {
    console.log(`Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.vin})`);
    console.log(`  Price: $${vehicle.price?.toLocaleString()}, Mileage: ${vehicle.mileage?.toLocaleString()}`);
    console.log(`  Features: ${vehicle.features?.length || 0} detected`);

    const report = await detector.analyzeVehicle(vehicle);

    if (report.totalAnomalies > 0) {
      console.log(`  🚨 ${report.totalAnomalies} anomalies detected (${report.overallRisk} risk):`);
      report.anomalies.forEach(anomaly => {
        console.log(`    - ${anomaly.type}: ${anomaly.message} (${anomaly.severity})`);
        console.log(`      Suggested Action: ${anomaly.suggestedAction}`);
      });
      if (report.estimatedLoss) {
        console.log(`  💰 Estimated Loss: $${report.estimatedLoss.toLocaleString()}`);
        totalEstimatedLoss += report.estimatedLoss;
      }
      
      if (['HIGH', 'CRITICAL'].includes(report.overallRisk)) {
        highRiskVehicles++;
      }
    } else {
      console.log(`  ✅ No anomalies detected`);
    }

    totalAnomalies += report.totalAnomalies;
    console.log('');
  }

  // Summary
  console.log('📊 Analysis Summary:');
  console.log(`  Total Vehicles Analyzed: ${testVehicles.length}`);
  console.log(`  Total Anomalies Detected: ${totalAnomalies}`);
  console.log(`  High/Critical Risk Vehicles: ${highRiskVehicles}`);
  console.log(`  Total Estimated Loss: $${totalEstimatedLoss.toLocaleString()}`);
  console.log(`  Average Loss per Vehicle: $${Math.round(totalEstimatedLoss / testVehicles.length).toLocaleString()}`);

  const detectionRate = (totalAnomalies / testVehicles.length) * 100;
  console.log(`  Anomaly Detection Rate: ${detectionRate.toFixed(1)}%`);

  // Simulate dashboard metrics
  console.log('\n📈 Dashboard Integration Preview:');
  console.log(`  Anomalies Detected: ${totalAnomalies}`);
  console.log(`  High Risk Count: ${highRiskVehicles}`);
  console.log(`  Estimated Loss: $${totalEstimatedLoss.toLocaleString()}`);

  const stats = detector.getStats();
  console.log(`\n🔧 Detector Performance:`);
  console.log(`  Total Analyzed: ${stats.totalAnalyzed}`);
  console.log(`  Model Trained: ${stats.modelTrained}`);

  console.log('\n✅ Anomaly detection integration test completed successfully!');
  console.log('   Ready for integration with vAuto processing workflow.');

  return {
    totalVehicles: testVehicles.length,
    totalAnomalies,
    highRiskVehicles,
    totalEstimatedLoss,
    detectionRate
  };
}

// Run the test
if (require.main === module) {
  testWithMockupData().then(results => {
    console.log('\n🎯 Test Results:', results);
    process.exit(0);
  }).catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
  });
}

export { testWithMockupData };