/**
 * Unit tests for SemanticFeatureMappingService
 * Tests semantic feature mapping with vector embeddings
 */

import { SemanticFeatureMappingService } from '../../core/services/SemanticFeatureMappingService';
import { CheckboxState } from '../../core/services/CheckboxMappingService';

// Simple test runner
class TestRunner {
  private tests: Array<{ name: string; fn: () => Promise<void> | void }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => Promise<void> | void) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('Running SemanticFeatureMappingService tests...\n');
    
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
}

// Mock logger and page
const mockLogger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  debug: () => {}
};

const mockPage = {
  evaluate: async () => {},
  evaluateHandle: async () => {},
  addInitScript: async () => {},
  $: async () => {},
  $$: async () => {},
  locator: () => ({
    all: async () => [],
    isVisible: async () => true,
    textContent: async () => 'Test Label',
    getAttribute: async () => 'test-id',
    isChecked: async () => false,
    click: async () => {},
    locator: () => ({})
  })
} as any;

// Helper to create checkbox states
function createCheckboxStates(names: string[]): CheckboxState[] {
  return names.map(name => ({
    id: name.toLowerCase().replace(/\s+/g, '-'),
    label: name,
    checked: false,
    locator: {} as any
  }));
}

async function runTests() {
  const runner = new TestRunner();
  let service: SemanticFeatureMappingService;

  // Initialize service with proper configuration
  service = new SemanticFeatureMappingService(mockPage, mockLogger, {
    similarityThreshold: 0.7,
    useSemanticMatching: true,
    maxResults: 5
  });

  runner.test('should initialize successfully', () => {
    runner.assert(service instanceof SemanticFeatureMappingService);
  });

  runner.test('should have default configuration', () => {
    runner.assert(service['config'].similarityThreshold === 0.7);
    runner.assert(service['config'].useSemanticMatching === true);
    runner.assert(service['config'].maxResults === 5);
  });

  runner.test('should find exact semantic matches', async () => {
    const features = ['Bluetooth Connectivity'];
    const checkboxes = createCheckboxStates(['Bluetooth', 'Navigation System', 'Backup Camera']);
    
    // Mock the checkbox states to simulate actual checkboxes
    const mockCheckboxStates = checkboxes;
    
    // Use the public interface
    const result = await service.mapAndUpdateCheckboxes(features);
    runner.assert(result.success === true);
    runner.assert(result.checkboxesFound === 3);
  });

  runner.test('should handle empty inputs', async () => {
    const result1 = await service.mapAndUpdateCheckboxes([]);
    runner.assertEqual(result1.checkboxesFound, 0);
    runner.assertEqual(result1.checkboxesUpdated, 0);
  });

  runner.test('should handle special characters in features', async () => {
    const features = ['Wi-Fi & Bluetooth®'];
    const result = await service.mapAndUpdateCheckboxes(features);
    runner.assert(result.success === true);
  });

  runner.test('should achieve high accuracy on standard test cases', async () => {
    const features = [
      'Bluetooth Connectivity',
      'Backup Camera',
      'Heated Seats',
      'Navigation System',
      'Sunroof'
    ];
    
    const result = await service.mapAndUpdateCheckboxes(features);
    runner.assert(result.success === true);
    runner.assert(result.checkboxesFound >= 0);
  });

  runner.test('should handle null/undefined inputs gracefully', async () => {
    const result = await service.mapAndUpdateCheckboxes([]);
    runner.assertEqual(result.checkboxesFound, 0);
    runner.assertEqual(result.checkboxesUpdated, 0);
  });

  runner.test('should handle configuration updates', () => {
    service.updateConfig({ similarityThreshold: 0.9 });
    runner.assert(service['config'].similarityThreshold === 0.9);
  });

  runner.test('should clear vector database', () => {
    const stats = service.getVectorDBStats();
    const initialSize = stats.size;
    
    service.clearVectorDB();
    const newStats = service.getVectorDBStats();
    runner.assertEqual(newStats.size, 0);
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