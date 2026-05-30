import { test, expect } from '@playwright/test';
import { loginAsEmployee, resetTestEmployeeAttendance } from './helpers';
import { OFFICE_LOCATION } from '../src/lib/location';

test.describe('Employee Attendance Flow', () => {
  // Use mobile-chrome project configuration (iPhone 14 viewport)
  test.use({
    geolocation: { latitude: OFFICE_LOCATION.lat, longitude: OFFICE_LOCATION.lng },
    permissions: ['geolocation'],
  });

  test.beforeEach(async () => {
    await resetTestEmployeeAttendance();
  });

  test('TEST-E6 & TEST-E7: Employee Clock In & Clock Out flow', async ({ page }) => {
    // Log in as test employee
    await loginAsEmployee(page, 'cmk1234567', 'TestPass123!');
    
    // Navigate to attendance page
    await page.goto('/employee/attendance');
    
    // Clock In
    const clockInBtn = page.locator('[data-testid="clock-in-btn"]').filter({ visible: true });
    await expect(clockInBtn).toBeVisible();
    await clockInBtn.click();
    
    // Assert status badge updates to Working
    const statusBadge = page.getByText(/^(Working|Present)$/i).filter({ visible: true }).first();
    await expect(statusBadge).toBeVisible();
    
    // Assert timer starts counting
    const timer = page.locator('span:has-text("Productive Work") + span').filter({ visible: true }).first();
    await expect(timer).toBeVisible();
    
    // Clock Out
    const clockOutBtn = page.locator('button:has-text("Clock Out"), button:has-text("Check Out"), button:has-text("CLOCK OUT")').filter({ visible: true });
    await expect(clockOutBtn).toBeVisible();
    await clockOutBtn.click();
    
    // Confirm checkout modal if present
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes, Clock Out")').filter({ visible: true });
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }
    
    // Assert status badge updates to Logged Out
    const loggedOutBadge = page.getByText(/^Logged Out$/i).filter({ visible: true }).first();
    await expect(loggedOutBadge).toBeVisible();
  });

  test('TEST-E8: Employee break flow', async ({ page }) => {
    await loginAsEmployee(page, 'cmk1234567', 'TestPass123!');
    await page.goto('/employee/attendance');

    // Clock In first
    const clockInBtn = page.locator('[data-testid="clock-in-btn"]').filter({ visible: true });
    await expect(clockInBtn).toBeVisible();
    await clockInBtn.click();
    const statusBadge = page.getByText(/^(Working|Present)$/i).filter({ visible: true }).first();
    await expect(statusBadge).toBeVisible();

    // Start Break
    const startBreakBtn = page.locator('button:has-text("Start Break")').filter({ visible: true });
    await expect(startBreakBtn).toBeVisible();
    await startBreakBtn.click();

    // Assert status badge shows Break
    const breakStatus = page.getByText(/^Break$/i).filter({ visible: true }).first();
    await expect(breakStatus).toBeVisible();

    // End Break
    const endBreakBtn = page.locator('button:has-text("End Break"), button:has-text("Resume Work")').filter({ visible: true });
    await expect(endBreakBtn).toBeVisible();
    await endBreakBtn.click();

    // Assert status returns to Working
    const workingBadge = page.getByText(/^Working$/i).filter({ visible: true }).first();
    await expect(workingBadge).toBeVisible();
  });
});
