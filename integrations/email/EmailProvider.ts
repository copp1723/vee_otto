import { Logger } from '../../core/utils/Logger';

export interface EmailConfig {
  provider: 'smtp' | 'mailgun';
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
  };
  mailgun?: {
    apiKey: string;
    domain: string;
    baseUrl?: string;
  };
  from: {
    email: string;
    name?: string;
  };
  recipients: string[];
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    path: string;
  }>;
  tags?: string[];
}

export interface TwoFactorCode {
  code: string;
  timestamp: Date;
  source: string;
}

export abstract class EmailProvider {
  protected config: EmailConfig;
  protected logger: Logger;

  constructor(config: EmailConfig) {
    this.config = config;
    this.logger = new Logger(this.constructor.name);
  }

  abstract initialize(): Promise<void>;
  abstract sendEmail(message: EmailMessage): Promise<void>;
  abstract waitForTwoFactorCode(timeoutMs?: number, fromDomain?: string): Promise<TwoFactorCode>;
  abstract testConnection(): Promise<boolean>;
  abstract close(): Promise<void>;

  // Common utility methods
  protected formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  protected getContentType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const contentTypes: { [key: string]: string } = {
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      'csv': 'text/csv',
      'pdf': 'application/pdf',
      'txt': 'text/plain'
    };
    return contentTypes[ext || ''] || 'application/octet-stream';
  }

  // High-level methods using templates
  async sendReportEmail(
    reportPath: string,
    reportName: string,
    platformName: string,
    metadata: any
  ): Promise<void> {
    const template = new EmailTemplates();
    const { subject, html, text } = template.reportDelivery({
      reportName,
      platformName,
      metadata,
      reportPath
    });

    await this.sendEmail({
      to: this.config.recipients,
      subject,
      html,
      text,
      attachments: [{ filename: reportName, path: reportPath }],
      tags: ['report-delivery', platformName.toLowerCase()]
    });
  }

  async sendNotificationEmail(
    subject: string,
    message: string,
    isError: boolean = false
  ): Promise<void> {
    const template = new EmailTemplates();
    const { html, text } = template.notification({ subject, message, isError });

    await this.sendEmail({
      to: this.config.recipients,
      subject: `${isError ? '❌' : '✅'} ${subject}`,
      html,
      text,
      tags: ['notification', isError ? 'error' : 'success']
    });
  }
}

// Consolidated email templates
class EmailTemplates {
  reportDelivery(data: {
    reportName: string;
    platformName: string;
    metadata: any;
    reportPath: string;
  }) {
    const subject = `📊 ${data.reportName} Report - ${data.platformName} (${new Date().toLocaleDateString()})`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">📊 Automated Report Delivery</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Your ${data.platformName} report has been successfully extracted</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
          <h2 style="color: #495057; margin-top: 0;">Report Details</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr style="background: white;">
              <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; width: 30%;">Report Name:</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${data.reportName}</td>
            </tr>
            <tr style="background: #f8f9fa;">
              <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Platform:</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${data.platformName}</td>
            </tr>
            <tr style="background: white;">
              <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold;">Extracted:</td>
              <td style="padding: 12px; border: 1px solid #dee2e6;">${data.metadata.extractedAt || new Date().toISOString()}</td>
            </tr>
          </table>

          <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <h3 style="color: #155724; margin: 0 0 10px 0;">✅ Extraction Successful</h3>
            <p style="color: #155724; margin: 0;">The report has been automatically extracted and is attached to this email.</p>
          </div>

          <p style="color: #6c757d; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            This is an automated message from your Automation Agent.
          </p>
        </div>
      </div>
    `;

    const text = `
📊 Automated Report Delivery

Report Details:
- Report Name: ${data.reportName}
- Platform: ${data.platformName}
- Extracted: ${data.metadata.extractedAt || new Date().toISOString()}

✅ Extraction Successful
The report has been automatically extracted and is attached to this email.

This is an automated message from your Automation Agent.
    `;

    return { subject, html, text };
  }

  notification(data: { subject: string; message: string; isError: boolean }) {
    const color = data.isError ? '#dc3545' : '#28a745';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">${data.subject}</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
          <p style="color: #495057; font-size: 16px; line-height: 1.5;">${data.message}</p>
          
          <p style="color: #6c757d; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            This is an automated notification from your Automation Agent.
            <br>Timestamp: ${new Date().toISOString()}
          </p>
        </div>
      </div>
    `;

    const text = `${data.subject}\n\n${data.message}\n\nThis is an automated notification from your Automation Agent.\nTimestamp: ${new Date().toISOString()}`;

    return { html, text };
  }
}