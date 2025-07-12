# vAuto Automation Core

This module implements automated vehicle inventory processing for vAuto, including:
- Twice-daily scheduled runs (7am/2pm per dealership timezone)
- Automatic login with 2FA support via email
- Inventory filtering for vehicles aged 0-1 days
- Window sticker content extraction and parsing
- Automatic checkbox updates based on vehicle features
- Comprehensive reporting via email

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example environment file:
```bash
cp .env.vauto.example .env
```

Edit `.env` with your credentials and settings:
- `VAUTO_USERNAME` - Your vAuto username
- `VAUTO_PASSWORD` - Your vAuto password
- `DEALERSHIP_ID` - Unique identifier for the dealership
- `DEALERSHIP_NAME` - Display name for reports
- `REPORT_EMAILS` - Comma-separated list of email recipients
- Mailgun configuration for email delivery

### 3. Configure 2FA Email Forwarding

Set up email forwarding to capture 2FA codes:
1. Configure your email to forward vAuto 2FA emails to Mailgun
2. Set up Mailgun routes to capture the codes
3. See `MAILGUN_SETUP.md` for detailed instructions

### 4. Test the Setup

Test individual components:
```bash
# Test vAuto selectors
npm run test-vauto -- --selectors

# Test full workflow (requires credentials)
npm run test-vauto -- --workflow

# Test email connection
npm run test-email-connection

# Test Mailgun
npm run test-mailgun
```

## Usage

### Scheduled Runs (Production)

Start the scheduler to run automatically at 7am and 2pm:
```bash
npm run vauto
```

With custom configuration file:
```bash
npm run vauto -- ./config/production.json
```

### Single Run (Testing)

Run once immediately:
```bash
npm run vauto:once
```

Test mode (runs immediately with test configuration):
```bash
npm run vauto:test
```

### Configuration Options

#### Environment Variables
See `.env.vauto.example` for all available options.

#### JSON Configuration
For multiple dealerships, use a JSON configuration file:

```json
{
  "dealerships": [
    {
      "id": "dealer1",
      "name": "Main Dealership",
      "timezone": "America/New_York",
      "username": "username1",
      "password": "password1",
      "recipientEmails": ["manager@dealer1.com"],
      "enabled": true
    },
    {
      "id": "dealer2",
      "name": "West Branch",
      "timezone": "America/Los_Angeles",
      "username": "username2",
      "password": "password2",
      "recipientEmails": ["manager@dealer2.com"],
      "enabled": true
    }
  ],
  "cronSchedule": "0 7,14 * * *",
  "mailgunConfig": {
    "apiKey": "key-xxx",
    "domain": "mg.yourdomain.com",
    "fromEmail": "automation@yourdomain.com"
  }
}
```

## Architecture

### Key Components

1. **VAutoAgent** (`src/agents/VAutoAgent.ts`)
   - Handles vAuto login with 2FA
   - Navigates inventory and applies filters
   - Processes vehicles and updates features
   - Generates reports

2. **VAutoScheduler** (`src/services/VAutoScheduler.ts`)
   - Manages cron jobs for each dealership
   - Handles timezone-specific scheduling
   - Coordinates agent runs and reporting

3. **Feature Mapping** (`src/config/featureMapping.ts`)
   - Maps window sticker text to vAuto checkboxes
   - Uses fuzzy matching for flexibility
   - Comprehensive feature dictionary

4. **Browser Utils** (`src/utils/browserUtils.ts`)
   - Enhanced reliability functions
   - Retry logic for flaky elements
   - Multiple fallback strategies

### Reliability Features

- **Retry Logic**: All clicks and interactions retry up to 3 times
- **Multiple Selectors**: Fallback selectors for critical elements
- **Screenshot on Error**: Captures state when failures occur
- **Loading Detection**: Waits for loading indicators to disappear
- **JavaScript Fallbacks**: Uses evaluate() when normal clicks fail

### Feature Detection

The system uses sophisticated feature matching:
1. Extracts text from window stickers
2. Parses into structured sections
3. Matches against known feature variations
4. Uses fuzzy matching (85% threshold) for flexibility
5. Updates only relevant checkboxes

## Monitoring

### Logs
- Detailed logs in console output
- Winston logger with timestamps
- Different log levels for debugging

### Reports
Each run generates:
- Summary statistics
- Per-vehicle processing details
- Error tracking
- Processing time metrics

### Notifications
- Email reports after each run
- Error notifications for failures
- Scheduler start/stop notifications

## Troubleshooting

### Common Issues

1. **Login Fails**
   - Verify credentials in `.env`
   - Check if vAuto changed their login page
   - Review screenshots in `screenshots/` folder

2. **2FA Not Working**
   - Verify email forwarding is set up
   - Check Mailgun routes configuration
   - Test with `npm run test-mailgun`

3. **Selectors Not Found**
   - Run selector test: `npm run test-vauto -- --selectors`
   - vAuto may have updated their UI
   - Check browser screenshots for actual elements

4. **Checkboxes Not Updating**
   - Verify feature mapping in `featureMapping.ts`
   - Check if checkbox labels match expected format
   - Enable debug logging for detailed info

### Debug Mode

Run with full debugging:
```bash
DEBUG=* npm run vauto:once
```

Run with browser visible:
```bash
HEADLESS=false npm run vauto:once
```

## Development

### Adding New Features

1. Add to feature map in `src/config/featureMapping.ts`
2. Test with sample window sticker text
3. Verify checkbox selectors match

### Updating Selectors

1. Use browser developer tools on vAuto site
2. Update selectors in `src/config/vautoSelectors.ts`
3. Test with `npm run test-vauto -- --selectors`

### Custom Processing Logic

Override methods in `VAutoAgent` for custom behavior:
- `processVehicle()` - Modify per-vehicle logic
- `updateFeatureCheckboxes()` - Change checkbox logic
- `generateReport()` - Customize report format

## Security Notes

- Store credentials securely (use environment variables)
- Don't commit `.env` files
- Use separate accounts for production/testing
- Rotate passwords regularly
- Monitor for unusual activity

## Support

For issues:
1. Check logs for error details
2. Review screenshots in `screenshots/`
3. Verify configuration matches vAuto's current UI
4. Test individual components separately
