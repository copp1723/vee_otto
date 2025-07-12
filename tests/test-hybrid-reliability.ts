import { HybridAutomationAgent } from './src/agents/HybridAutomationAgent';
import { Logger } from './src/utils/Logger';
import dotenv from 'dotenv';
import fs from 'fs-extra';

// Load environment variables
dotenv.config();

const logger = new Logger('ReliabilityTest');

interface TestResult {
  testName: string;
  attempts: number;
  successes: number;
  failures: number;
  avgTime: number;
  errorDetails: string[];
}

async function measureReliability(
  testName: string,
  testFn: () => Promise<boolean>,
  runs: number = 10
): Promise<TestResult> {
  const result: TestResult = {
    testName,
    attempts: runs,
    successes: 0,
    failures: 0,
    avgTime: 0,
    errorDetails: []
  };

  const times: number[] = [];

  for (let i = 1; i <= runs; i++) {
    logger.info(`Starting ${testName} - Run ${i}/${runs}`);
    
    const startTime = Date.now();
    
    try {
      const success = await testFn();
      const elapsed = Date.now() - startTime;
      times.push(elapsed);

      if (success) {
        result.successes++;
        logger.info(`✅ Run ${i} succeeded in ${elapsed}ms`);
      } else {
        result.failures++;
        result.errorDetails.push(`Run ${i}: Test returned false`);
        logger.warn(`❌ Run ${i} failed (returned false) in ${elapsed}ms`);
      }
    } catch (error) {
      const elapsed = Date.now() - startTime;
      times.push(elapsed);
      result.failures++;
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errorDetails.push(`Run ${i}: ${errorMsg}`);
      logger.error(`❌ Run ${i} failed with error in ${elapsed}ms: ${errorMsg}`);
    }

    // Wait between runs
    if (i < runs) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  result.avgTime = times.reduce((a, b) => a + b, 0) / times.length;

  return result;
}

async function runReliabilityTests() {
  logger.info('🚀 Starting Hybrid Reliability Tests');

  const config = {
    headless: false,
    enableUIVision: true,
    enableOCR: true,
    reliabilitySettings: {
      defaultRetries: 3,
      stabilityChecks: true,
      fuzzyMatching: true
    }
  };

  const results: TestResult[] = [];

  // Test 1: Login reliability
  const loginTest = await measureReliability(
    'Hybrid Login Test',
    async () => {
      const agent = new HybridAutomationAgent(config);
      try {
        await agent.initialize();
        
        const success = await agent.hybridLogin({
          url: process.env.PLATFORM_URL || 'https://app.vauto.com/login',
          usernameSelector: process.env.USERNAME_SELECTOR || '//input[@id="username"]',
          passwordSelector: process.env.PASSWORD_SELECTOR || '//input[@id="password"]',
          submitSelector: process.env.SUBMIT_SELECTOR || '//button[@type="submit"]',
          username: process.env.PLATFORM_USERNAME || 'test_user',
          password: process.env.PLATFORM_PASSWORD || 'test_pass',
          successIndicator: process.env.SUCCESS_INDICATOR || '//div[contains(@class, "dashboard")]',
          visualTargets: {
            username: 'images/username_field.png',
            password: 'images/password_field.png'
          }
        });

        return success;
      } finally {
        await agent.cleanup();
      }
    },
    5 // Run 5 times for login test
  );
  
  results.push(loginTest);

  // Test 2: Checkbox interaction reliability
  const checkboxTest = await measureReliability(
    'Hybrid Checkbox Test',
    async () => {
      const agent = new HybridAutomationAgent(config);
      try {
        await agent.initialize();
        
        // Simulate navigation to a page with checkboxes
        if (agent.page) {
          await agent.page.goto('file://' + process.cwd() + '/test-pages/checkboxes.html');
          
          const result = await agent.updateCheckboxes(
            ['#checkbox1', '#checkbox2', '#checkbox3'],
            [true, false, true],
            {
              visualVerification: true,
              checkboxImages: {
                checked: 'images/checkbox_checked.png',
                unchecked: 'images/checkbox_unchecked.png'
              }
            }
          );

          return result.success >= 2; // At least 2 out of 3 successful
        }
        
        return false;
      } finally {
        await agent.cleanup();
      }
    },
    10 // Run 10 times for checkbox test
  );

  results.push(checkboxTest);

  // Test 3: Dynamic content scraping reliability
  const scrapingTest = await measureReliability(
    'Hybrid Scraping Test',
    async () => {
      const agent = new HybridAutomationAgent(config);
      try {
        await agent.initialize();
        
        if (agent.page) {
          // Test on a sample page with dynamic content
          await agent.page.goto('file://' + process.cwd() + '/test-pages/dynamic-content.html');
          
          const content = await agent.scrapeWindowSticker(
            'a[href="#sticker"]',
            {
              useOCR: true,
              downloadFallback: true
            }
          );

          return content !== null && content.length > 0;
        }
        
        return false;
      } finally {
        await agent.cleanup();
      }
    },
    10 // Run 10 times for scraping test
  );

  results.push(scrapingTest);

  // Generate report
  generateReport(results);
}

function generateReport(results: TestResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('HYBRID RELIABILITY TEST REPORT');
  console.log('='.repeat(80) + '\n');

  let totalAttempts = 0;
  let totalSuccesses = 0;

  results.forEach(result => {
    const successRate = (result.successes / result.attempts * 100).toFixed(2);
    
    console.log(`📊 ${result.testName}`);
    console.log(`   Attempts: ${result.attempts}`);
    console.log(`   Successes: ${result.successes} (${successRate}%)`);
    console.log(`   Failures: ${result.failures}`);
    console.log(`   Avg Time: ${result.avgTime.toFixed(0)}ms`);
    
    if (result.errorDetails.length > 0) {
      console.log(`   Errors:`);
      result.errorDetails.slice(0, 3).forEach(error => {
        console.log(`     - ${error}`);
      });
      if (result.errorDetails.length > 3) {
        console.log(`     ... and ${result.errorDetails.length - 3} more`);
      }
    }
    
    console.log('');
    
    totalAttempts += result.attempts;
    totalSuccesses += result.successes;
  });

  const overallSuccessRate = (totalSuccesses / totalAttempts * 100).toFixed(2);
  
  console.log('='.repeat(80));
  console.log(`OVERALL SUCCESS RATE: ${overallSuccessRate}%`);
  console.log(`TARGET: 95%+ | STATUS: ${parseFloat(overallSuccessRate) >= 95 ? '✅ PASSED' : '❌ NEEDS IMPROVEMENT'}`);
  console.log('='.repeat(80) + '\n');

  // Save detailed report
  const reportPath = `./reliability-report-${Date.now()}.json`;
  fs.writeJsonSync(reportPath, {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      totalAttempts,
      totalSuccesses,
      overallSuccessRate: parseFloat(overallSuccessRate)
    }
  }, { spaces: 2 });

  console.log(`📄 Detailed report saved to: ${reportPath}`);
}

// Create test pages if they don't exist
async function createTestPages() {
  await fs.ensureDir('./test-pages');

  // Create checkbox test page
  const checkboxHtml = `
<!DOCTYPE html>
<html>
<head><title>Checkbox Test</title></head>
<body>
  <h1>Checkbox Test Page</h1>
  <div>
    <input type="checkbox" id="checkbox1" /> <label for="checkbox1">Option 1</label><br>
    <input type="checkbox" id="checkbox2" /> <label for="checkbox2">Option 2</label><br>
    <input type="checkbox" id="checkbox3" /> <label for="checkbox3">Option 3</label><br>
  </div>
</body>
</html>`;

  await fs.writeFile('./test-pages/checkboxes.html', checkboxHtml);

  // Create dynamic content test page
  const dynamicHtml = `
<!DOCTYPE html>
<html>
<head><title>Dynamic Content Test</title></head>
<body>
  <h1>Window Sticker Test</h1>
  <a href="#sticker" onclick="loadSticker()">View Window Sticker</a>
  <div id="sticker-content" style="display:none; margin-top: 20px; border: 1px solid #ccc; padding: 20px;">
    <h2>Vehicle Window Sticker</h2>
    <p>VIN: 1HGCM82633A123456</p>
    <p>Model: 2023 Honda Accord</p>
    <p>MSRP: $28,990</p>
  </div>
  <script>
    function loadSticker() {
      setTimeout(() => {
        document.getElementById('sticker-content').style.display = 'block';
      }, 1000);
    }
  </script>
</body>
</html>`;

  await fs.writeFile('./test-pages/dynamic-content.html', dynamicHtml);
}

// Run the tests
async function main() {
  try {
    await createTestPages();
    await runReliabilityTests();
  } catch (error) {
    logger.error('Test suite failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}