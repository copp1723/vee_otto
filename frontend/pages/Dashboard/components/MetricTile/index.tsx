import React from 'react';
import { MetricTileProps } from '../../../../types';
import styles from './MetricTile.module.css';

const MetricTile: React.FC<MetricTileProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  loading = false,
}) => {
  if (loading) {
    return (
      <div className={`${styles.metricTile} ${styles.loading}`}>
        <div className={`${styles.loadingValue} ${styles.loadingSkeleton}`} />
        <div className={`${styles.loadingLabel} ${styles.loadingSkeleton}`} />
        <div className={`${styles.loadingChange} ${styles.loadingSkeleton}`} />
      </div>
    );
  }

  const getChangeIcon = () => {
    switch (changeType) {
      case 'positive':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 3h7v7h-1.5V5.5L4 13l-1-1l7.5-7.5H6V3z"/>
          </svg>
        );
      case 'negative':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 13h7V6h-1.5v4.5L4 3l-1 1l7.5 7.5H6V13z"/>
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13 8l-3-3v2.5H3v1h7V11l3-3z"/>
          </svg>
        );
    }
  };

  return (
    <div className={styles.metricTile} role="article" aria-label={`${title} metric`}>
      <div>
        <div className={styles.metricValue} aria-label={`Value: ${value}`}>
          {value}
        </div>
        <div className={styles.metricLabel}>
          {title}
        </div>
      </div>
      {change && (
        <div 
          className={`${styles.metricChange} ${styles[changeType]}`}
          aria-label={`Change: ${change}`}
        >
          <span className={styles.changeIcon}>{getChangeIcon()}</span>
          {change}
        </div>
      )}
    </div>
  );
};

export default MetricTile;
