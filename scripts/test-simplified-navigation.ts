import { connectToExistingSession } from '../core/browser/sessionManager';
import { Logger } from '../core/utils/Logger';
import { SimplifiedTabNavigator } from './simplified-tab-navigation';

async function testSimplifiedNavigation() {
  const logger = new Logger({ module: 'TestSimplifiedNavigation' });
  logger.info('🚀 Starting Simplified Tab Navigation Test...');

  try {
    const { page } = await connectToExistingSession();
    logger.info('✅ Connected to existing session');

    // Create navigator instance
    const navigator = new SimplifiedTabNavigator(page, logger);

    // Step 1: Check current status
    logger.info('\n📊 Step 1: Checking current status...');
    const alreadyOnVehicleInfo = await navigator.isOnVehicleInfoTab();
    logger.info(`Currently on Vehicle Info tab: ${alreadyOnVehicleInfo}`);

    // Step 2: Navigate to Vehicle Info if needed
    if (!alreadyOnVehicleInfo) {
      logger.info('\n📑 Step 2: Navigating to Vehicle Info tab...');
      const navSuccess = await navigator.navigateToVehicleInfoTab();
      
      if (!navSuccess) {
        logger.error('❌ Failed to navigate to Vehicle Info tab');
        
        // Debug: Check what's visible in the modal
        logger.info('\n🔍 Debug: Checking visible elements...');
        const debugInfo = await page.evaluate(() => {
          const modal = document.querySelector('.x-window');
          const tabs = Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent?.includes('Vehicle Info') && 
            !el.children.length
          );
          
          return {
            modalVisible: !!modal,
            modalClass: modal?.className,
            tabsFound: tabs.length,
            tabDetails: tabs.slice(0, 3).map(tab => ({
              tag: tab.tagName,
              class: tab.className,
              text: tab.textContent,
              visible: (tab as HTMLElement).offsetParent !== null
            }))
          };
        });
        
        logger.info('Debug info:', JSON.stringify(debugInfo, null, 2));
        return;
      }
    }

    // Step 3: Click Factory Equipment
    logger.info('\n🏭 Step 3: Clicking Factory Equipment button...');
    const clickSuccess = await navigator.clickFactoryEquipment();
    
    if (clickSuccess) {
      logger.info('✅ Successfully clicked Factory Equipment!');
      
      // Check for new windows
      const pages = page.context().pages();
      logger.info(`\n📊 Browser now has ${pages.length} page(s)`);
      
      if (pages.length > 1) {
        const newPage = pages[pages.length - 1];
        const title = await newPage.title();
        const url = newPage.url();
        logger.info(`New window opened: ${title} - ${url}`);
      }
    } else {
      logger.error('❌ Failed to click Factory Equipment');
    }

    // Take screenshot for reference
    await page.screenshot({ path: `test-simplified-navigation-${Date.now()}.png` });
    logger.info('📸 Screenshot saved');

  } catch (error) {
    logger.error('❌ Error in simplified navigation test:', error);
  }
}

// Run the test
testSimplifiedNavigation().catch(console.error);