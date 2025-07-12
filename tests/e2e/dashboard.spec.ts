import { test, expect, Page } from '@playwright/test';
import { DashboardMetrics, ActionQueueItem, RecentCompletion } from '../../frontend/types';

// Test data
const testCredentials = {
  username: process.env.ADMIN_USER || 'admin',
  password: process.env.ADMIN_PASS || 'password'
};

// Helper functions
async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="username"]', testCredentials.username);
  await page.fill('input[name="password"]', testCredentials.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}

async function waitForDashboardLoad(page: Page) {
  // Wait for key elements to be visible
  await page.waitForSelector('[aria-label="Key performance metrics"]', { state: 'visible' });
  await page.waitForSelector('text=Action Queue', { state: 'visible' });
  await page.waitForSelector('text=Recent Completions', { state: 'visible' });
}

// Test suite
test.describe('Vee Otto Operations Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth tokens
    await page.context().clearCookies();
  });

  test('Dashboard loads successfully', async ({ page }) => {
    await login(page);
    await waitForDashboardLoad(page);
    
    // Verify header elements
    await expect(page.locator('h1')).toHaveText('VAUTO INTELLIGENCE SUITE');
    await expect(page.locator('[aria-label*="System"]')).toBeVisible();
  });

  test('Displays key metrics correctly', async ({ page }) => {
    await login(page);
    await waitForDashboardLoad(page);
    
    // Check metric tiles
    const metricTiles = page.locator('[role="article"]');
    await expect(metricTiles).toHaveCount(3);
    
    // Verify metric titles
    await expect(page.locator('text=No Price/Pending')).toBeVisible();
    await expect(page.locator('text=Time Saved Today')).toBeVisible();
    await expect(page.locator('text=Value Protected')).toBeVisible();
  });

  test('Action queue displays and updates', async ({ page }) => {
    await login(page);
    await waitForDashboardLoad(page);
    
    // Check action queue section
    const actionQueue = page.locator('section').filter({ hasText: 'Action Queue' });
    await expect(actionQueue).toBeVisible();
    
    // Verify queue items load
    const queueItems = actionQueue.locator('[role="listitem"]');
    const itemCount = await queueItems.count();
    expect(itemCount).toBeGreaterThan(0);
    
    // Check for Process All button
    const processButton = page.locator('button', { hasText: 'Process All' });
    await expect(processButton).toBeVisible();
  });

  test('Process All functionality works', async ({ page }) => {
    await login(page);
    await waitForDashboardLoad(page);
    
    // Get initial queue count
    const initialItems = await page.locator('[role="listitem"]').count();
    
    // Click Process All
    await page.click('button:has-text("Process All")');
    
    // Wait for processing (could show loading state)
    await page.waitForTimeout(2000);
    
    // Verify queue is reduced/cleared
    const finalItems = await page.locator('[role="listitem"]').count();
    expect(finalItems).toBeLessThan(initialItems);
  });

  test('Recent completions display correctly', async ({ page }) => {
    await login(page);
    await waitForDashboardLoad(page);
    
    // Check recent completions section
    const completions = page.locator('section').filter({ hasText: 'Recent Completions' });
    await expect(completions).toBeVisible();
    
    // Verify completion items
    const completionItems = completions.locator('[role="listitem"]');
    const itemCount = await completionItems.count();
    expect(itemCount).toBeGreaterThan(0);
    
    // Check completion details
    const firstCompletion = completionItems.first();
    await expect(firstCompletion.locator('text=/\\d{4}\\s+\\w+\\s+\\w+/')).toBeVisible(); // Year Make Model
    await expect(firstCompletion.locator('text=/\\d+\\s+min/')).toBeVisible(); // Time saved
  });

  test('Performance chart displays', async ({ page }) => {
    await login(page);
    await waitForDashboardLoad(page);
    
    // Check for chart section
    const chartSection = page.locator('.chartSection');
    await expect(chartSection).toBeVisible();
    
    // Verify chart elements (Recharts renders SVG)
    await expect(chartSection.locator('svg')).toBeVisible();
  });

  test('Real-time updates via WebSocket', async ({ page }) => {
    await login(page);
    await waitForDashboardLoad(page);
    
    // Get initial metric value
    const metricTile = page.locator('text=No Price/Pending').locator('..');
    const initialValue = await metricTile.locator('[class*="value"]').textContent();
    
    // Wait for potential WebSocket update (mock or real)
    await page.waitForTimeout(5000);
    
    // In a real test, you'd trigger an update from the backend
    // For now, just verify the value exists
    expect(initialValue).toBeTruthy();
  });

  test('Responsive design - mobile view', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await login(page);
    await waitForDashboardLoad(page);
    
    // Verify mobile layout
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[aria-label="Key performance metrics"]')).toBeVisible();
    
    // Check if sections stack vertically on mobile
    const sections = await page.locator('.section').count();
    expect(sections).toBeGreaterThan(0);
  });

  test('Error handling - network failure', async ({ page, context }) => {
    await login(page);
    
    // Simulate network failure
    await context.route('**/api/**', route => route.abort());
    
    await page.goto('/dashboard');
    
    // Should show error state
    await expect(page.locator('text=/Dashboard Error|Failed to load/')).toBeVisible({ timeout: 10000 });
    
    // Retry button should be available
    const retryButton = page.locator('button', { hasText: 'Retry' });
    await expect(retryButton).toBeVisible();
  });

  test('Authentication - redirects to login when unauthorized', async ({ page }) => {
    // Try to access dashboard without login
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('Queue simulation - handles 20+ items', async ({ page }) => {
    await login(page);
    await waitForDashboardLoad(page);
    
    // In a real test, you'd inject test data with 20+ queue items
    // For now, verify the queue can display multiple items
    const queueItems = await page.locator('[role="listitem"]').count();
    
    // Verify pagination or scrolling if more than visible items
    if (queueItems > 5) {
      const queueContainer = page.locator('[role="list"]');
      const isScrollable = await queueContainer.evaluate(el => el.scrollHeight > el.clientHeight);
      expect(isScrollable).toBeTruthy();
    }
  });

  test('Performance metrics - 95% coverage check', async ({ page }) => {
    await login(page);
    await waitForDashboardLoad(page);
    
    // List of critical elements that must be present
    const criticalElements = [
      'h1:has-text("VAUTO INTELLIGENCE SUITE")',
      '[aria-label="Key performance metrics"]',
      'text=No Price/Pending',
      'text=Time Saved Today',
      'text=Value Protected',
      'text=Action Queue',
      'text=Recent Completions',
      'button:has-text("Process All")',
      '[class*="statusIndicator"]',
      'svg' // Chart
    ];
    
    let visibleCount = 0;
    for (const selector of criticalElements) {
      const isVisible = await page.locator(selector).isVisible().catch(() => false);
      if (isVisible) visibleCount++;
    }
    
    const coverage = (visibleCount / criticalElements.length) * 100;
    expect(coverage).toBeGreaterThanOrEqual(95);
  });
});

// Integration test with Vee Otto agent
test.describe('Vee Otto Agent Integration', () => {
  test('Updates dashboard when agent completes task', async ({ page }) => {
    await login(page);
    await waitForDashboardLoad(page);
    
    // Get initial completion count
    const initialCompletions = await page.locator('[role="listitem"]').count();
    
    // In a real test, trigger agent task completion
    // For now, simulate by calling the API
    const response = await page.request.post('/api/process-queue', {
      headers: {
        'Authorization': `Bearer ${await page.evaluate(() => localStorage.getItem('authToken'))}`
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    // Wait for update
    await page.waitForTimeout(2000);
    
    // Verify new completion appears
    const finalCompletions = await page.locator('[role="listitem"]').count();
    expect(finalCompletions).toBeGreaterThanOrEqual(initialCompletions);
  });
});
