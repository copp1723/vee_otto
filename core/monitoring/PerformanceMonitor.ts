export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage?: NodeJS.MemoryUsage;
  operationName: string;
}

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();

  startOperation(operationName: string): void {
    this.metrics.set(operationName, {
      startTime: Date.now(),
      operationName,
      memoryUsage: process.memoryUsage()
    });
  }

  endOperation(operationName: string): PerformanceMetrics | null {
    const metric = this.metrics.get(operationName);
    if (!metric) return null;

    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;
    
    return metric;
  }

  getMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.values());
  }

  clear(): void {
    this.metrics.clear();
  }
}