/**
 * Centralized configuration constants for VeeOtto system
 * All timeout values, limits, URLs, and other magic numbers should be defined here
 */

export const TIMEOUTS = {
  // Authentication & Login timeouts
  LOGIN: 60000,              // 1 minute for login operations
  TWO_FACTOR: 300000,        // 5 minutes for 2FA operations
  CODE_EXPIRATION: 5 * 60 * 1000, // 5 minutes for 2FA code expiration
  
  // Page interaction timeouts
  PAGE_LOAD: 5000,           // 5 seconds for page loads
  NAVIGATION: 3000,          // 3 seconds for navigation actions
  ELEMENT_WAIT: 2000,        // 2 seconds for element visibility
  ACTION_DELAY: 1000,        // 1 second delay between actions
  SCREENSHOT_DELAY: 500,     // 500ms delay before screenshots
  
  // Retry timeouts
  RETRY_DELAY: 1000,         // 1 second between retries
  CHECKBOX_CHECK: 100,       // 100ms for checkbox state checks
  
  // Network timeouts
  NETWORK_IDLE: 'networkidle' as const,
  DOM_CONTENT_LOADED: 'domcontentloaded' as const,
};

export const LIMITS = {
  // Vehicle processing limits
  MAX_VEHICLES_DEFAULT: 10,     // Default max vehicles to process
  MAX_VEHICLES_BATCH: 25,       // Maximum vehicles in a single batch
  
  // Checkbox and feature limits
  MAX_CHECKBOX_TEST: 5,         // Max checkboxes to test
  MAX_FEATURES_DISPLAY: 5,      // Max features to display in logs
  
  // Text processing limits
  SCREENSHOT_TEXT_TRUNCATE: 1000, // Max characters for screenshot text
  LOG_MESSAGE_TRUNCATE: 500,      // Max characters for log messages
  
  // Retry limits
  MAX_RETRIES: 3,               // Default max retry attempts
  MAX_LOGIN_ATTEMPTS: 3,        // Max login retry attempts
};

export const URLS = {
  // API endpoints
  DEFAULT_WEBHOOK: '/api/2fa/latest',
  DEFAULT_FRONTEND: process.env.FRONTEND_URL || 'http://localhost:8080',
  DEFAULT_BACKEND: process.env.PUBLIC_URL || 'http://localhost:3000',
  
  // vAuto specific URLs
  VAUTO_BASE: 'https://www.vauto.com',
  VAUTO_LOGIN: 'https://www.vauto.com/login',
};

export const SELECTORS = {
  // Common UI patterns
  MENU_TOGGLE_PATTERNS: [
    '//button[contains(@class, "menu") or contains(@class, "toggle")]',
    '//a[contains(@class, "dropdown") or contains(@class, "menu")]',
    '//div[@role="button" and contains(@class, "menu")]'
  ],
  
  TAB_PATTERNS: [
    '//div[contains(@class, "tab") and .//text()[contains(., "Factory Equipment")]]',
    '//button[contains(@class, "tab") and contains(text(), "Factory Equipment")]',
    '//a[contains(@class, "tab") and contains(text(), "Factory Equipment")]'
  ],
  
  VEHICLE_LINK_PATTERNS: [
    '//tr[contains(@class, "x-grid3-row")]//td[position()=1 or position()=2]//a',
    '//tbody//tr//td[position()<=2]//a[string-length(text()) > 0]'
  ],
};

export const METRICS = {
  // Performance thresholds
  TARGET_VEHICLE_PROCESS_TIME: 30000,  // 30 seconds target per vehicle
  WARNING_PROCESS_TIME: 60000,         // 1 minute warning threshold
  ERROR_PROCESS_TIME: 120000,          // 2 minute error threshold
  
  // Success rate thresholds
  MIN_SUCCESS_RATE: 0.95,              // 95% minimum success rate
  WARNING_SUCCESS_RATE: 0.90,          // 90% warning threshold
};

export const STORAGE = {
  // JWT and session
  JWT_TOKEN_EXPIRY: '24h',
  SESSION_TIMEOUT: 30 * 60 * 1000,     // 30 minutes
  
  // Cache settings
  CACHE_TTL: 15 * 60 * 1000,           // 15 minutes cache TTL
  MAX_CACHE_SIZE: 100,                 // Max items in cache
};

export const LOGGING = {
  // Log levels
  DEFAULT_LEVEL: process.env.LOG_LEVEL || 'info',
  FILE_PATH: 'logs/server.log',
  
  // Log rotation
  MAX_FILE_SIZE: '10m',
  MAX_FILES: 5,
};