import { test, expect } from '@playwright/test';
import { loginAsEmployee } from './helpers';

test.describe('Employee Leave Application Flow', () => {
  test('TEST-E9: Apply for Casual Leave on a weekday', async ({ page }) => {
    await loginAsEmployee(page, 'cmk1234567', 'TestPass123!');
    await page.goto('/employee/leaves');

    // Click Apply for Leave button
    await page.click('button:has-text("Apply for Leave"), button:has-text("Request Leave")');

    // Fill the leave form
    await page.selectOption('select[name="type"]', 'Casual');
    
    // Choose a future weekday date (Tuesday June 9, 2026)
    await page.fill('input[name="start_date"]', '2026-06-09');
    await page.fill('input[name="end_date"]', '2026-06-09');
    await page.fill('textarea[name="reason"]', 'Personal work at bank');
    
    await page.click('button[type="submit"]');

    // Assert success notification toast
    const successToast = page.locator('text=Leave applied successfully, text=Success, text=submitted');
    await expect(successToast).toBeVisible();

    // Verify it is listed in the leaves table with status 'Pending'
    const pendingStatus = page.locator('table >> text=Pending').first();
    await expect(pendingStatus).toBeVisible();
  });

  test('TEST-E10: Leave application on weekend is rejected', async ({ page }) => {
    await loginAsEmployee(page, 'cmk1234567', 'TestPass123!');
    await page.goto('/employee/leaves');

    await page.click('button:has-text("Apply for Leave"), button:has-text("Request Leave")');

    await page.selectOption('select[name="type"]', 'Casual');
    
    // Pick a Saturday (June 6, 2026)
    await page.fill('input[name="start_date"]', '2026-06-06');
    await page.fill('input[name="end_date"]', '2026-06-06');
    await page.fill('textarea[name="reason"]', 'Weekend leave');

    await page.click('button[type="submit"]');

    // Assert validation error warning appears
    const errorAlert = page.locator('text=cannot fall on weekends, text=weekend');
    await expect(errorAlert).toBeVisible();
  });
});
