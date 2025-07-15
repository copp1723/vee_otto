import { Page, FrameLocator } from 'playwright';
import { TIMEOUTS } from '../config/constants';

export interface WindowStickerAccessResult {
  success: boolean;
  windowStickerPage?: Page;
  content?: string;
  method: 'iframe-tab' | 'new-window' | 'inline' | 'direct-link';
  error?: string;
}

export class WindowStickerAccessService {
  private page: Page;
  private logger: any;

  constructor(page: Page, logger: any) {
    this.page = page;
    this.logger = logger;
  }

  /**
   * Access window sticker following the exact workflow:
   * 1. Select iframe: id=GaugePageIFrame
   * 2. Click Factory Equipment tab: id=ext-gen201
   * 3. Switch to window: title=factory-equipment-details
   * 4. Extract content
   */
  async accessWindowSticker(): Promise<WindowStickerAccessResult> {
    this.logger.info('📄 Accessing window sticker following exact workflow...');

    // Strategy 1: Exact workflow - iframe → tab → window
    const iframeResult = await this.tryIframeTabWindow();
    if (iframeResult.success) return iframeResult;

    // Strategy 2: Direct tab click (no iframe)
    const directResult = await this.tryDirectTabClick();
    if (directResult.success) return directResult;

    // Strategy 3: Look for direct window sticker link
    const linkResult = await this.tryDirectStickerLink();
    if (linkResult.success) return linkResult;

    return {
      success: false,
      method: 'iframe-tab',
      error: 'All window sticker access methods failed'
    };
  }

  /**
   * Strategy 1: Follow exact workflow - iframe → Factory Equipment tab → new window
   */
  private async tryIframeTabWindow(): Promise<WindowStickerAccessResult> {
    try {
      this.logger.info('🖼️ Step 1: Selecting GaugePageIFrame...');
      
      // Wait for iframe to be available
      await this.page.waitForSelector('#GaugePageIFrame', { timeout: TIMEOUTS.NAVIGATION });
      const iframe = this.page.frameLocator('#GaugePageIFrame');
      
      // Verify iframe is accessible
      await iframe.locator('body').waitFor({ timeout: TIMEOUTS.NAVIGATION });
      this.logger.info('✅ GaugePageIFrame selected successfully');

      this.logger.info('🏭 Step 2: Clicking Factory Equipment tab (id=ext-gen201)...');
      
      // Click the specific Factory Equipment tab ID from workflow
      const factoryTab = iframe.locator('#ext-gen201');
      await factoryTab.waitFor({ timeout: TIMEOUTS.NAVIGATION });
      await factoryTab.click();
      
      this.logger.info('🪟 Step 3: Waiting for factory-equipment-details window...');
      
      // Wait for new window to open
      const [newPage] = await Promise.all([
        this.page.context().waitForEvent('page', { timeout: TIMEOUTS.PAGE_LOAD }),
        this.page.waitForTimeout(2000) // Give time for window to open
      ]);

      if (newPage) {
        await newPage.waitForLoadState('networkidle');
        const title = await newPage.title();
        
        if (title === 'factory-equipment-details' || title.includes('factory-equipment')) {
          this.logger.info('✅ Factory equipment details window opened');
          
          const content = await this.extractWindowStickerContent(newPage);
          return {
            success: true,
            windowStickerPage: newPage,
            content,
            method: 'iframe-tab'
          };
        }
      }

      return { success: false, method: 'iframe-tab', error: 'Factory equipment window not found' };

    } catch (error) {
      this.logger.warn('Iframe tab window method failed:', error);
      return { 
        success: false, 
        method: 'iframe-tab', 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Strategy 2: Direct Factory Equipment tab click (no iframe)
   */
  private async tryDirectTabClick(): Promise<WindowStickerAccessResult> {
    try {
      this.logger.info('🏭 Trying direct Factory Equipment tab click...');
      
      const tabSelectors = [
        '#ext-gen201',
        '#ext-gen175',
        '//a[contains(text(), "Factory Equipment")]',
        '//div[contains(@class, "x-tab") and contains(text(), "Factory Equipment")]'
      ];

      for (const selector of tabSelectors) {
        try {
          const tab = this.page.locator(selector).first();
          if (await tab.isVisible({ timeout: 2000 })) {
            await tab.click();
            await this.page.waitForTimeout(2000);
            
            // Check for new window
            const pages = this.page.context().pages();
            for (const p of pages) {
              const title = await p.title();
              if (title.includes('factory-equipment')) {
                const content = await this.extractWindowStickerContent(p);
                return {
                  success: true,
                  windowStickerPage: p,
                  content,
                  method: 'new-window'
                };
              }
            }
            
            // Check for inline content
            const inlineContent = await this.extractInlineContent();
            if (inlineContent) {
              return {
                success: true,
                content: inlineContent,
                method: 'inline'
              };
            }
          }
        } catch (e) {
          continue;
        }
      }

      return { success: false, method: 'new-window', error: 'No Factory Equipment tab found' };

    } catch (error) {
      return { 
        success: false, 
        method: 'new-window', 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Strategy 3: Look for direct window sticker link
   */
  private async tryDirectStickerLink(): Promise<WindowStickerAccessResult> {
    try {
      this.logger.info('🔗 Looking for direct window sticker link...');
      
      const linkSelectors = [
        '//a[contains(text(), "Window Sticker")]',
        '//a[contains(text(), "Monroney")]',
        '//button[contains(text(), "View Window Sticker")]',
        '//a[contains(@href, "window-sticker")]',
        '//a[contains(@href, "factory-equipment")]'
      ];

      for (const selector of linkSelectors) {
        try {
          const link = this.page.locator(selector).first();
          if (await link.isVisible({ timeout: 2000 })) {
            const [newPage] = await Promise.all([
              this.page.context().waitForEvent('page', { timeout: TIMEOUTS.PAGE_LOAD }),
              link.click()
            ]).catch(() => [null]);

            if (newPage) {
              await newPage.waitForLoadState('networkidle');
              const content = await this.extractWindowStickerContent(newPage);
              return {
                success: true,
                windowStickerPage: newPage,
                content,
                method: 'direct-link'
              };
            }
          }
        } catch (e) {
          continue;
        }
      }

      return { success: false, method: 'direct-link', error: 'No direct sticker link found' };

    } catch (error) {
      return { 
        success: false, 
        method: 'direct-link', 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Extract window sticker content from page
   */
  private async extractWindowStickerContent(page: Page): Promise<string> {
    const contentSelectors = [
      '//div[contains(@class, "window-sticker-details")]',
      '//div[contains(@class, "factory-equipment-content")]',
      '//div[contains(@class, "sticker-content")]',
      'body'
    ];

    for (const selector of contentSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          const content = await element.textContent();
          if (content && content.length > 100) {
            return content;
          }
        }
      } catch (e) {
        continue;
      }
    }

    return await page.textContent('body') || '';
  }

  /**
   * Extract inline window sticker content (when no new window opens)
   */
  private async extractInlineContent(): Promise<string | null> {
    const inlineSelectors = [
      '//div[contains(@class, "window-sticker")]',
      '//div[contains(@class, "factory-equipment")]',
      '//div[contains(@class, "equipment-details")]'
    ];

    for (const selector of inlineSelectors) {
      try {
        const element = this.page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          const content = await element.textContent();
          if (content && content.length > 100) {
            return content;
          }
        }
      } catch (e) {
        continue;
      }
    }

    return null;
  }
}