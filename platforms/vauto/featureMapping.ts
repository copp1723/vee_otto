// @ts-ignore - fuzzball doesn't have types
import * as fuzz from 'fuzzball';

// Comprehensive feature mapping between window sticker text and vAuto checkboxes
export const featureMap: Record<string, string[]> = {
  // Safety Features
  'Airbags': ['Front Airbags', 'Side Airbags', 'Curtain Airbags', 'Airbag'],
  'ABS': ['Anti-lock Braking System', 'ABS', 'Anti-lock Brakes'],
  'Traction Control': ['Traction Control', 'TCS', 'Traction Control System'],
  'Stability Control': ['Electronic Stability Control', 'ESC', 'Vehicle Stability Control', 'VSC'],
  'Blind Spot Monitoring': ['Blind Spot Monitor', 'BSM', 'Blind Spot Detection'],
  'Lane Departure Warning': ['Lane Departure Alert', 'LDW', 'Lane Departure Warning'],
  'Forward Collision Warning': ['Pre-Collision System', 'FCW', 'Collision Warning'],
  'Backup Camera': ['Rear View Camera', 'Backup Camera', 'Rearview Camera'],
  
  // Comfort & Convenience
  'Adjustable Pedals': ['Adjustable Pedals', 'Power Adjustable Pedals'],
  'Auto-Dimming Rearview Mirror': ['Auto-Dimming Mirror', 'Electrochromic Mirror', 'Auto Dimming Rearview Mirror'],
  'Power Steering': ['Power Steering', 'Electric Power Steering', 'EPS'],
  'Cruise Control': ['Cruise Control', 'Speed Control'],
  'Adaptive Cruise Control': ['Adaptive Cruise', 'Dynamic Radar Cruise', 'ACC'],
  'Keyless Entry': ['Keyless Entry', 'Remote Keyless Entry', 'RKE'],
  'Push Button Start': ['Push Button Start', 'Engine Start Button', 'Push Start'],
  'Remote Start': ['Remote Engine Start', 'Remote Start', 'Remote Starter'],
  
  // Seating & Interior
  'Leather Seats': ['Leather', 'Leather Trimmed', 'Leather Appointed'],
  'Heated Seats': ['Heated Seats', 'Seat Heater', 'Heated Front Seats'],
  'Cooled Seats': ['Ventilated Seats', 'Cooled Seats', 'Air Conditioned Seats'],
  'Power Seats': ['Power Driver Seat', 'Power Adjustable Seats', '8-way Power'],
  'Memory Seats': ['Memory Seat', 'Driver Memory', 'Seat Memory'],
  'Third Row Seating': ['3rd Row', 'Third Row', '7-Passenger', '8-Passenger'],
  
  // Technology & Entertainment
  'Navigation System': ['Navigation', 'GPS Navigation', 'Nav System'],
  'Bluetooth': ['Bluetooth', 'Hands-Free', 'Wireless Phone Connectivity'],
  'Apple CarPlay': ['Apple CarPlay', 'CarPlay'],
  'Android Auto': ['Android Auto'],
  'Premium Audio': ['Premium Sound', 'Bose', 'Harman Kardon', 'JBL', 'Mark Levinson'],
  'Satellite Radio': ['SiriusXM', 'Satellite Radio', 'XM Radio'],
  'Wi-Fi Hotspot': ['Wi-Fi', 'Hotspot', '4G LTE'],
  
  // Exterior
  'Sunroof': ['Sunroof', 'Moonroof', 'Panoramic Roof'],
  'Roof Rails': ['Roof Rails', 'Roof Rack', 'Cross Bars'],
  'Tow Package': ['Towing Package', 'Trailer Hitch', 'Tow Prep'],
  'Running Boards': ['Running Boards', 'Side Steps', 'Nerf Bars'],
  'Bed Liner': ['Bedliner', 'Bed Liner', 'Spray-in Bedliner'],
  
  // Wheels & Tires
  'Alloy Wheels': ['Alloy Wheels', 'Aluminum Wheels', 'Alloy Rims'],
  'Chrome Wheels': ['Chrome Wheels', 'Chrome Rims'],
  'All-Season Tires': ['All-Season Tires', 'All Season'],
  'Performance Tires': ['Performance Tires', 'Summer Tires', 'Sport Tires'],
  
  // Powertrain
  '4WD': ['4WD', 'Four Wheel Drive', '4x4'],
  'AWD': ['AWD', 'All Wheel Drive', 'All-Wheel Drive'],
  'Turbo': ['Turbo', 'Turbocharged', 'Turbocharger'],
  'Supercharged': ['Supercharged', 'Supercharger'],
  'Hybrid': ['Hybrid', 'Hybrid System', 'Hybrid Synergy'],
  'Electric': ['Electric', 'EV', 'Electric Vehicle', 'Battery Electric'],
  
  // Lighting
  'LED Headlights': ['LED Headlights', 'LED Headlamps', 'LED Lighting'],
  'HID Headlights': ['HID', 'Xenon', 'High Intensity Discharge'],
  'Fog Lights': ['Fog Lights', 'Fog Lamps'],
  'Daytime Running Lights': ['DRL', 'Daytime Running Lights', 'Daytime Running Lamps']
};

// Fuzzy matching configuration
const FUZZY_MATCH_THRESHOLD = 85; // 85% similarity required

/**
 * Match a feature from window sticker text to a checkbox label
 * @param stickerText - The text found in the window sticker
 * @param checkboxLabel - The label of the checkbox in vAuto
 * @returns boolean indicating if they match
 */
export function matchFeature(stickerText: string, checkboxLabel: string): boolean {
  // First try exact match (case-insensitive)
  if (stickerText.toLowerCase() === checkboxLabel.toLowerCase()) {
    return true;
  }
  
  // Then try fuzzy matching
  const ratio = fuzz.ratio(stickerText.toLowerCase(), checkboxLabel.toLowerCase());
  return ratio >= FUZZY_MATCH_THRESHOLD;
}

/**
 * Find all matching features in window sticker text
 * @param stickerText - The complete window sticker text
 * @returns Array of matched feature names
 */
export function findFeaturesInStickerText(stickerText: string): string[] {
  const foundFeatures: string[] = [];
  const stickerLower = stickerText.toLowerCase();
  
  for (const [feature, variations] of Object.entries(featureMap)) {
    // Check if any variation of the feature exists in the sticker text
    const hasFeature = variations.some(variation => {
      const variationLower = variation.toLowerCase();
      
      // Try exact substring match first
      if (stickerLower.includes(variationLower)) {
        return true;
      }
      
      // Try fuzzy matching on smaller chunks (split by common delimiters)
      const stickerChunks = stickerText.split(/[,;\n•▪]/);
      return stickerChunks.some(chunk => {
        const ratio = fuzz.ratio(chunk.trim().toLowerCase(), variationLower);
        return ratio >= FUZZY_MATCH_THRESHOLD;
      });
    });
    
    if (hasFeature) {
      foundFeatures.push(feature);
    }
  }
  
  return foundFeatures;
}

/**
 * Get checkbox label variations for a feature
 * @param feature - The feature name
 * @returns Array of possible checkbox labels
 */
export function getCheckboxLabels(feature: string): string[] {
  return featureMap[feature] || [feature];
}

/**
 * Parse window sticker text and extract structured features
 * This is a more advanced parser that can handle different sticker formats
 */
export function parseWindowStickerText(stickerText: string): {
  features: string[];
  rawSections: { [key: string]: string };
} {
  const features = findFeaturesInStickerText(stickerText);
  
  // Try to extract sections (many window stickers have sections like "STANDARD EQUIPMENT", "OPTIONS", etc.)
  const rawSections: { [key: string]: string } = {};
  const sectionRegex = /^([A-Z\s]+):?\s*$/gm;
  const lines = stickerText.split('\n');
  
  let currentSection = 'GENERAL';
  let sectionContent: string[] = [];
  
  for (const line of lines) {
    const sectionMatch = line.match(sectionRegex);
    if (sectionMatch) {
      if (sectionContent.length > 0) {
        rawSections[currentSection] = sectionContent.join('\n');
      }
      currentSection = sectionMatch[1].trim();
      sectionContent = [];
    } else if (line.trim()) {
      sectionContent.push(line);
    }
  }
  
  if (sectionContent.length > 0) {
    rawSections[currentSection] = sectionContent.join('\n');
  }
  
  return { features, rawSections };
}
