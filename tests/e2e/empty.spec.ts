import { expect, test } from '@playwright/test';

const ROUTES = ['today', 'trackers', 'decisions', 'assumptions', 'meetings', 'tasks'];

test('empty data renders', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
  page.on('pageerror', (e) => problems.push(e.message));
  await page.clock.setFixedTime('2026-11-10T09:00:00+05:30');
  for (const route of ROUTES) {
    await page.goto(`/#/${route}`);
    await expect(page.locator('main.page')).toBeVisible();
    await expect(page.locator('[role="status"]').first(), route).toBeVisible();
    await expect(page.locator('[data-id]'), route).toHaveCount(0);
  }
  expect(problems).toEqual([]);
});
