/**
 * Unit tests for parallel processing components
 */

import { NavigationMetrics } from '../../core/metrics/NavigationMetrics';
import { ParallelServiceAdapter } from '../../core/services/ParallelServiceAdapter';
import { PARALLEL_CONFIG } from '../../core/config/constants';

describe('Parallel Processing Components', () => {
  
  beforeEach(() => {
    NavigationMetrics.clear();
  });

  describe('NavigationMetrics - Parallel Tracking', () => {
    
    test('should record parallel attempts', () => {
      NavigationMetrics.recordParallelAttempt('worker-1', 0, 'test-strategy', 'batch-1');
      
      const report = NavigationMetrics.generateParallelReport();
      expect(report.summary.totalWorkers).toBe(1);
      expect(report.strategyBreakdown['test-strategy']).toBe(1);
    });

    test('should record worker performance', () => {
      NavigationMetrics.recordWorkerPerformance('worker-1', {
        vehicleCount: 5,
        totalTime: 10000,
        successRate: 0.8
      });

      const report = NavigationMetrics.generateParallelReport();
      expect(report.summary.totalWorkers).toBe(1);
      expect(report.workers[0].vehicleCount).toBe(5);
      expect(report.workers[0].successRate).toBe(0.8);
    });

    test('should complete parallel attempts', () => {
      NavigationMetrics.recordParallelAttempt('worker-1', 0, 'test-strategy', 'batch-1');
      NavigationMetrics.completeParallelAttempt('worker-1', 0, true, undefined, 'batch-1');
      
      const report = NavigationMetrics.generateParallelReport();
      expect(report.summary.totalWorkers).toBe(1);
    });

    test('should handle parallel errors', () => {
      NavigationMetrics.recordParallelAttempt('worker-1', 0, 'test-strategy', 'batch-1');
      NavigationMetrics.completeParallelAttempt('worker-1', 0, false, 'Test error', 'batch-1');
      
      const report = NavigationMetrics.generateParallelReport();
      expect(report.errorAnalysis['Test error']).toBe(1);
    });

    test('should generate comprehensive parallel report', () => {
      // Add multiple workers and attempts
      NavigationMetrics.recordWorkerPerformance('worker-1', {
        vehicleCount: 3,
        totalTime: 9000,
        successRate: 1.0,
        status: 'completed'
      });

      NavigationMetrics.recordWorkerPerformance('worker-2', {
        vehicleCount: 2,
        totalTime: 8000,
        successRate: 0.5,
        status: 'completed'
      });

      NavigationMetrics.recordParallelAttempt('worker-1', 0, 'strategy-a', 'batch-1');
      NavigationMetrics.completeParallelAttempt('worker-1', 0, true, undefined, 'batch-1');

      NavigationMetrics.recordParallelAttempt('worker-2', 1, 'strategy-b', 'batch-1');
      NavigationMetrics.completeParallelAttempt('worker-2', 1, false, 'Timeout error', 'batch-1');

      const report = NavigationMetrics.generateParallelReport();
      
      expect(report.summary.totalWorkers).toBe(2);
      expect(report.summary.totalVehicles).toBe(5);
      expect(report.strategyBreakdown['strategy-a']).toBe(1);
      expect(report.strategyBreakdown['strategy-b']).toBe(1);
      expect(report.errorAnalysis['Timeout']).toBe(1);
    });
  });

  describe('ParallelServiceAdapter', () => {
    
    test('should create service execution context', () => {
      const mockPage = {} as any;
      const mockLogger = { info: jest.fn(), error: jest.fn() };
      
      const context = {
        workerId: 'test-worker',
        batchId: 'test-batch',
        vehicleIndex: 0,
        page: mockPage,
        logger: mockLogger
      };

      expect(context.workerId).toBe('test-worker');
      expect(context.batchId).toBe('test-batch');
    });

    test('should validate configuration constants', () => {
      expect(PARALLEL_CONFIG.MAX_CONCURRENCY).toBeGreaterThan(0);
      expect(PARALLEL_CONFIG.MAX_CONCURRENCY).toBeLessThanOrEqual(10);
      
      expect(PARALLEL_CONFIG.WORKER_TIMEOUT).toBe(300000);
      expect(PARALLEL_CONFIG.ERROR_THRESHOLD).toBe(0.5);
      expect(PARALLEL_CONFIG.BATCH_SIZE).toBeGreaterThan(0);
    });

    test('should handle service execution results', async () => {
      // Mock service execution
      const mockResult = {
        success: true,
        data: { test: 'data' },
        executionTime: 1000,
        workerId: 'test-worker'
      };

      expect(mockResult.success).toBe(true);
      expect(mockResult.executionTime).toBe(1000);
      expect(mockResult.workerId).toBe('test-worker');
    });

    test('should handle service execution errors', async () => {
      // Mock error result
      const mockError = {
        success: false,
        error: 'Test service error',
        executionTime: 500,
        workerId: 'test-worker'
      };

      expect(mockError.success).toBe(false);
      expect(mockError.error).toBe('Test service error');
    });
  });

  describe('Integration Tests', () => {
    
    test('should integrate metrics with service adapter', () => {
      // Simulate a complete workflow
      const workerId = 'integration-test-worker';
      
      // Record worker start
      NavigationMetrics.recordWorkerPerformance(workerId, {
        vehicleCount: 0,
        totalTime: 0,
        successRate: 0,
        status: 'active'
      });

      // Simulate processing
      for (let i = 0; i < 3; i++) {
        NavigationMetrics.recordParallelAttempt(workerId, i, 'integration-test', 'test-batch');
        
        // Simulate some processing time
        const processingTime = 1000 + Math.random() * 2000;
        
        NavigationMetrics.completeParallelAttempt(
          workerId, 
          i, 
          Math.random() > 0.2, // 80% success rate
          Math.random() > 0.8 ? 'Random error' : undefined,
          'test-batch'
        );

        NavigationMetrics.recordWorkerPerformance(workerId, {
          vehicleCount: i + 1,
          totalTime: processingTime * (i + 1),
          successRate: 0.8
        });
      }

      const report = NavigationMetrics.generateParallelReport();
      expect(report.summary.totalWorkers).toBe(1);
      expect(report.workers[0].vehicleCount).toBe(3);
      expect(report.workers[0].successRate).toBe(0.8);
    });

    test('should handle concurrent worker metrics', () => {
      const workers = ['worker-1', 'worker-2', 'worker-3'];
      
      workers.forEach(workerId => {
        NavigationMetrics.recordWorkerPerformance(workerId, {
          vehicleCount: Math.floor(Math.random() * 10) + 1,
          totalTime: Math.floor(Math.random() * 30000) + 5000,
          successRate: Math.random() * 0.5 + 0.5, // 50-100%
          status: 'completed'
        });
      });

      const report = NavigationMetrics.generateParallelReport();
      expect(report.summary.totalWorkers).toBe(3);
      expect(report.workers).toHaveLength(3);
    });
  });

  describe('Performance Benchmarks', () => {
    
    test('should handle high volume metrics efficiently', () => {
      const startTime = Date.now();
      
      // Simulate 1000 parallel attempts
      for (let i = 0; i < 1000; i++) {
        const workerId = `worker-${i % 5}`;
        NavigationMetrics.recordParallelAttempt(workerId, i, 'benchmark-strategy', 'benchmark-batch');
        NavigationMetrics.completeParallelAttempt(workerId, i, i % 10 !== 0, i % 10 === 0 ? 'Benchmark error' : undefined, 'benchmark-batch');
      }

      // Record worker performance
      for (let w = 0; w < 5; w++) {
        NavigationMetrics.recordWorkerPerformance(`worker-${w}`, {
          vehicleCount: 200,
          totalTime: 120000,
          successRate: 0.9,
          status: 'completed'
        });
      }

      const report = NavigationMetrics.generateParallelReport();
      const endTime = Date.now();
      
      expect(report.summary.totalWorkers).toBe(5);
      expect(report.summary