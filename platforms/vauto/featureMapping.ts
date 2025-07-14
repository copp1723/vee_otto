// @ts-ignore - fuzzball doesn't have types
import * as fuzz from 'fuzzball';

// Comprehensive feature mapping between window sticker text and vAuto checkbox labels
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
  'Adaptive Cruise Control': ['Adaptive Cruise Control', 'ACC', 'Dynamic Cruise Control'],
  'Blind Spot Monitoring System': ['Blind Spot Monitor', 'BSM'],
  'Heated Front Seats': ['Heated Seats', 'Heated Front Seats'],
  'Heated Rear Seats': ['Heated Rear Seats'],
  'Ventilated Seats': ['Ventilated Seats', 'Cooled Seats', 'Air Conditioned Seats'],
  'Apple CarPlay Integration': ['Apple CarPlay/Android Auto', 'Apple CarPlay', 'CarPlay'],
  'Android Auto': ['Android Auto', 'Apple CarPlay/Android Auto'],
  'Backup Camera with Guidelines': ['Backup Camera', 'Rear View Camera'],
  'Sunroof/Moonroof Package': ['Sunroof/Moonroof', 'Sunroof', 'Moonroof', 'Panoramic Roof'],
  'Navigation System w/ Voice': ['Navigation', 'GPS Navigation', 'Nav System'],
  'Premium Audio Surround': ['Premium Audio', 'Surround Sound', 'Premium Sound System'],
  'Keyless Entry/Start': ['Keyless Entry', 'Push Button Start', 'Smart Key'],
  'Remote Start': ['Remote Start', 'Remote Engine Start'],
  
  // Engine/Performance
  'Turbocharged 2.0L Engine': ['Turbocharged', 'Turbo'],
  '6.7L I-6 Diesel Turbocharged': ['Turbocharged', 'Diesel Engine', 'Turbo Diesel'],
  'All Wheel Drive': ['AWD', 'All-Wheel Drive', '4WD', 'Four Wheel Drive'],
  'Four Wheel Drive': ['4WD', 'Four-Wheel Drive', '4x4'],
  
  // Interior Features
  'Leather Seats': ['Leather', 'Leather Trim', 'Leather Upholstery'],
  'Power Seats': ['Power Seats', 'Power Adjustable Seats', '8-Way Power Seats'],
  'Memory Seats': ['Memory Seats', 'Driver Memory', 'Memory Settings'],
  'Third Row Seats': ['Third Row', '3rd Row Seats', '7-Passenger', '8-Passenger'],
  
  // Exterior Features
  'Fog Lights': ['Fog Lights', 'Fog Lamps'],
  'LED Headlights': ['LED Headlights', 'LED Lights'],
  'Alloy Wheels': ['Alloy Wheels', 'Aluminum Wheels', 'Chrome Wheels'],
  'Running Boards': ['Running Boards', 'Side Steps'],
  'Tow Package': ['Towing Package', 'Trailer Hitch', 'Tow Hitch'],
  
  // Technology
  'Bluetooth': ['Bluetooth', 'Bluetooth Connectivity', 'Hands-Free'],
  'USB Ports': ['USB Ports', 'USB Charging', 'USB'],
  'Wireless Charging': ['Wireless Charging', 'Qi Charging'],
  'Head-Up Display': ['Head-Up Display', 'HUD'],
  'Parking Sensors': ['Parking Sensors', 'Park Assist', 'Parking Aid'],
  '360 Camera': ['360 Camera', 'Surround View Camera', 'Birds Eye View']
};

// Reverse mapping for checkbox label to feature names
export const checkboxToFeatureMap: Record<string, string[]> = {};

// Build reverse mapping
Object.entries(featureMap).forEach(([feature, checkboxLabels]) => {
  checkboxLabels.forEach(label => {
    if (!checkboxToFeatureMap[label]) {
      checkboxToFeatureMap[label] = [];
    }
    checkboxToFeatureMap[label].push(feature);
  });
});

/**
 * Parse window sticker text to extract features
 * @param stickerText Raw text from window sticker
 * @returns Object containing extracted features
 */
export function parseWindowStickerText(stickerText: string): { features: string[] } {
  if (!stickerText || stickerText.trim().length === 0) {
    return { features: [] };
  }

  // Common patterns for feature extraction
  const featurePatterns = [
    // Look for bullet points or dashes
    /[•\-*]\s*([^•\-*\n]+)/g,
    // Look for numbered lists
    /\d+\.\s*([^\n]+)/g,
    // Look for "Standard Equipment" or "Optional Equipment" sections
    /(?:Standard|Optional)\s+Equipment[:\s]*([^•\-*\n]+)/gi,
    // Look for features in parentheses
    /\(([^)]+)\)/g,
    // Look for features after colons
    /:\s*([^•\-*\n]+)/g
  ];

  const features = new Set<string>();
  
  // Extract features using patterns
  featurePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(stickerText)) !== null) {
      const feature = match[1]?.trim();
      if (feature && feature.length > 3 && feature.length < 100) {
        features.add(feature);
      }
    }
  });

  // Also look for known feature keywords
  const knownFeatures = Object.keys(featureMap);
  knownFeatures.forEach(feature => {
    if (stickerText.toLowerCase().includes(feature.toLowerCase())) {
      features.add(feature);
    }
  });

  return { features: Array.from(features) };
}

/**
 * Find features in sticker text using pattern matching
 * @param stickerText Raw text from window sticker
 * @returns Array of found features
 */
export function findFeaturesInStickerText(stickerText: string): string[] {
  const { features } = parseWindowStickerText(stickerText);
  return features;
}

/**
 * Get possible checkbox labels for a given feature
 * @param feature The feature name to find checkbox labels for
 * @returns Array of possible checkbox labels
 */
export function getCheckboxLabels(feature: string): string[] {
  // First check direct mapping
  const directMappings = featureMap[feature] || [];
  
  // Also check reverse mapping for any checkbox labels that might match
  const reverseMappings: string[] = [];
  Object.entries(checkboxToFeatureMap).forEach(([checkboxLabel, features]) => {
    if (features.includes(feature)) {
      reverseMappings.push(checkboxLabel);
    }
  });

  // Combine and deduplicate
  const allLabels = [...directMappings, ...reverseMappings];
  return [...new Set(allLabels)];
}

/**
 * Interface for feature matching result
 */
export interface FeatureMatch {
  windowStickerFeature: string;
  checkboxLabel: string;
  confidence: number;
  matched: boolean;
}

/**
 * Map window sticker features to checkbox labels using fuzzy matching
 * @param windowStickerFeatures Array of features extracted from window sticker
 * @param availableCheckboxes Array of available checkbox labels on the page
 * @param threshold Minimum similarity score (0-100) for a match
 * @returns Array of feature matches
 */
export function mapFeaturesToCheckboxes(
  windowStickerFeatures: string[],
  availableCheckboxes: string[],
  threshold: number = 90
): FeatureMatch[] {
  const matches: FeatureMatch[] = [];
  const unmatchedFeatures: string[] = [];

  for (const stickerFeature of windowStickerFeatures) {
    let bestMatch: FeatureMatch | null = null;
    let highestScore = 0;

    // First, try direct mapping
    const directMappings = featureMap[stickerFeature] || [];
    for (const mapping of directMappings) {
      const checkboxMatch = availableCheckboxes.find(cb => 
        cb.toLowerCase() === mapping.toLowerCase()
      );
      if (checkboxMatch) {
        bestMatch = {
          windowStickerFeature: stickerFeature,
          checkboxLabel: checkboxMatch,
          confidence: 100,
          matched: true
        };
        break;
      }
    }

    // If no direct match, use fuzzy matching
    if (!bestMatch) {
      for (const checkbox of availableCheckboxes) {
        // Try multiple fuzzy matching algorithms
        const scores = [
          fuzz.ratio(stickerFeature, checkbox),
          fuzz.partial_ratio(stickerFeature, checkbox),
          fuzz.token_set_ratio(stickerFeature, checkbox),
          fuzz.token_sort_ratio(stickerFeature, checkbox)
        ];
        
        const maxScore = Math.max(...scores);
        
        if (maxScore > highestScore && maxScore >= threshold) {
          highestScore = maxScore;
          bestMatch = {
            windowStickerFeature: stickerFeature,
            checkboxLabel: checkbox,
            confidence: maxScore,
            matched: true
          };
        }
      }
    }

    if (bestMatch) {
      matches.push(bestMatch);
    } else {
      unmatchedFeatures.push(stickerFeature);
      matches.push({
        windowStickerFeature: stickerFeature,
        checkboxLabel: '',
        confidence: 0,
        matched: false
      });
    }
  }

  // Log unmatched features for future mapping updates
  if (unmatchedFeatures.length > 0) {
    console.log('📝 Unmatched features for future mapping:', unmatchedFeatures);
  }

  return matches;
}

/**
 * Determine which checkboxes should be checked based on window sticker
 * @param windowStickerFeatures Features found in window sticker
 * @param checkboxStates Current state of all checkboxes { label: string, checked: boolean, id: string }[]
 * @returns Actions to take { id: string, label: string, shouldBeChecked: boolean, currentlyChecked: boolean }[]
 */
export function determineCheckboxActions(
  windowStickerFeatures: string[],
  checkboxStates: Array<{ label: string; checked: boolean; id: string }>
): Array<{ id: string; label: string; shouldBeChecked: boolean; currentlyChecked: boolean; action: 'check' | 'uncheck' | 'none' }> {
  const actions = [];
  const availableLabels = checkboxStates.map(cb => cb.label);
  const featureMatches = mapFeaturesToCheckboxes(windowStickerFeatures, availableLabels);
  
  // Create a set of matched checkbox labels for quick lookup
  const matchedCheckboxLabels = new Set(
    featureMatches
      .filter(m => m.matched)
      .map(m => m.checkboxLabel.toLowerCase())
  );

  // Go through each checkbox and determine action
  for (const checkbox of checkboxStates) {
    const labelLower = checkbox.label.toLowerCase();
    const isMatched = matchedCheckboxLabels.has(labelLower);
    
    let action: 'check' | 'uncheck' | 'none' = 'none';
    
    if (isMatched && !checkbox.checked) {
      action = 'check';
    } else if (!isMatched && checkbox.checked) {
      // Only uncheck if we have high confidence this should not be checked
      // (i.e., we have good coverage of window sticker features)
      if (windowStickerFeatures.length > 10) { // Arbitrary threshold for good coverage
        action = 'uncheck';
      }
    }
    
    actions.push({
      id: checkbox.id,
      label: checkbox.label,
      shouldBeChecked: isMatched,
      currentlyChecked: checkbox.checked,
      action
    });
  }
  
  return actions;
}

/**
 * Generate a summary report of feature updates
 */
export interface FeatureUpdateReport {
  vin: string;
  timestamp: Date;
  totalFeatures: number;
  matchedFeatures: number;
  unmatchedFeatures: number;
  checkboxesUpdated: number;
  checkboxesChecked: number;
  checkboxesUnchecked: number;
  errors: string[];
  details: {
    matched: FeatureMatch[];
    unmatched: string[];
    actions: Array<{ label: string; action: string }>;
  };
}

export function generateFeatureReport(
  vin: string,
  windowStickerFeatures: string[],
  featureMatches: FeatureMatch[],
  checkboxActions: Array<{ label: string; action: 'check' | 'uncheck' | 'none' }>,
  errors: string[] = []
): FeatureUpdateReport {
  const matched = featureMatches.filter(m => m.matched);
  const unmatched = featureMatches.filter(m => !m.matched).map(m => m.windowStickerFeature);
  const checked = checkboxActions.filter(a => a.action === 'check');
  const unchecked = checkboxActions.filter(a => a.action === 'uncheck');
  
  return {
    vin,
    timestamp: new Date(),
    totalFeatures: windowStickerFeatures.length,
    matchedFeatures: matched.length,
    unmatchedFeatures: unmatched.length,
    checkboxesUpdated: checked.length + unchecked.length,
    checkboxesChecked: checked.length,
    checkboxesUnchecked: unchecked.length,
    errors,
    details: {
      matched,
      unmatched,
      actions: checkboxActions
        .filter(a => a.action !== 'none')
        .map(a => ({ label: a.label, action: a.action }))
    }
  };
}
