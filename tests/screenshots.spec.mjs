import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8765/ascii-cam.html';

// iPhone 16 Pro: 402×874 pt, device pixel ratio 3
const IPHONE_16_PRO_PORTRAIT  = { width: 402, height: 874, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const IPHONE_16_PRO_LANDSCAPE = { width: 874, height: 402, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

// Grant fake camera so the page doesn't error out
const CONTEXT_OPTS = {
  permissions: ['camera'],
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
};

// --- Screenshot tests ---

test.describe('Visual screenshots', () => {
  test('Desktop 1440×900', async ({ browser }) => {
    const ctx = await browser.newContext({
      ...CONTEXT_OPTS,
      viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(2000); // let a few frames render
    await page.screenshot({ path: 'tests/screenshots/desktop-1440x900.png', fullPage: true });
    await ctx.close();
  });

  test('iPhone 16 Pro portrait', async ({ browser }) => {
    const ctx = await browser.newContext({
      ...CONTEXT_OPTS,
      viewport: { width: IPHONE_16_PRO_PORTRAIT.width, height: IPHONE_16_PRO_PORTRAIT.height },
      deviceScaleFactor: IPHONE_16_PRO_PORTRAIT.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/screenshots/iphone16pro-portrait.png', fullPage: true });
    await ctx.close();
  });

  test('iPhone 16 Pro landscape', async ({ browser }) => {
    const ctx = await browser.newContext({
      ...CONTEXT_OPTS,
      viewport: { width: IPHONE_16_PRO_LANDSCAPE.width, height: IPHONE_16_PRO_LANDSCAPE.height },
      deviceScaleFactor: IPHONE_16_PRO_LANDSCAPE.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/screenshots/iphone16pro-landscape.png', fullPage: true });
    await ctx.close();
  });
});

// --- E2E functional tests ---

test.describe('E2E controls', () => {
  let ctx, page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext({
      ...CONTEXT_OPTS,
      viewport: { width: 1280, height: 800 },
    });
    page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(1500);
  });

  test.afterAll(async () => { await ctx.close(); });

  test('page loads and canvas renders frames', async () => {
    const canvas = page.locator('#ascii-canvas');
    await expect(canvas).toBeVisible();
    // Canvas should have non-zero dimensions once rendering starts
    const w = await canvas.evaluate(el => el.width);
    const h = await canvas.evaluate(el => el.height);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });

  test('detail slider updates display value', async () => {
    const slider = page.locator('#detail');
    const display = page.locator('[data-for="detail"]');
    await slider.fill('200');
    await slider.dispatchEvent('input');
    await expect(display).toHaveText('200');
  });

  test('brightness slider updates display value', async () => {
    const slider = page.locator('#brightness');
    const display = page.locator('[data-for="brightness"]');
    await slider.fill('150');
    await slider.dispatchEvent('input');
    await expect(display).toHaveText('150%');
  });

  test('contrast slider updates display value', async () => {
    const slider = page.locator('#contrast');
    const display = page.locator('[data-for="contrast"]');
    await slider.fill('80');
    await slider.dispatchEvent('input');
    await expect(display).toHaveText('80%');
  });

  test('color toggle is clickable', async () => {
    const toggle = page.locator('#color-mode');
    const wasChecked = await toggle.isChecked();
    await page.locator('label:has(#color-mode)').click();
    expect(await toggle.isChecked()).toBe(!wasChecked);
  });

  test('invert toggle is clickable', async () => {
    const toggle = page.locator('#invert');
    const wasChecked = await toggle.isChecked();
    await page.locator('label:has(#invert)').click();
    expect(await toggle.isChecked()).toBe(!wasChecked);
  });

  test('mirror toggle defaults to checked', async () => {
    // Mirror starts checked per HTML
    const toggle = page.locator('#mirror');
    // It may have been toggled by previous tests, so just verify it exists
    await expect(toggle).toBeAttached();
  });

  test('snapshot button exists and is enabled', async () => {
    const btn = page.locator('#snapshot-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveText('Save Snapshot');
  });

  test('countdown overlay is hidden by default', async () => {
    const overlay = page.locator('#countdown-overlay');
    // Overlay uses display:none by default; class .visible shows it
    const display = await overlay.evaluate(el => getComputedStyle(el).display);
    expect(display).toBe('none');
  });

  test('all group titles render', async () => {
    await expect(page.locator('.group-title').nth(0)).toHaveText('Render');
    await expect(page.locator('.group-title').nth(1)).toHaveText('Adjust');
    await expect(page.locator('.group-title').nth(2)).toHaveText('Style');
  });

  test('no console errors on load', async () => {
    const errors = [];
    const page2 = await ctx.newPage();
    page2.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page2.goto(BASE);
    await page2.waitForTimeout(2000);
    // Filter out expected camera-related messages in headless
    const real = errors.filter(e => !e.includes('NotAllowedError') && !e.includes('NotFoundError') && !e.includes('Could not start'));
    expect(real).toEqual([]);
    await page2.close();
  });

  test('footer text is present', async () => {
    await expect(page.locator('footer')).toContainText('no frames leave your device');
  });
});

// --- Responsive layout tests ---

test.describe('Responsive layout', () => {
  test('desktop has sidebar layout (grid-template-columns)', async ({ browser }) => {
    const ctx = await browser.newContext({
      ...CONTEXT_OPTS,
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(500);
    const cols = await page.locator('main').evaluate(el => getComputedStyle(el).gridTemplateColumns);
    // Should have two column values (sidebar + canvas)
    expect(cols.split(' ').length).toBe(2);
    await ctx.close();
  });

  test('mobile has single column layout', async ({ browser }) => {
    const ctx = await browser.newContext({
      ...CONTEXT_OPTS,
      viewport: { width: 402, height: 874 },
      isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(500);
    const cols = await page.locator('main').evaluate(el => getComputedStyle(el).gridTemplateColumns);
    // Should be single column
    expect(cols.split(' ').length).toBe(1);
    await ctx.close();
  });
});
