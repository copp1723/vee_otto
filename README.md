# Vee Otto - AI-Powered vAuto Automation Suite

<div align="center">
  <img src="docs/images/vee-otto-logo.png" alt="Vee Otto Logo" width="200"/>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)](https://www.typescriptlang.org/)
  [![Playwright](https://img.shields.io/badge/Playwright-1.40-green)](https://playwright.dev/)
  [![React](https://img.shields.io/badge/React-18.2-61dafb)](https://reactjs.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
</div>

## 🚀 Overview

Vee Otto is an enterprise-grade AI browser automation agent that revolutionizes vAuto inventory management. By automating feature extraction from window stickers, checkbox updates, and multi-book synchronization, it reduces vehicle processing time from 5-7 minutes to under 30 seconds while preventing costly valuation errors.

### Key Features

- **🤖 Hybrid Automation**: 95%+ reliability using Playwright with UI Vision and OCR fallbacks
- **📊 Operations Dashboard**: Real-time metrics, action queues, and performance analytics
- **🔄 Multi-Book Sync**: Automatic synchronization across J.D. Power, Black Book, and KBB
- **🎯 Smart Feature Mapping**: Fuzzy matching with 85%+ accuracy threshold
- **⏰ Scheduled Processing**: Timezone-aware runs at 7am/2pm with email reports
- **🔐 Enterprise Security**: Encrypted credentials, 2FA support, comprehensive audit logs

## 📈 Business Impact

- **80% Time Reduction**: Process 150+ vehicles in under 2 hours vs 13+ hours manually
- **$500-2,200 Error Prevention**: Per vehicle by capturing all paid features
- **90% Queue Reduction**: "No Price/No Pending" queue shrinks from 150+ to <20 daily
- **100% Feature Consistency**: Across all book values and descriptions

## 🛠️ Technology Stack

- **Frontend**: React 18.2, TypeScript, CSS Modules, Recharts
- **Backend**: Node.js, Express, Socket.io (WebSocket)
- **Automation**: Playwright, UI Vision RPA, Tesseract.js (OCR)
- **Utilities**: Winston (logging), p-retry, p-queue, fuzzball (fuzzy matching)

## 📦 Installation

### Prerequisites

- Node.js 18+ and npm
- Chrome/Chromium browser
- UI Vision RPA extension (for visual fallbacks)
- Git

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/vee-otto.git
cd vee-otto

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Copy environment configuration
cp .env.example .env
cp config/email-config.example.json config/email-config.json
cp config/mailgun-config.example.json config/mailgun-config.json

# Edit .env with your vAuto credentials and settings
```

## 🚀 Usage

### Running the Automation

```bash
# Single run
npm run vauto:once

# Scheduled runs (7am/2pm)
npm run vauto

# Test mode with mock data
npm run vauto:test

# Run with specific configuration
npm run automation -- --config custom-config.json
```

### Operations Dashboard

```bash
# Start development server
npm run dashboard:dev

# Build for production
npm run dashboard:build

# Run production server
npm run dashboard:prod
```

Access the dashboard at `http://localhost:3000`

### Testing & Reliability

```bash
# Run hybrid reliability tests
npm run test:reliability

# Run specific test suites
npm run test:email
npm run test:mailgun
npm run test:vauto

# Run with CI mode
CI=true npm run test:reliability
```

## 🏗️ Architecture

```
vee-otto/
├── src/
│   ├── agents/              # Automation agents
│   │   ├── BaseAutomationAgent.ts
│   │   ├── HybridAutomationAgent.ts
│   │   └── VAutoAgent.ts
│   ├── services/            # External integrations
│   │   ├── OCRService.ts
│   │   ├── UIVisionService.ts
│   │   └── VAutoScheduler.ts
│   ├── utils/               # Shared utilities
│   │   ├── browserUtils.ts
│   │   ├── reliabilityUtils.ts
│   │   └── featureMapping.ts
│   └── frontend/            # React dashboard
│       └── pages/Dashboard/
├── config/                  # Configuration files
├── tests/                   # Test suites
├── scripts/                 # CLI scripts
└── docs/                    # Documentation
```

## ⚙️ Configuration

### Environment Variables (.env)

```bash
# vAuto Credentials
VAUTO_USERNAME=your_username
VAUTO_PASSWORD=your_password
VAUTO_DEALERSHIP_ID=12345

# Automation Settings
HEADLESS=false
ENABLE_UI_VISION=true
ENABLE_OCR=true
DEFAULT_RETRIES=3

# Dashboard
DASHBOARD_PORT=3000
WEBSOCKET_PORT=3001

# Notifications
SMTP_HOST=smtp.gmail.com
NOTIFICATION_EMAIL=inventory@dealership.com
```

### Feature Mapping Configuration

Edit `config/featureMapping.json` to customize feature detection:

```json
{
  "priorityFeatures": [
    "Leather Seats",
    "Navigation System",
    "Sunroof"
  ],
  "packageMappings": {
    "Competition Package": [
      "Adaptive Cruise Control",
      "Lane Keeping Assist"
    ]
  }
}
```

## 📊 Metrics & Monitoring

The Operations Dashboard provides real-time insights:

- **Key Metrics**: No Price/Pending count, time saved, value protected
- **Action Queue**: Vehicles requiring manual review with issue categorization
- **Recent Completions**: Last 5 processed vehicles with outcomes
- **Performance Charts**: 7-day trends for all metrics

## 🔧 Advanced Features

### Hybrid Automation Strategy

1. **Primary**: Playwright browser automation
2. **Fallback 1**: UI Vision visual recognition
3. **Fallback 2**: OCR text extraction
4. **Fallback 3**: File download and parsing

### Rate Limiting & Performance

- OCR operations: Max 2 concurrent, 1-second interval
- Locator caching: 5-second TTL
- Element stability checks before interactions
- Exponential backoff retry logic

### Security Features

- Encrypted credential storage
- 2FA support via email/Mailgun
- Comprehensive audit logging
- Role-based access control (coming soon)

## 🧪 Development

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests with Playwright
npm run test:e2e

# Coverage report
npm run test:coverage
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- TypeScript strict mode enabled
- ESLint configuration provided
- Prettier for formatting
- Commit messages follow Conventional Commits

## 📝 API Reference

### VAutoAgent Methods

```typescript
// Process entire inventory
await agent.processInventory(options?: ProcessOptions)

// Process single vehicle
await agent.processVehicle(vin: string, options?: VehicleOptions)

// Extract window sticker features
await agent.extractWindowStickerFeatures(stickerUrl: string)

// Update checkboxes
await agent.updateFeatureCheckboxes(features: Feature[])
```

### Event Emitters

```typescript
agent.on('vehicle:processed', (data) => {
  console.log(`Processed ${data.vin} in ${data.duration}ms`);
});

agent.on('error', (error) => {
  console.error('Processing error:', error);
});
```

## 🚨 Troubleshooting

### Common Issues

**Login Failures**
- Verify credentials in `.env`
- Check for UI changes in vAuto
- Enable visual debugging: `HEADLESS=false`

**OCR Accuracy**
- Ensure good image quality
- Adjust confidence threshold
- Check language settings

**Performance Issues**
- Reduce concurrent operations
- Increase timeouts for slow connections
- Enable caching

### Debug Mode

```bash
# Enable verbose logging
DEBUG=vee-otto:* npm run vauto:once

# Save screenshots on error
SCREENSHOT_ON_ERROR=true npm run vauto:once

# Record Playwright traces
PLAYWRIGHT_TRACE=on npm run vauto:once
```

## 📅 Roadmap

### Phase 1 (Current)
- ✅ Core automation engine
- ✅ Hybrid reliability system
- ✅ Operations dashboard
- 🔄 Book value synchronization

### Phase 2 (August 2025)
- Advanced flagging system
- Queue management improvements
- Multi-dealership support

### Phase 3 (September 2025)
- Photo assessment (<20 images detection)
- AI-powered feature suggestions
- Mobile app integration

### Phase 4 (Q4 2025)
- Machine learning optimization
- Predictive analytics
- Enterprise API

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

- **Documentation**: [Full Docs](https://vee-otto.readthedocs.io)
- **Issues**: [GitHub Issues](https://github.com/yourusername/vee-otto/issues)
- **Discord**: [Community Server](https://discord.gg/vee-otto)
- **Email**: support@vee-otto.ai

## 🙏 Acknowledgments

- Tom Fohr - Product Vision & Strategy
- Tré Hall - Business Requirements
- Rakesh Gohel - Technical Architecture
- The entire dev team for making this vision a reality

---

<div align="center">
  Built with ❤️ for the automotive industry
  
  Making inventory management intelligent, one vehicle at a time.
</div>