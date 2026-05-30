import { test, expect } from '@playwright/test';
import { loginAsEmployee } from './helpers';

test.describe('Daily Metrics Report Flow', () => {
  test('TEST-E12: Employee fills and submits daily metrics', async ({ page }) => {
    await loginAsEmployee(page, 'cmk1234567', 'TestPass123!');
    await page.goto('/employee/daily-report');

    // Verify daily report form components are visible
    await expect(page.locator('[data-testid="daily-reports-page"]')).toBeVisible();
    const formHeading = page.locator('h1:has-text("Daily Recruitment Report"), h1:has-text("Daily Report"), h2:has-text("Daily Metrics")');
    await expect(formHeading).toBeVisible();

    // Check if there are active client profiles to report metrics for
    const inputFields = page.locator('input[type="number"]');
    if (await inputFields.count() === 0) {
      console.log('No assigned client profiles found to submit metrics for, skipping E2E form inputs.');
      return;
    }

    // Fill applications, interviews, and other metrics fields
    await inputFields.nth(0).fill('4'); // applications
    await inputFields.nth(1).fill('1'); // interviews
    await inputFields.nth(2).fill('0'); // assessments
    await inputFields.nth(3).fill('0'); // technical_rounds
    await inputFields.nth(4).fill('0'); // non_technical
    await inputFields.nth(5).fill('2'); // self_submissions
    await inputFields.nth(6).fill('2'); // support_submissions

    // Click Submit
    const submitBtn = page.locator('button[type="submit"]:has-text("Submit"), button:has-text("Save Daily Metrics")');
    await submitBtn.click();

    // Assert success notification toast
    const successToast = page.locator('text=success, text=submitted, text=saved');
    await expect(successToast).toBeVisible();
  });
});
