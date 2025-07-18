import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/Logger';
import { ProcessingError, ErrorHandlingService } from './ErrorHandlingService';

export interface VehicleProcessingReport {
  vin: string;
  dealershipId: string;
  processed: boolean;
  processingTime: number;
  featuresFound: string[];
  featuresUpdated: string[];
  errors: ProcessingError[];
  timestamp: Date;
  dealer: string;
  age: string;
  unmappedFeatures: string[];
}

export interface DealershipRunReport {
  runId: string;
  dealershipId: string;
  startTime: Date;
  endTime: Date;
  totalVehicles: number;
  successfulVehicles: number;
  failedVehicles: number;
  skippedVehicles: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  vehicles: VehicleProcessingReport[];
  errorSummary: {
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    criticalErrors: ProcessingError[];
  };
  performanceMetrics: {
    successRate: number;
    errorRate: number;
    averageTimePerVehicle: number;
    featuresFoundTotal: number;
    featuresUpdatedTotal: number;
  };
}

export interface ReportingConfig {
  outputDir: string;
  generateJSON: boolean;
  generateCSV: boolean;
  generateHTML: boolean;
  emailNotifications: boolean;
  emailRecipients: string[];
  retentionDays: number;
}

export class EnterpriseReportingService {
  private logger: Logger;
  private config: ReportingConfig;
  private currentReport: DealershipRunReport | null = null;

  constructor(logger: Logger, config: Partial<ReportingConfig> = {}) {
    this.logger = logger;
    this.config = {
      outputDir: './reports',
      generateJSON: true,
      generateCSV: true,
      generateHTML: true,
      emailNotifications: false,
      emailRecipients: [],
      retentionDays: 30,
      ...config
    };

    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  initializeReport(dealershipId: string): DealershipRunReport {
    this.currentReport = {
      runId: this.generateRunId(),
      dealershipId,
      startTime: new Date(),
      endTime: new Date(),
      totalVehicles: 0,
      successfulVehicles: 0,
      failedVehicles: 0,
      skippedVehicles: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      vehicles: [],
      errorSummary: {
        totalErrors: 0,
        errorsByCategory: {},
        errorsBySeverity: {},
        criticalErrors: []
      },
      performanceMetrics: {
        successRate: 0,
        errorRate: 0,
        averageTimePerVehicle: 0,
        featuresFoundTotal: 0,
        featuresUpdatedTotal: 0
      }
    };

    this.logger.info(`Initialized report for dealership ${dealershipId} with run ID: ${this.currentReport.runId}`);
    return this.currentReport;
  }

  addVehicleResult(vehicleReport: VehicleProcessingReport): void {
    if (!this.currentReport) {
      throw new Error('No active report. Call initializeReport() first.');
    }

    this.currentReport.vehicles.push(vehicleReport);
    this.currentReport.totalVehicles++;
    this.currentReport.totalProcessingTime += vehicleReport.processingTime;

    if (vehicleReport.processed) {
      this.currentReport.successfulVehicles++;
    } else {
      this.currentReport.failedVehicles++;
    }

    // Update performance metrics
    this.updatePerformanceMetrics();
    
    this.logger.debug(`Added vehicle result for VIN: ${vehicleReport.vin}`);
  }

  async finalizeReport(errorHandlingService: ErrorHandlingService): Promise<DealershipRunReport> {
    if (!this.currentReport) {
      throw new Error('No active report to finalize.');
    }

    this.currentReport.endTime = new Date();
    this.currentReport.averageProcessingTime = this.currentReport.totalVehicles > 0 
      ? this.currentReport.totalProcessingTime / this.currentReport.totalVehicles 
      : 0;

    // Collect error statistics from ErrorHandlingService
    const errorStats = errorHandlingService.getErrorStats();
    this.currentReport.errorSummary = {
      totalErrors: errorStats.total,
      errorsByCategory: errorStats.byCategory,
      errorsBySeverity: errorStats.bySeverity,
      criticalErrors: errorHandlingService.getCriticalErrors()
    };

    // Final performance metrics calculation
    this.updatePerformanceMetrics();

    // Generate reports in configured formats
    await this.generateReports(this.currentReport);

    // Send email notifications if configured
    if (this.config.emailNotifications) {
      await this.sendEmailNotification(this.currentReport);
    }

    // Clean up old reports
    await this.cleanupOldReports();

    this.logger.info(`Finalized report ${this.currentReport.runId} for dealership ${this.currentReport.dealershipId}`);
    
    const finalReport = this.currentReport;
    this.currentReport = null;
    return finalReport;
  }

  private async generateReports(report: DealershipRunReport): Promise<void> {
    const baseFilename = `${report.dealershipId}_${report.runId}_${this.formatDateForFilename(report.startTime)}`;

    if (this.config.generateJSON) {
      await this.generateJSONReport(report, baseFilename);
    }

    if (this.config.generateCSV) {
      await this.generateCSVReport(report, baseFilename);
    }

    if (this.config.generateHTML) {
      await this.generateHTMLReport(report, baseFilename);
    }
  }

  private async generateJSONReport(report: DealershipRunReport, baseFilename: string): Promise<void> {
    const filename = `${baseFilename}.json`;
    const filepath = path.join(this.config.outputDir, filename);
    
    try {
      await fs.promises.writeFile(filepath, JSON.stringify(report, null, 2));
      this.logger.info(`Generated JSON report: ${filepath}`);
    } catch (error: any) {
      this.logger.error(`Failed to generate JSON report: ${error.message}`);
    }
  }

  private async generateCSVReport(report: DealershipRunReport, baseFilename: string): Promise<void> {
    const filename = `${baseFilename}.csv`;
    const filepath = path.join(this.config.outputDir, filename);
    
    try {
      const csvContent = this.convertToCSV(report);
      await fs.promises.writeFile(filepath, csvContent);
      this.logger.info(`Generated CSV report: ${filepath}`);

      // --- Generate errors.csv ---
      const errorRows: string[][] = [];
      const errorHeaders = [
        'VIN', 'Error Message', 'Category', 'Severity', 'Step', 'Timestamp'
      ];
      for (const vehicle of report.vehicles) {
        if (vehicle.errors && Array.isArray(vehicle.errors)) {
          for (const err of vehicle.errors) {
            // If error is a ProcessingError object
            if (typeof err === 'object' && err !== null && 'message' in err) {
              errorRows.push([
                vehicle.vin,
                (err as any).message || '',
                (err as any).category || '',
                (err as any).severity || '',
                (err as any).context?.step || '',
                (err as any).timestamp ? new Date((err as any).timestamp).toISOString() : ''
              ]);
            } else {
              // Fallback: error is a string
              errorRows.push([
                vehicle.vin,
                String(err),
                '',
                '',
                '',
                ''
              ]);
            }
          }
        }
      }
      if (errorRows.length > 0) {
        const errorsCsv = [errorHeaders, ...errorRows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const errorsFile = path.join(this.config.outputDir, `${baseFilename}-errors.csv`);
        await fs.promises.writeFile(errorsFile, errorsCsv);
        this.logger.info(`Generated errors CSV: ${errorsFile}`);
      }
      // --- End errors.csv ---

    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error) {
        this.logger.error(`Failed to generate CSV report: ${(error as any).message}`);
      } else {
        this.logger.error(`Failed to generate CSV report: ${String(error)}`);
      }
    }
  }

  private async generateHTMLReport(report: DealershipRunReport, baseFilename: string): Promise<void> {
    const filename = `${baseFilename}.html`;
    const filepath = path.join(this.config.outputDir, filename);
    
    try {
      const htmlContent = this.convertToHTML(report);
      await fs.promises.writeFile(filepath, htmlContent);
      this.logger.info(`Generated HTML report: ${filepath}`);
    } catch (error: unknown) {
      this.logger.error(`Failed to generate HTML report: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private convertToCSV(report: DealershipRunReport): string {
    const headers = [
      'VIN', 'Dealership ID', 'Processed', 'Processing Time (ms)', 
      'Features Found', 'Features Updated', 'Errors', 'Timestamp', 
      'Dealer', 'Age', 'Unmapped Features'
    ];

    const rows = report.vehicles.map(vehicle => [
      vehicle.vin,
      vehicle.dealershipId,
      vehicle.processed,
      vehicle.processingTime,
      vehicle.featuresFound.join(';'),
      vehicle.featuresUpdated.join(';'),
      vehicle.errors.length,
      vehicle.timestamp.toISOString(),
      vehicle.dealer,
      vehicle.age,
      vehicle.unmappedFeatures.join(';')
    ]);

    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  private convertToHTML(report: DealershipRunReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>VeeOtto Processing Report - ${report.dealershipId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f4f4f4; padding: 20px; border-radius: 5px; }
        .metrics { display: flex; justify-content: space-around; margin: 20px 0; }
        .metric { text-align: center; padding: 10px; background-color: #e9e9e9; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .success { color: green; }
        .error { color: red; }
        .warning { color: orange; }
    </style>
</head>
<body>
    <div class="header">
        <h1>VeeOtto Processing Report</h1>
        <p><strong>Dealership:</strong> ${report.dealershipId}</p>
        <p><strong>Run ID:</strong> ${report.runId}</p>
        <p><strong>Start Time:</strong> ${report.startTime.toLocaleString()}</p>
        <p><strong>End Time:</strong> ${report.endTime.toLocaleString()}</p>
        <p><strong>Duration:</strong> ${this.formatDuration(report.endTime.getTime() - report.startTime.getTime())}</p>
    </div>

    <div class="metrics">
        <div class="metric">
            <h3>Total Vehicles</h3>
            <p>${report.totalVehicles}</p>
        </div>
        <div class="metric">
            <h3>Success Rate</h3>
            <p class="success">${report.performanceMetrics.successRate.toFixed(1)}%</p>
        </div>
        <div class="metric">
            <h3>Average Time</h3>
            <p>${this.formatDuration(report.performanceMetrics.averageTimePerVehicle)}</p>
        </div>
        <div class="metric">
            <h3>Features Updated</h3>
            <p>${report.performanceMetrics.featuresUpdatedTotal}</p>
        </div>
    </div>

    <h2>Vehicle Processing Results</h2>
    <table>
        <thead>
            <tr>
                <th>VIN</th>
                <th>Status</th>
                <th>Processing Time</th>
                <th>Features Found</th>
                <th>Features Updated</th>
                <th>Errors</th>
            </tr>
        </thead>
        <tbody>
            ${report.vehicles.map(vehicle => `
                <tr>
                    <td>${vehicle.vin}</td>
                    <td class="${vehicle.processed ? 'success' : 'error'}">
                        ${vehicle.processed ? 'Success' : 'Failed'}
                    </td>
                    <td>${this.formatDuration(vehicle.processingTime)}</td>
                    <td>${vehicle.featuresFound.length}</td>
                    <td>${vehicle.featuresUpdated.length}</td>
                    <td class="${vehicle.errors.length > 0 ? 'error' : ''}">${vehicle.errors.length}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <h2>Error Summary</h2>
    <p><strong>Total Errors:</strong> ${report.errorSummary.totalErrors}</p>
    <p><strong>Critical Errors:</strong> ${report.errorSummary.criticalErrors.length}</p>
    
    <h3>Errors by Category</h3>
    <ul>
        ${Object.entries(report.errorSummary.errorsByCategory).map(([category, count]) => 
            `<li>${category}: ${count}</li>`
        ).join('')}
    </ul>
</body>
</html>`;
  }

  private async sendEmailNotification(report: DealershipRunReport): Promise<void> {
    // Send email with both main CSV and errors.csv attached
    try {
      const baseFilename = `${report.dealershipId}_${report.runId}_${this.formatDateForFilename(report.startTime)}`;
      const csvPath = path.join(this.config.outputDir, `${baseFilename}.csv`);
      const errorsPath = path.join(this.config.outputDir, `${baseFilename}-errors.csv`);
      const recipients = this.config.emailRecipients.join(',');

      // Use nodemailer directly or SMTPEmailService if available
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      const mailOptions = {
        from: process.env.SMTP_FROM || 'automation@yourdomain.com',
        to: recipients,
        subject: `VeeOtto Processing Report - ${report.dealershipId}`,
        text: `Attached are the processing report and error log for run ${report.runId}.`,
        attachments: [
          { filename: path.basename(csvPath), path: csvPath },
          { filename: path.basename(errorsPath), path: errorsPath }
        ]
      };

      await transporter.sendMail(mailOptions);
      this.logger.info(`Report email sent to: ${recipients}`);
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error) {
        this.logger.error(`Failed to send report email: ${(error as any).message}`);
      } else {
        this.logger.error(`Failed to send report email: ${String(error)}`);
      }
    }
  }

  private async cleanupOldReports(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.config.outputDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      for (const file of files) {
        const filepath = path.join(this.config.outputDir, file);
        const stats = await fs.promises.stat(filepath);
        
        if (stats.mtime < cutoffDate) {
          await fs.promises.unlink(filepath);
          this.logger.info(`Cleaned up old report: ${file}`);
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Failed to cleanup old reports: ${error.message}`);
      } else {
        this.logger.error('Failed to cleanup old reports: Unknown error occurred');
      }
    }
  }

  createVehicleReport(
    vin: string,
    dealershipId: string,
    processed: boolean,
    processingTime: number,
    featuresFound: string[] = [],
    featuresUpdated: string[] = [],
    errors: ProcessingError[] = [],
    dealer: string = '',
    age: string = '',
    unmappedFeatures: string[] = []
  ): VehicleProcessingReport {
    return {
      vin,
      dealershipId,
      processed,
      processingTime,
      featuresFound,
      featuresUpdated,
      errors,
      timestamp: new Date(),
      dealer,
      age,
      unmappedFeatures
    };
  }

  private updatePerformanceMetrics(): void {
    if (!this.currentReport) return;

    const { totalVehicles, successfulVehicles, totalProcessingTime } = this.currentReport;
    
    this.currentReport.performanceMetrics.successRate = totalVehicles > 0 
      ? (successfulVehicles / totalVehicles) * 100 
      : 0;
    
    this.currentReport.performanceMetrics.errorRate = totalVehicles > 0 
      ? ((totalVehicles - successfulVehicles) / totalVehicles) * 100 
      : 0;
    
    this.currentReport.performanceMetrics.averageTimePerVehicle = totalVehicles > 0 
      ? totalProcessingTime / totalVehicles 
      : 0;

    this.currentReport.performanceMetrics.featuresFoundTotal = this.currentReport.vehicles
      .reduce((sum, vehicle) => sum + vehicle.featuresFound.length, 0);
    
    this.currentReport.performanceMetrics.featuresUpdatedTotal = this.currentReport.vehicles
      .reduce((sum, vehicle) => sum + vehicle.featuresUpdated.length, 0);
  }

  private generateRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private formatDateForFilename(date: Date): string {
    return date.toISOString().replace(/[:.]/g, '-').split('T')[0];
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}