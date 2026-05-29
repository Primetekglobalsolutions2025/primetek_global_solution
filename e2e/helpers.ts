import { Page, expect } from '@playwright/test';

/**
 * Logs in as an administrator.
 */
export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.fill('input[type="email"]', 'admin@primetekglobalsolutions.com');
  await page.fill('input[type="password"]', 'AdminPass123!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/admin/dashboard');
}

/**
 * Logs in as a standard employee.
 */
export async function loginAsEmployee(page: Page, employeeId: string, password: string = 'TestPass123!') {
  await page.goto('/employee/login');
  await page.fill('input[name="employeeId"]', employeeId);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/employee/dashboard');
}

/**
 * Signs out from either employee or admin portal.
 */
export async function logout(page: Page) {
  // Click user profile/menu or signout button directly
  const signoutBtn = page.locator('button:has-text("Sign Out"), button:has-text("Logout")');
  if (await signoutBtn.isVisible()) {
    await signoutBtn.click();
    // Confirm if there's a modal dialog
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }
  }
}
