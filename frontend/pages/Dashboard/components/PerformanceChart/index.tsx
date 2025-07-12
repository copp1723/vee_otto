import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { PerformanceChartProps, PerformanceData } from '../../../../types';
import styles from './PerformanceChart.module.css';

interface MetricConfig {
  key: keyof PerformanceData;
  label: string;
  color: string;
  yAxisLabel: string;
  formatter: (value: number) => string;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({
  data,
  loading = false,
}) => {
  const [activeMetrics, setActiveMetrics] = useState<Set<string>>(
    new Set(['vehiclesProcessed', 'timeSaved', 'valueProtected'])
  );

  const metricsConfig: Record<string, MetricConfig> = {
    vehiclesProcessed: {
      key: 'vehiclesProcessed',
      label: 'Vehicles Processed',
      color: '#007bff',
      yAxisLabel: 'Vehicles',
      formatter: (value) => `${value} vehicles`,
    },
    timeSaved: {
      key: 'timeSaved',
      label: 'Time Saved',
      color: '#28a745',
      yAxisLabel: 'Hours',
      formatter: (value) => `${value}h`,
    },
    valueProtected: {
      key: 'valueProtected',
      label: 'Value Protected',
      color: '#ff9500',
      yAxisLabel: 'Value ($)',
      formatter: (value) => 
        new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value),
    },
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const toggleMetric = (metric: string) => {
    const newActiveMetrics = new Set(activeMetrics);
    if (newActiveMetrics.has(metric)) {
      if (newActiveMetrics.size > 1) {
        newActiveMetrics.delete(metric);
      }
    } else {
      newActiveMetrics.add(metric);
    }
    setActiveMetrics(newActiveMetrics);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.chartTooltip}>
          <div className={styles.tooltipContent}>
            <div className={styles.tooltipLabel}>
              {formatDate(label)}
            </div>
            {payload.map((entry: any, index: number) => (
              <div key={index} className={styles.tooltipItem}>
                <div 
                  className={styles.tooltipColor}
                  style={{ backgroundColor: entry.color }}
                />
                <span>
                  {entry.name}: {metricsConfig[entry.dataKey]?.formatter(entry.value) || entry.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className={styles.performanceChart}>
        <div className={styles.chartHeader}>
          <h3 className={styles.chartTitle}>7-Day Performance Trends</h3>
        </div>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner} />
          <div className={styles.loadingText}>Loading performance data...</div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={styles.performanceChart}>
        <div className={styles.chartHeader}>
          <h3 className={styles.chartTitle}>7-Day Performance Trends</h3>
        </div>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📊</div>
          <div className={styles.emptyMessage}>No Performance Data</div>
          <div className={styles.emptyDescription}>
            Performance trends will appear here once data is available.
          </div>
        </div>
      </div>
    );
  }

  // Prepare chart data with formatted dates
  const chartData = data.map(item => ({
    ...item,
    formattedDate: formatDate(item.date),
  }));

  return (
    <div className={styles.performanceChart}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>7-Day Performance Trends</h3>
        <p className={styles.chartSubtitle}>
          Track daily vehicle processing, time savings, and value protection over the past week
        </p>
        
        <div className={styles.chartControls} role="group" aria-label="Chart metric toggles">
          {Object.entries(metricsConfig).map(([key, config]) => (
            <button
              key={key}
              className={`${styles.metricToggle} ${styles[key]} ${
                activeMetrics.has(key) ? styles.active : ''
              }`}
              onClick={() => toggleMetric(key)}
              aria-pressed={activeMetrics.has(key)}
              aria-label={`Toggle ${config.label} metric`}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 60,
            }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#e0e0e0"
              strokeOpacity={0.6}
            />
            <XAxis
              dataKey="formattedDate"
              stroke="#666666"
              fontSize={12}
              tick={{ fill: '#666666' }}
              axisLine={{ stroke: '#e0e0e0' }}
              tickLine={{ stroke: '#e0e0e0' }}
            />
            <YAxis
              stroke="#666666"
              fontSize={12}
              tick={{ fill: '#666666' }}
              axisLine={{ stroke: '#e0e0e0' }}
              tickLine={{ stroke: '#e0e0e0' }}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {Array.from(activeMetrics).map(metricKey => {
              const config = metricsConfig[metricKey];
              return (
                <Line
                  key={metricKey}
                  type="monotone"
                  dataKey={config.key}
                  stroke={config.color}
                  strokeWidth={3}
                  dot={{ 
                    fill: config.color, 
                    strokeWidth: 2, 
                    r: 6,
                    stroke: '#ffffff'
                  }}
                  activeDot={{ 
                    r: 8, 
                    stroke: config.color,
                    strokeWidth: 2,
                    fill: '#ffffff'
                  }}
                  name={config.label}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
        
        <div className={styles.chartLegend} role="group" aria-label="Chart legend">
          {Array.from(activeMetrics).map(metricKey => {
            const config = metricsConfig[metricKey];
            return (
              <div key={metricKey} className={styles.legendItem}>
                <div 
                  className={styles.legendColor}
                  style={{ backgroundColor: config.color }}
                />
                <span>{config.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PerformanceChart;
