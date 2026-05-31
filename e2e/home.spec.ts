import { test, expect } from '@playwright/test';
import { loginAsEmployee } from './helpers';

test.describe('Employee Home / Dashboard Flow', () => {
  test('TEST-E14: Verify Today\'s Overview timings and formatting on Home page', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'This test is only for mobile view');
    // Log in as employee
    await loginAsEmployee(page, 'cmk1234567', 'TestPass123!');
    
    // Assert redirect to employee section
    await expect(page).toHaveURL(/\/employee\/dashboard/);

    // Verify Today's Overview section is visible
    const overviewSection = page.locator('[data-testid="today-overview"]').filter({ visible: true });
    await expect(overviewSection).toBeVisible();

    // Verify Hours Worked timings structure (e.g., '0h 00m')
    const hoursWorkedText = page.locator('[data-testid="today-overview"] >> text=Hours Worked').locator('xpath=preceding-sibling::span[1]');
    await expect(hoursWorkedText).toBeVisible();
    
    const textContent = await hoursWorkedText.innerText();
    expect(textContent).toMatch(/^\d+h \d{2}m$/);
  });
});
