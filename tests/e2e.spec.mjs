import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8080/ascii-cam.html';

function fakeCamera(ctx) {
  return ctx.browser().newContext({
    ...ctx,
    permissions: ['camera'],
  });
}

// Viewports
const DESKTOP = { width: 1440, height: 900 };
const IPHONE_PORTRAIT = { width: 402, height: 874, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const IPHONE_LANDSCAPE = { width: 874, height: 402, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

// Shared context factory with fake camera
async function makeContext(browser, viewport) {
  return browser.newContext({
    permissions: ['camera'],
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor || 2,
    isMobile: viewport.isMobile || false,
    hasTouch: viewport.hasTouch || false,
  });
}

// ============================================================
// Structure tests — verify all expected DOM elements exist
// ============================================================
test.describe('DOM structure', () => {
  let ctx, page;
  test.beforeAll(async ({ browser }) => {
    ctx = await makeContext(browser, DESKTOP);
    page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(1500);
  });
  test.afterAll(async () => { await ctx?.close(); });

  test('has header with title', async () => {
    await expect(page.locator('header h1')).toHaveText('ASCII Cam');
  });

  test('has canvas element', async () => {
    await expect(page.locator('#ascii-canvas')).toBeVisible();
  });

  test('has detail slider', async () => {
    await expect(page.locator('#detail')).toBeAttached();
  });

  test('has brightness slider', async () => {
    await expect(page.locator('#brightness')).toBeAttached();
  });

  test('has contrast slider', async () => {
    await expect(page.locator('#contrast')).toBeAttached();
  });

  test('has color toggle', async () => {
    await expect(page.locator('#color-mode')).toBeAttached();
  });

  test('has invert toggle', async () => {
    await expect(page.locator('#invert')).toBeAttached();
  });

  test('has mirror toggle defaulting to checked', async () => {
    const mirror = page.locator('#mirror');
    await expect(mirror).toBeAttached();
    expect(await mirror.isChecked()).toBe(true);
  });

  test('has snapshot button', async () => {
    await expect(page.locator('#snapshot-btn')).toBeVisible();
    await expect(page.locator('#snapshot-btn')).toHaveText('Save Snapshot');
    await expect(page.locator('#snapshot-btn')).toBeEnabled();
  });

  test('countdown overlay is hidden', async () => {
    const display = await page.locator('#countdown-overlay').evaluate(
      el => getComputedStyle(el).display
    );
    expect(display).toBe('none');
  });

  test('has footer', async () => {
    await expect(page.locator('footer')).toContainText('no frames leave your device');
  });

  test('has three group titles', async () => {
    const titles = page.locator('.group-title');
    await expect(titles).toHaveCount(3);
    await expect(titles.nth(0)).toHaveText(/render/i);
    await expect(titles.nth(1)).toHaveText(/adjust/i);
    await expect(titles.nth(2)).toHaveText(/style/i);
  });

  test('no external stylesheets loaded (no Tailwind)', async () => {
    const links = await page.locator('link[rel="stylesheet"]').count();
    const tailwind = await page.locator('script[src*="tailwind"]').count();
    expect(links).toBe(0);
    expect(tailwind).toBe(0);
  });
});

// ============================================================
// Control interaction tests
// ============================================================
test.describe('Control interactions', () => {
  let ctx, page;
  test.beforeAll(async ({ browser }) => {
    ctx = await makeContext(browser, DESKTOP);
    page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(1500);
  });
  test.afterAll(async () => { await ctx?.close(); });

  test('detail slider updates display', async () => {
    await page.locator('#detail').fill('200');
    await page.locator('#detail').dispatchEvent('input');
    await expect(page.locator('[data-for="detail"]')).toHaveText('200');
  });

  test('brightness slider updates display', async () => {
    await page.locator('#brightness').fill('150');
    await page.locator('#brightness').dispatchEvent('input');
    await expect(page.locator('[data-for="brightness"]')).toHaveText('150%');
  });

  test('contrast slider updates display', async () => {
    await page.locator('#contrast').fill('80');
    await page.locator('#contrast').dispatchEvent('input');
    await expect(page.locator('[data-for="contrast"]')).toHaveText('80%');
  });

  test('color toggle toggles', async () => {
    const toggle = page.locator('#color-mode');
    const was = await toggle.isChecked();
    await page.locator('label:has(#color-mode)').click();
    expect(await toggle.isChecked()).toBe(!was);
  });

  test('invert toggle toggles', async () => {
    const toggle = page.locator('#invert');
    const was = await toggle.isChecked();
    await page.locator('label:has(#invert)').click();
    expect(await toggle.isChecked()).toBe(!was);
  });

  test('mirror toggle toggles', async () => {
    const toggle = page.locator('#mirror');
    const was = await toggle.isChecked();
    await page.locator('label:has(#mirror)').click();
    expect(await toggle.isChecked()).toBe(!was);
  });
});

// ============================================================
// Canvas rendering tests
// ============================================================
test.describe('Canvas rendering', () => {
  let ctx, page;
  test.beforeAll(async ({ browser }) => {
    ctx = await makeContext(browser, DESKTOP);
    page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(2000);
  });
  test.afterAll(async () => { await ctx?.close(); });

  test('canvas has nonzero pixel dimensions', async () => {
    const dims = await page.locator('#ascii-canvas').evaluate(el => ({
      w: el.width, h: el.height,
      sw: el.style.width, sh: el.style.height,
    }));
    expect(dims.w).toBeGreaterThan(0);
    expect(dims.h).toBeGreaterThan(0);
    expect(dims.sw).toBeTruthy();
    expect(dims.sh).toBeTruthy();
  });

  test('canvas aspect ratio matches ~16:9 video', async () => {
    // The fake camera in Chromium produces a roughly 4:3 or 16:9 stream.
    // We check the CSS dimensions preserve a reasonable landscape ratio.
    const ratio = await page.locator('#ascii-canvas').evaluate(el => {
      const w = parseFloat(el.style.width);
      const h = parseFloat(el.style.height);
      return w / h;
    });
    // Should be landscape (wider than tall), not portrait or square
    expect(ratio).toBeGreaterThan(1.0);
    expect(ratio).toBeLessThan(2.5);
  });

  test('changing detail does NOT change canvas CSS size', async () => {
    // Read initial size
    const initial = await page.locator('#ascii-canvas').evaluate(el => ({
      w: parseFloat(el.style.width), h: parseFloat(el.style.height),
    }));

    // Change detail to max
    await page.locator('#detail').fill('300');
    await page.locator('#detail').dispatchEvent('input');
    await page.waitForTimeout(500);

    const after = await page.locator('#ascii-canvas').evaluate(el => ({
      w: parseFloat(el.style.width), h: parseFloat(el.style.height),
    }));

    // Size should remain the same (within rounding tolerance)
    expect(Math.abs(after.w - initial.w)).toBeLessThanOrEqual(5);
    expect(Math.abs(after.h - initial.h)).toBeLessThanOrEqual(5);

    // Reset
    await page.locator('#detail').fill('160');
    await page.locator('#detail').dispatchEvent('input');
  });

  test('canvas fits within its container', async () => {
    const data = await page.evaluate(() => {
      const wrap = document.getElementById('canvas-wrap');
      const canvas = document.getElementById('ascii-canvas');
      const wr = wrap.getBoundingClientRect();
      const cr = canvas.getBoundingClientRect();
      return {
        wrapW: wr.width, wrapH: wr.height,
        canvasW: cr.width, canvasH: cr.height,
      };
    });
    expect(data.canvasW).toBeLessThanOrEqual(data.wrapW + 1);
    expect(data.canvasH).toBeLessThanOrEqual(data.wrapH + 1);
  });
});

// ============================================================
// Desktop layout tests
// ============================================================
test.describe('Layout: Desktop 1440×900', () => {
  let ctx, page;
  test.beforeAll(async ({ browser }) => {
    ctx = await makeContext(browser, DESKTOP);
    page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(1500);
  });
  test.afterAll(async () => { await ctx?.close(); });

  test('two-column grid layout', async () => {
    const cols = await page.locator('main').evaluate(
      el => getComputedStyle(el).gridTemplateColumns
    );
    // Should have exactly 2 column values
    expect(cols.split(' ').filter(s => s).length).toBe(2);
  });

  test('sidebar is to the left of canvas', async () => {
    const data = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      const canvas = document.getElementById('canvas-wrap');
      return {
        sidebarX: sidebar.getBoundingClientRect().left,
        canvasX: canvas.getBoundingClientRect().left,
      };
    });
    expect(data.sidebarX).toBeLessThan(data.canvasX);
  });

  test('no horizontal overflow', async () => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test('footer at bottom, not pushed off screen', async () => {
    const data = await page.evaluate(() => {
      const footer = document.querySelector('footer');
      const r = footer.getBoundingClientRect();
      return { bottom: r.bottom, viewH: window.innerHeight };
    });
    expect(data.bottom).toBeLessThanOrEqual(data.viewH + 1);
  });

  test('control groups have full sidebar width', async () => {
    const data = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar');
      const group = document.querySelector('.control-group');
      return {
        sidebarW: sidebar.getBoundingClientRect().width,
        groupW: group.getBoundingClientRect().width,
      };
    });
    // Group should be close to sidebar width (within padding)
    expect(data.groupW).toBeGreaterThan(data.sidebarW * 0.9);
  });
});

// ============================================================
// Mobile portrait layout tests
// ============================================================
test.describe('Layout: iPhone 16 Pro portrait (402×874)', () => {
  let ctx, page;
  test.beforeAll(async ({ browser }) => {
    ctx = await makeContext(browser, IPHONE_PORTRAIT);
    page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(1500);
  });
  test.afterAll(async () => { await ctx?.close(); });

  test('single-column flex layout', async () => {
    const display = await page.locator('main').evaluate(
      el => getComputedStyle(el).display
    );
    expect(display).toBe('flex');
  });

  test('canvas appears above controls', async () => {
    const data = await page.evaluate(() => {
      const canvas = document.getElementById('canvas-wrap');
      const sidebar = document.querySelector('.sidebar');
      return {
        canvasTop: canvas.getBoundingClientRect().top,
        sidebarTop: sidebar.getBoundingClientRect().top,
      };
    });
    expect(data.canvasTop).toBeLessThan(data.sidebarTop);
  });

  test('controls are full-width (not shrunken)', async () => {
    const data = await page.evaluate(() => {
      const group = document.querySelector('.control-group');
      const main = document.querySelector('main');
      return {
        groupW: group.getBoundingClientRect().width,
        mainW: main.getBoundingClientRect().width,
      };
    });
    expect(data.groupW).toBeGreaterThan(data.mainW * 0.8);
  });

  test('no horizontal overflow', async () => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test('canvas has landscape aspect ratio (wider than tall)', async () => {
    const ratio = await page.locator('#ascii-canvas').evaluate(el => {
      const w = parseFloat(el.style.width);
      const h = parseFloat(el.style.height);
      return w / h;
    });
    expect(ratio).toBeGreaterThan(1.0);
  });

  test('snapshot button is full-width', async () => {
    await page.locator('#snapshot-btn').scrollIntoViewIfNeeded();
    const data = await page.evaluate(() => {
      const btn = document.getElementById('snapshot-btn');
      const sidebar = document.querySelector('.sidebar');
      return {
        btnW: btn.getBoundingClientRect().width,
        sidebarW: sidebar.getBoundingClientRect().width,
      };
    });
    expect(data.btnW).toBeGreaterThan(data.sidebarW * 0.9);
  });

  test('page scrolls to reveal all controls', async () => {
    // All these must be scrollable-to and visible
    for (const sel of ['#detail', '#brightness', '#contrast', '#color-mode', '#invert', '#mirror', '#snapshot-btn']) {
      const el = page.locator(sel);
      await el.scrollIntoViewIfNeeded();
      await expect(el).toBeAttached();
    }
  });

  test('footer is reachable by scrolling', async () => {
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
  });

  test('page has vertical scroll (content taller than viewport)', async () => {
    const data = await page.evaluate(() => ({
      scrollH: document.documentElement.scrollHeight,
      clientH: document.documentElement.clientHeight,
    }));
    // Content should be taller than the viewport on mobile portrait
    expect(data.scrollH).toBeGreaterThan(data.clientH);
  });

  test('only body scrolls (no nested scrollbars)', async () => {
    const nestedScroll = await page.evaluate(() => {
      // Check that main and sidebar are not independently scrollable
      const main = document.querySelector('main');
      const sidebar = document.querySelector('.sidebar');
      return {
        mainOverflow: getComputedStyle(main).overflow,
        sidebarOverflow: getComputedStyle(sidebar).overflowY,
      };
    });
    expect(nestedScroll.mainOverflow).toBe('visible');
    expect(nestedScroll.sidebarOverflow).toBe('visible');
  });
});

// ============================================================
// Mobile landscape layout tests
// ============================================================
test.describe('Layout: iPhone 16 Pro landscape (874×402)', () => {
  let ctx, page;
  test.beforeAll(async ({ browser }) => {
    ctx = await makeContext(browser, IPHONE_LANDSCAPE);
    page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForTimeout(1500);
  });
  test.afterAll(async () => { await ctx?.close(); });

  test('two-column layout (above breakpoint)', async () => {
    const cols = await page.locator('main').evaluate(
      el => getComputedStyle(el).gridTemplateColumns
    );
    expect(cols.split(' ').filter(s => s).length).toBe(2);
  });

  test('no horizontal overflow', async () => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});

// ============================================================
// Screenshot capture (for human review)
// ============================================================
test.describe('Screenshots', () => {
  for (const [name, vp] of [
    ['desktop', DESKTOP],
    ['iphone-portrait', IPHONE_PORTRAIT],
    ['iphone-landscape', IPHONE_LANDSCAPE],
  ]) {
    test(`capture ${name}`, async ({ browser }) => {
      const ctx = await makeContext(browser, vp);
      const page = await ctx.newPage();
      await page.goto(BASE);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `tests/screenshots/${name}.png`, fullPage: true });
      await ctx.close();
    });
  }
});
