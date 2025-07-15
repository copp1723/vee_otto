import { Page, FrameLocator } from 'playwright';

export interface NavigationResult {
  success: boolean;
  method: string;
  contentPage?: Page;
  error?: string;
}

export class FactoryEquipmentNavigator {
  private page: Page;
  private logger: any;

  constructor(page: Page, logger: any) {
    this.page = page;
    this.logger = logger;
  }

  async navigateToFactoryEquipment(): Promise<NavigationResult> {
    // Strategy 1: Text-based tab selection (most reliable)
    const textResult = await this.tryTextBasedNavigation();
    if (textResult.success) return textResult;

    // Strategy 2: Position-based tab selection
    const positionResult = await this.tryPositionBasedNavigation();
    if (positionResult.success) return positionResult;

    // Strategy 3: Direct window sticker link
    const directResult = await this.tryDirectStickerLink();
    if (directResult.success) return directResult;

    return { success: false, method: 'all-failed', error: 'All navigation methods failed' };
  }

  private async tryTextBasedNavigation(): Promise<NavigationResult> {
    try {
      // Try within iframe first
      const iframe = this.page.frameLocator('#GaugePageIFrame');
      const iframeTab = iframe.locator('text=Factory Equipment').first();
      
      if (await iframeTab.isVisible({ timeout: 2000 })) {
        await iframeTab.click();
        await this.page.waitForTimeout(2000);
        
        const windowResult = await this.checkForNewWindow();
        if (windowResult) return { success: true, method: 'iframe-text', contentPage: windowResult };
      }

      // Try direct page
      const directTab = this.page.locator('text=Factory Equipment').first();
      if (await directTab.isVisible({ timeout: 2000 })) {
        await directTab.click();
        await this.page.waitForTimeout(2000);
        
        const windowResult = await this.checkForNewWindow();
        if (windowResult) return { success: true, method: 'direct-text', contentPage: windowResult };
      }

      return { success: false, method: 'text-based', error: 'No text-based tab found' };
    } catch (error) {
      return { success: false, method: 'text-based', error: String(error) };
    }
  }

  private async tryPositionBasedNavigation(): Promise<NavigationResult> {
    try {
      // Find tabs by position (Factory Equipment usually 3rd or 4th tab)
      const tabs = await this.page.locator('//ul[contains(@class, "x-tab-strip")]//a').all();
      
      for (let i = 2; i < Math.min(tabs.length, 6); i++) {
        const tabText = await tabs[i].textContent();
        if (tabText?.toLowerCase().includes('factory') || tabText?.toLowerCase().includes('equipment')) {
          await tabs[i].click();
          await this.page.waitForTimeout(2000);
          
          const windowResult = await this.checkForNewWindow();
          if (windowResult) return { success: true, method: 'position-based', contentPage: windowResult };
        }
      }

      return { success: false, method: 'position-based', error: 'No factory equipment tab found by position' };
    } catch (error) {
      return { success: false, method: 'position-based', error: String(error) };
    }
  }

  private async tryDirectStickerLink(): Promise<NavigationResult> {
    try {
      const stickerSelectors = [
        'text=Window Sticker',
        'text=Monroney',
        'text=Factory Equipment PDF',
        '//a[contains(@href, "sticker")]'
      ];

      for (const selector of stickerSelectors) {
        const link = this.page.locator(selector).first();
        if (await link.isVisible({ timeout: 2000 })) {
          const [newPage] = await Promise.all([
            this.page.context().waitForEvent('page', { timeout: 5000 }),
            link.click()
          ]).catch(() => [null]);

          if (newPage) {
            await newPage.waitForLoadState('networkidle');
            return { success: true, method: 'direct-link', contentPage: newPage };
          }
        }
      }

      return { success: false, method: 'direct-link', error: 'No direct sticker link found' };
    } catch (error) {
      return { success: false, method: 'direct-link', error: String(error) };
    }
  }

  private async checkForNewWindow(): Promise<Page | null> {
    const pages = this.page.context().pages();
    for (const p of pages) {
      if (p !== this.page) {
        const title = await p.title();
        if (title.includes('factory-equipment') || title.includes('sticker')) {
          await p.waitForLoadState('networkidle');
          return p;
        }
      }
    }
    return null;
  }
}