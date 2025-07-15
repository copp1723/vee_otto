import { Page } from 'playwright';

export class VisualDebugger {
  private page: Page;
  private stepCounter = 0;

  constructor(page: Page) {
    this.page = page;
  }

  async captureStep(description: string) {
    this.stepCounter++;
    const filename = `debug-step-${this.stepCounter.toString().padStart(2, '0')}-${description.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
    await this.page.screenshot({ 
      path: `screenshots/${filename}`,
      fullPage: true 
    });
    console.log(`📸 Captured: ${filename}`);
  }

  async captureElement(selector: string, description: string) {
    try {
      const element = this.page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        await element.screenshot({ 
          path: `screenshots/element-${description.replace(/[^a-zA-Z0-9]/g, '-')}.png` 
        });
        console.log(`🎯 Element captured: ${description}`);
      }
    } catch (e) {
      console.log(`❌ Could not capture element: ${description}`);
    }
  }
}