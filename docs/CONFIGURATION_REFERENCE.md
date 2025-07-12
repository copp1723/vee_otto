# Vee Otto Configuration Reference

## Table of Contents

1. [Overview](#overview)
2. [Environment Variables](#environment-variables)
3. [Configuration Files](#configuration-files)
4. [Agent Configuration](#agent-configuration)
5. [Service Configuration](#service-configuration)
6. [Feature Mapping](#feature-mapping)
7. [Scheduling Configuration](#scheduling-configuration)
8. [Security Configuration](#security-configuration)
9. [Advanced Options](#advanced-options)
10. [Configuration Precedence](#configuration-precedence)

## Overview

Vee Otto uses a hierarchical configuration system that allows customization at multiple levels:

1. **Environment Variables** - Runtime configuration via `.env` files
2. **JSON Configuration Files** - Structured configuration for services
3. **Code-level Defaults** - Fallback values in the source code

Configuration can be overridden at runtime through CLI arguments or programmatically through the API.

## Environment Variables

### Core Configuration

Create a `.env` file in the project root based on `.env.example`:

```bash
# Platform Configuration
PLATFORM_URL=https://app.vauto.com/login
PLATFORM_USERNAME=your_username
PLATFORM_PASSWORD=your_password
```

#### Platform Settings

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PLATFORM_URL` | string | `https://app.vauto.com/login` | vAuto login URL |
| `PLATFORM_USERNAME` | string | required | Your vAuto username |
| `PLATFORM_PASSWORD` | string | required | Your vAuto password |
| `VAUTO_DEALERSHIP_ID` | string | optional | Specific dealership ID to select |

#### Browser Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `HEADLESS` | boolean | `false` | Run browser in headless mode |
| `BROWSER_TIMEOUT` | number | `30000` | Default timeout in milliseconds |
| `BROWSER_SLOWMO` | number | `100` | Slow down operations by ms |
| `VIEWPORT_WIDTH` | number | `1920` | Browser viewport width |
| `VIEWPORT_HEIGHT` | number | `1080` | Browser viewport height |

#### Selectors (Override Defaults)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `USERNAME_SELECTOR` | string | `//input[@id="username"]` | Username input selector |
| `PASSWORD_SELECTOR` | string | `//input[@id="password"]` | Password input selector |
| `SUBMIT_SELECTOR` | string | `//button[@type="submit"]` | Login button selector |
| `SUCCESS_INDICATOR` | string | `//div[contains(@class, "dashboard")]` | Login success indicator |

#### 2FA Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ENABLE_2FA` | boolean | `true` | Enable 2FA handling |
| `TFA_EMAIL_SELECTOR` | string | `//button[contains(text(), "Email")]` | 2FA email option |
| `TFA_CODE_SELECTOR` | string | `//input[@name="code"]` | 2FA code input |
| `TFA_SUBMIT_SELECTOR` | string | `//button[contains(text(), "Verify")]` | 2FA submit button |
| `TFA_SUCCESS_INDICATOR` | string | `//div[contains(@class, "authenticated")]` | 2FA success indicator |

### Service Configuration

#### Mailgun (2FA Code Retrieval)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MAILGUN_API_KEY` | string | required | Mailgun API key |
| `MAILGUN_DOMAIN` | string | required | Your Mailgun domain |
| `MAILGUN_FROM_FILTER` | string | optional | Filter emails by sender |
| `MAILGUN_TIMEOUT` | number | `60000` | Email check timeout |

#### Email Service (Notifications)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SMTP_HOST` | string | `smtp.gmail.com` | SMTP server host |
| `SMTP_PORT` | number | `587` | SMTP server port |
| `SMTP_SECURE` | boolean | `false` | Use TLS |
| `SMTP_USER` | string | required | SMTP username |
| `SMTP_PASS` | string | required | SMTP password |
| `SMTP_FROM` | string | required | From email address |
| `REPORTS_NOTIFICATION_EMAIL` | string | required | Email for reports |

#### OpenRouter (AI Integration)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `OPENROUTER_API_KEY` | string | optional | OpenRouter API key |
| `OPENROUTER_BASE_URL` | string | `https://openrouter.ai/api/v1` | API base URL |
| `OPENROUTER_DEFAULT_MODEL` | string | `anthropic/claude-3.5-sonnet` | Default AI model |
| `OPENROUTER_MAX_TOKENS` | number | `4000` | Max response tokens |

### Dashboard Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | number | `3000` | Server port |
| `DASHBOARD_PORT` | number | `8080` | Dashboard dev server port |
| `JWT_SECRET` | string | required | JWT signing secret |
| `ADMIN_USER` | string | `admin` | Admin username |
| `ADMIN_PASS` | string | required | Admin password |
| `FRONTEND_URL` | string | `http://localhost:8080` | Frontend URL |
| `REACT_APP_API_URL` | string | `http://localhost:3000/api` | API URL for frontend |
| `REACT_APP_WS_URL` | string | `http://localhost:3000` | WebSocket URL |

### Logging & Debugging

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `LOG_LEVEL` | string | `info` | Log level (debug/info/warn/error) |
| `LOG_FILE` | string | `./logs/agent.log` | Log file path |
| `DEBUG` | string | optional | Debug namespaces (e.g., `vee-otto:*`) |
| `SCREENSHOT_ON_ERROR` | boolean | `true` | Take screenshots on error |
| `PLAYWRIGHT_TRACE` | string | optional | Enable Playwright tracing |

### Performance & Reliability

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DEFAULT_RETRIES` | number | `3` | Default retry count |
| `RETRY_DELAY` | number | `1000` | Delay between retries (ms) |
| `ENABLE_UI_VISION` | boolean | `true` | Enable UI Vision fallback |
| `ENABLE_OCR` | boolean | `true` | Enable OCR fallback |
| `OCR_CONFIDENCE_THRESHOLD` | number | `0.8` | OCR confidence threshold |
| `FUZZY_MATCH_THRESHOLD` | number | `0.85` | Fuzzy matching threshold |

## Configuration Files

### Email Configuration (`config/email-config.json`)

```json
{
  "imap": {
    "host": "imap.gmail.com",
    "port": 993,
    "secure": true,
    "auth": {
      "user": "your_email@gmail.com",
      "pass": "your_app_password"
    }
  },
  "searchCriteria": {
    "from": ["noreply@vauto.com", "support@vauto.com"],
    "subject": ["verification", "code", "2FA"],
    "unseen": true
  },
  "checkInterval": 5000,
  "maxRetries": 12,
  "codePatterns": [
    "\\b\\d{6}\\b",
    "code:\\s*(\\d{6})",
    "verification code is (\\d{6})"
  ]
}
```

### Mailgun Configuration (`config/mailgun-config.json`)

```json
{
  "apiKey": "your-mailgun-api-key",
  "domain": "mg.yourdomain.com",
  "fromFilter": "noreply@vauto.com",
  "eventTypes": ["delivered", "opened"],
  "webhook": {
    "signingKey": "your-webhook-signing-key",
    "port": 3001
  }
}
```

### Feature Mapping (`config/featureMapping.json`)

```json
{
  "priorityFeatures": [
    "Leather Seats",
    "Navigation System",
    "Sunroof/Moonroof",
    "Heated Seats",
    "Backup Camera"
  ],
  "featurePatterns": {
    "leather": ["Leather", "Lthr", "Leather-Trimmed"],
    "navigation": ["Navigation", "Nav", "GPS", "Nav System"],
    "sunroof": ["Sunroof", "Moonroof", "Panoramic Roof"]
  },
  "packageMappings": {
    "Technology Package": [
      "Navigation System",
      "Premium Audio",
      "Blind Spot Monitoring"
    ],
    "Convenience Package": [
      "Keyless Entry",
      "Power Liftgate",
      "Remote Start"
    ]
  },
  "ignoredTerms": [
    "Standard",
    "N/A",
    "None",
    "Base"
  ],
  "valueThresholds": {
    "highValue": 1000,
    "mediumValue": 500,
    "lowValue": 100
  }
}
```

### vAuto Workflow (`config/vauto-workflow.json`)

```json
{
  "login": {
    "maxAttempts": 3,
    "waitAfterLogin": 5000
  },
  "inventory": {
    "url": "https://app.vauto.com/inventory",
    "filters": {
      "status": "no_price_pending",
      "age": "all",
      "location": "all"
    },
    "batchSize": 10,
    "delayBetweenVehicles": 2000
  },
  "processing": {
    "windowSticker": {
      "downloadTimeout": 30000,
      "parseMethod": "hybrid"
    },
    "checkboxes": {
      "updateMethod": "batch",
      "verifyAfterUpdate": true
    },
    "books": {
      "syncJDPower": true,
      "syncBlackBook": true,
      "syncKBB": true
    }
  },
  "reporting": {
    "sendEmail": true,
    "includeSummary": true,
    "includeErrors": true,
    "attachScreenshots": false
  }
}
```

## Agent Configuration

### BaseAutomationAgent

```typescript
const agent = new BaseAutomationAgent({
  // Browser settings
  headless: false,
  slowMo: 100,
  timeout: 30000,
  
  // Error handling
  screenshotOnError: true,
  maxRetries: 3,
  
  // Notifications
  notificationsEnabled: false,
  notificationChannels: ['email']
});
```

### HybridAutomationAgent

```typescript
const agent = new HybridAutomationAgent({
  // Inherit base configuration
  ...baseConfig,
  
  // Hybrid features
  enableUIVision: true,
  enableOCR: true,
  
  // Reliability settings
  reliabilitySettings: {
    defaultRetries: 3,
    stabilityChecks: true,
    fuzzyMatching: true,
    fuzzyThreshold: 0.85
  },
  
  // Rate limiting
  rateLimiting: {
    concurrency: 2,
    interval: 1000,
    intervalCap: 5
  },
  
  // Metrics
  enableMetrics: true,
  metricsInterval: 60000
});
```

### VAutoAgent

```typescript
const agent = new VAutoAgent({
  // vAuto specific
  dealershipId: '12345',
  dealershipName: 'Premier Auto Group',
  
  // Feature extraction
  featureExtraction: {
    method: 'hybrid',
    ocrLanguage: 'eng',
    confidenceThreshold: 0.8
  },
  
  // Checkbox mapping
  checkboxMapping: {
    fuzzyMatch: true,
    threshold: 0.85,
    priorityFeatures: ['Leather', 'Navigation', 'Sunroof']
  },
  
  // Book synchronization
  bookSync: {
    enabled: true,
    books: ['jdpower', 'blackbook', 'kbb'],
    retryOnFailure: true
  }
});
```

## Service Configuration

### OCRService

```typescript
const ocrService = new OCRService({
  // Tesseract settings
  language: 'eng',
  oem: 3,  // OCR Engine Mode
  psm: 3,  // Page Segmentation Mode
  
  // Performance
  workerCount: 2,
  cacheResults: true,
  cacheTTL: 300000,  // 5 minutes
  
  // Quality
  preprocessImage: true,
  enhanceContrast: true,
  confidenceThreshold: 0.8
});
```

### UIVisionService

```typescript
const uiVision = new UIVisionService({
  // Extension settings
  extensionId: 'your-extension-id',
  apiUrl: 'http://localhost:6831/api',
  
  // Visual matching
  defaultConfidence: 0.8,
  searchRegion: 'full',
  waitTimeout: 10000,
  
  // Macro settings
  macroFolder: './macros',
  autoSaveMacros: true
});
```

### NotificationService

```typescript
const notifications = new NotificationService({
  // Channels
  email: {
    enabled: true,
    service: 'smtp',  // or 'mailgun', 'sendgrid'
    throttle: 300000  // 5 minutes
  },
  
  webhook: {
    enabled: false,
    url: process.env.WEBHOOK_URL,
    headers: { 'Authorization': 'Bearer token' }
  },
  
  // Templates
  templates: {
    success: 'email-success.hbs',
    failure: 'email-failure.hbs',
    summary: 'email-summary.hbs'
  }
});
```

## Feature Mapping

### Priority Configuration

```javascript
{
  // High priority features (check first)
  "tier1": [
    "Leather Seats",
    "Navigation System",
    "Sunroof/Moonroof"
  ],
  
  // Medium priority
  "tier2": [
    "Heated Seats",
    "Backup Camera",
    "Bluetooth"
  ],
  
  // Low priority
  "tier3": [
    "Floor Mats",
    "Cargo Net",
    "First Aid Kit"
  ]
}
```

### Fuzzy Matching Rules

```javascript
{
  "synonyms": {
    "leather": ["Lthr", "Leather-Trimmed", "Leather Appointed"],
    "navigation": ["Nav", "GPS", "Navigation System"],
    "sunroof": ["Moonroof", "Panoramic Roof", "Sun/Moon Roof"]
  },
  
  "abbreviations": {
    "Pwr": "Power",
    "Htd": "Heated",
    "Mem": "Memory",
    "Pkg": "Package"
  },
  
  "corrections": {
    "Naviation": "Navigation",
    "Lether": "Leather",
    "Camara": "Camera"
  }
}
```

## Scheduling Configuration

### Cron Schedule

```javascript
// config/schedule.json
{
  "production": {
    "runs": [
      {
        "name": "Morning Run",
        "cron": "0 7 * * *",
        "timezone": "America/New_York"
      },
      {
        "name": "Afternoon Run", 
        "cron": "0 14 * * *",
        "timezone": "America/New_York"
      }
    ]
  },
  
  "development": {
    "runs": [
      {
        "name": "Test Run",
        "cron": "*/30 * * * *",  // Every 30 minutes
        "timezone": "America/New_York"
      }
    ]
  }
}
```

### Scheduler Options

```typescript
const scheduler = new VAutoScheduler({
  // Schedule configuration
  configFile: './config/schedule.json',
  environment: process.env.NODE_ENV || 'production',
  
  // Execution options
  runImmediately: false,
  catchupOnRestart: false,
  
  // Error handling
  retryFailedRuns: true,
  maxRetries: 2,
  
  // Notifications
  notifyOnStart: true,
  notifyOnComplete: true,
  notifyOnError: true
});
```

## Security Configuration

### Authentication

```javascript
// config/auth.json
{
  "jwt": {
    "secret": "${JWT_SECRET}",
    "expiresIn": "24h",
    "algorithm": "HS256"
  },
  
  "session": {
    "secret": "${SESSION_SECRET}",
    "resave": false,
    "saveUninitialized": false,
    "cookie": {
      "secure": true,
      "httpOnly": true,
      "maxAge": 86400000
    }
  },
  
  "rateLimiting": {
    "windowMs": 900000,  // 15 minutes
    "max": 100,
    "message": "Too many requests"
  }
}
```

### Encryption

```javascript
// config/encryption.json
{
  "credentials": {
    "algorithm": "aes-256-gcm",
    "keyDerivation": "pbkdf2",
    "iterations": 100000
  },
  
  "storage": {
    "encryptAtRest": true,
    "encryptionKey": "${ENCRYPTION_KEY}"
  }
}
```

## Advanced Options

### Performance Tuning

```javascript
// config/performance.json
{
  "browser": {
    "args": [
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu"
    ],
    "ignoreDefaultArgs": ["--disable-extensions"]
  },
  
  "parallel": {
    "maxConcurrent": 3,
    "queueSize": 100,
    "timeout": 300000
  },
  
  "caching": {
    "enabled": true,
    "ttl": 3600000,
    "maxSize": "100mb"
  }
}
```

### Debug Configuration

```javascript
// config/debug.json
{
  "playwright": {
    "trace": "on-first-retry",
    "video": "retain-on-failure",
    "screenshot": "only-on-failure"
  },
  
  "logging": {
    "console": true,
    "file": true,
    "maxFiles": 10,
    "maxSize": "10m"
  },
  
  "devTools": {
    "enabled": true,
    "slowMo": 500,
    "headless": false
  }
}
```

## Configuration Precedence

Configuration is loaded and merged in the following order (later overrides earlier):

1. **Default Values** - Hardcoded in source files
2. **Configuration Files** - JSON files in `/config`
3. **Environment Variables** - `.env` file
4. **Runtime Environment** - Process environment variables
5. **CLI Arguments** - Command line flags
6. **API Parameters** - Runtime API calls

### Example Override Chain

```javascript
// 1. Default (in code)
const DEFAULT_TIMEOUT = 30000;

// 2. Config file (config/agent.json)
{ "timeout": 45000 }

// 3. Environment variable (.env)
BROWSER_TIMEOUT=60000

// 4. Runtime environment
BROWSER_TIMEOUT=75000 npm run vauto

// 5. CLI argument
npm run vauto -- --timeout 90000

// 6. API call
agent.setTimeout(120000);

// Final value: 120000
```

### Accessing Configuration

```typescript
// Via environment
const timeout = process.env.BROWSER_TIMEOUT || 30000;

// Via config loader
import { loadConfig } from './utils/configLoader';
const config = loadConfig('agent');

// Via agent options
const agent = new VAutoAgent({
  timeout: config.timeout || DEFAULT_TIMEOUT
});

// Runtime override
agent.updateConfig({ timeout: 120000 });
```

## Best Practices

1. **Environment-Specific Files**
   ```
   .env.development
   .env.production
   .env.test
   ```

2. **Secrets Management**
   - Never commit `.env` files
   - Use environment variables for secrets
   - Consider secret management services

3. **Configuration Validation**
   ```typescript
   import { validateConfig } from './utils/configValidator';
   
   const config = loadConfig();
   const errors = validateConfig(config);
   if (errors.length > 0) {
     throw new Error(`Invalid configuration: ${errors.join(', ')}`);
   }
   ```

4. **Dynamic Reloading**
   ```typescript
   // Watch for config changes
   import { watchConfig } from './utils/configWatcher';
   
   watchConfig('./config', (changes) => {
     console.log('Configuration updated:', changes);
     agent.reloadConfig();
   });
   ```

## Support

For configuration issues:
- Check the [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md)
- Review [example configurations](https://github.com/yourusername/vee-otto/tree/main/config/examples)
- Open an [issue](https://github.com/yourusername/vee-otto/issues/new)