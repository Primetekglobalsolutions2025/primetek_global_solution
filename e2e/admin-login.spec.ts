import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Admin Authentication Flow', () => {
  test('TEST-E1: Admin login success & dashboard redirect', async ({ page }) => {
    await page.goto('/admin/login');
    
    // Fill credentials
    await page.fill('input[type="email"]', 'admin@primetekglobalsolutions.com');
    await page.fill('input[type="password"]', 'AdminPass123!');
    await page.click('button[type="submit"]');

    // Assert redirect to dashboard
    await expect(page).toHaveURL('/admin/dashboard');
    
    // Verify dashboard UI components are visible
    const heading = page.locator('h1:has-text("Dashboard"), h1:has-text("Welcome")');
    await expect(heading).toBeVisible();
    
    const isMobile = (page.viewportSize()?.width ?? 0) < 1024;
    if (!isMobile) {
      const sidebar = page.locator('nav').first();
      await expect(sidebar).toBeVisible();
    }
  });

  test('TEST-E2: Admin login failure with wrong password', async ({ page }) => {
    await page.goto('/admin/login');
    
    await page.fill('input[type="email"]', 'admin@primetekglobalsolutions.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Assert still on login page and error message is displayed
    await expect(page).toHaveURL('/admin/login');
    
    const errorAlert = page.getByText(/Invalid credentials|Incorrect password|Unauthorized/i);
    await expect(errorAlert).toBeVisible();
  });

  test('TEST-E3: Admin redirect when already logged in', async ({ page }) => {
    // Perform login first
    await loginAsAdmin(page);

    // Try navigating to login page directly
    await page.goto('/admin/login');

    // Should redirect back to dashboard
    await expect(page).toHaveURL('/admin/dashboard');
  });
});
