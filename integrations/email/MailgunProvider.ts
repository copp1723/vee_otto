import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs-extra';
import { EmailProvider, EmailMessage, TwoFactorCode } from './EmailProvider';

export class MailgunProvider extends EmailProvider {
  private baseUrl: string;

  constructor(config: any) {
    super(config);
    this.baseUrl = config.mailgun?.baseUrl || `https://api.mailgun.net/v3/${config.mailgun?.domain}`;
  }

  async initialize(): Promise<void> {
    const isConnected = await this.testConnection();
    if (!isConnected) {
      throw new Error('Failed to initialize Mailgun connection');
    }
    this.logger.info('Mailgun provider initialized successfully');
  }

  async sendEmail(message: EmailMessage): Promise<void> {
    try {
      const form = new FormData();
      
      form.append('from', `${this.config.from.name || 'Automation Agent'} <${this.config.from.email}>`);
      
      const recipients = Array.isArray(message.to) ? message.to : [message.to];
      recipients.forEach(recipient => form.append('to', recipient));
      
      form.append('subject', message.subject);
      
      if (message.text) form.append('text', message.text);
      if (message.html) form.append('html', message.html);

      // Add tags
      if (message.tags) {
        message.tags.forEach(tag => form.append('o:tag', tag));
      } else {
        form.append('o:tag', 'ai-agent');
      }

      // Add attachments
      if (message.attachments) {
        for (const attachment of message.attachments) {
          if (await fs.pathExists(attachment.path)) {
            const fileStream = fs.createReadStream(attachment.path);
            form.append('attachment', fileStream, {
              filename: attachment.filename,
              contentType: this.getContentType(attachment.path)
            });
          }
        }
      }

      await axios.post(`${this.baseUrl}/messages`, form, {
        auth: {
          username: 'api',
          password: this.config.mailgun!.apiKey
        },
        headers: form.getHeaders()
      });

      this.logger.info('Email sent successfully via Mailgun', {
        recipients: recipients.length,
        subject: message.subject
      });

    } catch (error: any) {
      this.logger.error('Failed to send email via Mailgun', {
        error: error.message || error,
        subject: message.subject
      });
      throw error;
    }
  }

  async waitForTwoFactorCode(timeoutMs: number = 300000, fromDomain?: string): Promise<TwoFactorCode> {
    this.logger.warn('2FA code retrieval not implemented for Mailgun. Use webhook handler instead.');
    throw new Error('2FA code retrieval requires webhook handler for Mailgun');
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.sendEmail({
        to: this.config.from.email,
        subject: 'Mailgun Connection Test',
        text: 'This is a test email to verify Mailgun configuration.',
        tags: ['connection-test']
      });
      return true;
    } catch (error: any) {
      this.logger.error('Mailgun connection test failed', { error: error.message || error });
      return false;
    }
  }

  async close(): Promise<void> {
    this.logger.info('Mailgun provider closed');
  }
}