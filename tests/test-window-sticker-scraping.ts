import { chromium, Page, Browser } from 'playwright';
import { basicLoginTask, twoFactorAuthTask, navigateToInventoryTask, applyInventoryFiltersTask, allVAutoTasks } from '../platforms/vauto/tasks/VAutoTasks';
import { TaskOrchestrator } from '../core/services/TaskOrchestrator';
import { Logger } from '../core/utils/Logger';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const logger = new Logger('WindowStickerTest');

/**
 * Test script for window sticker scraping functionality
 * This test will:
 * 1. Apply recent inventory filter
 * 2. Click on a vehicle link
 * 3. Navigate to Vehicle Info tab
 * 4. Access Factory Equipment tab through iframe
 * 5. Scrape window sticker content from popup
 */
async function testWindowStickerScraping() {
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  try {
    logger.info('🚀 Starting Window Sticker Scraping Test...');
    
    // Launch browser
    browser = await chromium.launch({
      headless: false,
      slowMo: 100,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });
    
    page = await browser.newPage();
    
    // Configure test with mockup or real VAuto
    const isUsingMockup = process.env.VAUTO_MOCKUP === 'true';
    const config = {
      username: process.env.VAUTO_USERNAME || 'testuser',
      password: process.env.VAUTO_PASSWORD || 'testpass',
      dealershipId: process.env.VAUTO_DEALERSHIP_ID,
      webhookUrl: process.env.WEBHOOK_URL || 'http://localhost:3000/api/2fa/latest',
      maxVehiclesToProcess: 1, // Only process 1 vehicle for testing
      readOnlyMode: true // Don't modify checkboxes during test
    };
    
    if (isUsingMockup) {
      logger.info('📦 Using VAuto mockup for testing...');
      // Navigate to mockup instead of real VAuto
      await page.goto('http://localhost:5001/tests/fixtures/vauto-mockup/index.html');
    } else {
      logger.info('🌐 Using real VAuto for testing...');
    }
    
    // Create custom task that focuses on window sticker scraping
    const windowStickerTask = {
      id: 'window-sticker-test',
      name: 'Window Sticker Scraping Test',
      description: 'Test window sticker scraping functionality',
      dependencies: isUsingMockup ? [] : ['apply-filters'],
      timeout: 300000,
      retryCount: 1,
      critical: false,
      
      async execute(context: any): Promise<any> {
        const { page, config, logger } = context;
        
        logger.info('🔍 Starting window sticker scraping test...');
        
        const results = {
          vehiclesProcessed: 0,
          windowStickersScraped: 0,
          featuresExtracted: [] as string[],
          errors: [] as string[]
        };
        
        try {
          // Get vehicle links
          const vehicleLinks = await page.locator('//tr[contains(@class, "x-grid3-row")]//a').all();
          logger.info(`Found ${vehicleLinks.length} vehicle links`);
          
          if (vehicleLinks.length === 0) {
            throw new Error('No vehicle links found in inventory');
          }
          
          // Click first vehicle
          logger.info('Clicking on first vehicle link...');
          await vehicleLinks[0].click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);
          
          // Take screenshot of vehicle details page
          await page.screenshot({ 
            path: `screenshots/vehicle-details-${Date.now()}.png`,
            fullPage: true 
          });
          
          // Check if we're on Vehicle Info tab
          const vehicleInfoTab = page.locator('//a[contains(text(), "Vehicle Info")] | //div[contains(text(), "Vehicle Info")]').first();
          if (await vehicleInfoTab.isVisible()) {
            logger.info('Vehicle Info tab found, ensuring it\'s active...');
            await vehicleInfoTab.click();
            await page.waitForTimeout(1000);
          }
          
          // Try to access Factory Equipment through iframe
          logger.info('Looking for GaugePageIFrame...');
          const iframeElement = page.locator('#GaugePageIFrame');
          const iframeExists = await iframeElement.count() > 0;
          
          if (iframeExists) {
            logger.info('Found GaugePageIFrame, accessing Factory Equipment...');
            
            const gaugeIframe = page.frameLocator('#GaugePageIFrame');
            const factoryTabInFrame = gaugeIframe.locator('#ext-gen201').first();
            
            if (await factoryTabInFrame.isVisible()) {
              logger.info('Found Factory Equipment tab in iframe, clicking...');
              await factoryTabInFrame.click();
              await page.waitForTimeout(3000);
              
              // Check for new window
              const pages = page.context().pages();
              logger.info(`Open pages: ${pages.length}`);
              
              for (const p of pages) {
                const title = await p.title();
                const url = p.url();
                logger.info(`Page: ${title} - ${url}`);
                
                if (title.includes('factory-equipment') || url.includes('factory-equipment')) {
                  logger.info('✅ Found factory equipment window!');
                  
                  // Wait for content to load
                  await p.waitForLoadState('networkidle');
                  
                  // Take screenshot
                  await p.screenshot({
                    path: `screenshots/window-sticker-${Date.now()}.png`,
                    fullPage: true
                  });
                  
                  // Get all text content
                  const content = await p.textContent('body');
                  logger.info(`Window sticker content length: ${content?.length || 0} characters`);
                  
                  if (content) {
                    // Log first 500 characters
                    logger.info(`Content preview: ${content.substring(0, 500)}...`);
                    
                    // Extract features
                    const lines = content.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 3);
                    results.featuresExtracted = lines.slice(0, 20); // First 20 features
                    results.windowStickersScraped++;
                    
                    logger.info(`Extracted ${lines.length} features`);
                    logger.info(`Sample features: ${results.featuresExtracted.slice(0, 5).join(', ')}`);
                  }
                  
                  // Close the window
                  await p.close();
                  break;
                }
              }
            } else {
              logger.warn('Factory Equipment tab not visible in iframe');
            }
          } else {
            logger.warn('GaugePageIFrame not found');
          }
          
          results.vehiclesProcessed++;
          
        } catch (error) {
          logger.error('Window sticker test failed:', error);
          results.errors.push(error instanceof Error ? error.message : String(error));
        }
        
        return results;
      }
    };
    
    // Set up task orchestrator
    const orchestrator = new TaskOrchestrator('WindowStickerTest');
    
    // Register tasks
    if (!isUsingMockup) {
      // For real VAuto, run all prerequisite tasks
      allVAutoTasks.forEach(task => orchestrator.registerTask(task));
    }
    
    // Register our custom window sticker test task
    orchestrator.registerTask(windowStickerTask);
    
    // Execute tasks
    const results = await orchestrator.executeAll(page, config);
    
    // Log results
    logger.info('📊 Test Results:');
    const resultsSummary = orchestrator.generateSummary();
    logger.info(resultsSummary);
    
    // Check if window sticker was successfully scraped
    const stickerResult = orchestrator.getTaskResult('window-sticker-test');
    if (stickerResult && stickerResult.success && stickerResult.data) {
      logger.info('✅ Window sticker scraping test PASSED!');
      logger.info(`Successfully scraped ${stickerResult.data.windowStickersScraped} window sticker(s)`);
      logger.info(`Extracted ${stickerResult.data.featuresExtracted.length} features`);
    } else {
      logger.error('❌ Window sticker scraping test FAILED!');
      logger.error('No window stickers were successfully scraped');
      if (stickerResult?.error) {
        logger.error(`Error: ${stickerResult.error}`);
      }
    }
    
  } catch (error) {
    logger.error('Test failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
if (require.main === module) {
  testWindowStickerScraping()
    .then(() => {
      logger.info('✅ Test completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('❌ Test failed:', error);
      process.exit(1);
    });
} 