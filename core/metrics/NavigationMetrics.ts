/**
 * Navigation Performance Metrics
 * 
 * Lightweight performance tracking for vehicle navigation without modifying core logic
 */

export interface NavigationMetric {
  vehicleIndex: number;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  navigationMethod: 'primary' | 'fallback' | 'coordinate' | 'unknown';
  errorType?: string;
  url?: string;
  timestamp: Date;
}

export interface NavigationPerformanceReport {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  successRate: number;
  avgNavigationTime: number;
  avgSuccessTime: number;
  avgFailureTime: number;
  slowestNavigations: NavigationMetric[];
  failurePatterns: { [key: string]: number };
  methodBreakdown: {
    primary: number;
    fallback: number;
    coordinate: number;
    unknown: number;
  };
  timeBreakdown: {
    navigation: number;
    tabAccess: number;
    windowSticker: number;
    checkboxUpdate: number;
    total: number;
  };
}

export class NavigationMetrics {
  private static metrics: Map<string, NavigationMetric> = new Map();
  private static timeBreakdown: Map<string, any> = new Map();

  /**
   * Record a navigation attempt
   */
  static recordNavigationAttempt(
    vehicleIndex: number, 
    startTime: number, 
    result: any
  ): void {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const key = `vehicle_${vehicleIndex}_${startTime}`;

    const metric: NavigationMetric = {
      vehicleIndex,
      startTime,
      endTime,
      duration,
      success: result.success || false,
      navigationMethod: result.navigationMethod || 'unknown',
      errorType: result.error ? result.error.split(':')[0].trim() : undefined,
      url: result.url,
      timestamp: new Date()
    };

    this.metrics.set(key, metric);
  }

  /**
   * Record time spent on specific operations
   */
  static recordOperationTime(
    vehicleIndex: number,
    operation: 'navigation' | 'tabAccess' | 'windowSticker' | 'checkboxUpdate',
    duration: number
  ): void {
    const key = `vehicle_${vehicleIndex}`;
    const existing = this.timeBreakdown.get(key) || {};
    existing[operation] = duration;
    this.timeBreakdown.set(key, existing);
  }

  /**
   * Generate performance report
   */
  static generateReport(): NavigationPerformanceReport {
    const metricsArray = Array.from(this.metrics.values());
    const successfulMetrics = metricsArray.filter(m => m.success);
    const failedMetrics = metricsArray.filter(m => !m.success);

    // Calculate averages
    const avgNavigationTime = metricsArray.length > 0
      ? metricsArray.reduce((sum, m) => sum + m.duration, 0) / metricsArray.length
      : 0;

    const avgSuccessTime = successfulMetrics.length > 0
      ? successfulMetrics.reduce((sum, m) => sum + m.duration, 0) / successfulMetrics.length
      : 0;

    const avgFailureTime = failedMetrics.length > 0
      ? failedMetrics.reduce((sum, m) => sum + m.duration, 0) / failedMetrics.length
      : 0;

    // Get slowest navigations
    const slowestNavigations = [...metricsArray]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    // Analyze failure patterns
    const failurePatterns: { [key: string]: number } = {};
    failedMetrics.forEach(m => {
      const pattern = m.errorType || 'Unknown';
      failurePatterns[pattern] = (failurePatterns[pattern] || 0) + 1;
    });

    // Method breakdown
    const methodBreakdown = {
      primary: metricsArray.filter(m => m.navigationMethod === 'primary').length,
      fallback: metricsArray.filter(m => m.navigationMethod === 'fallback').length,
      coordinate: metricsArray.filter(m => m.navigationMethod === 'coordinate').length,
      unknown: metricsArray.filter(m => m.navigationMethod === 'unknown').length
    };

    // Time breakdown (average across all vehicles)
    const timeBreakdownArray = Array.from(this.timeBreakdown.values());
    const timeBreakdown = {
      navigation: this.calculateAvgTime(timeBreakdownArray, 'navigation'),
      tabAccess: this.calculateAvgTime(timeBreakdownArray, 'tabAccess'),
      windowSticker: this.calculateAvgTime(timeBreakdownArray, 'windowSticker'),
      checkboxUpdate: this.calculateAvgTime(timeBreakdownArray, 'checkboxUpdate'),
      total: 0
    };
    timeBreakdown.total = Object.values(timeBreakdown).reduce((sum, val) => sum + val, 0);

    return {
      totalAttempts: metricsArray.length,
      successfulAttempts: successfulMetrics.length,
      failedAttempts: failedMetrics.length,
      successRate: metricsArray.length > 0 
        ? (successfulMetrics.length / metricsArray.length) * 100 
        : 0,
      avgNavigationTime,
      avgSuccessTime,
      avgFailureTime,
      slowestNavigations,
      failurePatterns,
      methodBreakdown,
      timeBreakdown
    };
  }

  /**
   * Calculate average time for an operation
   */
  private static calculateAvgTime(data: any[], operation: string): number {
    const times = data.map(d => d[operation] || 0).filter(t => t > 0);
    return times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : 0;
  }

  /**
   * Clear all metrics
   */
  static clear(): void {
    this.metrics.clear();
    this.timeBreakdown.clear();
  }

  /**
   * Export metrics as JSON
   */
  static exportMetrics(): string {
    return JSON.stringify({
      metrics: Array.from(this.metrics.entries()),
      timeBreakdown: Array.from(this.timeBreakdown.entries()),
      report: this.generateReport()
    }, null, 2);
  }

  /**
   * Get formatted report summary
   */
  static getFormattedSummary(): string {
    const report = this.generateReport();
    
    return `
Navigation Performance Summary:
==============================
Total Attempts: ${report.totalAttempts}
Success Rate: ${report.successRate.toFixed(1)}%
Avg Navigation Time: ${(report.avgNavigationTime / 1000).toFixed(2)}s
Avg Success Time: ${(report.avgSuccessTime / 1000).toFixed(2)}s
Avg Failure Time: ${(report.avgFailureTime / 1000).toFixed(2)}s

Time Breakdown (avg per vehicle):
- Navigation: ${(report.timeBreakdown.navigation / 1000).toFixed(2)}s
- Tab Access: ${(report.timeBreakdown.tabAccess / 1000).toFixed(2)}s
- Window Sticker: ${(report.timeBreakdown.windowSticker / 1000).toFixed(2)}s
- Checkbox Update: ${(report.timeBreakdown.checkboxUpdate / 1000).toFixed(2)}s
- Total: ${(report.timeBreakdown.total / 1000).toFixed(2)}s

Navigation Methods Used:
- Primary: ${report.methodBreakdown.primary}
- Fallback: ${report.methodBreakdown.fallback}
- Coordinate: ${report.methodBreakdown.coordinate}

Top Failure Patterns:
${Object.entries(report.failurePatterns)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 3)
  .map(([pattern, count]) => `- ${pattern}: ${count}`)
  .join('\n')}
    `.trim();
  }
}
