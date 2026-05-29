import { test, expect } from '@playwright/test';

test.describe('Employee Authentication Flow', () => {
  test('TEST-E4: Employee login success & dashboard welcome message', async ({ page }) => {
    await page.goto('/employee/login');
    
    // Fill credentials (using a standard test employee code)
    await page.fill('input[name="employeeId"]', 'cmk1234567');
    await page.fill('input[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');

    // Assert redirect to dashboard
    await expect(page).toHaveURL('/employee/dashboard');
    
    // Verify welcome message is visible
    const welcomeText = page.locator('h1:has-text("Welcome"), h2:has-text("Welcome")');
    await expect(welcomeText).toBeVisible();
  });

  test('TEST-E5: Employee login failure with wrong password', async ({ page }) => {
    await page.goto('/employee/login');
    
    await page.fill('input[name="employeeId"]', 'cmk1234567');
    await page.fill('input[name="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Assert still on login page and error is shown
    await expect(page).toHaveURL('/employee/login');
    
    const errorAlert = page.locator('text=Invalid credentials, text=Incorrect password, text=Unauthorized');
    await expect(errorAlert).toBeVisible();
  });
});
