import { Logger } from '../utils/Logger';
import { FeatureUpdateReport } from '../../platforms/vauto/featureMapping';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface VehicleProcessingResult {
  vin: string;
  processed: boolean;
  featuresFound: string[];
  featuresUpdated: string[];
  windowStickerScraped: boolean;
  factoryEquipmentAccessed: boolean;
  featureUpdateReport: FeatureUpdateReport | null;
  errors: string[];
  processingTime: number;
  timestamp: Date;
}

export interface RunSummary {
  runId: string;
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  totalVehicles: number;
  successfulVehicles: number;
  failedVehicles: number;
  windowStickersScraped: number;
  totalFeaturesFound: number;
  totalCheckboxesUpdated: number;
  errors: Array<{ vin: string; error: string }>;
}

export class ReportingService {
  private logger: Logger;
  private reportsDir: string;

  constructor(reportsDir: string = './reports') {
    this.logger = new Logger('ReportingService');
    this.reportsDir = reportsDir;
  }

  /**
   * Initialize reporting directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.reportsDir, { recursive: true });
      this.logger.info(`Reports directory initialized: ${this.reportsDir}`);
    } catch (error) {
      this.logger.error('Failed to initialize reports directory:', error);
    }
  }

  /**
   * Generate a comprehensive CSV report
   */
  async generateCSVReport(runId: string, vehicles: VehicleProcessingResult[]): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `vauto-report-${runId}-${timestamp}.csv`;
    const filepath = path.join(this.reportsDir, filename);

    const headers = [
      'VIN',
      'Processed',
      'Window Sticker Scraped',
      'Factory Equipment Accessed',
      'Total Features Found',
      'Features Matched',
      'Features Unmatched',
      'Checkboxes Updated',
      'Checkboxes Checked',
      'Checkboxes Unchecked',
      'Processing Time (ms)',
      'Errors',
      'Unmatched Features'
    ];

    const rows = vehicles.map(vehicle => {
      const report = vehicle.featureUpdateReport;
      return [
        vehicle.vin,
        vehicle.processed ? 'Yes' : 'No',
        vehicle.windowStickerScraped ? 'Yes' : 'No',
        vehicle.factoryEquipmentAccessed ? 'Yes' : 'No',
        vehicle.featuresFound.length,
        report?.matchedFeatures || 0,
        report?.unmatchedFeatures || 0,
        report?.checkboxesUpdated || 0,
        report?.checkboxesChecked || 0,
        report?.checkboxesUnchecked || 0,
        vehicle.processingTime,
        vehicle.errors.join('; '),
        report?.details.unmatched.join('; ') || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    await fs.writeFile(filepath, csvContent, 'utf-8');
    this.logger.info(`CSV report generated: ${filepath}`);
    
    return filepath;
  }

  /**
   * Generate a detailed JSON report
   */
  async generateJSONReport(runId: string, summary: RunSummary, vehicles: VehicleProcessingResult[]): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `vauto-report-${runId}-${timestamp}.json`;
    const filepath = path.join(this.reportsDir, filename);

    const report = {
      summary,
      vehicles: vehicles.map(v => ({
        ...v,
        timestamp: v.timestamp || new Date()
      }))
    };

    await fs.writeFile(filepath, JSON.stringify(report, null, 2), 'utf-8');
    this.logger.info(`JSON report generated: ${filepath}`);
    
    return filepath;
  }

  /**
   * Generate an HTML report for easy viewing
   */
  async generateHTMLReport(runId: string, summary: RunSummary, vehicles: VehicleProcessingResult[]): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `vauto-report-${runId}-${timestamp}.html`;
    const filepath = path.join(this.reportsDir, filename);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VAuto Processing Report - ${runId}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1, h2 {
            color: #333;
        }
        .summary {
            background-color: #e3f2fd;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .metric {
            background-color: white;
            padding: 10px;
            border-radius: 5px;
            text-align: center;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #1976d2;
        }
        .metric-label {
            color: #666;
            font-size: 14px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
        }
        .success {
            color: #4caf50;
        }
        .error {
            color: #f44336;
        }
        .warning {
            color: #ff9800;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>VAuto Processing Report</h1>
        <p>Run ID: ${runId} | Generated: ${new Date().toLocaleString()}</p>
        
        <div class="summary">
            <h2>Summary</h2>
            <div class="summary-grid">
                <div class="metric">
                    <div class="metric-value">${summary.totalVehicles}</div>
                    <div class="metric-label">Total Vehicles</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${summary.successfulVehicles}</div>
                    <div class="metric-label">Successful</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${summary.failedVehicles}</div>
                    <div class="metric-label">Failed</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${summary.windowStickersScraped}</div>
                    <div class="metric-label">Window Stickers Scraped</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${summary.totalFeaturesFound}</div>
                    <div class="metric-label">Features Found</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${summary.totalCheckboxesUpdated}</div>
                    <div class="metric-label">Checkboxes Updated</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${Math.round(summary.totalDuration / 60)}min</div>
                    <div class="metric-label">Duration</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${Math.round((summary.successfulVehicles / summary.totalVehicles) * 100)}%</div>
                    <div class="metric-label">Success Rate</div>
                </div>
            </div>
        </div>
        
        <h2>Vehicle Details</h2>
        <table>
            <thead>
                <tr>
                    <th>VIN</th>
                    <th>Status</th>
                    <th>Window Sticker</th>
                    <th>Features Found</th>
                    <th>Checkboxes Updated</th>
                    <th>Processing Time</th>
                    <th>Errors</th>
                </tr>
            </thead>
            <tbody>
                ${vehicles.map(v => `
                <tr>
                    <td>${v.vin}</td>
                    <td class="${v.processed ? 'success' : 'error'}">${v.processed ? 'Success' : 'Failed'}</td>
                    <td class="${v.windowStickerScraped ? 'success' : 'warning'}">${v.windowStickerScraped ? 'Yes' : 'No'}</td>
                    <td>${v.featuresFound.length}</td>
                    <td>${v.featureUpdateReport?.checkboxesUpdated || 0}</td>
                    <td>${(v.processingTime / 1000).toFixed(1)}s</td>
                    <td class="${v.errors.length > 0 ? 'error' : ''}">${v.errors.join('; ') || '-'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        
        ${summary.errors.length > 0 ? `
        <h2>Errors</h2>
        <ul>
            ${summary.errors.map(e => `<li><strong>${e.vin}:</strong> ${e.error}</li>`).join('')}
        </ul>
        ` : ''}
    </div>
</body>
</html>
    `;

    await fs.writeFile(filepath, html, 'utf-8');
    this.logger.info(`HTML report generated: ${filepath}`);
    
    return filepath;
  }

  /**
   * Generate all report formats
   */
  async generateAllReports(runId: string, summary: RunSummary, vehicles: VehicleProcessingResult[]): Promise<{
    csv: string;
    json: string;
    html: string;
  }> {
    await this.initialize();

    const [csv, json, html] = await Promise.all([
      this.generateCSVReport(runId, vehicles),
      this.generateJSONReport(runId, summary, vehicles),
      this.generateHTMLReport(runId, summary, vehicles)
    ]);

    this.logger.info(`All reports generated for run ${runId}`);
    
    return { csv, json, html };
  }

  /**
   * Log unmatched features for future mapping updates
   */
  async logUnmatchedFeatures(vehicles: VehicleProcessingResult[]): Promise<void> {
    const unmatchedFeatures = new Map<string, number>();

    vehicles.forEach(vehicle => {
      if (vehicle.featureUpdateReport?.details.unmatched) {
        vehicle.featureUpdateReport.details.unmatched.forEach(feature => {
          unmatchedFeatures.set(feature, (unmatchedFeatures.get(feature) || 0) + 1);
        });
      }
    });

    if (unmatchedFeatures.size > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `unmatched-features-${timestamp}.json`;
      const filepath = path.join(this.reportsDir, 'unmatched', filename);

      await fs.mkdir(path.join(this.reportsDir, 'unmatched'), { recursive: true });

      const sortedFeatures = Array.from(unmatchedFeatures.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([feature, count]) => ({ feature, count }));

      await fs.writeFile(filepath, JSON.stringify(sortedFeatures, null, 2), 'utf-8');
      this.logger.info(`Unmatched features logged: ${filepath}`);
    }
  }
} 