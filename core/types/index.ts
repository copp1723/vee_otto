// Core Types for Vinny Agent System

export interface PlatformCredentials {
  username: string;
  password: string;
  url: string;
  additionalFields?: Record<string, string>;
}

export interface ReportRequest {
  reportName: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'custom';
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  outputFormat: 'csv' | 'pdf' | 'xlsx' | 'json';
  outputPath: string;
}

export interface ExtractionResult {
  success: boolean;
  reportName: string;
  filePath?: string;
  data?: any;
  metadata: {
    extractedAt: string;
    platform: string;
    fileSize?: number;
    recordCount?: number;
  };
  error?: string;
  attempt: number;
  executionTime: number;
}

export interface AgentConfig {
  headless: boolean;
  timeout: number;
  maxRetries: number;
  screenshotOnError: boolean;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
}

export interface PlatformAdapter {
  platformName: string;
  login(credentials: PlatformCredentials): Promise<boolean>;
  navigateToReports(): Promise<boolean>;
  extractReport(request: ReportRequest): Promise<ExtractionResult>;
  logout(): Promise<void>;
  isLoggedIn(): Promise<boolean>;
}

export interface PerceptionResult {
  markdown: string;
  elements: PerceptionElement[];
  actions: PerceptionAction[];
}

export interface PerceptionElement {
  id: string;
  type: 'button' | 'link' | 'input' | 'select' | 'text';
  description: string;
  selector?: string;
  coordinates?: {
    x: number;
    y: number;
  };
  confidence: number;
}

export interface PerceptionAction {
  id: string;
  description: string;
  type: 'click' | 'input' | 'select' | 'navigate';
  target: string;
  confidence: number;
}

export interface VisionResult {
  success: boolean;
  element?: {
    xpath: string;
    coordinates: {
      x: number;
      y: number;
    };
    confidence: number;
  };
  error?: string;
}

export interface ScheduleConfig {
  enabled: boolean;
  cronExpression: string;
  reportRequests: ReportRequest[];
  notifications: {
    email?: string;
    webhook?: string;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  checks: {
    browser: boolean;
    platform: boolean;
    storage: boolean;
    network: boolean;
  };
  lastSuccessfulExtraction?: string;
  errors?: string[];
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: Record<string, any>;
  platform?: string;
  reportName?: string;
}

// Enums
export enum PlatformType {
  VAUTO = 'vauto',
  SALESFORCE = 'salesforce',
  HUBSPOT = 'hubspot',
  GENERIC = 'generic'
}

export enum ReportStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

export enum AgentCapability {
  PERCEPTION = 'perception',
  VISION = 'vision',
  DOWNLOAD = 'download',
  SCREENSHOT = 'screenshot',
  FORM_FILLING = 'form_filling',
  NAVIGATION = 'navigation'
}


// Consolidated retry options
export interface RetryOptions {
  retries?: number;
  minTimeout?: number;
  maxTimeout?: number;
  factor?: number;
  onFailedAttempt?: (error: Error, attempt: number) => void;
}

// Consolidated browser configuration
export interface BrowserConfig {
  headless?: boolean;
  viewport?: { width: number; height: number };
  timeout?: number;
  slowMo?: number;
  args?: string[];
}

// Consolidated automation options
export interface AutomationOptions {
  timeout?: number;
  waitForStable?: boolean;
  screenshotOnFailure?: boolean;
  retries?: number;
}

// Consolidated element selector
export interface ElementSelector {
  selector: string;
  text?: string;
  index?: number;
  visible?: boolean;
}

// Dashboard Data Models
export interface DashboardMetrics {
  noPricePending: {
    current: number;
    total: number;
    percentageReduction: number;
  };
  timeSaved: {
    hours: number;
    formatted: string;
  };
  valueProtected: {
    amount: number;
    formatted: string;
  };
}

export interface ActionQueueItem {
  id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  issueType: 'NO_STICKER' | 'LOW_CONFIDENCE' | 'MISSING_DATA';
  issueDescription: string;
  estimatedTime: number;
}

export interface RecentCompletion {
  id: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  completedAt: string;
  timeSaved: number;
  valueProtected: number;
  outcome: string;
}

export interface PerformanceData {
  date: string;
  vehiclesProcessed: number;
  timeSaved: number;
  valueProtected: number;
}

export interface SystemStatus {
  operational: boolean;
  lastUpdate: string;
  activeAgents: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: string;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'METRICS_UPDATE' | 'QUEUE_UPDATE' | 'COMPLETION_UPDATE' | 'STATUS_UPDATE';
  payload: any;
  timestamp: string;
}

// Component Props Types
export interface MetricTileProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  loading?: boolean;
}

export interface ActionQueueProps {
  items: ActionQueueItem[];
  onProcessAll: () => void;
  onViewAll: () => void;
  loading?: boolean;
}

export interface RecentCompletionsProps {
  completions: RecentCompletion[];
  loading?: boolean;
}

export interface PerformanceChartProps {
  data: PerformanceData[];
  loading?: boolean;
}
