import { test, expect } from '@playwright/test';

test('access dashboard directly', async ({ page }) => {
  // Go directly to dashboard (bypassing login)
  await page.goto('http://localhost:3000/dashboard');
  
  // Wait for the page to load
  await page.waitForTimeout(2000);
  
  // Check if we're redirected or if dashboard loads
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);
  
  // Take a screenshot
  await page.screenshot({ path: 'dashboard-screenshot.png' });
  
  // Try to find dashboard elements
  const pageTitle = await page.title();
  console.log('Page title:', pageTitle);
  
  // Check for any visible text
  const bodyText = await page.textContent('body');
  console.log('Page has content:', bodyText ? 'Yes' : 'No');
  
  // Keep browser open for 15 seconds
  console.log('Browser will stay open for 15 seconds...');
  await page.waitForTimeout(15000);
});