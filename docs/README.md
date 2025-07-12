# Vee Otto - Generic Browser Automation Framework

A flexible, reusable browser automation framework built with Playwright for web scraping, form filling, and automated interactions with support for 2FA via email forwarding.

## Features

- 🤖 **Generic Browser Automation**: Configurable automation for any web platform
- 🔐 **2FA Support**: Automated two-factor authentication via email forwarding (Mailgun)
- 📸 **Screenshot Capture**: Automatic screenshots at key points and on errors
- 📧 **Email Notifications**: Send reports and alerts via SMTP or Mailgun
- 🔧 **Modular Architecture**: Easy to extend for new platforms
- ⚡ **Built on Playwright**: Fast, reliable browser automation
- 🎯 **Configurable Selectors**: Platform-specific selectors via configuration

## Quick Start

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd vee_otto
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your platform credentials and settings
   ```

3. **Configure Email/Mailgun (for 2FA)**
   ```bash
   cp mailgun-config.example.json mailgun-config.json
   # Edit with your Mailgun API credentials
   ```

4. **Run the Automation**
   ```bash
   npm run start:dev
   ```

## Project Structure

```
vee_otto/
├── src/
│   ├── agents/           # Automation agents
│   │   └── BaseAutomationAgent.ts
│   ├── services/         # External services (email, notifications)
│   │   ├── EmailService.ts
│   │   ├── MailgunService.ts
│   │   └── NotificationService.ts
│   ├── utils/            # Utility functions
│   │   ├── browserUtils.ts
│   │   ├── FileManager.ts
│   │   └── Logger.ts
│   ├── config/           # Configuration files
│   │   └── selectors.ts  # Platform-specific selectors
│   └── types/            # TypeScript types
├── test-*.ts             # Test files
├── run-autonomous-agent.ts # Main entry point
└── package.json
```

## Configuration

### Environment Variables

See `.env.example` for all available options:

- **Platform Settings**: URL, credentials, selectors
- **Browser Options**: Headless mode, timeouts
- **2FA Settings**: Email selectors, code inputs
- **Notification Services**: Email, webhooks

### Platform Selectors

Define platform-specific selectors in `src/config/selectors.ts`:

```typescript
export const vAutoSelectors: PlatformSelectors = {
  login: {
    url: 'https://app.vauto.com/login',
    usernameSelector: '//input[@id="username"]',
    passwordSelector: '//input[@id="password"]',
    // ...
  }
};
```

## Usage Examples

### Basic Login Automation

```typescript
const agent = new BaseAutomationAgent({
  headless: false,
  screenshotOnError: true
});

await agent.execute(async () => {
  await agent.login({
    url: 'https://example.com/login',
    usernameSelector: 'input[name="username"]',
    passwordSelector: 'input[name="password"]',
    submitSelector: 'button[type="submit"]',
    username: 'user@example.com',
    password: 'password',
    successIndicator: '.dashboard'
  });
});
```

### With 2FA Support

```typescript
await agent.handle2FA({
  enabled: true,
  emailSelector: '//button[contains(text(), "Email")]',
  codeInputSelector: '//input[@name="code"]',
  submitSelector: '//button[contains(text(), "Verify")]',
  successIndicator: '.authenticated'
});
```

## Extending for New Platforms

1. Add platform selectors to `src/config/selectors.ts`
2. Create a custom agent extending `BaseAutomationAgent`
3. Implement platform-specific logic
4. Update environment configuration

## Development

```bash
# Run in development mode
npm run start:dev

# Run tests
npm run test-email-connection
npm run test-mailgun

# Build TypeScript
npm run build
```

## License

MIT