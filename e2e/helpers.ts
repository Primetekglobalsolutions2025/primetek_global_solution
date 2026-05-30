import { Page, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Resets the attendance state for the test employee in the database to isolate E2E tests.
 */
export async function resetTestEmployeeAttendance() {
  dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Warning: Missing database URL or service key. Skipping attendance reset.');
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: emp } = await supabase
    .from('employees')
    .select('id')
    .eq('employee_id', 'cmk1234567')
    .maybeSingle();

  if (emp) {
    await supabase.from('leave_requests').delete().eq('employee_id', emp.id);
    await supabase.from('attendance_events').delete().eq('employee_id', emp.id);
    await supabase.from('attendance_risk_events').delete().eq('employee_id', emp.id);
    await supabase.from('attendance').delete().eq('employee_id', emp.id);
    console.log('Successfully reset attendance and leaves state for employee in database.');
  }
}


/**
 * Logs in as an administrator.
 */
export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.fill('input[type="email"]', 'admin@primetekglobalsolutions.com');
  await page.fill('input[type="password"]', 'AdminPass123!');
  await page.click('button[type="submit"]');
  // Wait for the URL to settle on the final dashboard page to avoid client-side routing interruptions
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  // Verify layout sidebar is attached to DOM
  await expect(page.locator('nav').first()).toBeAttached();
}

/**
 * Logs in as a standard employee.
 */
export async function loginAsEmployee(page: Page, employeeId: string, password: string = 'TestPass123!') {
  await page.goto('/employee/login');
  await page.fill('input#emp-email', employeeId);
  await page.fill('input#emp-password', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/employee\/dashboard/, { timeout: 15000 });
  await expect(page.locator('nav').first()).toBeAttached();
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
