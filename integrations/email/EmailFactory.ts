import { EmailProvider, EmailConfig } from './EmailProvider';
import { MailgunProvider } from './MailgunProvider';
import { SMTPProvider } from './SMTPProvider';

export class EmailFactory {
  static create(config: EmailConfig): EmailProvider {
    switch (config.provider) {
      case 'mailgun':
        if (!config.mailgun) {
          throw new Error('Mailgun configuration is required when provider is "mailgun"');
        }
        return new MailgunProvider(config);
      
      case 'smtp':
        if (!config.smtp) {
          throw new Error('SMTP configuration is required when provider is "smtp"');
        }
        return new SMTPProvider(config);
      
      default:
        throw new Error(`Unsupported email provider: ${config.provider}`);
    }
  }
}

// Convenience function for quick setup
export async function createEmailProvider(config: EmailConfig): Promise<EmailProvider> {
  const provider = EmailFactory.create(config);
  await provider.initialize();
  return provider;
}