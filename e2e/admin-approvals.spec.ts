import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Admin Approvals Flow', () => {
  test('TEST-E11: Admin approves a pending leave request', async ({ page }) => {
    // Log in as administrator
    await loginAsAdmin(page);
    
    // Navigate to approvals page
    await page.goto('/admin/approvals');
    
    // Find a pending leave request row
    const pendingLeaveRow = page.locator('tr:has-text("Pending")').first();
    
    // Skip test if no pending requests are present
    if (await pendingLeaveRow.count() === 0) {
      console.log('No pending leave requests found, skipping E2E assertion.');
      return;
    }
    
    // Click Authorize/Approve button
    const approveBtn = pendingLeaveRow.locator('button:has-text("Authorize"), button:has-text("Approve")');
    await approveBtn.click();
    
    // Confirm in modal if present
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }
    
    // Assert success toast appears
    const successToast = page.locator('text=success, text=approved, text=processed');
    await expect(successToast).toBeVisible();
  });
});
