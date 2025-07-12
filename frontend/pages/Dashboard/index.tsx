import React, { useState, useEffect, useCallback } from 'react';
import MetricTile from './components/MetricTile';
import ActionQueue from './components/ActionQueue';
import RecentCompletions from './components/RecentCompletions';
import PerformanceChart from './components/PerformanceChart';
import { 
  DashboardMetrics, 
  ActionQueueItem, 
  RecentCompletion, 
  PerformanceData,
  SystemStatus 
} from '../../types';
import { mockApiService } from '../../services/mockData';
import { webSocketService } from '../../services/webSocketService';
import styles from './Dashboard.module.css';

const Dashboard: React.FC = () => {
  // State management
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [actionQueue, setActionQueue] = useState<ActionQueueItem[]>([]);
  const [recentCompletions, setRecentCompletions] = useState<RecentCompletion[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  
  // Loading states
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(true);
  const [completionsLoading, setCompletionsLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  
  // Error states
  const [error, setError] = useState<string | null>(null);

  // Data fetching functions
  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      
      // Fetch all data in parallel
      const [
        metricsData,
        queueData,
        completionsData,
        chartData,
        statusData
      ] = await Promise.all([
        mockApiService.getDashboardMetrics(),
        mockApiService.getActionQueue(),
        mockApiService.getRecentCompletions(),
        mockApiService.getPerformanceData(),
        mockApiService.getSystemStatus()
      ]);

      setMetrics(metricsData);
      setActionQueue(queueData);
      setRecentCompletions(completionsData);
      setPerformanceData(chartData);
      setSystemStatus(statusData);
      
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data. Please try refreshing the page.');
    } finally {
      setMetricsLoading(false);
      setQueueLoading(false);
      setCompletionsLoading(false);
      setChartLoading(false);
    }
  }, []);

  const refreshRecentCompletions = useCallback(async () => {
    try {
      const completionsData = await mockApiService.getRecentCompletions();
      setRecentCompletions(completionsData);
    } catch (err) {
      console.error('Failed to refresh recent completions:', err);
    }
  }, []);

  // Handle Process All action
  const handleProcessAll = useCallback(async () => {
    try {
      await mockApiService.processAllItems();
      // Refresh action queue and metrics after processing
      const [queueData, metricsData] = await Promise.all([
        mockApiService.getActionQueue(),
        mockApiService.getDashboardMetrics()
      ]);
      setActionQueue(queueData);
      setMetrics(metricsData);
    } catch (err) {
      console.error('Failed to process all items:', err);
      setError('Failed to process items. Please try again.');
    }
  }, []);

  // Handle View All action (placeholder)
  const handleViewAll = useCallback(() => {
    console.log('View All clicked - would navigate to full queue view');
    // In a real application, this would navigate to a full queue page
  }, []);

  // WebSocket event handlers
  useEffect(() => {
    const unsubscribeMetrics = webSocketService.subscribe('METRICS_UPDATE', (data) => {
      setMetrics(data);
    });

    const unsubscribeQueue = webSocketService.subscribe('QUEUE_UPDATE', (data) => {
      setActionQueue(data);
    });

    const unsubscribeCompletions = webSocketService.subscribe('COMPLETION_UPDATE', (data) => {
      setRecentCompletions(data);
    });

    const unsubscribeStatus = webSocketService.subscribe('STATUS_UPDATE', (data) => {
      setSystemStatus(data);
    });

    return () => {
      unsubscribeMetrics();
      unsubscribeQueue();
      unsubscribeCompletions();
      unsubscribeStatus();
    };
  }, []);

  // Auto-refresh for recent completions
  useEffect(() => {
    const interval = setInterval(refreshRecentCompletions, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [refreshRecentCompletions]);

  // Initial data load
  useEffect(() => {
    fetchDashboardData();
    
    // Connect to WebSocket for real-time updates
    // webSocketService.connect();
    
    return () => {
      // webSocketService.disconnect();
    };
  }, [fetchDashboardData]);

  // Format metric values for display
  const formatMetricValue = (value: number, type: 'currency' | 'number' | 'percentage'): string => {
    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return value.toString();
    }
  };

  if (error) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.error}>
          <div className={styles.errorIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 20h20L12 2zm0 3.5L19.5 18.5H4.5L12 5.5z" fill="#dc3545"/>
              <path d="M11 10v4h2v-4h-2zm0 6v2h2v-2h-2z" fill="#dc3545"/>
            </svg>
          </div>
          <div className={styles.errorMessage}>Dashboard Error</div>
          <div className={styles.errorDescription}>{error}</div>
          <button 
            onClick={fetchDashboardData}
            className={styles.retryButton}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>VAUTO INTELLIGENCE SUITE</h1>
          <div className={styles.statusIndicator}>
            <div 
              className={`${styles.statusDot} ${
                systemStatus?.operational ? '' : styles.offline
              }`}
              aria-label={systemStatus?.operational ? 'System operational' : 'System offline'}
            />
            <span className={styles.statusText}>
              {systemStatus?.operational ? 'Operational' : 'Offline'}
              {systemStatus?.activeAgents && (
                <> • {systemStatus.activeAgents} agents active</>
              )}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.container}>
        {/* Key Metrics Section */}
        <section className={styles.metricsGrid} aria-label="Key performance metrics">
          <MetricTile
            title="No Price/Pending"
            value={metrics ? `${metrics.noPricePending.current}/${metrics.noPricePending.total}` : '...'}
            change={metrics ? `${metrics.noPricePending.percentageReduction}% reduction` : undefined}
            changeType="positive"
            loading={metricsLoading}
          />
          <MetricTile
            title="Time Saved Today"
            value={metrics?.timeSaved.formatted || '...'}
            change={metrics ? `${metrics.timeSaved.hours} hours` : undefined}
            changeType="positive"
            loading={metricsLoading}
          />
          <MetricTile
            title="Value Protected"
            value={metrics?.valueProtected.formatted || '...'}
            change={metrics ? formatMetricValue(metrics.valueProtected.amount, 'currency') : undefined}
            changeType="positive"
            loading={metricsLoading}
          />
        </section>

        {/* Action Queue and Recent Completions */}
        <section className={styles.contentGrid}>
          <div className={styles.section}>
            <ActionQueue
              items={actionQueue}
              onProcessAll={handleProcessAll}
              onViewAll={handleViewAll}
              loading={queueLoading}
            />
          </div>
          
          <div className={styles.section}>
            <RecentCompletions
              completions={recentCompletions}
              loading={completionsLoading}
            />
          </div>
        </section>

        {/* Performance Chart */}
        <section className={`${styles.section} ${styles.chartSection}`}>
          <PerformanceChart
            data={performanceData}
            loading={chartLoading}
          />
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
