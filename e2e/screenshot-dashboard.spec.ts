import { test } from '@playwright/test';
import { loginAsEmployee } from './helpers';
import path from 'path';

test('Capture mobile dashboard screenshots', async ({ page }) => {
  // Use iPhone 14 dimensions for pixel-perfect viewport simulation
  await page.setViewportSize({ width: 390, height: 844 });

  // Log in as standard employee
  await loginAsEmployee(page, 'cmk1234567', 'TestPass123!');
  
  // Navigate directly to the dashboard view
  await page.goto('/employee/dashboard');
  await page.waitForTimeout(3000); // Allow all transitions, charts, and animations to load fully
  
  const elementAtPoint = await page.evaluate(() => {
    const el = document.elementFromPoint(30, 810);
    return el ? el.outerHTML : 'No element at point';
  });
  console.log('Element at point (30, 810):', elementAtPoint);

  // Define screenshot destination paths
  const artifactDir = 'C:\\Users\\janak\\.gemini\\antigravity-ide\\brain\\659a78e4-bc80-4f4b-bfc6-533a44350a67';
  const screenshotPath = path.join(artifactDir, 'mobile_dashboard_view.png');
  const fullPagePath = path.join(artifactDir, 'mobile_dashboard_fullpage.png');
  
  // Clean up portal once more right before screenshot
  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach(el => el.remove());
  });
  await page.screenshot({ path: screenshotPath });
  
  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach(el => el.remove());
  });
  await page.screenshot({ path: fullPagePath, fullPage: true });
  
  console.log('Mobile dashboard screenshots saved successfully.');
});
