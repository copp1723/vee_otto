import { test, expect } from '@playwright/test';

test('debug dashboard with pause', async ({ page }) => {
  // Navigate to login
  await page.goto('http://localhost:3000/login');
  
  // Fill in credentials
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'YourNewSecurePassword123!');
  
  // Pause here - this will open Playwright Inspector
  // You can step through the test or continue manually
  await page.pause();
  
  // The test will continue when you click "Resume" in the inspector
});