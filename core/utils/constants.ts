/**
 * Shared Constants
 * Centralizes hardcoded values from across the codebase
 */

export const TIMEOUTS = {
  DEFAULT: 5000,
  SHORT: 2000,
  MEDIUM: 10000,
  LONG: 30000,
  NAVIGATION: 60000,
} as const;

export const RETRY_CONFIG = {
  DEFAULT_RETRIES: 3,
  DEFAULT_MIN_TIMEOUT: 1000,
  DEFAULT_MAX_TIMEOUT: 10000,
  DEFAULT_FACTOR: 2,
} as const;

export const PORTS = {
  DEFAULT_SERVER: 3000,
  DEFAULT_FRONTEND: 8080,
  DEFAULT_WEBHOOK: 3001,
} as const;

export const URLS = {
  LOCAL_SERVER: `http://localhost:${PORTS.DEFAULT_SERVER}`,
  LOCAL_FRONTEND: `http://localhost:${PORTS.DEFAULT_FRONTEND}`,
} as const;

export const PATHS = {
  SCREENSHOTS: 'screenshots',
  LOGS: 'logs',
  REPORTS: 'reports',
  CONFIG: 'config',
  TEMP: 'temp',
} as const;

export const BROWSER_CONFIG = {
  DEFAULT_VIEWPORT: { width: 1920, height: 1080 },
  HEADLESS: process.env.HEADLESS === 'true',
  SLOW_MO: process.env.DEBUG_MODE === 'true' ? 500 : 0,
} as const;

export const LOG_CONFIG = {
  MAX_SIZE: '10m',
  MAX_FILES: '7d',
  DATE_PATTERN: 'YYYY-MM-DD',
} as const;
