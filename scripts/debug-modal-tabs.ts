import puppeteer from 'puppeteer';
import { connectToExistingSession } from '../core/browser/sessionManager';
import { Logger } from '../core/utils/Logger';

async function debugModalTabs() {
  const logger = new Logger({ module: 'DebugModalTabs' });
  logger.info('🔍 Starting Modal Tab Structure Debug...');

  try {
    // Connect to existing session
    const { page } = await connectToExistingSession();
    logger.info('✅ Connected to existing session');

    // Function to analyze tab structure
    const analyzeTabStructure = async () => {
      logger.info('\n🔍 Analyzing tab structure...\n');

      // Try multiple approaches to find the tabs
      const tabSelectors = [
        // ExtJS common tab selectors
        '.x-tab-strip .x-tab',
        '.x-tab-strip-wrap .x-tab',
        '.x-tab-panel-header .x-tab',
        '.x-tab-strip li',
        '.x-tab-strip td',
        
        // Look for spans/divs containing tab text
        'span:has-text("Vehicle Info")',
        'span:has-text("Pricing")',
        'span:has-text("Transfer Adv")',
        'span:has-text("Book Values")',
        'span:has-text("Media")',
        'span:has-text("Window Stickers")',
        'span:has-text("Lifecycle")',
        'span:has-text("Vehicle Log")',
        
        // More generic approaches
        '.x-tab-strip *',
        '.x-tab-panel-header *',
        
        // Look in the modal header
        '.x-window .x-window-header *',
        '.x-window-tc *',
        
        // Based on the modal structure
        '.x-window .x-tab',
        '.x-window .x-tab-strip-text',
        '.x-window span[class*="tab"]',
        '.x-window div[class*="tab"]'
      ];

      // Execute in browser context
      const tabInfo = await page.evaluate((selectors) => {
        const results: any = {};
        
        // Try each selector
        selectors.forEach(selector => {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              results[selector] = {
                count: elements.length,
                elements: Array.from(elements).slice(0, 10).map((el: any) => ({
                  tagName: el.tagName,
                  className: el.className,
                  id: el.id,
                  text: el.textContent?.trim().substring(0, 50),
                  isVisible: el.offsetParent !== null,
                  rect: {
                    top: el.getBoundingClientRect().top,
                    left: el.getBoundingClientRect().left,
                    width: el.getBoundingClientRect().width,
                    height: el.getBoundingClientRect().height
                  }
                }))
              };
            }
          } catch (e) {
            // Skip invalid selectors
          }
        });

        // Also get the modal structure
        const modal = document.querySelector('.x-window');
        const modalInfo = modal ? {
          className: modal.className,
          id: modal.id,
          headerHTML: modal.querySelector('.x-window-header')?.innerHTML?.substring(0, 500)
        } : null;

        // Look for all elements containing tab names
        const tabNames = ['Vehicle Info', 'Pricing', 'Transfer Adv', 'Book Values', 'Media', 'Window Stickers', 'Lifecycle', 'Vehicle Log'];
        const tabElements: any = {};
        
        tabNames.forEach(tabName => {
          const elements = Array.from(document.querySelectorAll('*')).filter((el: any) => 
            el.textContent?.trim() === tabName && 
            !el.children.length && // Leaf nodes only
            el.offsetParent !== null // Visible
          );
          
          if (elements.length > 0) {
            tabElements[tabName] = elements.map((el: any) => ({
              tagName: el.tagName,
              className: el.className,
              id: el.id,
              parentClassName: el.parentElement?.className,
              grandparentClassName: el.parentElement?.parentElement?.className,
              onclick: el.onclick?.toString() || el.parentElement?.onclick?.toString(),
              rect: {
                top: el.getBoundingClientRect().top,
                left: el.getBoundingClientRect().left
              }
            }));
          }
        });

        return {
          results,
          modalInfo,
          tabElements
        };
      }, tabSelectors);

      // Log the findings
      logger.info('📊 Tab Structure Analysis Results:');
      
      Object.entries(tabInfo.results).forEach(([selector, data]: [string, any]) => {
        if (data.count > 0) {
          logger.info(`\nSelector: ${selector}`);
          logger.info(`Found: ${data.count} elements`);
          data.elements.forEach((el: any, i: number) => {
            if (el.text && el.text.length > 0) {
              logger.info(`  ${i + 1}. ${el.tagName} | "${el.text}" | Visible: ${el.isVisible} | Class: ${el.className}`);
            }
          });
        }
      });

      logger.info('\n📑 Tab Elements by Name:');
      Object.entries(tabInfo.tabElements).forEach(([tabName, elements]: [string, any]) => {
        logger.info(`\n${tabName}:`);
        elements.forEach((el: any, i: number) => {
          logger.info(`  ${i + 1}. ${el.tagName} | Class: "${el.className}" | Parent: "${el.parentClassName}"`);
          if (el.onclick) {
            logger.info(`     onClick: ${el.onclick.substring(0, 100)}`);
          }
        });
      });

      // Try to identify clickable elements
      const clickableElements = await page.evaluate(() => {
        const tabs = ['Vehicle Info', 'Pricing', 'Transfer Adv', 'Book Values', 'Media', 'Window Stickers', 'Lifecycle', 'Vehicle Log'];
        const clickables: any[] = [];
        
        tabs.forEach(tabName => {
          // Find elements containing the tab name
          const elements = Array.from(document.querySelectorAll('*')).filter((el: any) => 
            el.textContent?.trim() === tabName && !el.children.length
          );
          
          elements.forEach((el: any) => {
            // Walk up the DOM tree to find clickable parent
            let current = el;
            let depth = 0;
            while (current && depth < 5) {
              if (current.onclick || 
                  current.tagName === 'A' || 
                  current.tagName === 'BUTTON' ||
                  current.className?.includes('x-tab') ||
                  current.className?.includes('clickable') ||
                  current.style?.cursor === 'pointer') {
                clickables.push({
                  tabName,
                  clickableTag: current.tagName,
                  clickableClass: current.className,
                  clickableId: current.id,
                  textElement: {
                    tag: el.tagName,
                    class: el.className
                  },
                  depth,
                  hasOnClick: !!current.onclick,
                  cursor: window.getComputedStyle(current).cursor
                });
                break;
              }
              current = current.parentElement;
              depth++;
            }
          });
        });
        
        return clickables;
      });

      logger.info('\n🖱️ Potentially Clickable Tab Elements:');
      clickableElements.forEach((item: any) => {
        logger.info(`\n${item.tabName}:`);
        logger.info(`  Clickable: ${item.clickableTag} | Class: "${item.clickableClass}" | ID: "${item.clickableId}"`);
        logger.info(`  Text in: ${item.textElement.tag} | Depth: ${item.depth} | Has onClick: ${item.hasOnClick}`);
      });

      // Take a screenshot for reference
      await page.screenshot({ path: `debug-modal-tabs-${Date.now()}.png`, fullPage: false });
      logger.info('\n📸 Screenshot saved for reference');
    };

    // Run the analysis
    await analyzeTabStructure();

    // Try to get the HTML of the tab area
    const tabAreaHTML = await page.evaluate(() => {
      const modal = document.querySelector('.x-window');
      const header = modal?.querySelector('.x-window-header');
      const tabStrip = document.querySelector('.x-tab-strip');
      
      return {
        modalHeader: header?.outerHTML?.substring(0, 1000),
        tabStrip: tabStrip?.outerHTML?.substring(0, 1000),
        modalTopSection: modal?.innerHTML?.substring(0, 2000)
      };
    });

    logger.info('\n📄 Tab Area HTML:');
    if (tabAreaHTML.tabStrip) {
      logger.info('Tab Strip HTML:', tabAreaHTML.tabStrip);
    }
    if (tabAreaHTML.modalHeader) {
      logger.info('Modal Header HTML:', tabAreaHTML.modalHeader);
    }

  } catch (error) {
    logger.error('❌ Error during tab structure debug:', error);
  }
}

// Run the debug
debugModalTabs().catch(console.error);