import * as nodemailer from 'nodemailer';
import { Logger } from '../../core/utils/Logger';
import { DealershipRunReport } from '../../core/services/EnterpriseReportingService';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface EmailNotificationService {
  sendReportNotification(report: DealershipRunReport, recipients: string[]): Promise<void>;
  sendErrorAlert(error: any, dealershipId: string, recipients: string[]): Promise<void>;
}

export class SMTPEmailService implements EmailNotificationService {
  private transporter: nodemailer.Transporter;
  private logger: Logger;
  private config: EmailConfig;

  constructor(config: EmailConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth
    });
  }

  async sendReportNotification(report: DealershipRunReport, recipients: string[]): Promise<void> {
    try {
      const subject = `VeeOtto Processing Report - ${report.dealershipId} - ${report.runId}`;
      const htmlContent = this.generateReportEmailHTML(report);
      const textContent = this.generateReportEmailText(report);

      const mailOptions = {
        from: this.config.from,
        to: recipients.join(', '),
        subject,
        html: htmlContent,
        text: textContent,
        attachments: [
          {
            filename: `${report.dealershipId}_${report.runId}_report.json`,
            content: JSON.stringify(report, null, 2),
            contentType: 'application/json'
          }
        ]
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.info(`Report notification sent to ${recipients.length} recipients`);
    } catch (error) {
      this.logger.error(`Failed to send report notification: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async sendErrorAlert(error: any, dealershipId: string, recipients: string[]): Promise<void> {
    try {
      const subject = `VeeOtto Critical Error Alert - ${dealershipId}`;
      const htmlContent = this.generateErrorAlertHTML(error, dealershipId);
      const textContent = this.generateErrorAlertText(error, dealershipId);

      const mailOptions = {
        from: this.config.from,
        to: recipients.join(', '),
        subject,
        html: htmlContent,
        text: textContent
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.info(`Error alert sent to ${recipients.length} recipients`);
    } catch (emailError) {
      this.logger.error(`Failed to send error alert: ${emailError instanceof Error ? emailError.message : String(emailError)}`);
      throw emailError;
    }
  }

  private generateReportEmailHTML(report: DealershipRunReport): string {
    const duration = report.endTime.getTime() - report.startTime.getTime();
    const successRate = report.totalVehicles > 0 ? (report.successfulVehicles / report.totalVehicles * 100).toFixed(1) : '0';
    
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .metrics { display: flex; justify-content: space-around; margin: 20px 0; }
        .metric { text-align: center; padding: 15px; background-color: #f4f4f4; border-radius: 5px; }
        .metric h3 { margin: 0 0 10px 0; color: #4CAF50; }
        .metric p { margin: 0; font-size: 24px; font-weight: bold; }
        .success { color: #4CAF50; }
        .error { color: #f44336; }
        .warning { color: #ff9800; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .footer { background-color: #f4f4f4; padding: 15px; text-align: center; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>VeeOtto Processing Report</h1>
        <p>Dealership: ${report.dealershipId} | Run ID: ${report.runId}</p>
    </div>
    
    <div class="content">
        <h2>Execution Summary</h2>
        <p><strong>Start Time:</strong> ${report.startTime.toLocaleString()}</p>
        <p><strong>End Time:</strong> ${report.endTime.toLocaleString()}</p>
        <p><strong>Duration:</strong> ${this.formatDuration(duration)}</p>
        
        <div class="metrics">
            <div class="metric">
                <h3>Total Vehicles</h3>
                <p>${report.totalVehicles}</p>
            </div>
            <div class="metric">
                <h3>Successful</h3>
                <p class="success">${report.successfulVehicles}</p>
            </div>
            <div class="metric">
                <h3>Failed</h3>
                <p class="error">${report.failedVehicles}</p>
            </div>
            <div class="metric">
                <h3>Success Rate</h3>
                <p class="success">${successRate}%</p>
            </div>
        </div>
        
        <h2>Performance Metrics</h2>
        <ul>
            <li><strong>Average Processing Time:</strong> ${this.formatDuration(report.performanceMetrics.averageTimePerVehicle)}</li>
            <li><strong>Features Found:</strong> ${report.performanceMetrics.featuresFoundTotal}</li>
            <li><strong>Features Updated:</strong> ${report.performanceMetrics.featuresUpdatedTotal}</li>
            <li><strong>Error Rate:</strong> ${report.performanceMetrics.errorRate.toFixed(1)}%</li>
        </ul>
        
        <h2>Error Summary</h2>
        <p><strong>Total Errors:</strong> ${report.errorSummary.totalErrors}</p>
        <p><strong>Critical Errors:</strong> <span class="error">${report.errorSummary.criticalErrors.length}</span></p>
        
        ${Object.keys(report.errorSummary.errorsByCategory).length > 0 ? `
        <h3>Errors by Category</h3>
        <ul>
            ${Object.entries(report.errorSummary.errorsByCategory)
              .sort(([,a], [,b]) => b - a)
              .map(([category, count]) => `<li>${category}: ${count}</li>`)
              .join('')}
        </ul>
        ` : ''}
        
        <h2>Vehicle Processing Details</h2>
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
                ${report.vehicles.slice(0, 10).map(vehicle => `
                    <tr>
                        <td>${vehicle.vin}</td>
                        <td class="${vehicle.processed ? 'success' : 'error'}">
                            ${vehicle.processed ? 'Success' : 'Failed'}
                        </td>
                        <td>${this.formatDuration(vehicle.processingTime)}</td>
                        <td>${vehicle.featuresFound.length}</td>
                        <td>${vehicle.featuresUpdated.length}</td>
                        <td>${vehicle.errors.length}</td>
                    </tr>
                `).join('')}
                ${report.vehicles.length > 10 ? `
                    <tr>
                        <td colspan="6" style="text-align: center; font-style: italic;">
                            ... and ${report.vehicles.length - 10} more vehicles (see attached JSON report for complete details)
                        </td>
                    </tr>
                ` : ''}
            </tbody>
        </table>
    </div>
    
    <div class="footer">
        <p>This report was generated automatically by VeeOtto at ${new Date().toLocaleString()}</p>
        <p>For detailed information, please refer to the attached JSON report.</p>
    </div>
</body>
</html>`;
  }

  private generateReportEmailText(report: DealershipRunReport): string {
    const duration = report.endTime.getTime() - report.startTime.getTime();
    const successRate = report.totalVehicles > 0 ? (report.successfulVehicles / report.totalVehicles * 100).toFixed(1) : '0';
    
    return `
VeeOtto Processing Report
========================

Dealership: ${report.dealershipId}
Run ID: ${report.runId}

Execution Summary:
- Start Time: ${report.startTime.toLocaleString()}
- End Time: ${report.endTime.toLocaleString()}
- Duration: ${this.formatDuration(duration)}

Results:
- Total Vehicles: ${report.totalVehicles}
- Successful: ${report.successfulVehicles}
- Failed: ${report.failedVehicles}
- Success Rate: ${successRate}%

Performance Metrics:
- Average Processing Time: ${this.formatDuration(report.performanceMetrics.averageTimePerVehicle)}
- Features Found: ${report.performanceMetrics.featuresFoundTotal}
- Features Updated: ${report.performanceMetrics.featuresUpdatedTotal}
- Error Rate: ${report.performanceMetrics.errorRate.toFixed(1)}%

Error Summary:
- Total Errors: ${report.errorSummary.totalErrors}
- Critical Errors: ${report.errorSummary.criticalErrors.length}

${Object.keys(report.errorSummary.errorsByCategory).length > 0 ? `
Errors by Category:
${Object.entries(report.errorSummary.errorsByCategory)
  .sort(([,a], [,b]) => b - a)
  .map(([category, count]) => `- ${category}: ${count}`)
  .join('\n')}
` : ''}

Vehicle Processing Summary:
${report.vehicles.slice(0, 5).map(vehicle => 
  `- ${vehicle.vin}: ${vehicle.processed ? 'Success' : 'Failed'} (${this.formatDuration(vehicle.processingTime)})`
).join('\n')}
${report.vehicles.length > 5 ? `... and ${report.vehicles.length - 5} more vehicles` : ''}

This report was generated automatically by VeeOtto at ${new Date().toLocaleString()}
For detailed information, please refer to the attached JSON report.
`;
  }

  private generateErrorAlertHTML(error: any, dealershipId: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: #f44336; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .error-box { background-color: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 20px 0; }
        .timestamp { color: #666; font-size: 14px; }
        .footer { background-color: #f4f4f4; padding: 15px; text-align: center; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚨 VeeOtto Critical Error Alert</h1>
        <p>Dealership: ${dealershipId}</p>
    </div>
    
    <div class="content">
        <div class="error-box">
            <h2>Error Details</h2>
            <p><strong>Message:</strong> ${error.message || 'Unknown error'}</p>
            <p><strong>Type:</strong> ${error.name || 'Error'}</p>
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
            ${error.stack ? `<p><strong>Stack Trace:</strong></p><pre>${error.stack}</pre>` : ''}
        </div>
        
        <h2>Recommended Actions</h2>
        <ul>
            <li>Check the automation logs for additional context</li>
            <li>Verify system connectivity and authentication</li>
            <li>Review recent configuration changes</li>
            <li>Contact support if the issue persists</li>
        </ul>
    </div>
    
    <div class="footer">
        <p>This alert was generated automatically by VeeOtto</p>
        <p class="timestamp">Alert sent at: ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`;
  }

  private generateErrorAlertText(error: any, dealershipId: string): string {
    return `
VeeOtto Critical Error Alert
============================

🚨 CRITICAL ERROR DETECTED 🚨

Dealership: ${dealershipId}
Timestamp: ${new Date().toLocaleString()}

Error Details:
- Message: ${error.message || 'Unknown error'}
- Type: ${error.name || 'Error'}

${error.stack ? `Stack Trace:\n${error.stack}` : ''}

Recommended Actions:
- Check the automation logs for additional context
- Verify system connectivity and authentication
- Review recent configuration changes
- Contact support if the issue persists

This alert was generated automatically by VeeOtto at ${new Date().toLocaleString()}
`;
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