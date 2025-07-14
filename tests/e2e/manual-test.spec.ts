import { test, expect } from '@playwright/test';

test('manual dashboard interaction', async ({ page }) => {
  // Set a longer timeout for manual testing
  test.setTimeout(300000); // 5 minutes
  
  // Navigate to login
  await page.goto('http://localhost:3000/login');
  
  // Fill in credentials
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'YourNewSecurePassword123!');
  
  // Click login
  await page.click('button[type="submit"]');
  
  // Wait for dashboard to load
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  
  console.log('Dashboard loaded! Browser will stay open for 2 minutes.');
  console.log('You can interact with the dashboard now.');
  console.log('Look for the automation button and any errors.');
  
  // Keep browser open for 2 minutes
  await page.waitForTimeout(120000);
});