# Vee Otto Troubleshooting Guide

## Table of Contents

1. [Common Issues](#common-issues)
2. [Authentication Problems](#authentication-problems)
3. [Browser & Navigation Issues](#browser--navigation-issues)
4. [OCR & Visual Recognition](#ocr--visual-recognition)
5. [Feature Mapping Issues](#feature-mapping-issues)
6. [Performance Problems](#performance-problems)
7. [Email & Notification Issues](#email--notification-issues)
8. [Dashboard Problems](#dashboard-problems)
9. [System & Environment](#system--environment)
10. [Debugging Tools](#debugging-tools)
11. [Error Codes Reference](#error-codes-reference)
12. [Performance Optimization](#performance-optimization)

## Common Issues

### "Login Failed" Error

**Symptoms:**
- Authentication fails repeatedly
- Browser gets stuck on login page
- 2FA codes not working

**Solutions:**

1. **Verify Credentials**
   ```bash
   # Check .env file
   cat .env | grep -E "PLATFORM_USERNAME|PLATFORM_PASSWORD"
   
   # Test credentials manually in browser
   ```

2. **Update Selectors**
   ```typescript
   // Check if vAuto changed their UI
   const agent = new VAutoAgent({
     selectors: {
       username: '//input[@name="username"]',  // Updated selector
       password: '//input[@name="password"]',
       submit: '//button[contains(text(), "Sign In")]'
     }
   });
   ```

3. **Enable Visual Debugging**
   ```bash
   # Run with browser visible
   HEADLESS=false npm run vauto:once
   
   # Add delays for manual inspection
   BROWSER_SLOWMO=2000 npm run vauto:once
   ```

### "Element Not Found" Errors

**Symptoms:**
- `TimeoutError: Waiting for selector`
- Elements exist but not being detected
- Intermittent selector failures

**Solutions:**

1. **Use Reliable Selectors**
   ```typescript
   // Prefer stable attributes
   const reliableSelector = '[data-testid="submit-button"]';  // Good
   const unreliableSelector = 'button:nth-child(3)';          // Bad
   ```

2. **Add Wait Conditions**
   ```typescript
   // Wait for element to be stable
   await page.waitForSelector(selector, { state: 'visible' });
   await page.waitForLoadState('networkidle');
   ```

3. **Use Hybrid Fallbacks**
   ```typescript
   try {
     await page.click(selector);
   } catch (error) {
     // Fallback to UI Vision
     await uiVision.visualClick('submit_button.png');
   }
   ```

### "Process Hangs or Freezes"

**Symptoms:**
- Automation stops responding
- Browser tabs accumulate
- Memory usage increases

**Solutions:**

1. **Set Proper Timeouts**
   ```typescript
   const agent = new VAutoAgent({
     timeout: 30000,        // 30 second default
     navigationTimeout: 45000  // 45 seconds for page loads
   });
   ```

2. **Implement Resource Cleanup**
   ```typescript
   try {
     await agent.execute(async () => {
       // Your automation logic
     });
   } finally {
     await agent.cleanup();  // Always cleanup
   }
   ```

3. **Monitor Resource Usage**
   ```bash
   # Monitor during execution
   watch -n 1 'ps aux | grep chrome'
   ```

## Authentication Problems

### 2FA Code Not Retrieved

**Symptoms:**
- 2FA required but code not found
- Email check fails
- Mailgun webhook not receiving

**Diagnostic Steps:**

1. **Verify Email Configuration**
   ```bash
   # Test email connection
   npm run test:email
   
   # Check email config
   cat config/email-config.json
   ```

2. **Check Mailgun Setup**
   ```bash
   # Test Mailgun API
   curl -s --user 'api:YOUR_API_KEY' \
     https://api.mailgun.net/v3/YOUR_DOMAIN/events
   
   # Verify webhook
   npm run test:mailgun
   ```

3. **Enable Debug Logging**
   ```bash
   DEBUG=vee-otto:email,vee-otto:mailgun npm run vauto:once
   ```

**Solutions:**

1. **Update Email Filters**
   ```json
   // config/email-config.json
   {
     "searchCriteria": {
       "from": ["noreply@vauto.com", "security@vauto.com"],
       "subject": ["verification", "authentication", "login"],
       "since": "2024-01-01"
     }
   }
   ```

2. **Adjust Code Patterns**
   ```json
   {
     "codePatterns": [
       "\\b\\d{6}\\b",                    // 6 digits
       "code[\\s:]*([0-9]{6})",          // "code: 123456"
       "verification[\\s:]*([0-9]{6})"   // "verification: 123456"
     ]
   }
   ```

### Captcha Challenges

**Symptoms:**
- Login blocked by captcha
- Repeated login attempts trigger security

**Solutions:**

1. **Reduce Login Frequency**
   ```typescript
   const agent = new VAutoAgent({
     loginCooldown: 300000,  // 5 minutes between attempts
     maxLoginAttempts: 3
   });
   ```

2. **Use Longer Delays**
   ```typescript
   await page.waitForTimeout(5000);  // Wait 5 seconds between actions
   ```

3. **Rotate User Agents**
   ```typescript
   const userAgents = [
     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
   ];
   ```

## Browser & Navigation Issues

### Browser Crashes

**Symptoms:**
- `Error: Browser has been closed`
- Chromium process exits unexpectedly
- Memory errors

**Solutions:**

1. **Add Chrome Flags**
   ```bash
   # .env file
   CHROME_FLAGS="--no-sandbox --disable-dev-shm-usage --disable-gpu"
   ```

2. **Increase Memory Limits**
   ```bash
   # Node.js memory
   NODE_OPTIONS="--max-old-space-size=4096"
   
   # Chrome memory
   CHROME_FLAGS="--memory-pressure-off --max_old_space_size=4096"
   ```

3. **Use Browser Pool**
   ```typescript
   // Reuse browser instances
   const browserPool = new BrowserPool({ maxSize: 3 });
   const browser = await browserPool.acquire();
   ```

### Page Load Timeouts

**Symptoms:**
- `Navigation timeout of 30000ms exceeded`
- Pages load partially
- Resources fail to load

**Solutions:**

1. **Increase Timeouts**
   ```typescript
   await page.goto(url, { 
     waitUntil: 'networkidle',
     timeout: 60000 
   });
   ```

2. **Wait for Specific Elements**
   ```typescript
   // Wait for critical content
   await page.waitForSelector('[data-loaded="true"]');
   ```

3. **Handle Slow Networks**
   ```typescript
   // Retry navigation
   await withRetry(async () => {
     await page.goto(url);
     await page.waitForLoadState('domcontentloaded');
   }, { retries: 3, delay: 5000 });
   ```

### Popup Handling

**Symptoms:**
- Unexpected popups block automation
- Modal dialogs not dismissed
- Overlay elements interfere

**Solutions:**

1. **Handle Common Popups**
   ```typescript
   // Auto-dismiss dialogs
   page.on('dialog', async dialog => {
     console.log(`Dialog: ${dialog.message()}`);
     await dialog.dismiss();
   });
   
   // Close modal overlays
   await page.evaluate(() => {
     const modals = document.querySelectorAll('.modal, .overlay');
     modals.forEach(modal => modal.remove());
   });
   ```

2. **Use Popup Blockers**
   ```typescript
   const context = await browser.newContext({
     permissions: ['notifications'],  // Block notification popups
     hasTouch: false                 // Disable touch events
   });
   ```

## OCR & Visual Recognition

### OCR Accuracy Issues

**Symptoms:**
- Low confidence scores (<0.8)
- Incorrect text extraction
- Missing features in recognition

**Diagnostic Steps:**

1. **Check Image Quality**
   ```bash
   # Enable screenshot saving
   SAVE_OCR_IMAGES=true npm run vauto:once
   
   # Review saved images in ./screenshots/ocr/
   ```

2. **Test OCR Manually**
   ```typescript
   const ocr = new OCRService();
   const result = await ocr.extractText('./test-image.png');
   console.log('Confidence:', result.confidence);
   console.log('Text:', result.text);
   ```

**Solutions:**

1. **Improve Image Preprocessing**
   ```typescript
   const ocr = new OCRService({
     preprocessing: {
       enhanceContrast: true,
       removeNoise: true,
       sharpen: true,
       resize: { scale: 2.0 }  // Upscale for better recognition
     }
   });
   ```

2. **Adjust OCR Parameters**
   ```typescript
   const ocr = new OCRService({
     tesseractOptions: {
       tessedit_pageseg_mode: '6',      // Single uniform block
       tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '
     }
   });
   ```

3. **Use Multiple OCR Engines**
   ```typescript
   // Try different PSM modes
   const psmModes = [3, 6, 8, 11];
   for (const psm of psmModes) {
     const result = await ocr.extractText(image, { psm });
     if (result.confidence > 0.85) break;
   }
   ```

### UI Vision Extension Issues

**Symptoms:**
- `Extension not found` errors
- Visual clicks not working
- Macro execution fails

**Solutions:**

1. **Verify Extension Installation**
   ```bash
   # Check if extension is installed
   ls ~/Library/Application\ Support/Google/Chrome/Default/Extensions/
   
   # Verify extension ID
   chrome://extensions/
   ```

2. **Configure Extension API**
   ```typescript
   const uiVision = new UIVisionService({
     extensionId: 'kglhbbefdnlheedjiejgomgmfplipfeb',
     apiPort: 6831,
     timeout: 15000
   });
   ```

3. **Update Visual Targets**
   ```typescript
   // Use higher resolution images
   await uiVision.updateTargetImage('login_button.png', {
     resolution: '2x',
     confidence: 0.8
   });
   ```

## Feature Mapping Issues

### Features Not Detected

**Symptoms:**
- Known features missing from extraction
- Low mapping confidence
- Important features unmapped

**Diagnostic Steps:**

1. **Review Extracted Text**
   ```bash
   # Enable feature debug logging
   DEBUG=vee-otto:features npm run vauto:once
   ```

2. **Test Feature Patterns**
   ```typescript
   const text = "Heated Leather Seats, Navigation System";
   const features = extractFeaturesFromText(text);
   console.log('Detected features:', features);
   ```

**Solutions:**

1. **Update Feature Patterns**
   ```json
   // config/featureMapping.json
   {
     "featurePatterns": {
       "heated_seats": [
         "Heated Seats", "Htd Seats", "Seat Heaters",
         "Heated Front Seats", "Heated Rear Seats"
       ],
       "navigation": [
         "Navigation", "Nav System", "GPS", "Navi",
         "In-Dash Navigation", "Built-in GPS"
       ]
     }
   }
   ```

2. **Adjust Fuzzy Matching**
   ```typescript
   const mapping = mapFeatureToCheckbox('Lthr Seats', checkboxes, {
     threshold: 0.75,  // Lower threshold for partial matches
     algorithm: 'jaro-winkler'  // Alternative matching algorithm
   });
   ```

3. **Add Manual Mappings**
   ```json
   {
     "manualMappings": {
       "Convenience Pkg": ["Keyless Entry", "Power Windows"],
       "Tech Pkg": ["Navigation", "Premium Audio"]
     }
   }
   ```

### Checkbox Updates Fail

**Symptoms:**
- Checkboxes not updating in vAuto
- State changes not persisting
- Verification failures

**Solutions:**

1. **Use Stable Checkbox Selectors**
   ```typescript
   // Prefer data attributes over CSS classes
   const checkboxSelector = '[data-feature="leather-seats"] input[type="checkbox"]';
   ```

2. **Add Verification Steps**
   ```typescript
   await hybridSetCheckbox(page, selector, true);
   
   // Verify the change
   const isChecked = await page.isChecked(selector);
   if (!isChecked) {
     throw new Error('Checkbox update failed');
   }
   ```

3. **Handle Dynamic Content**
   ```typescript
   // Wait for checkbox to be ready
   await page.waitForFunction(
     selector => document.querySelector(selector)?.disabled === false,
     checkboxSelector
   );
   ```

## Performance Problems

### Slow Execution

**Symptoms:**
- Each vehicle takes >2 minutes
- Browser operations lag
- High CPU/memory usage

**Solutions:**

1. **Optimize Selectors**
   ```typescript
   // Use specific selectors
   const fast = '[data-testid="feature-checkbox"]';     // Fast
   const slow = 'div > ul > li:nth-child(5) input';     // Slow
   ```

2. **Reduce Wait Times**
   ```typescript
   // Use shorter timeouts where appropriate
   await page.waitForSelector(selector, { timeout: 5000 });
   ```

3. **Parallel Processing**
   ```typescript
   // Process multiple vehicles concurrently
   const limit = pLimit(3);  // Max 3 concurrent
   const results = await Promise.all(
     vehicles.map(vehicle => 
       limit(() => agent.processVehicle(vehicle.vin))
     )
   );
   ```

### Memory Leaks

**Symptoms:**
- Memory usage increases over time
- Browser tabs not closing
- System becomes unresponsive

**Solutions:**

1. **Proper Resource Cleanup**
   ```typescript
   class VAutoAgent {
     async cleanup() {
       // Close all pages
       const pages = this.context.pages();
       await Promise.all(pages.map(page => page.close()));
       
       // Close context
       await this.context.close();
       
       // Close browser if owned
       if (this.ownsBrowser) {
         await this.browser.close();
       }
     }
   }
   ```

2. **Implement Context Rotation**
   ```typescript
   // Create new context every N operations
   let operationCount = 0;
   if (++operationCount % 50 === 0) {
     await this.rotateContext();
   }
   ```

3. **Monitor Memory Usage**
   ```typescript
   setInterval(() => {
     const usage = process.memoryUsage();
     if (usage.heapUsed > 1024 * 1024 * 1024) {  // 1GB
       console.warn('High memory usage detected');
       this.performGarbageCollection();
     }
   }, 60000);
   ```

## Email & Notification Issues

### Email Notifications Not Sent

**Symptoms:**
- No completion emails received
- SMTP connection failures
- Authentication errors

**Solutions:**

1. **Test Email Configuration**
   ```bash
   # Test SMTP connection
   npm run test:email
   
   # Send test notification
   node -e "
   const { NotificationService } = require('./src/services/NotificationService');
   const service = new NotificationService();
   service.sendTest('test@example.com');
   "
   ```

2. **Update SMTP Settings**
   ```bash
   # Gmail App Password (not regular password)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-character-app-password
   ```

3. **Handle Authentication**
   ```typescript
   // OAuth2 for Gmail
   const transporter = nodemailer.createTransporter({
     service: 'gmail',
     auth: {
       type: 'OAuth2',
       user: process.env.EMAIL_USER,
       clientId: process.env.OAUTH_CLIENT_ID,
       clientSecret: process.env.OAUTH_CLIENT_SECRET,
       refreshToken: process.env.OAUTH_REFRESH_TOKEN
     }
   });
   ```

### Mailgun Webhook Issues

**Symptoms:**
- 2FA codes not received via webhook
- Webhook endpoint not responding
- Invalid signatures

**Solutions:**

1. **Verify Webhook URL**
   ```bash
   # Test webhook endpoint
   curl -X POST http://localhost:3001/webhook \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

2. **Validate Webhook Signature**
   ```typescript
   const crypto = require('crypto');
   
   function verifySignature(timestamp, token, signature, signingKey) {
     const data = timestamp + token;
     const expectedSignature = crypto
       .createHmac('sha256', signingKey)
       .update(data)
       .digest('hex');
     
     return signature === expectedSignature;
   }
   ```

3. **Configure Mailgun Correctly**
   ```bash
   # Set up webhook in Mailgun dashboard
   curl -s --user 'api:YOUR_API_KEY' \
     https://api.mailgun.net/v3/YOUR_DOMAIN/webhooks \
     -F id='delivered' \
     -F url='https://yourdomain.com/webhook'
   ```

## Dashboard Problems

### WebSocket Connection Issues

**Symptoms:**
- Real-time updates not working
- Connection timeouts
- Dashboard shows "Disconnected"

**Solutions:**

1. **Check WebSocket Server**
   ```bash
   # Verify server is listening
   netstat -tulpn | grep 3000
   
   # Test WebSocket connection
   npm run test:websocket
   ```

2. **Configure CORS**
   ```typescript
   // server.js
   const io = new Server(server, {
     cors: {
       origin: process.env.FRONTEND_URL,
       methods: ['GET', 'POST']
     }
   });
   ```

3. **Handle Connection Retries**
   ```typescript
   // Frontend reconnection logic
   const socket = io(process.env.REACT_APP_WS_URL, {
     autoConnect: true,
     reconnection: true,
     reconnectionDelay: 1000,
     reconnectionDelayMax: 5000,
     maxReconnectionAttempts: 5
   });
   ```

### API Endpoint Errors

**Symptoms:**
- 404 Not Found errors
- 500 Internal Server Error
- CORS policy blocks

**Solutions:**

1. **Verify API Routes**
   ```bash
   # Test API endpoints
   curl http://localhost:3000/api/metrics
   curl http://localhost:3000/api/health
   ```

2. **Check Error Logs**
   ```bash
   # View server logs
   tail -f logs/server.log
   
   # Check PM2 logs
   pm2 logs vee-otto-server
   ```

3. **Fix CORS Issues**
   ```typescript
   app.use(cors({
     origin: [
       'http://localhost:3000',
       'http://localhost:8080',
       process.env.FRONTEND_URL
     ],
     credentials: true
   }));
   ```

## System & Environment

### Node.js Version Issues

**Symptoms:**
- Module compatibility errors
- Unexpected behavior
- Installation failures

**Solutions:**

1. **Use Correct Node Version**
   ```bash
   # Check current version
   node --version
   
   # Install Node 18 (recommended)
   nvm install 18
   nvm use 18
   ```

2. **Clear Package Cache**
   ```bash
   # Clear npm cache
   npm cache clean --force
   
   # Remove node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

### Permission Issues

**Symptoms:**
- `EACCES` permission errors
- Cannot write to directories
- Chrome fails to start

**Solutions:**

1. **Fix File Permissions**
   ```bash
   # Fix ownership
   sudo chown -R $USER:$USER /path/to/vee-otto
   
   # Fix permissions
   chmod -R 755 /path/to/vee-otto
   chmod +x scripts/*
   ```

2. **Configure Chrome Sandbox**
   ```bash
   # Disable sandbox for headless mode
   CHROME_FLAGS="--no-sandbox --disable-setuid-sandbox"
   ```

### Environment Variable Issues

**Symptoms:**
- Configuration not loading
- Default values used instead
- Variables not interpolated

**Solutions:**

1. **Verify Environment Loading**
   ```bash
   # Check if .env is loaded
   node -e "require('dotenv').config(); console.log(process.env.PLATFORM_USERNAME);"
   ```

2. **Use Environment-Specific Files**
   ```bash
   # Create environment files
   cp .env .env.development
   cp .env .env.production
   ```

3. **Debug Configuration**
   ```typescript
   console.log('Config loaded:', {
     username: process.env.PLATFORM_USERNAME ? '***' : 'NOT_SET',
     headless: process.env.HEADLESS,
     logLevel: process.env.LOG_LEVEL
   });
   ```

## Debugging Tools

### Enable Debug Logging

```bash
# Full debug output
DEBUG=vee-otto:* npm run vauto:once

# Specific modules
DEBUG=vee-otto:agent,vee-otto:ocr npm run vauto:once

# Save debug output
DEBUG=vee-otto:* npm run vauto:once 2>&1 | tee debug.log
```

### Browser Debugging

```bash
# Run with browser visible
HEADLESS=false npm run vauto:once

# Slow down for observation
BROWSER_SLOWMO=2000 npm run vauto:once

# Enable Playwright Inspector
PWDEBUG=1 npm run vauto:once
```

### Screenshot Debugging

```typescript
// Take screenshots at key points
await page.screenshot({ path: `debug-${Date.now()}.png`, fullPage: true });

// Screenshot on error
try {
  await page.click(selector);
} catch (error) {
  await page.screenshot({ path: 'error-screenshot.png' });
  throw error;
}
```

### Performance Profiling

```bash
# Node.js profiling
node --prof app.js

# Memory heap snapshot
node --inspect app.js
# Then open chrome://inspect in Chrome
```

### Network Monitoring

```typescript
// Log all network requests
page.on('request', request => {
  console.log(`Request: ${request.method()} ${request.url()}`);
});

page.on('response', response => {
  console.log(`Response: ${response.status()} ${response.url()}`);
});
```

## Error Codes Reference

| Code | Category | Description | Solution |
|------|----------|-------------|----------|
| AUTH001 | Authentication | Login credentials invalid | Verify username/password in .env |
| AUTH002 | Authentication | 2FA code not found | Check email/Mailgun configuration |
| AUTH003 | Authentication | Login timeout | Increase timeout, check network |
| NAV001 | Navigation | Element not found | Update selectors, wait for page load |
| NAV002 | Navigation | Page load timeout | Increase timeout, check network |
| NAV003 | Navigation | Unexpected popup | Add popup handlers |
| OCR001 | OCR | Tesseract initialization failed | Check Tesseract.js installation |
| OCR002 | OCR | Low confidence result | Improve image quality |
| OCR003 | OCR | Text extraction timeout | Increase OCR timeout |
| UI001 | UI Vision | Extension not available | Install UI Vision extension |
| UI002 | UI Vision | Visual target not found | Update target images |
| UI003 | UI Vision | Macro execution failed | Check macro syntax |
| FEAT001 | Features | Feature extraction failed | Check window sticker format |
| FEAT002 | Features | Mapping confidence low | Update feature patterns |
| FEAT003 | Features | Checkbox update failed | Verify checkbox selectors |
| SYS001 | System | Browser crash | Add Chrome flags, increase memory |
| SYS002 | System | Memory exhaustion | Implement cleanup, reduce concurrency |
| SYS003 | System | File system error | Check permissions, disk space |
| NET001 | Network | Connection timeout | Check internet, increase timeout |
| NET002 | Network | Rate limiting | Reduce request frequency |
| NET003 | Network | SSL/TLS error | Update certificates, check proxy |

## Performance Optimization

### Browser Optimization

```typescript
const optimizedConfig = {
  args: [
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--disable-ipc-flooding-protection'
  ],
  ignoreDefaultArgs: ['--disable-extensions']
};
```

### Memory Management

```typescript
// Implement garbage collection
global.gc = global.gc || function() { return; };
setInterval(() => {
  global.gc();
}, 300000);  // Every 5 minutes

// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  console.log(`Memory: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
}, 60000);
```

### Concurrency Tuning

```typescript
// Optimal concurrency based on system resources
const os = require('os');
const maxConcurrency = Math.min(os.cpus().length, 4);

const limiter = pLimit(maxConcurrency);
```

### Database Optimization

```typescript
// Connection pooling
const pool = new Pool({
  host: 'localhost',
  database: 'veeotto',
  max: 20,              // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

## Support Escalation

If issues persist after following this guide:

1. **Gather Information**
   ```bash
   # System info
   npm run info:system
   
   # Configuration check
   npm run info:config
   
   # Recent logs
   tail -n 100 logs/agent.log
   ```

2. **Create Issue Report**
   - Error messages and stack traces
   - Steps to reproduce
   - Environment details
   - Screenshots if relevant

3. **Contact Support**
   - GitHub Issues: [Create Issue](https://github.com/yourusername/vee-otto/issues/new)
   - Email: support@vee-otto.ai
   - Discord: #troubleshooting channel

## Prevention Tips

1. **Regular Health Checks**
   ```bash
   # Daily health check
   npm run health:check
   
   # Monitor key metrics
   npm run metrics:collect
   ```

2. **Proactive Monitoring**
   ```typescript
   // Set up alerts
   const healthCheck = setInterval(async () => {
     const isHealthy = await checkSystemHealth();
     if (!isHealthy) {
       await sendAlert('System health check failed');
     }
   }, 300000);  // Every 5 minutes
   ```

3. **Regular Updates**
   ```bash
   # Keep dependencies updated
   npm audit
   npm update
   
   # Update browser
   npx playwright install chromium
   ```