#!/usr/bin/env npx tsx

import { chromium, Browser, Page } from 'playwright';
import { ExperimentalVAutoAgent } from '../core/agents/ExperimentalVAutoAgent';
import { HybridAutomationAgent } from '../core/agents/HybridAutomationAgent';
import { Logger } from '../core/utils/Logger';
import * as path from 'path';

const logger = new Logger('StagehandTest');

interface TestCase {
  name: string;
  url: string;
  actions: Array<{
    type: 'navigate' | 'click' | 'fill' | 'extract';
    instruction: string;
    value?: string;
    selector?: string;
    humanName?: string;
    runComparison?: boolean;
  }>;
}

const TEST_CASES: TestCase[] = [
  {
    name: 'Basic Google Search Test',
    url: 'https://www.google.com',
    actions: [
      {
        type: 'navigate',
        instruction: 'Navigate to Google search page',
        runComparison: true
      },
      {
        type: 'fill',
        instruction: 'search input field',
        value: 'Stagehand AI automation',
        selector: 'input[name="q"]',
        humanName: 'Google search box',
        runComparison: true
      },
      {
        type: 'click',
        instruction: 'search button or press enter',
        selector: 'input[name="btnK"]',
        humanName: 'Google search button',
        runComparison: false
      }
    ]
  },
  {
    name: 'Example.com Simple Test',
    url: 'https://example.com',
    actions: [
      {
        type: 'navigate',
        instruction: 'Navigate to example.com',
        runComparison: true
      },
      {
        type: 'extract',
        instruction: 'Extract the main heading text from the page'
      }
    ]
  }
];

async function runStagehandTest(): Promise<void> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  let experimentalAgent: ExperimentalVAutoAgent | null = null;

  try {
    logger.info('🚀 Starting Stagehand Experimental Test');

    // Launch browser
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });

    page = await browser.newPage();

    // Create hybrid automation agent
    const hybridAgent = new HybridAutomationAgent(page, browser, {
      headless: false,
      timeout: 15000,
      retries: 2,
      screenshotOnFailure: true,
      performanceMonitoring: true
    });

    // Create experimental agent
    experimentalAgent = new ExperimentalVAutoAgent(
      page, 
      browser, 
      hybridAgent, 
      path.join(process.cwd(), 'config/experimental.json')
    );

    // Initialize experimental agent
    await experimentalAgent.initialize();

    logger.info('✅ Experimental agent initialized successfully');

    // Run test cases
    for (const testCase of TEST_CASES) {
      logger.info(`🧪 Running test case: ${testCase.name}`);
      
      try {
        await runTestCase(experimentalAgent, testCase);
        logger.info(`✅ Test case passed: ${testCase.name}`);
      } catch (error) {
        logger.error(`❌ Test case failed: ${testCase.name}`, error);
        
        // Take screenshot on failure
        try {
          const screenshot = await page.screenshot({ fullPage: false });
          logger.info(`📸 Screenshot captured for failed test: ${testCase.name}`);
        } catch (screenshotError) {
          logger.warn('Failed to capture screenshot', screenshotError);
        }
      }

      // Wait between test cases
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Get and display metrics
    const metrics = experimentalAgent.getMetrics();
    const actionHistory = experimentalAgent.getActionHistory();

    logger.info('📊 Final Test Metrics:', {
      totalActions: metrics.session.totalActions,
      stagehandActions: metrics.session.stagehandActions,
      fallbackActions: metrics.session.fallbackActions,
      failedActions: metrics.session.failedActions,
      successRateStagehand: metrics.performance.successRateStagehand,
      successRateFallback: metrics.performance.successRateFallback
    });

    logger.info('📈 Action History Summary:', {
      totalComparisons: actionHistory.length,
      stagehandWins: actionHistory.filter(a => a.winner === 'stagehand').length,
      fallbackWins: actionHistory.filter(a => a.winner === 'fallback').length,
      ties: actionHistory.filter(a => a.winner === 'tie').length,
      bothFailed: actionHistory.filter(a => a.winner === 'both_failed').length
    });

    // Export metrics
    try {
      const exportPath = await experimentalAgent.exportMetrics('json');
      logger.info(`📁 Metrics exported to: ${exportPath}`);
    } catch (exportError) {
      logger.warn('Failed to export metrics', exportError);
    }

  } catch (error) {
    logger.error('❌ Test execution failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (experimentalAgent) {
      await experimentalAgent.cleanup();
    }
    
    if (browser) {
      await browser.close();
    }
    
    logger.info('🧹 Cleanup completed');
  }
}

async function runTestCase(agent: ExperimentalVAutoAgent, testCase: TestCase): Promise<void> {
  for (const action of testCase.actions) {
    logger.info(`🎯 Executing action: ${action.type} - ${action.instruction}`);

    try {
      switch (action.type) {
        case 'navigate':
          const navResult = await agent.smartNavigate(
            action.instruction,
            testCase.url,
            {
              timeout: 15000,
              runComparison: action.runComparison
            }
          );
          
          if (!navResult.success) {
            throw new Error(`Navigation failed: ${navResult.error}`);
          }
          break;

        case 'click':
          const clickResult = await agent.smartClick(
            action.instruction,
            action.selector,
            action.humanName,
            {
              timeout: 10000,
              runComparison: action.runComparison
            }
          );
          
          if (!clickResult.success) {
            throw new Error(`Click failed: ${clickResult.error}`);
          }
          break;

        case 'fill':
          if (!action.value) {
            throw new Error('Fill action requires a value');
          }
          
          const fillResult = await agent.smartFill(
            action.instruction,
            action.value,
            action.selector,
            action.humanName,
            {
              timeout: 10000,
              verifyInput: true,
              runComparison: action.runComparison
            }
          );
          
          if (!fillResult.success) {
            throw new Error(`Fill failed: ${fillResult.error}`);
          }
          break;

        case 'extract':
          const extractResult = await agent.extractData(
            action.instruction,
            { timeout: 10000 }
          );
          
          if (!extractResult.success) {
            throw new Error(`Extract failed: ${extractResult.error}`);
          }
          
          logger.info(`📝 Extracted data:`, extractResult.data);
          break;

        default:
          throw new Error(`Unknown action type: ${(action as any).type}`);
      }

      logger.info(`✅ Action completed: ${action.type}`);

      // Brief pause between actions
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      logger.error(`❌ Action failed: ${action.type} - ${action.instruction}`, error);
      throw error;
    }
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  runStagehandTest().catch(error => {
    logger.error('💥 Test execution crashed:', error);
    process.exit(1);
  });
}

export { runStagehandTest, TEST_CASES };