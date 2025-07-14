import { Logger } from './Logger';

/**
 * Enhanced logger with emoji support and structured logging patterns
 * This is a zero-risk addition that enhances logging without modifying existing code
 */
export class EnhancedLogger extends Logger {
  // Emoji constants for consistent visual parsing
  private static readonly EMOJIS = {
    search: '🔍',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    target: '🎯',
    list: '📋',
    info: '📝',
    folder: '📂',
    time: '⏱️',
    robot: '🤖',
    vehicle: '🚗',
    filter: '🎨',
    save: '💾',
    click: '👆',
    wait: '⏳',
    navigation: '🧭',
    iframe: '🖼️',
    window: '🪟',
    feature: '✨',
    checkbox: '☑️',
    report: '📊',
    debug: '🐛'
  };

  private enhancedContext: string;

  constructor(context: string) {
    super(context);
    this.enhancedContext = context;
  }

  /**
   * Log with emoji prefix for better visual parsing
   */
  logWithEmoji(emoji: keyof typeof EnhancedLogger.EMOJIS, message: string, meta?: any): void {
    const emojiChar = EnhancedLogger.EMOJIS[emoji] || '';
    this.info(`${emojiChar} ${message}`, meta);
  }

  /**
   * Log search/discovery operations
   */
  logSearch(message: string, meta?: any): void {
    this.logWithEmoji('search', message, meta);
  }

  /**
   * Log successful operations
   */
  logSuccess(message: string, meta?: any): void {
    this.logWithEmoji('success', message, meta);
  }

  /**
   * Log targeting/selection operations
   */
  logTarget(message: string, meta?: any): void {
    this.logWithEmoji('target', message, meta);
  }

  /**
   * Log list/enumeration operations
   */
  logList(message: string, meta?: any): void {
    this.logWithEmoji('list', message, meta);
  }

  /**
   * Log element details with structured data
   */
  logElement(description: string, element: {
    selector?: string;
    text?: string;
    visible?: boolean;
    count?: number;
    attributes?: Record<string, any>;
  }): void {
    this.logList(description, {
      selector: element.selector,
      text: element.text,
      visible: element.visible,
      count: element.count,
      attributes: element.attributes
    });
  }

  /**
   * Log dropdown items with detailed information
   */
  logDropdownItems(items: Array<{ index: number; text: string; visible?: boolean }>): void {
    this.logList(`Found ${items.length} dropdown items total`);
    items.forEach(item => {
      this.logList(`Dropdown item ${item.index}: visible=${item.visible !== false}, text="${item.text}"`);
    });
  }

  /**
   * Log smart dropdown selection logic
   */
  logSmartDropdownSelection(
    allItems: Array<{ text: string; index: number }>,
    safeItems: Array<{ text: string; index: number }>,
    selectedItem: { text: string; index: number }
  ): void {
    this.logTarget('Using smart dropdown selection to avoid menu conflicts...');
    this.info(`Found ${safeItems.length} safe dropdown items (excluding Manage Filters)`);
    safeItems.forEach((item, idx) => {
      this.info(`  ${idx + 1}. "${item.text}"`);
    });
    this.logTarget(`Targeting dropdown item: "${selectedItem.text}" at index ${selectedItem.index}`);
  }

  /**
   * Log vehicle processing with structured data
   */
  logVehicleProcessing(vehicleData: {
    id?: string;
    index?: number;
    total?: number;
    vin?: string;
    status?: string;
  }): void {
    const parts = [];
    if (vehicleData.index && vehicleData.total) {
      parts.push(`[${vehicleData.index}/${vehicleData.total}]`);
    }
    if (vehicleData.id) {
      parts.push(`ID: ${vehicleData.id}`);
    }
    if (vehicleData.vin) {
      parts.push(`VIN: ${vehicleData.vin}`);
    }
    if (vehicleData.status) {
      parts.push(`Status: ${vehicleData.status}`);
    }
    
    this.logWithEmoji('vehicle', `Processing vehicle ${parts.join(', ')}`);
  }

  /**
   * Log timing information
   */
  logTiming(operation: string, durationMs: number): void {
    this.logWithEmoji('time', `${operation} completed in ${durationMs}ms`);
  }

  /**
   * Log filter operations
   */
  logFilter(message: string, filterData?: {
    filterName?: string;
    vehicleCount?: number;
    criteria?: Record<string, any>;
  }): void {
    this.logWithEmoji('filter', message, filterData);
  }

  /**
   * Create a child logger with additional context
   */
  createChildLogger(additionalContext: string): EnhancedLogger {
    return new EnhancedLogger(`${this.enhancedContext}-${additionalContext}`);
  }
}

/**
 * Factory function to create enhanced logger instances
 */
export function createEnhancedLogger(context: string): EnhancedLogger {
  return new EnhancedLogger(context);
} 