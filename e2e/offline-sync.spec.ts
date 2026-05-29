import { test, expect } from '@playwright/test';
import { loginAsEmployee } from './helpers';
import { OFFICE_LOCATION } from '../src/lib/location';

test.describe('Offline Queue & Reconnection Sync Flow', () => {
  test.use({
    geolocation: { latitude: OFFICE_LOCATION.lat, longitude: OFFICE_LOCATION.lng },
    permissions: ['geolocation'],
  });

  test('TEST-E13: Offline check-in queues and sync on reconnect', async ({ context, page }) => {
    await loginAsEmployee(page, 'cmk1234567', 'TestPass123!');
    await page.goto('/employee/attendance');

    // Go Offline via Playwright context network emulation
    await context.setOffline(true);

    // Click Clock In while offline
    const clockInBtn = page.locator('button:has-text("Clock In"), button:has-text("Check In")');
    await expect(clockInBtn).toBeVisible();
    await clockInBtn.click();

    // Assert offline banner/badge appears with pending queue count = 1
    const offlineBanner = page.locator('text=Offline, text=pending, text=sync');
    await expect(offlineBanner).toBeVisible();

    // Restore Network connectivity
    await context.setOffline(false);

    // Assert the sync banner shows "Syncing..." and completes, transitioning status to Working
    const syncingText = page.locator('text=Syncing, text=Working, text=Present');
    await expect(syncingText).toBeVisible();
  });
});
