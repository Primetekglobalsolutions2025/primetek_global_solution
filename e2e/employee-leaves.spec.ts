import { test, expect } from '@playwright/test';
import { loginAsEmployee, resetTestEmployeeAttendance } from './helpers';

test.describe('Employee Leave Application Flow', () => {
  test.beforeEach(async () => {
    await resetTestEmployeeAttendance();
  });
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
    await page.fill('input[name="reason"]', 'Personal work at bank');
    
    await page.click('button[type="submit"]');

    // Assert success notification
    const successToast = page.getByText('Request Submitted!');
    await expect(successToast).toBeVisible();

    // Wait for modal to close (takes ~2s)
    await expect(successToast).toBeHidden();

    // Verify it is listed in the leaves table/log with status 'Pending'
    const pendingStatus = page.locator('text=Pending').first();
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
    await page.fill('input[name="reason"]', 'Weekend leave');

    await page.click('button[type="submit"]');

    // Assert validation error warning appears
    const errorAlert = page.getByText('Leave requests cannot fall on weekends (Saturday or Sunday).');
    await expect(errorAlert).toBeVisible();
  });
});
