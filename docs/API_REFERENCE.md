# Vee Otto API Reference

## Table of Contents

1. [Core Classes](#core-classes)
2. [Automation Agents](#automation-agents)
3. [Services](#services)
4. [Utilities](#utilities)
5. [Types & Interfaces](#types--interfaces)
6. [Event System](#event-system)
7. [REST API Endpoints](#rest-api-endpoints)
8. [WebSocket Events](#websocket-events)

## Core Classes

### BaseAutomationAgent

Base class for all automation agents providing core browser automation functionality.

```typescript
class BaseAutomationAgent {
  constructor(config?: AgentConfig)
  
  // Lifecycle methods
  async initialize(): Promise<void>
  async cleanup(): Promise<void>
  async execute(task: () => Promise<void>): Promise<void>
  
  // Navigation & interaction
  async login(loginConfig: LoginConfig): Promise<boolean>
  async handle2FA(twoFactorConfig: TwoFactorConfig): Promise<boolean>
  async navigateTo(url: string): Promise<void>
  async click(selector: string): Promise<void>
  async fill(selector: string, value: string): Promise<void>
  async getText(selector: string): Promise<string>
  async waitForSelector(selector: string, options?: any): Promise<void>
  async takeScreenshot(name: string): Promise<string>
}
```

#### Configuration

```typescript
interface AgentConfig {
  headless?: boolean              // Run browser in headless mode (default: false)
  slowMo?: number                // Slow down operations by ms (default: 100)
  timeout?: number               // Default timeout in ms (default: 30000)
  screenshotOnError?: boolean    // Take screenshot on error (default: true)
  notificationsEnabled?: boolean // Enable notifications (default: false)
}
```

### HybridAutomationAgent

Enhanced agent with UI Vision and OCR fallback capabilities.

```typescript
class HybridAutomationAgent extends BaseAutomationAgent {
  constructor(config?: HybridAgentConfig)
  
  // Enhanced methods with fallbacks
  async hybridLogin(loginConfig: LoginConfig & { visualTargets?: VisualTargets }): Promise<boolean>
  async updateCheckboxes(selectors: string[], values: boolean[], options?: CheckboxOptions): Promise<CheckboxResult>
  async scrapeWindowSticker(stickerLinkSelector: string, options?: ScrapeOptions): Promise<string | null>
  async findElementByFuzzyText(searchText: string, elementType?: string): Promise<any>
  
  // Metrics
  getMetrics(): MetricsData
  resetMetrics(): void
}
```

#### Configuration

```typescript
interface HybridAgentConfig extends AgentConfig {
  enableUIVision?: boolean       // Enable UI Vision fallback (default: true)
  enableOCR?: boolean           // Enable OCR fallback (default: true)
  reliabilitySettings?: {
    defaultRetries?: number     // Number of retries (default: 3)
    stabilityChecks?: boolean   // Check element stability (default: true)
    fuzzyMatching?: boolean     // Enable fuzzy text matching (default: true)
  }
  rateLimiting?: RateLimitConfig
  enableMetrics?: boolean       // Track performance metrics (default: true)
  vAutoConfig?: VAutoConfig     // vAuto-specific configuration
}
```

### VAutoAgent

Specialized agent for vAuto inventory processing.

```typescript
class VAutoAgent extends HybridAutomationAgent {
  constructor(config?: VAutoConfig)
  
  // Core workflow methods
  async login(): Promise<boolean>
  async selectDealership(dealershipId?: string): Promise<boolean>
  async navigateToInventory(): Promise<boolean>
  async filterInventory(criteria: FilterCriteria): Promise<boolean>
  async processInventory(options?: ProcessOptions): Promise<ProcessResult>
  async processVehicle(vin: string, vehicleData?: any): Promise<VehicleResult>
  
  // Feature extraction
  async extractWindowStickerFeatures(vehicle: any): Promise<ExtractedFeatures>
  async mapFeaturesToCheckboxes(features: string[]): Promise<FeatureMapping[]>
  async updateFeatureCheckboxes(mappings: FeatureMapping[]): Promise<boolean>
  
  // Reporting
  async generateReport(results: ProcessResult[]): Promise<Report>
  async sendNotifications(report: Report): Promise<void>
}
```

## Services

### OCRService

Optical Character Recognition service using Tesseract.js.

```typescript
class OCRService {
  constructor(config?: OCRConfig)
  
  async initialize(): Promise<void>
  async extractText(imagePath: string): Promise<OCRResult>
  async extractFromScreenshot(buffer: Buffer, options?: ExtractOptions): Promise<OCRResult>
  async findTextInImage(imagePath: string, searchText: string, options?: FindOptions): Promise<FindResult>
  async terminate(): Promise<void>
}

interface OCRResult {
  text: string
  confidence: number
  words?: Array<{
    text: string
    confidence: number
    bbox: BoundingBox
  }>
}
```

### UIVisionService

Visual automation service for image-based interactions.

```typescript
class UIVisionService {
  constructor(config?: UIVisionConfig)
  
  async createMacro(name: string, commands: UIVisionCommand[]): Promise<string>
  async runMacro(macroName: string): Promise<boolean>
  async visualClick(imageTarget: string, confidence?: number): Promise<boolean>
  async visualType(imageTarget: string, text: string): Promise<boolean>
  async captureScreenshot(filename: string): Promise<string>
  async waitForImage(imageTarget: string, timeout?: number): Promise<boolean>
  getBrowserArgs(): string[]
  async createVAutoMacros(): Promise<void>
}
```

### VAutoScheduler

Cron-based scheduling service for automated runs.

```typescript
class VAutoScheduler {
  constructor(config?: SchedulerConfig)
  
  start(): void
  stop(): void
  scheduleRun(cronExpression: string, task: () => Promise<void>): string
  cancelSchedule(scheduleId: string): boolean
  getNextRunTime(): Date | null
  getScheduleStatus(): ScheduleStatus
}

interface SchedulerConfig {
  timezone?: string              // Timezone for scheduling (default: 'America/New_York')
  runTimes?: string[]           // Cron expressions (default: ['0 7 * * *', '0 14 * * *'])
  enableNotifications?: boolean  // Send notifications (default: true)
}
```

### NotificationService

Multi-channel notification service.

```typescript
class NotificationService {
  constructor()
  
  async sendSuccessNotification(result: ExtractionResult): Promise<void>
  async sendFailureNotification(result: ExtractionResult): Promise<void>
  async sendHealthAlert(status: string, details: string): Promise<void>
  async sendError(message: string, error: unknown): Promise<void>
}
```

## Utilities

### browserUtils

Browser automation utility functions.

```typescript
// Launch browser with configuration
async function launchBrowser(config?: BrowserConfig): Promise<BrowserInstance>

// Element interaction with retries
async function reliableClick(page: Page, selector: string, options?: ClickOptions): Promise<void>
async function hybridClick(page: Page, selector: string, options?: HybridOptions): Promise<boolean>
async function hybridGetText(page: Page, selector: string, options?: TextOptions): Promise<string | null>
async function hybridSetCheckbox(page: Page, selector: string, checked: boolean, options?: CheckboxOptions): Promise<boolean>

// Content extraction
async function scrapeInlineContent(page: Page, containerSelector: string, options?: ScrapeOptions): Promise<string>
async function handleDownload(page: Page, clickSelector: string, options?: DownloadOptions): Promise<string | null>

// Utilities
async function waitForLoadingToComplete(page: Page, loadingSelectors: string[], options?: WaitOptions): Promise<void>
async function takeScreenshot(page: Page, name: string, options?: ScreenshotOptions): Promise<string>
function initializeUIVision(config?: any): UIVisionService
```

### reliabilityUtils

Reliability enhancement utilities.

```typescript
// Retry logic
async function withRetry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>

// Fuzzy matching
function fuzzyMatch(target: string, candidates: string[], threshold?: number): string | null
function findBestMatch(searchText: string, options: string[], threshold?: number): MatchResult

// Verification
async function verifySuccess(verificationFns: Array<() => Promise<boolean>>, options?: VerifyOptions): Promise<boolean>
async function waitWithBackoff(checkFn: () => Promise<boolean>, options?: BackoffOptions): Promise<boolean>
async function waitForElementStability(getElementFn: () => Promise<Position | null>, options?: StabilityOptions): Promise<boolean>
```

### featureMapping

Feature extraction and mapping utilities.

```typescript
// Feature extraction
function extractFeaturesFromText(text: string): string[]
function normalizeFeatureName(feature: string): string
function parsePackageFeatures(packageName: string): string[]

// Mapping
function mapFeatureToCheckbox(feature: string, checkboxLabels: string[]): FeatureMapping | null
function calculateFeatureValue(feature: string): number
function prioritizeFeatures(features: string[]): string[]

// Validation
function validateFeatureMapping(mapping: FeatureMapping): boolean
function getUnmappedFeatures(features: string[], mappings: FeatureMapping[]): string[]
```

## Types & Interfaces

### Core Types

```typescript
interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

interface VisualTargets {
  username?: string
  password?: string
  submit?: string
  [key: string]: string | undefined
}

interface MetricsData {
  totalOperations: number
  playwrightSuccesses: number
  uiVisionFallbacks: number
  ocrFallbacks: number
  failures: number
  avgResponseTime: number
  fallbackPercentage: number
}

interface ProcessResult {
  totalVehicles: number
  processed: number
  failed: number
  skipped: number
  errors: Array<{ vin: string; error: string }>
  duration: number
}

interface VehicleResult {
  vin: string
  success: boolean
  features?: string[]
  mappings?: FeatureMapping[]
  errors?: string[]
  duration: number
  confidence: number
}
```

### Feature Types

```typescript
interface Feature {
  name: string
  category: string
  value?: number
  confidence: number
}

interface FeatureMapping {
  featureName: string
  checkboxLabel: string
  checked: boolean
  confidence: number
  value?: number
}

interface ExtractedFeatures {
  raw: string[]
  normalized: string[]
  packages: Record<string, string[]>
  priority: string[]
  unmapped: string[]
}
```

## Event System

### Agent Events

```typescript
// Vehicle processing events
agent.on('vehicle:start', (data: { vin: string }) => void)
agent.on('vehicle:processed', (data: VehicleResult) => void)
agent.on('vehicle:failed', (data: { vin: string; error: Error }) => void)

// Feature events
agent.on('features:extracted', (data: { vin: string; features: string[] }) => void)
agent.on('features:mapped', (data: { vin: string; mappings: FeatureMapping[] }) => void)

// System events
agent.on('error', (error: Error) => void)
agent.on('warning', (warning: { message: string; details?: any }) => void)
agent.on('metrics:updated', (metrics: MetricsData) => void)
```

## REST API Endpoints

### Dashboard API

```typescript
// Metrics
GET /api/metrics
Response: {
  noPricePending: number
  timeSaved: number
  valueProtected: number
}

// Action Queue
GET /api/action-queue
Query: { limit?: number; offset?: number }
Response: {
  items: ActionItem[]
  total: number
}

POST /api/action-queue/process
Body: { vehicleIds?: string[] }
Response: { success: boolean; processed: number }

// Recent Completions
GET /api/recent-completions
Query: { limit?: number }
Response: VehicleResult[]

// Performance Data
GET /api/performance
Query: { days?: number }
Response: PerformanceData[]
```

### Automation Control

```typescript
// Start/stop automation
POST /api/automation/start
Body: { mode?: 'once' | 'scheduled' }

POST /api/automation/stop

GET /api/automation/status
Response: {
  running: boolean
  mode: string
  nextRun?: Date
  metrics: MetricsData
}

// Manual vehicle processing
POST /api/vehicles/:vin/process
Response: VehicleResult
```

## WebSocket Events

### Client to Server

```typescript
// Subscribe to updates
socket.emit('subscribe', { channels: ['metrics', 'queue', 'completions'] })

// Request specific data
socket.emit('request:metrics')
socket.emit('request:queue', { limit: 10 })
socket.emit('request:performance', { days: 7 })
```

### Server to Client

```typescript
// Real-time updates
socket.on('metrics:update', (data: MetricsData) => void)
socket.on('queue:update', (data: { items: ActionItem[]; total: number }) => void)
socket.on('completion:new', (data: VehicleResult) => void)

// System events
socket.on('system:status', (data: { operational: boolean; message?: string }) => void)
socket.on('system:error', (data: { error: string; details?: any }) => void)
```

## Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| AUTH001 | Login failed | Check credentials |
| AUTH002 | 2FA required | Configure 2FA handler |
| NAV001 | Element not found | Update selectors |
| NAV002 | Navigation timeout | Increase timeout |
| OCR001 | OCR initialization failed | Check Tesseract installation |
| OCR002 | Low confidence result | Improve image quality |
| UI001 | UI Vision not available | Install extension |
| API001 | Rate limit exceeded | Reduce request frequency |
| SYS001 | Browser crash | Restart automation |

## Examples

### Basic Vehicle Processing

```typescript
const agent = new VAutoAgent({
  headless: false,
  enableMetrics: true
});

await agent.initialize();
await agent.login();

const result = await agent.processVehicle('1HGCM82633A123456');
console.log(`Processed in ${result.duration}ms with ${result.features?.length} features`);

await agent.cleanup();
```

### Advanced Processing with Events

```typescript
const agent = new HybridAutomationAgent({
  enableUIVision: true,
  enableOCR: true,
  reliabilitySettings: {
    defaultRetries: 5,
    fuzzyMatching: true
  }
});

agent.on('vehicle:processed', (result) => {
  console.log(`✅ ${result.vin}: ${result.features?.length} features mapped`);
});

agent.on('metrics:updated', (metrics) => {
  console.log(`Fallback usage: ${metrics.fallbackPercentage.toFixed(2)}%`);
});

await agent.execute(async () => {
  // Your automation logic here
});
```