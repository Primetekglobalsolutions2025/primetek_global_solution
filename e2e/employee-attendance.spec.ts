import { test, expect } from '@playwright/test';
import { loginAsEmployee } from './helpers';
import { OFFICE_LOCATION } from '../src/lib/location';

test.describe('Employee Attendance Flow', () => {
  // Use mobile-chrome project configuration (iPhone 14 viewport)
  test.use({
    geolocation: { latitude: OFFICE_LOCATION.lat, longitude: OFFICE_LOCATION.lng },
    permissions: ['geolocation'],
  });

  test('TEST-E6 & TEST-E7: Employee Clock In & Clock Out flow', async ({ page }) => {
    // Log in as test employee
    await loginAsEmployee(page, 'cmk1234567', 'TestPass123!');
    
    // Navigate to attendance page
    await page.goto('/employee/attendance');
    
    // Clock In
    const clockInBtn = page.locator('button:has-text("Clock In"), button:has-text("Check In")');
    await expect(clockInBtn).toBeVisible();
    await clockInBtn.click();
    
    // Assert status badge updates to Working
    const statusBadge = page.locator('text=Working, text=Present');
    await expect(statusBadge).toBeVisible();
    
    // Assert timer starts counting
    const timer = page.locator('.timer, [data-testid="timer"]');
    await expect(timer).toBeVisible();
    
    // Clock Out
    const clockOutBtn = page.locator('button:has-text("Clock Out"), button:has-text("Check Out")');
    await expect(clockOutBtn).toBeVisible();
    await clockOutBtn.click();
    
    // Confirm checkout modal if present
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes, Clock Out")');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }
    
    // Assert status badge updates to Logged Out
    const loggedOutBadge = page.locator('text=Logged Out');
    await expect(loggedOutBadge).toBeVisible();
  });

  test('TEST-E8: Employee break flow', async ({ page }) => {
    await loginAsEmployee(page, 'cmk1234567', 'TestPass123!');
    await page.goto('/employee/attendance');

    // Ensure we are clocked in first
    const clockInBtn = page.locator('button:has-text("Clock In"), button:has-text("Check In")');
    if (await clockInBtn.isVisible()) {
      await clockInBtn.click();
    }

    // Start Break
    const startBreakBtn = page.locator('button:has-text("Start Break")');
    await expect(startBreakBtn).toBeVisible();
    await startBreakBtn.click();

    // Assert status badge shows Break
    const breakStatus = page.locator('text=Break');
    await expect(breakStatus).toBeVisible();

    // End Break
    const endBreakBtn = page.locator('button:has-text("End Break")');
    await expect(endBreakBtn).toBeVisible();
    await endBreakBtn.click();

    // Assert status returns to Working
    const workingBadge = page.locator('text=Working');
    await expect(workingBadge).toBeVisible();
  });
});
