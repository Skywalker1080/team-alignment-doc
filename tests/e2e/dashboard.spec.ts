import { expect, test, type Page } from '@playwright/test';

const ROUTES = ['today', 'trackers', 'decisions', 'assumptions', 'meetings', 'tasks'];
const EMAILS = /@example\.test|@[a-z0-9-]+\.(com|io|test)\b/i;

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime('2026-11-10T09:00:00+05:30');
});

async function open(page: Page, route: string) {
  await page.goto(`/#/${route}`);
  await expect(page.locator('main.page')).toBeVisible();
}

test('Today shows a lane per member plus Anyone', async ({ page }) => {
  await open(page, 'today');
  const lanes = page.locator('[data-lane]');
  await expect(lanes).toHaveCount(4);
  const owners = await lanes.evaluateAll((els) => els.map((e) => e.getAttribute('data-lane')));
  expect(owners).toEqual(['yogesh', 'ranjeet', 'pranav', 'anyone']);
});

test('overdue p0 T-0001 shows its origin and overdue days', async ({ page }) => {
  await open(page, 'today');
  const card = page.locator('[data-id="T-0001"]');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('from 3 Nov · 7d overdue');
});

test('no email text on any route', async ({ page }) => {
  for (const route of ROUTES) {
    await open(page, route);
    expect(await page.locator('body').innerText(), route).not.toMatch(EMAILS);
    expect(await page.content(), route).not.toMatch(EMAILS);
  }
});

test('no horizontal overflow at 375px on any route', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const route of ROUTES) {
    await open(page, route);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, route).toBeLessThanOrEqual(375);
  }
});

test('today follows the clock on focus, visibilitychange and the minute timer', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-10T23:59:00+05:30') });
  await open(page, 'today');
  const title = page.locator('h1.page-title');
  await expect(title).toHaveText('Tuesday 10 November');

  await page.clock.setSystemTime(new Date('2026-11-11T09:00:00+05:30'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(title).toHaveText('Wednesday 11 November');

  await page.clock.setSystemTime(new Date('2026-11-12T09:00:00+05:30'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(title).toHaveText('Thursday 12 November');

  await page.clock.setSystemTime(new Date('2026-11-13T09:00:00+05:30'));
  await page.clock.runFor(60_000);
  await expect(title).toHaveText('Friday 13 November');
});

test('?today= stays pinned when the clock moves', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-10T09:00:00+05:30') });
  await page.goto('/?today=2026-11-04#/today');
  const title = page.locator('h1.page-title');
  await expect(title).toHaveText('Wednesday 4 November');
  await page.clock.setSystemTime(new Date('2026-11-11T09:00:00+05:30'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.clock.runFor(60_000);
  await expect(title).toHaveText('Wednesday 4 November');
});
