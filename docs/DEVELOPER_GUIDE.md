# Vee Otto Developer Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Architecture Overview](#architecture-overview)
3. [Development Workflow](#development-workflow)
4. [Core Concepts](#core-concepts)
5. [Adding New Features](#adding-new-features)
6. [Testing Strategy](#testing-strategy)
7. [Code Style & Best Practices](#code-style--best-practices)
8. [Debugging & Troubleshooting](#debugging--troubleshooting)
9. [Performance Optimization](#performance-optimization)
10. [Contributing](#contributing)

## Getting Started

### Prerequisites

- Node.js 18+ and npm 8+
- Git
- VS Code (recommended) or your preferred IDE
- Chrome browser
- Basic knowledge of TypeScript, React, and Playwright

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/vee-otto.git
cd vee-otto

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Setup development environment
cp .env.example .env
cp config/email-config.example.json config/email-config.json

# Install VS Code extensions (recommended)
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension ms-playwright.playwright
```

### IDE Configuration

**.vscode/settings.json**:
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.DS_Store": true
  }
}
```

## Architecture Overview

### System Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  React Dashboard├─────┤  Express Server  ├─────┤  vAuto Website  │
│                 │     │                  │     │                 │
└────────┬────────┘     └────────┬─────────┘     └─────────────────┘
         │                       │
         │ WebSocket             │
         │                       │
         └───────────┬───────────┘
                     │
            ┌────────┴────────┐
            │                 │
            │  Automation     │
            │  Engine         │
            │                 │
            └─────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────┴────┐  ┌───┴────┐  ┌───┴────┐
   │Playwright│  │UI Vision│  │  OCR   │
   └─────────┘  └─────────┘  └─────────┘
```

### Directory Structure

```
vee-otto/
├── src/
│   ├── agents/              # Automation agents
│   ├── services/            # Business logic services
│   ├── utils/               # Utility functions
│   ├── types/               # TypeScript type definitions
│   ├── config/              # Configuration modules
│   └── frontend/            # React dashboard
│       ├── components/      # Reusable components
│       ├── pages/           # Page components
│       ├── services/        # API services
│       └── hooks/           # Custom React hooks
├── scripts/                 # CLI scripts
├── tests/                   # Test suites
├── config/                  # Configuration files
└── docs/                    # Documentation
```

### Key Components

1. **Agents**: Encapsulate browser automation logic
2. **Services**: Handle external integrations (OCR, email, etc.)
3. **Utils**: Shared utility functions
4. **Frontend**: React-based operations dashboard
5. **Scripts**: Entry points for various operations

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and test locally
npm run dev

# Run tests
npm test

# Commit changes
git add .
git commit -m "feat: add your feature description"

# Push and create PR
git push origin feature/your-feature-name
```

### 2. Local Development

```bash
# Start all services
npm run dev:all

# Or start individually
npm run server:dev      # Backend server
npm run dashboard:dev   # Frontend dashboard
npm run vauto:test      # Test automation
```

### 3. Hot Reloading

- **Backend**: Uses nodemon for auto-restart
- **Frontend**: Webpack dev server with HMR
- **Tests**: Use `--watch` flag for continuous testing

## Core Concepts

### 1. Agent Hierarchy

```typescript
BaseAutomationAgent
  └── HybridAutomationAgent
        └── VAutoAgent
```

Each level adds functionality:
- **Base**: Core browser operations
- **Hybrid**: Adds UI Vision and OCR fallbacks
- **VAuto**: Specific vAuto workflows

### 2. Reliability Pattern

```typescript
// Primary method
try {
  await page.click(selector);
} catch {
  // Fallback 1: UI Vision
  try {
    await uiVision.visualClick(imageTarget);
  } catch {
    // Fallback 2: OCR + Click
    const text = await ocr.extractText();
    await clickNearText(text);
  }
}
```

### 3. Feature Mapping

```typescript
// Extract features from text
const features = extractFeaturesFromText(stickerText);

// Map to checkboxes with fuzzy matching
const mappings = features.map(feature => 
  mapFeatureToCheckbox(feature, availableCheckboxes)
);

// Apply with confidence threshold
const validMappings = mappings.filter(m => m.confidence > 0.85);
```

### 4. Event-Driven Architecture

```typescript
agent.on('vehicle:processed', (result) => {
  // Update dashboard
  io.emit('completion:new', result);
  
  // Log metrics
  metrics.recordProcessing(result);
  
  // Send notifications if needed
  if (result.errors) {
    notificationService.sendAlert(result);
  }
});
```

## Adding New Features

### 1. Adding a New Agent Method

```typescript
// src/agents/VAutoAgent.ts
export class VAutoAgent extends HybridAutomationAgent {
  async yourNewMethod(params: YourParams): Promise<YourResult> {
    // 1. Validate inputs
    if (!params.required) {
      throw new Error('Missing required parameter');
    }

    // 2. Log operation start
    this.logger.info('Starting yourNewMethod', { params });

    // 3. Implement with error handling
    try {
      // Your logic here
      const result = await this.doSomething(params);
      
      // 4. Emit events
      this.emit('your:event', { result });
      
      // 5. Return typed result
      return {
        success: true,
        data: result
      };
    } catch (error) {
      // 6. Handle errors
      this.logger.error('yourNewMethod failed', { error });
      throw error;
    }
  }
}
```

### 2. Adding a New Service

```typescript
// src/services/YourService.ts
import { Logger } from '../utils/Logger';

export class YourService {
  private logger: Logger;

  constructor(private config: YourConfig) {
    this.logger = new Logger('YourService');
  }

  async initialize(): Promise<void> {
    // Setup logic
  }

  async yourMethod(): Promise<YourResult> {
    // Implementation
  }

  async cleanup(): Promise<void> {
    // Cleanup logic
  }
}
```

### 3. Adding Dashboard Component

```tsx
// src/frontend/components/YourComponent/index.tsx
import React, { useState, useEffect } from 'react';
import styles from './YourComponent.module.css';

interface YourComponentProps {
  data: YourData;
  onAction: (action: string) => void;
}

export const YourComponent: React.FC<YourComponentProps> = ({ 
  data, 
  onAction 
}) => {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    // Subscribe to updates
    const handler = (update: Update) => setState(update);
    socket.on('your:update', handler);
    
    return () => {
      socket.off('your:update', handler);
    };
  }, []);

  return (
    <div className={styles.container}>
      {/* Your UI */}
    </div>
  );
};
```

### 4. Adding API Endpoint

```typescript
// src/server.ts
app.get('/api/your-endpoint', async (req, res) => {
  try {
    // Validate request
    const { param } = req.query;
    if (!param) {
      return res.status(400).json({ error: 'Missing parameter' });
    }

    // Process request
    const result = await yourService.process(param);

    // Return response
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('API error', { error });
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});
```

## Testing Strategy

### 1. Unit Tests

```typescript
// tests/unit/featureMapping.test.ts
import { mapFeatureToCheckbox } from '../../src/utils/featureMapping';

describe('Feature Mapping', () => {
  it('should map exact matches', () => {
    const result = mapFeatureToCheckbox(
      'Leather Seats',
      ['Leather Seats', 'Cloth Seats']
    );
    
    expect(result).toEqual({
      featureName: 'Leather Seats',
      checkboxLabel: 'Leather Seats',
      confidence: 1.0
    });
  });

  it('should handle fuzzy matches', () => {
    const result = mapFeatureToCheckbox(
      'Lthr Seats',
      ['Leather Seats', 'Cloth Seats']
    );
    
    expect(result.confidence).toBeGreaterThan(0.85);
  });
});
```

### 2. Integration Tests

```typescript
// tests/integration/vAutoFlow.test.ts
import { VAutoAgent } from '../../src/agents/VAutoAgent';

describe('vAuto Flow Integration', () => {
  let agent: VAutoAgent;

  beforeAll(async () => {
    agent = new VAutoAgent({ headless: true });
    await agent.initialize();
  });

  afterAll(async () => {
    await agent.cleanup();
  });

  it('should complete login flow', async () => {
    const success = await agent.login();
    expect(success).toBe(true);
  });
});
```

### 3. E2E Tests

```typescript
// tests/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard E2E', () => {
  test('should display metrics', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Wait for metrics to load
    await expect(page.locator('[data-testid="metric-tile"]'))
      .toHaveCount(3);
    
    // Check WebSocket connection
    await expect(page.locator('[data-testid="status-indicator"]'))
      .toHaveText('Operational');
  });
});
```

### 4. Performance Tests

```typescript
// tests/performance/reliability.test.ts
describe('Performance Benchmarks', () => {
  it('should process vehicle in under 30 seconds', async () => {
    const start = Date.now();
    await agent.processVehicle('TEST_VIN');
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(30000);
  });
});
```

## Code Style & Best Practices

### TypeScript Guidelines

1. **Use strict typing**
   ```typescript
   // Good
   function processData(data: VehicleData): ProcessResult {
     return { success: true, count: data.vehicles.length };
   }

   // Bad
   function processData(data: any): any {
     return { success: true, count: data.vehicles.length };
   }
   ```

2. **Prefer interfaces over types**
   ```typescript
   // Good
   interface UserConfig {
     name: string;
     settings: Settings;
   }

   // Less preferred
   type UserConfig = {
     name: string;
     settings: Settings;
   };
   ```

3. **Use enums for constants**
   ```typescript
   enum Status {
     Pending = 'PENDING',
     Processing = 'PROCESSING',
     Complete = 'COMPLETE'
   }
   ```

### React Guidelines

1. **Functional components with hooks**
   ```tsx
   const MyComponent: React.FC<Props> = ({ data }) => {
     const [state, setState] = useState(initial);
     
     useEffect(() => {
       // Effect logic
     }, [dependency]);
     
     return <div>{/* JSX */}</div>;
   };
   ```

2. **Custom hooks for logic**
   ```tsx
   function useVehicleData(vin: string) {
     const [data, setData] = useState(null);
     const [loading, setLoading] = useState(true);
     
     useEffect(() => {
       fetchVehicleData(vin).then(setData);
     }, [vin]);
     
     return { data, loading };
   }
   ```

### Error Handling

1. **Always handle errors explicitly**
   ```typescript
   try {
     const result = await riskyOperation();
     return { success: true, data: result };
   } catch (error) {
     logger.error('Operation failed', { 
       error: error instanceof Error ? error.message : String(error),
       context: { /* relevant context */ }
     });
     
     // Re-throw or return error result
     return { success: false, error: error.message };
   }
   ```

2. **Use custom error classes**
   ```typescript
   class VAutoError extends Error {
     constructor(
       message: string, 
       public code: string, 
       public details?: any
     ) {
       super(message);
       this.name = 'VAutoError';
     }
   }
   ```

### Logging Best Practices

```typescript
// Use structured logging
logger.info('Processing vehicle', {
  vin: vehicle.vin,
  features: vehicle.features.length,
  timestamp: new Date().toISOString()
});

// Log levels:
// - debug: Detailed information for debugging
// - info: General information about normal operations
// - warn: Warning messages for potentially problematic situations
// - error: Error messages for definite problems
```

## Debugging & Troubleshooting

### 1. Browser Debugging

```typescript
// Enable visual debugging
const agent = new VAutoAgent({
  headless: false,
  slowMo: 1000  // Slow down by 1 second
});

// Take screenshots at key points
await page.screenshot({ path: 'debug-step1.png' });

// Pause execution
await page.pause();  // Opens Playwright Inspector
```

### 2. Network Debugging

```typescript
// Log all network requests
page.on('request', request => {
  console.log('Request:', request.url());
});

page.on('response', response => {
  console.log('Response:', response.status(), response.url());
});
```

### 3. Memory Profiling

```typescript
// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  console.log(`Memory: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
}, 5000);
```

### 4. Performance Profiling

```typescript
// Use performance marks
performance.mark('operation-start');

// Do operation
await heavyOperation();

performance.mark('operation-end');
performance.measure('operation', 'operation-start', 'operation-end');

const measure = performance.getEntriesByName('operation')[0];
console.log(`Operation took ${measure.duration}ms`);
```

## Performance Optimization

### 1. Caching Strategies

```typescript
class CachedSelector {
  private cache = new Map<string, any>();
  private ttl = 5000; // 5 seconds

  async get(selector: string, fetcher: () => Promise<any>) {
    const cached = this.cache.get(selector);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.value;
    }

    const value = await fetcher();
    this.cache.set(selector, { value, timestamp: Date.now() });
    return value;
  }
}
```

### 2. Parallel Processing

```typescript
// Process multiple vehicles in parallel
const results = await Promise.all(
  vehicles.map(vehicle => 
    limiter.schedule(() => processVehicle(vehicle))
  )
);
```

### 3. Resource Management

```typescript
// Reuse browser context
class BrowserPool {
  private pool: Browser[] = [];
  
  async acquire(): Promise<Browser> {
    return this.pool.pop() || await chromium.launch();
  }
  
  release(browser: Browser): void {
    if (this.pool.length < 5) {
      this.pool.push(browser);
    } else {
      browser.close();
    }
  }
}
```

## Contributing

### 1. Code Review Checklist

- [ ] TypeScript types are properly defined
- [ ] Error handling is comprehensive
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] Performance impact is considered
- [ ] Security implications reviewed

### 2. Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add window sticker OCR fallback
fix: resolve checkbox mapping issue
docs: update API documentation
test: add integration tests for login flow
refactor: simplify feature extraction logic
perf: optimize vehicle processing loop
```

### 3. Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] My code follows the project style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [UI Vision RPA Guide](https://ui.vision/rpa)
- [Tesseract.js Documentation](https://tesseract.projectnaptha.com/)

## Support

- **Slack**: #vee-otto-dev
- **GitHub Issues**: [Create Issue](https://github.com/yourusername/vee-otto/issues/new)
- **Wiki**: [Developer Wiki](https://github.com/yourusername/vee-otto/wiki)