import React from 'react';
import { RecentCompletionsProps } from '../../../../types';
import styles from './RecentCompletions.module.css';

const RecentCompletions: React.FC<RecentCompletionsProps> = ({
  completions,
  loading = false,
}) => {
  const formatTimeAgo = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  if (loading) {
    return (
      <div className={styles.recentCompletions}>
        <div className={styles.completionsHeader}>
          <h3 className={styles.completionsTitle}>Recent Completions</h3>
        </div>
        <div className={styles.completionsList}>
          {[...Array(3)].map((_, index) => (
            <div key={index} className={styles.loadingItem}>
              <div className={styles.loadingHeader}>
                <div className={`${styles.loadingCheckmark} ${styles.loadingSkeleton}`} />
                <div style={{ flex: 1 }}>
                  <div className={`${styles.loadingVehicle} ${styles.loadingSkeleton}`} />
                  <div className={`${styles.loadingVin} ${styles.loadingSkeleton}`} />
                </div>
              </div>
              <div className={`${styles.loadingOutcome} ${styles.loadingSkeleton}`} />
              <div className={styles.loadingMetrics}>
                <div className={`${styles.loadingMetric} ${styles.loadingSkeleton}`} />
                <div className={`${styles.loadingMetric} ${styles.loadingSkeleton}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (completions.length === 0) {
    return (
      <div className={styles.recentCompletions}>
        <div className={styles.completionsHeader}>
          <h3 className={styles.completionsTitle}>Recent Completions</h3>
        </div>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="3" width="14" height="18" rx="2" stroke="#6c757d" strokeWidth="2"/>
              <path d="M9 3h6v3H9V3z" stroke="#6c757d" strokeWidth="2"/>
              <path d="M9 10h6M9 14h6" stroke="#6c757d" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className={styles.emptyMessage}>No Recent Activity</div>
          <div className={styles.emptyDescription}>
            Completed vehicle processing will appear here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.recentCompletions}>
      <div className={styles.completionsHeader}>
        <h3 className={styles.completionsTitle}>Recent Completions</h3>
      </div>
      
      <div className={styles.completionsList} role="list" aria-label="Recently completed vehicles">
        {completions.map((completion) => (
          <div 
            key={completion.id} 
            className={styles.completionItem}
            role="listitem"
            aria-label={`Completed: ${completion.year} ${completion.make} ${completion.model}`}
          >
            <div className={styles.completionHeader}>
              <div className={styles.checkmark} aria-label="Completed">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" fill="#28a745"/>
                  <path d="M8 12l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className={styles.vehicleInfo}>
                <div className={styles.vehicleName}>
                  {completion.year} {completion.make} {completion.model}
                </div>
                <div className={styles.vehicleVin} title="Vehicle Identification Number">
                  {completion.vin}
                </div>
                <div className={styles.completionTime}>
                  {formatTimeAgo(completion.completedAt)}
                </div>
              </div>
            </div>
            
            <div className={styles.outcome}>
              {completion.outcome}
            </div>
            
            <div className={styles.metrics}>
              <div className={styles.metric}>
                <div className={styles.metricValue}>
                  {formatTime(completion.timeSaved)}
                </div>
                <div className={styles.metricLabel}>Time Saved</div>
              </div>
              <div className={styles.metric}>
                <div className={styles.metricValue}>
                  {formatCurrency(completion.valueProtected)}
                </div>
                <div className={styles.metricLabel}>Value Protected</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className={styles.refreshIndicator}>
        <div className={styles.refreshDot}></div>
        Auto-refreshing every 30 seconds
      </div>
    </div>
  );
};

export default RecentCompletions;
