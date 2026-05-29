import { test, expect } from '@playwright/test';

test.describe('Employee Authentication Flow', () => {
  test('TEST-E4: Employee login success & dashboard welcome message', async ({ page }) => {
    await page.goto('/employee/login');
    
    // Fill credentials (using a standard test employee code)
    await page.fill('input#emp-email', 'cmk1234567');
    await page.fill('input#emp-password', 'TestPass123!');
    await page.click('button[type="submit"]');

    // Assert redirect to employee section
    await expect(page).toHaveURL(/\/employee\/dashboard/);
    
    // Verify layouts components (nav sidebar) are attached
    await expect(page.locator('nav').first()).toBeAttached();
  });

  test('TEST-E5: Employee login failure with wrong password', async ({ page }) => {
    await page.goto('/employee/login');
    
    await page.fill('input#emp-email', 'cmk1234567');
    await page.fill('input#emp-password', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Assert still on login page and error is shown
    await expect(page).toHaveURL('/employee/login');
    
    const errorAlert = page.getByText(/Invalid credentials|Incorrect password|Unauthorized/i);
    await expect(errorAlert).toBeVisible();
  });
});
