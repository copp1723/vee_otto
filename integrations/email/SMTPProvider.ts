import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { EmailProvider, EmailMessage, TwoFactorCode } from './EmailProvider';

export class SMTPProvider extends EmailProvider {
  private smtpTransporter: nodemailer.Transporter;
  private imapClient: ImapFlow | null = null;

  constructor(config: any) {
    super(config);
    
    this.smtpTransporter = nodemailer.createTransport({
      host: config.smtp!.host,
      port: config.smtp!.port,
      secure: config.smtp!.secure,
      auth: config.smtp!.auth,
      tls: { rejectUnauthorized: false }
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.smtpTransporter.verify();
      this.logger.info('SMTP connection verified');
      
      await this.connectIMAP();
      this.logger.info('SMTP provider initialized successfully');
    } catch (error: any) {
      this.logger.error('Failed to initialize SMTP provider', { error: error.message || error });
      throw error;
    }
  }

  private async connectIMAP(): Promise<void> {
    if (this.imapClient) {
      await this.imapClient.logout();
    }

    this.imapClient = new ImapFlow({
      host: this.config.smtp!.host,
      port: 993, // Standard IMAP SSL port
      secure: true,
      auth: this.config.smtp!.auth,
      logger: false
    });

    await this.imapClient.connect();
    this.logger.info('IMAP connection established');
  }

  async sendEmail(message: EmailMessage): Promise<void> {
    try {
      const recipients = Array.isArray(message.to) ? message.to : [message.to];
      
      for (const recipient of recipients) {
        await this.smtpTransporter.sendMail({
          from: `"${this.config.from.name || 'Automation Agent'}" <${this.config.from.email}>`,
          to: recipient,
          subject: message.subject,
          text: message.text,
          html: message.html,
          attachments: message.attachments?.map(att => ({
            filename: att.filename,
            path: att.path,
            contentType: this.getContentType(att.path)
          }))
        });
      }

      this.logger.info('Email sent successfully via SMTP', {
        recipients: recipients.length,
        subject: message.subject
      });

    } catch (error: any) {
      this.logger.error('Failed to send email via SMTP', {
        error: error.message || error,
        subject: message.subject
      });
      throw error;
    }
  }

  async waitForTwoFactorCode(timeoutMs: number = 300000, fromDomain: string = 'example.com'): Promise<TwoFactorCode> {
    const startTime = Date.now();
    
    try {
      if (!this.imapClient) {
        await this.connectIMAP();
      }

      await this.imapClient!.mailboxOpen('INBOX');
      this.logger.info(`Waiting for 2FA code from ${fromDomain}...`);

      while (Date.now() - startTime < timeoutMs) {
        try {
          const searchCriteria = {
            from: fromDomain,
            since: new Date(startTime - 60000)
          };

          const messages = await this.imapClient!.search(searchCriteria);
          
          if (Array.isArray(messages) && messages.length > 0) {
            for (const messageSeq of messages) {
              const email = await this.imapClient!.fetchOne(messageSeq, { source: true });
              
              if (email && email.source) {
                const parsed = await simpleParser(email.source);
                const code = this.extract2FACode(parsed.text || '', parsed.html || '');
                
                if (code) {
                  return {
                    code,
                    timestamp: parsed.date || new Date(),
                    source: parsed.from?.text || 'unknown'
                  };
                }
              }
            }
          }

          await new Promise(resolve => setTimeout(resolve, 5000));

        } catch (searchError: any) {
          this.logger.debug('Search iteration failed, retrying...', { error: searchError.message });
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      throw new Error(`Timeout waiting for 2FA code from ${fromDomain}`);

    } catch (error: any) {
      this.logger.error('Failed to retrieve 2FA code', { error: error.message || error });
      throw error;
    }
  }

  private extract2FACode(text: string, html: string): string | null {
    const content = text + ' ' + html;
    
    const patterns = [
      /verification code[:\s]+(\d{4,8})/i,
      /your code[:\s]+(\d{4,8})/i,
      /security code[:\s]+(\d{4,8})/i,
      /access code[:\s]+(\d{4,8})/i,
      /(\d{6})/g,
      /(\d{4})/g,
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        const code = matches[1] || matches[0];
        if (/^\d{4,8}$/.test(code)) {
          return code;
        }
      }
    }

    return null;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.smtpTransporter.verify();
      return true;
    } catch (error: any) {
      this.logger.error('SMTP connection test failed', { error: error.message || error });
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.imapClient) {
        await this.imapClient.logout();
        this.imapClient = null;
      }
      this.smtpTransporter.close();
      this.logger.info('SMTP provider closed');
    } catch (error: any) {
      this.logger.error('Error closing SMTP provider', { error: error.message || error });
    }
  }
}