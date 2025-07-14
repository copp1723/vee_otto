import { test, expect } from '@playwright/test';

test('open dashboard and wait', async ({ page }) => {
  // Navigate to the dashboard
  await page.goto('http://localhost:3000/dashboard');
  
  // Wait for 30 seconds so you can see the browser
  console.log('Browser is open! You can now see the dashboard.');
  console.log('The test will wait for 30 seconds...');
  
  await page.waitForTimeout(30000);
  
  console.log('Test complete!');
});