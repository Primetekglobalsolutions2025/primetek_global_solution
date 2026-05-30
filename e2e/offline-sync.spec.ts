import { test, expect } from '@playwright/test';
import { loginAsEmployee, resetTestEmployeeAttendance } from './helpers';
import { OFFICE_LOCATION } from '../src/lib/location';

test.describe('Offline Queue & Reconnection Sync Flow', () => {
  test.use({
    geolocation: { latitude: OFFICE_LOCATION.lat, longitude: OFFICE_LOCATION.lng },
    permissions: ['geolocation'],
  });

  test.beforeEach(async () => {
    await resetTestEmployeeAttendance();
  });

  test('TEST-E13: Offline check-in queues and sync on reconnect', async ({ context, page }) => {
    await loginAsEmployee(page, 'cmk1234567', 'TestPass123!');
    await page.goto('/employee/attendance');

    // Go Offline via Playwright context network emulation
    await context.setOffline(true);

    // Click Clock In while offline
    const clockInBtn = page.locator('[data-testid="clock-in-btn"]').filter({ visible: true });
    await expect(clockInBtn).toBeVisible();
    await clockInBtn.click();

    // Assert offline banner/badge appears
    await expect(page.getByText('You are offline').filter({ visible: true }).first()).toBeVisible();

    // Restore Network connectivity
    await context.setOffline(false);

    // Assert the sync completes, transitioning status to Working/Present
    await expect(page.getByText(/Working|Present/i).filter({ visible: true }).first()).toBeVisible();
  });
});
