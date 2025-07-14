# Window Sticker Scraping Implementation

## Overview

This document describes the implementation of the vehicle selection and window sticker scraping functionality for the VAuto automation system.

## Key Changes

### 1. Enhanced Vehicle Selection (Vehicle Links)

Previously, the system clicked on vehicle rows. Now it properly clicks on vehicle links (URLs) within the inventory list.

**File:** `platforms/vauto/tasks/VAutoTasks.ts`

```typescript
// Click on vehicle link instead of row
const vehicleLinks = await page.locator(vAutoSelectors.inventory.vehicleLink).all();
await vehicleLinks[i].click();
```

### 2. New Selectors Added

**File:** `platforms/vauto/vautoSelectors.ts`

Added comprehensive selectors for:
- Vehicle links in inventory grid
- Vehicle Info tab navigation
- GaugePageIFrame access
- Factory Equipment tab within iframe
- Window sticker popup detection

```typescript
// Vehicle link selectors
vehicleLink: '//tr[contains(@class, "x-grid3-row")]//a[contains(@href, "javascript") or contains(@onclick, "javascript")]',

// Vehicle Info tab and iframe
vehicleInfoTab: '//a[contains(text(), "Vehicle Info")] | //div[contains(text(), "Vehicle Info")]',
gaugePageIFrame: '#GaugePageIFrame',

// Factory Equipment in iframe
factoryEquipmentTabInFrame: '//a[@id="ext-gen201"] | //div[@id="ext-gen201"]',
```

### 3. Window Sticker Scraping Process

The implementation follows this flow:

1. **Click Vehicle Link** - Navigate to specific vehicle (e.g., "2016 Dodge Grand Caravan SXT")
2. **Ensure Vehicle Info Tab Active** - Make sure we're on the right tab
3. **Access GaugePageIFrame** - Switch to the iframe context
4. **Click Factory Equipment Tab** - Using ID `ext-gen201` within the iframe
5. **Detect New Window** - Factory equipment opens in a new window/tab
6. **Scrape Content** - Extract all text from the window sticker
7. **Parse Features** - Organize content into sections (Interior, Mechanical, etc.)
8. **Close Window** - Clean up and return to inventory

### 4. Content Parsing

The window sticker content is intelligently parsed into sections:

```typescript
const sections = {
  interior: [],      // Interior features
  mechanical: [],    // Engine and mechanical specs
  comfort: [],       // Comfort & convenience features
  safety: [],        // Safety & security features
  other: []         // Miscellaneous features
};
```

### 5. Error Handling

Robust error handling includes:
- Fallback selectors if primary ones fail
- Graceful handling of missing iframes
- Window detection with multiple checks
- Content validation before processing

## Testing

A dedicated test file has been created:

**File:** `tests/test-window-sticker-scraping.ts`

Run the test with:
```bash
npm test tests/test-window-sticker-scraping.ts
```

Test features:
- Works with both mockup and real VAuto
- Takes screenshots at each step
- Validates window sticker was scraped
- Reports extracted features

## Usage in Production

The window sticker scraping is now integrated into the main vehicle processing flow:

1. When processing inventory, vehicles are clicked by their links
2. Window sticker is automatically scraped if Factory Equipment is accessible
3. Features are extracted and can be used for checkbox updates
4. All content is logged for verification

## Key Benefits

1. **Accurate Vehicle Selection** - Clicking links ensures proper navigation
2. **Complete Feature Extraction** - Window sticker provides comprehensive feature list
3. **Automated Process** - No manual intervention required
4. **Error Resilient** - Multiple fallbacks ensure reliability

## Monitoring

The system logs detailed information:
- Vehicle link clicks
- Tab navigation
- Window detection
- Content extraction
- Feature parsing

Look for these log messages:
```
🔍 Clicking vehicle link 1...
📍 Vehicle Info tab found, ensuring it's active...
🏭 Accessing Factory Equipment through iframe...
✅ Found factory equipment window!
📋 Scraped window sticker. Found X features
```

## Future Enhancements

1. **Feature Mapping** - Map window sticker features to checkbox IDs
2. **Batch Processing** - Process multiple vehicles in parallel
3. **Content Caching** - Cache window sticker data to avoid re-scraping
4. **Advanced Parsing** - Use NLP for better feature extraction 