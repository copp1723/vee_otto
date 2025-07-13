# Stagehand Experimental Integration Guide

## Overview

This guide covers the experimental integration of [Stagehand](https://github.com/browserbase/stagehand) AI-powered browser automation into the vee_otto framework. This integration provides natural language browser automation capabilities as a potential enhancement to the existing Playwright + OCR automation system.

## 🚧 **EXPERIMENTAL STATUS**

**⚠️ Important: This is an experimental feature branch for evaluation purposes only.**

- **Branch**: `feature/stagehand-experimental`
- **Status**: Proof of Concept / Evaluation Phase
- **Production Ready**: No
- **Purpose**: Compare Stagehand AI automation against existing vee_otto methods

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    vee_otto + Stagehand                     │
├─────────────────────────────────────────────────────────────┤
│  ExperimentalVAutoAgent (Orchestration Layer)              │
│  ├── StagehandAdapter (Primary AI Automation)              │
│  │   └── StagehandService (Stagehand Wrapper)              │
│  └── HybridAutomationAgent (Fallback System)               │
│      ├── Playwright (Traditional Automation)               │
│      └── OCR Service (Visual Fallback)                     │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. StagehandService (`core/services/StagehandService.ts`)
- **Purpose**: Direct wrapper around Stagehand library
- **Features**: 
  - Stagehand initialization and configuration
  - Action execution (act, extract, observe, navigate)
  - Metrics collection and performance tracking
  - Error handling and cleanup

### 2. StagehandAdapter (`core/adapters/StagehandAdapter.ts`)
- **Purpose**: Bridge between vee_otto and Stagehand
- **Features**:
  - Smart automation methods with fallback support
  - Unified interface for natural language actions
  - Performance comparison capabilities
  - Hybrid automation when Stagehand fails

### 3. ExperimentalVAutoAgent (`core/agents/ExperimentalVAutoAgent.ts`)
- **Purpose**: Orchestrates experimental testing and comparison
- **Features**:
  - Side-by-side performance testing
  - Metrics collection and analysis
  - Configuration management
  - Results export and reporting

### 4. Experimental Configuration (`config/experimental.json`)
- **Purpose**: Central configuration for experimental features
- **Features**:
  - Stagehand settings and parameters
  - Fallback behavior configuration
  - Metrics and logging options
  - Safety and limit controls

## Installation & Setup

### 1. Switch to Experimental Branch
```bash
git checkout feature/stagehand-experimental
```

### 2. Install Dependencies
```bash
npm install
# Installs @browserbasehq/stagehand and dependencies
```

### 3. Configure Environment
Create or update your environment variables:
```bash
# Optional: For Browserbase cloud (if using remote environment)
export BROWSERBASE_API_KEY="your_api_key_here"

# For OpenAI API (required for Stagehand AI)
export OPENAI_API_KEY="your_openai_api_key_here"
```

### 4. Review Configuration
Edit `config/experimental.json` to customize:
- Stagehand model (default: `openai/gpt-4o`)
- Fallback behavior settings
- Metrics collection preferences
- Debug and logging options

## Usage Examples

### Basic Usage

```typescript
import { ExperimentalVAutoAgent } from './core/agents/ExperimentalVAutoAgent';
import { HybridAutomationAgent } from './core/agents/HybridAutomationAgent';
import { chromium } from 'playwright';

// Setup
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
const hybridAgent = new HybridAutomationAgent(page, browser);

// Initialize experimental agent
const experimentalAgent = new ExperimentalVAutoAgent(
  page, 
  browser, 
  hybridAgent
);
await experimentalAgent.initialize();

// Natural language automation
await experimentalAgent.smartNavigate(
  "Go to the login page", 
  "https://example.com/login"
);

await experimentalAgent.smartFill(
  "username field", 
  "testuser@example.com",
  'input[name="email"]',
  "Email input"
);

await experimentalAgent.smartClick(
  "login button", 
  'button[type="submit"]',
  "Login button"
);

// Extract data using AI
const result = await experimentalAgent.extractData(
  "Extract the user's profile information from the page"
);

console.log('Extracted data:', result.data);
```

### Performance Comparison Mode

```typescript
// Run side-by-side comparison (where possible)
const clickResult = await experimentalAgent.smartClick(
  "click the submit button",
  'button[type="submit"]',
  "Submit button",
  {
    timeout: 10000,
    runComparison: true  // This enables A/B testing
  }
);

// Check which method was used
console.log(`Method used: ${clickResult.method}`);
console.log(`Success: ${clickResult.success}`);
console.log(`Response time: ${clickResult.responseTime}ms`);

// Get comparison metrics
const metrics = experimentalAgent.getMetrics();
console.log('Performance comparison:', metrics.comparison);
```

## Available Scripts

### Run Experimental Test
```bash
npm run experimental:test
# Runs the comprehensive test suite comparing Stagehand vs traditional methods
```

### Run Stagehand-Only Test
```bash
npm run stagehand:test
# Tests only Stagehand functionality without comparison
```

### Generate Metrics Report
```bash
npm run stagehand:metrics
# Exports detailed performance and comparison metrics
```

### Compare Methods
```bash
npm run stagehand:compare
# Runs specific comparison tests between automation methods
```

## Understanding the Results

### Metrics Categories

#### 1. Session Metrics
- **Total Actions**: All automation actions performed
- **Stagehand Actions**: Actions performed using AI automation
- **Fallback Actions**: Actions performed using traditional methods
- **Failed Actions**: Actions that failed with both methods

#### 2. Performance Metrics
- **Average Response Time**: Time taken per action type
- **Success Rates**: Success percentage by method
- **Cost Estimates**: Rough API cost calculations

#### 3. Comparison Results
- **Stagehand Faster**: Cases where AI automation was faster
- **Fallback Faster**: Cases where traditional methods were faster
- **Equivalent**: Cases with similar performance
- **Winner Analysis**: Overall method comparison

### Sample Output
```json
{
  "sessionId": "exp_1641234567890_abc123",
  "metrics": {
    "session": {
      "totalActions": 15,
      "stagehandActions": 12,
      "fallbackActions": 3,
      "failedActions": 1
    },
    "performance": {
      "stagehandAvgResponseTime": 2340,
      "fallbackAvgResponseTime": 890,
      "successRateStagehand": 91.7,
      "successRateFallback": 100.0
    },
    "costs": {
      "estimatedStagehandCost": 0.18,
      "estimatedFallbackCost": 0.003
    }
  }
}
```

## Key Findings to Evaluate

### Potential Advantages of Stagehand
1. **Natural Language Interface**: More intuitive automation instructions
2. **Dynamic Element Detection**: Better handling of changing UI elements
3. **Context Understanding**: Can interpret page context and user intent
4. **Reduced Selector Brittleness**: Less dependence on specific CSS selectors

### Potential Disadvantages
1. **Response Time**: AI processing adds latency (typically 1-3 seconds)
2. **API Costs**: Each action requires API calls to OpenAI
3. **Reliability Variance**: AI decisions can be inconsistent
4. **Internet Dependency**: Requires stable connection to AI services

### Fallback Strategy Benefits
1. **Best of Both Worlds**: AI-first with traditional backup
2. **Reliability**: Ensures actions complete even if AI fails
3. **Cost Optimization**: Uses cheaper methods when possible
4. **Gradual Adoption**: Allows incremental integration

## Troubleshooting

### Common Issues

#### 1. Stagehand Initialization Fails
```bash
Error: Failed to initialize Stagehand
```
**Solutions**:
- Verify OpenAI API key is set: `echo $OPENAI_API_KEY`
- Check internet connectivity
- Ensure Stagehand package is installed: `npm list @browserbasehq/stagehand`

#### 2. Actions Timeout
```bash
Error: Action verification failed
```
**Solutions**:
- Increase timeout in `config/experimental.json`
- Check if page is fully loaded before actions
- Enable fallback mode for better reliability

#### 3. High API Costs
```bash
Warning: Estimated cost exceeding budget
```
**Solutions**:
- Set `stagehandPrimary: false` to use traditional methods primarily
- Reduce `maxActionsPerSession` in configuration
- Use comparison mode sparingly

### Debug Mode
Enable detailed logging:
```json
{
  "experimental": {
    "features": {
      "debugMode": true
    }
  },
  "logging": {
    "level": "debug",
    "logStagehandActions": true,
    "logFallbackActions": true
  }
}
```

## Next Steps & Evaluation Criteria

### Phase 1: Technical Validation (Current)
- ✅ Integration completeness
- ✅ Basic functionality testing
- ✅ Error handling and fallbacks
- ✅ Metrics collection system

### Phase 2: Performance Evaluation
- [ ] Response time analysis across action types
- [ ] Success rate comparison in real-world scenarios
- [ ] Cost-benefit analysis
- [ ] Reliability assessment under various conditions

### Phase 3: Decision Framework
Based on evaluation results, determine:
1. **Should Stagehand be adopted?** Performance vs. cost trade-offs
2. **What integration strategy?** AI-first, hybrid, or specific use cases
3. **What configuration?** Optimal settings for production use
4. **What migration plan?** Gradual rollout strategy if adopted

### Evaluation Questions
1. **Performance**: Does Stagehand improve automation success rates?
2. **Reliability**: Is the fallback system sufficient for production use?
3. **Cost**: Are the API costs justified by the benefits?
4. **Maintenance**: Does this reduce or increase maintenance overhead?
5. **User Experience**: Does natural language improve workflow efficiency?

## Security & Production Considerations

### Security Notes
- **API Keys**: Store securely, never commit to version control
- **Data Privacy**: Be aware that page content may be sent to OpenAI
- **Network Traffic**: AI calls increase network usage and latency

### Production Readiness Checklist
- [ ] Comprehensive error handling for all failure modes
- [ ] Rate limiting and quota management for API calls
- [ ] Monitoring and alerting for both Stagehand and fallback systems
- [ ] Cost controls and budget alerts
- [ ] Performance benchmarks and SLA definitions
- [ ] Rollback procedures if integration causes issues

## Support & Feedback

### Getting Help
1. **Check Logs**: Review detailed logs in `logs/experimental/`
2. **Review Metrics**: Export and analyze performance data
3. **Test Isolation**: Use individual test scripts to isolate issues
4. **Documentation**: Reference Stagehand official docs for AI-specific issues

### Providing Feedback
Document your evaluation findings:
- Performance characteristics in your specific use cases
- Cost analysis for your usage patterns
- Integration challenges or successes
- Recommendations for production adoption

---

**Remember**: This is an experimental integration for evaluation purposes. Take time to thoroughly test and analyze before making any production decisions.