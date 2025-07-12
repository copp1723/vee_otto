import React from 'react';
import { ActionQueueProps } from '../../../../types';
import styles from './ActionQueue.module.css';

const ActionQueue: React.FC<ActionQueueProps> = ({
  items,
  onProcessAll,
  onViewAll,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className={styles.actionQueue}>
        <div className={styles.actionHeader}>
          <h3 className={styles.actionTitle}>Action Required</h3>
          <button className={styles.processAllBtn} disabled>
            Process All
          </button>
        </div>
        <div className={styles.queueList}>
          {[...Array(3)].map((_, index) => (
            <div key={index} className={`${styles.loadingItem} ${styles.loadingSkeleton}`}>
              <div className={`${styles.loadingVehicle} ${styles.loadingSkeleton}`} />
              <div className={`${styles.loadingVin} ${styles.loadingSkeleton}`} />
              <div className={`${styles.loadingDescription} ${styles.loadingSkeleton}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={styles.actionQueue}>
        <div className={styles.actionHeader}>
          <h3 className={styles.actionTitle}>Action Required</h3>
        </div>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="#28a745" strokeWidth="2"/>
              <path d="M8 12l3 3 5-6" stroke="#28a745" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.emptyMessage}>All Clear!</div>
          <div className={styles.emptyDescription}>
            No vehicles require manual attention at this time.
          </div>
        </div>
      </div>
    );
  }

  const displayItems = items.slice(0, 5);
  const hasMore = items.length > 5;

  const formatEstimatedTime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  const getIssueTypeLabel = (issueType: string): string => {
    switch (issueType) {
      case 'NO_STICKER':
        return 'No Sticker';
      case 'LOW_CONFIDENCE':
        return 'Low Confidence';
      case 'MISSING_DATA':
        return 'Missing Data';
      default:
        return issueType;
    }
  };

  return (
    <div className={styles.actionQueue}>
      <div className={styles.actionHeader}>
        <h3 className={styles.actionTitle}>Action Required</h3>
        <button 
          className={styles.processAllBtn}
          onClick={onProcessAll}
          aria-label={`Process all ${items.length} items`}
        >
          Process All ({items.length})
        </button>
      </div>
      
      <div className={styles.queueList} role="list" aria-label="Vehicles requiring attention">
        {displayItems.map((item) => (
          <div 
            key={item.id} 
            className={styles.actionItem}
            role="listitem"
            aria-label={`${item.year} ${item.make} ${item.model} requires attention`}
          >
            <div className={styles.vehicleInfo}>
              <div className={styles.vehicleDetails}>
                <div className={styles.vehicleName}>
                  {item.year} {item.make} {item.model}
                </div>
                <div className={styles.vehicleVin} title="Vehicle Identification Number">
                  {item.vin}
                </div>
              </div>
              <div className={styles.issueInfo}>
                <div className={`${styles.issueType} ${styles[item.issueType]}`}>
                  {getIssueTypeLabel(item.issueType)}
                </div>
                <div className={styles.estimatedTime}>
                  Est. {formatEstimatedTime(item.estimatedTime)}
                </div>
              </div>
            </div>
            <div className={styles.issueDescription}>
              {item.issueDescription}
            </div>
          </div>
        ))}
      </div>
      
      {hasMore && (
        <button 
          className={styles.viewAllLink}
          onClick={onViewAll}
          aria-label={`View all ${items.length} items requiring attention`}
        >
          View All ({items.length})
        </button>
      )}
    </div>
  );
};

export default ActionQueue;
