# UI Vision Hybrid Setup Guide

This guide explains how to set up and use the UI Vision hybrid approach for enhanced reliability in the vee_otto automation framework.

## Overview

The hybrid approach combines:
- **Playwright** for programmatic browser control
- **UI Vision** for visual/image-based automation fallbacks
- **Tesseract.js** for OCR text extraction
- **Fuzzy matching** for flexible element selection
- **Retry logic** with exponential backoff

Target: **95%+ success rate** on flaky legacy UI interactions

## Installation

### 1. UI Vision Extension

1. Install UI Vision RPA extension:
   - Chrome: https://chrome.google.com/webstore/detail/uivision-rpa/gcbalfbdmfieckjlnblleoemohcganoc
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/rpa/

2. Configure UI Vision:
   - Open UI Vision
   - Go to Settings > API
   - Enable "Allow command line"
   - Note the CLI path (usually `/usr/local/bin/ui.vision.cli`)

3. Install UI Vision CLI:
   ```bash
   # macOS/Linux
   curl -o ui.vision.cli https://ui.vision/downloads/cli/mac/ui.vision.cli
   chmod +x ui.vision.cli
   sudo mv ui.vision.cli /usr/local/bin/

   # Windows
   # Download from https://ui.vision/downloads/cli/win/ui.vision.cli.exe
   # Add to PATH
   ```

### 2. Image Assets

Create reference images for visual automation:

```bash
# Create directories
mkdir -p macros/images

# Add reference images:
# - username_field.png (screenshot of username input)
# - password_field.png (screenshot of password input)
# - login_button.png (screenshot of login button)
# - checkbox_unchecked.png
# - checkbox_checked.png
# - window_sticker_link.png
# - dashboard_loaded.png
```

### 3. Environment Configuration

Update `.env`:

```env
# UI Vision Settings
UI_VISION_ENABLED=true
UI_VISION_CLI_PATH=/usr/local/bin/ui.vision.cli
UI_VISION_EXTENSION_PATH=/path/to/extension

# OCR Settings
OCR_ENABLED=true
OCR_LANGUAGE=eng

# Reliability Settings
DEFAULT_RETRIES=3
STABILITY_CHECKS=true
FUZZY_MATCHING=true
```

## Usage

### Basic Hybrid Agent

```typescript
import { HybridAutomationAgent } from './src/agents/HybridAutomationAgent';

const agent = new HybridAutomationAgent({
  headless: false,
  enableUIVision: true,
  enableOCR: true,
  reliabilitySettings: {
    defaultRetries: 3,
    stabilityChecks: true,
    fuzzyMatching: true
  }
});

await agent.initialize();

// Hybrid login with visual fallbacks
await agent.hybridLogin({
  url: 'https://app.vauto.com/login',
  usernameSelector: '//input[@id="username"]',
  passwordSelector: '//input[@id="password"]',
  submitSelector: '//button[@type="submit"]',
  username: 'user@example.com',
  password: 'password',
  successIndicator: '.dashboard',
  visualTargets: {
    username: 'images/username_field.png',
    password: 'images/password_field.png'
  }
});
```

### Checkbox Handling

```typescript
// Update checkboxes with visual verification
const result = await agent.updateCheckboxes(
  ['#checkbox1', '#checkbox2', '#checkbox3'],
  [true, false, true],
  {
    visualVerification: true,
    checkboxImages: {
      checked: 'images/checkbox_checked.png',
      unchecked: 'images/checkbox_unchecked.png'
    }
  }
);

console.log(`Success: ${result.success}, Failed: ${result.failed}`);
```

### Window Sticker Scraping

```typescript
// Scrape with multiple fallback methods
const content = await agent.scrapeWindowSticker(
  'a[href*="sticker"]',
  {
    useOCR: true,
    downloadFallback: true
  }
);
```

## Macro Examples

### Visual Click Macro (vauto_checkbox.json)

```json
{
  "name": "vauto_checkbox",
  "commands": [
    {
      "command": "visualAssert",
      "target": "images/checkbox_area.png",
      "value": "5"
    },
    {
      "command": "XClick",
      "target": "images/checkbox_unchecked.png",
      "value": "0.85"
    },
    {
      "command": "visualVerify",
      "target": "images/checkbox_checked.png"
    }
  ]
}
```

## Testing Reliability

Run the reliability test suite:

```bash
npm run test-hybrid
```

This will:
1. Test login reliability (5 runs)
2. Test checkbox interactions (10 runs)
3. Test dynamic content scraping (10 runs)
4. Generate a detailed report with success rates

Target metrics:
- Overall success rate: 95%+
- Average operation time: <5 seconds
- Retry success rate: >80% on first retry

## Troubleshooting

### UI Vision Not Found

```bash
# Check CLI installation
which ui.vision.cli

# Test CLI
ui.vision.cli version
```

### Low Success Rates

1. Update reference images with better quality screenshots
2. Adjust confidence thresholds (0.7-0.9)
3. Increase retry counts
4. Add more wait time between operations

### OCR Issues

1. Ensure good contrast in screenshots
2. Try different languages: `ocrLanguage: 'eng+deu'`
3. Pre-process images for better OCR results

## Best Practices

1. **Image Quality**: Use high-contrast, clear screenshots for reference images
2. **Unique Targets**: Ensure visual targets are unique on the page
3. **Fallback Order**: Playwright → UI Vision → OCR → Download
4. **Error Handling**: Always implement proper cleanup in error cases
5. **Monitoring**: Log all fallback attempts for debugging

## Performance Tips

1. Cache UI Vision macros to avoid recreation
2. Use element stability checks before interactions
3. Implement smart waits instead of fixed delays
4. Batch similar operations when possible
5. Use parallel execution for independent tasks