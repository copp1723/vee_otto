import { ActionQueueItem, RecentCompletion, DashboardMetrics } from '../core/types';
import { updateFromAgent } from './server';
import winston from 'winston';
import sqlite3 from 'sqlite3';

// Logger for dashboard integration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/dashboard-integration.log' })
  ]
});

// Initialize SQLite database
const db = new sqlite3.Database('./dashboard.db', (err) => {
  if (err) {
    logger.error('Failed to open database', err);
  } else {
    logger.info('Connected to SQLite database');
    // Create tables
    db.run(`CREATE TABLE IF NOT EXISTS action_queue (
      id TEXT PRIMARY KEY,
      vin TEXT,
      year INTEGER,
      make TEXT,
      model TEXT,
      issueType TEXT,
      issueDescription TEXT,
      estimatedTime INTEGER
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS completions (
      id TEXT PRIMARY KEY,
      vin TEXT,
      year INTEGER,
      make TEXT,
      model TEXT,
      completedAt TEXT,
      timeSaved INTEGER,
      valueProtected INTEGER,
      outcome TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      noPricePending_current INTEGER,
      noPricePending_total INTEGER,
      noPricePending_percentageReduction REAL,
      timeSaved_hours REAL,
      timeSaved_formatted TEXT,
      valueProtected_amount INTEGER,
      valueProtected_formatted TEXT,
      timestamp TEXT
    )`);
  }
});

export class DashboardIntegration {
  private isConnected: boolean = false;

  constructor() {
    this.isConnected = true;
    logger.info('Dashboard integration initialized');
  }

  /**
   * Report a vehicle that needs manual review to the action queue
   */
  async addToActionQueue(vehicle: {
    vin: string;
    year: number;
    make: string;
    model: string;
    issue: 'NO_STICKER' | 'LOW_CONFIDENCE' | 'MISSING_DATA';
    description: string;
    estimatedTime?: number;
  }) {
    return new Promise<void>((resolve, reject) => {
      const queueItem: ActionQueueItem = {
        id: `aq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        vin: vehicle.vin,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        issueType: vehicle.issue,
        issueDescription: vehicle.description,
        estimatedTime: vehicle.estimatedTime || 5
      };

      db.run(`INSERT INTO action_queue (id, vin, year, make, model, issueType, issueDescription, estimatedTime)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [queueItem.id, queueItem.vin, queueItem.year, queueItem.make, queueItem.model, queueItem.issueType, queueItem.issueDescription, queueItem.estimatedTime],
        (err) => {
          if (err) {
            logger.error('Failed to add to action queue', err);
            reject(err);
          } else {
            updateFromAgent({ actionQueue: [queueItem] }); // Assuming this updates in-memory or socket
            logger.info('Added vehicle to action queue', { vin: vehicle.vin, issue: vehicle.issue });
            resolve();
          }
        });
    });
  }

  /**
   * Report a completed vehicle processing
   */
  async reportCompletion(completion: {
    vin: string;
    year: number;
    make: string;
    model: string;
    timeSaved: number;
    valueProtected: number;
    outcome: string;
  }) {
    return new Promise<void>((resolve, reject) => {
      const completionRecord: RecentCompletion = {
        id: `rc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        vin: completion.vin,
        year: completion.year,
        make: completion.make,
        model: completion.model,
        completedAt: new Date().toISOString(),
        timeSaved: completion.timeSaved,
        valueProtected: completion.valueProtected,
        outcome: completion.outcome
      };

      db.run(`INSERT INTO completions (id, vin, year, make, model, completedAt, timeSaved, valueProtected, outcome)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [completionRecord.id, completionRecord.vin, completionRecord.year, completionRecord.make, completionRecord.model, completionRecord.completedAt, completionRecord.timeSaved, completionRecord.valueProtected, completionRecord.outcome],
        (err) => {
          if (err) {
            logger.error('Failed to report completion', err);
            reject(err);
          } else {
            updateFromAgent({ completion: completionRecord });
            logger.info('Reported vehicle completion', { vin: completion.vin, outcome: completion.outcome });
            resolve();
          }
        });
    });
  }

  /**
   * Update dashboard metrics
   */
  async updateMetrics(metrics: Partial<DashboardMetrics>) {
    return new Promise<void>((resolve, reject) => {
      const currentTime = new Date().toISOString();
      const currentNoPricePendingCurrent = metrics.noPricePending?.current || 0;
      const currentNoPricePendingTotal = metrics.noPricePending?.total || 0;
      const currentNoPricePendingPercentageReduction = metrics.noPricePending?.percentageReduction || 0;
      const currentTimeSavedHours = metrics.timeSaved?.hours || 0;
      const currentTimeSavedFormatted = metrics.timeSaved?.formatted || '0h 0m';
      const currentValueProtectedAmount = metrics.valueProtected?.amount || 0;
      const currentValueProtectedFormatted = metrics.valueProtected?.formatted || '$0';

      db.run(`INSERT INTO metrics (noPricePending_current, noPricePending_total, noPricePending_percentageReduction, timeSaved_hours, timeSaved_formatted, valueProtected_amount, valueProtected_formatted, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [currentNoPricePendingCurrent, currentNoPricePendingTotal, currentNoPricePendingPercentageReduction, currentTimeSavedHours, currentTimeSavedFormatted, currentValueProtectedAmount, currentValueProtectedFormatted, currentTime],
        (err) => {
          if (err) {
            logger.error('Failed to update metrics', err);
            reject(err);
          } else {
            updateFromAgent({ metrics });
            logger.info('Updated dashboard metrics', metrics);
            resolve();
          }
        });
    });
  }

  /**
   * Update system status
   */
  async updateSystemStatus(status: {
    operational: boolean;
    activeAgents: number;
  }) {
    try {
      updateFromAgent({
        systemStatus: {
          operational: status.operational,
          lastUpdate: new Date().toISOString(),
          activeAgents: status.activeAgents
        }
      });
      
      logger.info('Updated system status', status);
    } catch (error) {
      logger.error('Failed to update system status', error);
    }
  }

  /**
   * Batch update from agent run results
   */
  async reportAgentRun(results: {
    dealershipName: string;
    vehiclesProcessed: number;
    vehiclesWithIssues: any[];
    completedVehicles: any[];
    totalTimeSaved: number;
    totalValueProtected: number;
  }) {
    try {
      logger.info(`Processing agent run results for ${results.dealershipName}`);

      for (const vehicle of results.vehiclesWithIssues) {
        await this.addToActionQueue(vehicle);
      }

      for (const vehicle of results.completedVehicles) {
        await this.reportCompletion({
          ...vehicle,
          valueProtected: Math.floor(results.totalValueProtected / (results.completedVehicles.length || 1))
        });
      }

      await this.updateMetrics({
        noPricePending: {
          current: results.vehiclesWithIssues.length,
          total: results.vehiclesProcessed,
          percentageReduction: results.vehiclesProcessed > 0 ?
            ((results.vehiclesProcessed - results.vehiclesWithIssues.length) / results.vehiclesProcessed) * 100 : 0
        },
        timeSaved: {
            hours: results.totalTimeSaved / 60,
            formatted: `${Math.floor(results.totalTimeSaved / 60)}h ${results.totalTimeSaved % 60}m`
        },
        valueProtected: {
            amount: results.totalValueProtected,
            formatted: `$${results.totalValueProtected.toLocaleString()}`
        }
      });

      logger.info(`Agent run completed for ${results.dealershipName}`);
    } catch (error) {
      logger.error('Failed to report agent run', error);
    }
  }

  async updateQueue(item: { vin: string, status: string, timestamp: string }) {
    logger.info('Queue update received', item);
    // This is a stub for real-time queue updates.
  }

  async reportError(vin: string, error: string) {
    logger.error(`Error reported for VIN: ${vin}`, { error });
    await this.addToActionQueue({
        vin,
        year: new Date().getFullYear(),
        make: 'Unknown',
        model: 'Unknown',
        issue: 'LOW_CONFIDENCE',
        description: error,
    });
  }
}

// Export singleton instance
export const dashboardIntegration = new DashboardIntegration();
