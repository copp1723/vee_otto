#!/usr/bin/env node

import { Logger } from '../core/utils/Logger';
import { WindowStickerService } from '../core/services/WindowStickerService';
import { VAutoCheckboxMappingService } from '../core/services/VAutoCheckboxMappingService';
import { CheckboxState, CheckboxAction } from '../core/services/CheckboxMappingService';

const logger = new Logger('Test-Parsing-Logic');

// Extended CheckboxState for testing with category
interface ExtendedCheckboxState extends CheckboxState {
  category?: string;
}

// Mock window sticker content based on the requirements
const mockWindowStickerContent = `
WINDOW STICKER

Interior:
- Adjustable Pedals
- Auto-Dimming Rearview Mirror
- Leather Seats
- Power Driver Seat
- Heated Front Seats
- Color-keyed instrument panel bezel

Comfort & Convenience:
- Navigation System
- Bluetooth Connectivity
- Remote Start System
- Power Windows
- Power Door Locks
- Cruise Control

Mechanical:
- 6.7L I-6 Diesel Turbocharged
- Power Steering
- All-Wheel Drive
- Anti-Lock Brakes
- Stability Control

Safety:
- Front Airbags
- Side Airbags
- Backup Camera
- Blind Spot Monitoring

Engine:
- 6.7L Cummins Turbo Diesel
- Engine Block Heater
- Heavy Duty Transmission
`;

// Mock locator for testing
const mockLocator = {} as any;

// Mock checkboxes that would be found on the page
const mockCheckboxes: ExtendedCheckboxState[] = [
  // Convenience
  { id: 'cb-1', label: 'Adjustable Pedals', checked: false, category: 'Convenience', locator: mockLocator },
  { id: 'cb-2', label: 'Auto-Dimming Rearview Mirror', checked: true, category: 'Convenience', locator: mockLocator },
  { id: 'cb-3', label: 'Navigation System', checked: false, category: 'Convenience', locator: mockLocator },
  { id: 'cb-4', label: 'Remote Start', checked: false, category: 'Convenience', locator: mockLocator },
  { id: 'cb-5', label: 'Bluetooth', checked: false, category: 'Convenience', locator: mockLocator },
  { id: 'cb-6', label: 'Cruise Control', checked: true, category: 'Convenience', locator: mockLocator },
  
  // Safety
  { id: 'cb-7', label: 'Airbags', checked: true, category: 'Safety', locator: mockLocator },
  { id: 'cb-8', label: 'Anti-Lock Brakes', checked: false, category: 'Safety', locator: mockLocator },
  { id: 'cb-9', label: 'Backup Camera', checked: false, category: 'Safety', locator: mockLocator },
  { id: 'cb-10', label: 'Stability Control', checked: false, category: 'Safety', locator: mockLocator },
  { id: 'cb-11', label: 'Blind Spot Monitor', checked: false, category: 'Safety', locator: mockLocator },
  
  // Seats
  { id: 'cb-12', label: 'Leather Seats', checked: false, category: 'Seats', locator: mockLocator },
  { id: 'cb-13', label: 'Heated Seats', checked: false, category: 'Seats', locator: mockLocator },
  { id: 'cb-14', label: 'Power Seats', checked: true, category: 'Seats', locator: mockLocator },
  
  // Mechanical
  { id: 'cb-15', label: 'Power Steering', checked: false, category: 'Mechanical', locator: mockLocator },
  { id: 'cb-16', label: 'Turbocharged Engine', checked: false, category: 'Mechanical', locator: mockLocator },
  { id: 'cb-17', label: 'All-Wheel Drive', checked: false, category: 'Mechanical', locator: mockLocator },
  { id: 'cb-18', label: 'Diesel Engine', checked: false, category: 'Mechanical', locator: mockLocator },
  
  // Other features that might not match
  { id: 'cb-19', label: 'Sunroof', checked: false, category: 'Convenience', locator: mockLocator },
  { id: 'cb-20', label: 'DVD Player', checked: false, category: 'Entertainment', locator: mockLocator }
];

async function testParsingLogic() {
  logger.info('🧪 Testing Window Sticker Parsing and Checkbox Mapping Logic\n');
  
  // Test 1: Feature Extraction
  logger.info('📋 Test 1: Feature Extraction from Window Sticker');
  logger.info('Sample window sticker content:');
  logger.info(mockWindowStickerContent.substring(0, 200) + '...\n');
  
  // Create a mock page that returns our content
  const mockPage = {
    locator: () => ({
      first: () => ({
        isVisible: async () => true,
        textContent: async () => mockWindowStickerContent
      })
    }),
    textContent: async () => mockWindowStickerContent
  } as any;
  
  const stickerService = new WindowStickerService();
  const extractedData = await stickerService.extractFeatures(mockPage);
  
  logger.info('Extraction Results:');
  logger.info(`  Total Features: ${extractedData.features.length}`);
  logger.info(`  By Section:`);
  logger.info(`    - Interior: ${extractedData.sections.interior.length}`);
  logger.info(`    - Mechanical: ${extractedData.sections.mechanical.length}`);
  logger.info(`    - Comfort: ${extractedData.sections.comfort.length}`);
  logger.info(`    - Safety: ${extractedData.sections.safety.length}`);
  logger.info(`    - Other: ${extractedData.sections.other.length}`);
  
  logger.info('\nAll Extracted Features:');
  extractedData.features.forEach((feature, i) => {
    logger.info(`  ${i + 1}. ${feature}`);
  });
  
  // Test 2: Feature-to-Checkbox Mapping
  logger.info('\n📋 Test 2: Feature-to-Checkbox Mapping');
  logger.info(`Mock checkboxes available: ${mockCheckboxes.length}`);
  
  // Create mock mapping service
  const mockMappingService = new VAutoCheckboxMappingService(mockPage, logger);
  
  // Test the mapping logic
  const mappingActions = mockMappingService['mapFeaturesToCheckboxes'](
    extractedData.features,
    mockCheckboxes
  );
  
  logger.info(`\nMapping Results:`);
  logger.info(`  Total Actions: ${mappingActions.length}`);
  logger.info(`  Check Actions: ${mappingActions.filter(a => a.action === 'check').length}`);
  logger.info(`  Uncheck Actions: ${mappingActions.filter(a => a.action === 'uncheck').length}`);
  
  logger.info('\nDetailed Mapping Actions:');
  mappingActions.forEach((action, i) => {
    const checkbox = mockCheckboxes.find(cb => cb.id === action.id);
    logger.info(`  ${i + 1}. Feature → ${action.label}`);
    logger.info(`     Action: ${action.action}, Confidence: ${(action.confidence * 100).toFixed(1)}%`);
    logger.info(`     Current state: ${checkbox?.checked ? 'checked' : 'unchecked'}`);
  });
  
  // Test 3: Identify unmapped features
  logger.info('\n📋 Test 3: Unmapped Features Analysis');
  const mappedFeatureLabels = new Set(mappingActions.map(a => a.label));
  const unmappedFeatures = extractedData.features.filter(f => !Array.from(mappedFeatureLabels).some(label => label.toLowerCase().includes(f.toLowerCase()) || f.toLowerCase().includes(label.toLowerCase())));
  
  logger.info(`Unmapped Features (${unmappedFeatures.length}):`);
  unmappedFeatures.forEach(feature => {
    logger.info(`  - ${feature}`);
  });
  
  // Test 4: Checkbox state changes
  logger.info('\n📋 Test 4: Checkbox State Changes');
  const stateChanges = mappingActions.map(action => {
    const checkbox = mockCheckboxes.find(cb => cb.id === action.id);
    if (!checkbox) return null;
    
    const wouldChange = (action.action === 'check' && !checkbox.checked) || 
                       (action.action === 'uncheck' && checkbox.checked);
    
    return {
      label: checkbox.label,
      currentState: checkbox.checked,
      newState: action.action === 'check',
      wouldChange
    };
  }).filter(change => change !== null && change.wouldChange);
  
  logger.info(`Checkboxes that would change state (${stateChanges.length}):`);
  stateChanges.forEach(change => {
    if (change) {
      logger.info(`  - ${change.label}: ${change.currentState ? 'checked' : 'unchecked'} → ${change.newState ? 'checked' : 'unchecked'}`);
    }
  });
  
  // Summary
  logger.info('\n📊 Test Summary:');
  logger.info(`  ✅ Features Extracted: ${extractedData.features.length}`);
  logger.info(`  ✅ Checkboxes Mapped: ${mappingActions.length}`);
  logger.info(`  ✅ State Changes: ${stateChanges.length}`);
  logger.info(`  ⚠️ Unmapped Features: ${unmappedFeatures.length}`);
  
  // Recommendations
  if (unmappedFeatures.length > 0) {
    logger.info('\n💡 Recommendations:');
    logger.info('  - Add mappings for common unmapped features');
    logger.info('  - Consider fuzzy matching threshold adjustments');
    logger.info('  - Review checkbox labels for better matching');
  }
  
  logger.info('\n✅ Parsing logic test complete!');
}

// Run test
testParsingLogic().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});