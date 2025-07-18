import { chromium } from 'playwright';
import * as dotenv from 'dotenv';

dotenv.config();

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  // 1. Login and navigate to inventory
  console.log('Navigate to vAuto login page...');
  await page.goto('https://vauto.signin.coxautoinc.com');
  console.log('Please log in manually and complete 2FA if needed.');
  console.log('After you are on the inventory page, press Enter in the terminal to continue...');
  await new Promise(resolve => process.stdin.once('data', resolve));

  // 2. Wait for inventory grid to load
  console.log('Waiting for inventory grid...');
  await page.waitForSelector('//tr[contains(@class, "x-grid3-row")]', { timeout: 60000 });

  // 3. Log all vehicle link selectors and their visibility
  const selectors = [
    '//tr[contains(@class, "x-grid3-row")]//td[position()=1 or position()=2]//a[contains(@href, "javascript") or contains(@onclick, "OpenVehicle") or contains(@onclick, "viewVehicle")]',
    '//tr[contains(@class, "x-grid3-row")]//a[contains(@onclick, "OpenVehicle") or contains(@onclick, "viewVehicle") or contains(@onclick, "ShowVehicle")]',
    '//tr[contains(@class, "x-grid3-row")]//td[1]//a[1]',
    '//tr[contains(@class, "x-grid3-row")]//td[contains(@class, "x-grid3-col-model") or contains(@class, "x-grid3-col-year")]//a'
  ];

  for (const selector of selectors) {
    const links = await page.$$(selector);
    console.log(`Selector: ${selector} - Found: ${links.length}`);
    for (let i = 0; i < links.length; i++) {
      const visible = await links[i].isVisible();
      const text = await links[i].innerText().catch(() => '');
      console.log(`  [${i}] Visible: ${visible} | Text: "${text}"`);
    }
  }

  // 4. Try to click the first visible vehicle link using multiple strategies
  let clicked = false;
  for (const selector of selectors) {
    const links = await page.$$(selector);
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (await link.isVisible()) {
        try {
          console.log(`Trying normal click on selector: ${selector} [${i}]`);
          await link.click({ timeout: 5000 });
          clicked = true;
          break;
        } catch (e) {
          console.log(`Normal click failed: ${e}`);
        }
        try {
          console.log(`Trying force click on selector: ${selector} [${i}]`);
          await link.click({ force: true, timeout: 5000 });
          clicked = true;
          break;
        } catch (e) {
          console.log(`Force click failed: ${e}`);
        }
        try {
          console.log(`Trying JS click on selector: ${selector} [${i}]`);
          await link.evaluate((el: HTMLElement) => el.click());
          clicked = true;
          break;
        } catch (e) {
          console.log(`JS click failed: ${e}`);
        }
      }
    }
    if (clicked) break;
  }

  if (!clicked) {
    console.log('❌ Could not click any vehicle link. Please check the selectors and UI.');
    await browser.close();
    process.exit(1);
  }

  // 5. Wait for modal to appear
  try {
    await page.waitForSelector('.x-window', { state: 'visible', timeout: 10000 });
    console.log('✅ Vehicle modal opened!');
  } catch {
    console.log('❌ Vehicle modal did not open after clicking vehicle link.');
    await browser.close();
    process.exit(1);
  }

  // 6. Wait for user to observe
  console.log('Browser will remain open for you to observe the modal. Press Ctrl+C to exit.');
})();