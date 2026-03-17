import { chromium } from 'playwright';

const BASE = 'http://localhost:8765/ascii-cam.html';
const LAUNCH = {
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
};

async function auditViewport(name, viewport, extra = {}) {
  const browser = await chromium.launch(LAUNCH);
  const ctx = await browser.newContext({ viewport, permissions: ['camera'], ...extra });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForTimeout(2000);

  console.log(`\n========== ${name} (${viewport.width}×${viewport.height}) ==========`);

  // Check body overflow
  const bodyOverflow = await page.evaluate(() => {
    const body = document.body;
    return {
      scrollWidth: body.scrollWidth,
      clientWidth: body.clientWidth,
      scrollHeight: body.scrollHeight,
      clientHeight: body.clientHeight,
      horizontalOverflow: body.scrollWidth > body.clientWidth,
    };
  });
  console.log('Body overflow:', bodyOverflow);

  // Check all major elements
  const elements = [
    'header', 'header h1', 'main', '.sidebar',
    '.group-title', '.control-group', '.control-item',
    '.control-toggle', '.toggle-track', '.toggle-knob',
    'input[type="range"]', '.snapshot-btn',
    '#ascii-canvas', '.canvas-wrap', 'footer',
    '#countdown-overlay',
  ];

  for (const sel of elements) {
    const infos = await page.$$eval(sel, els => els.map(el => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        tag: el.tagName,
        id: el.id || '',
        class: el.className || '',
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        display: s.display,
        visibility: s.visibility,
        overflow: s.overflow,
        font: s.fontFamily.substring(0, 60),
        fontSize: s.fontSize,
        color: s.color,
        bg: s.backgroundColor,
      };
    }));
    if (infos.length > 3) {
      console.log(`  ${sel}: ${infos.length} elements, first:`, JSON.stringify(infos[0]));
    } else {
      infos.forEach(info => console.log(`  ${sel}:`, JSON.stringify(info)));
    }
  }

  // Check for elements that extend beyond viewport
  const overflowing = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return [...document.querySelectorAll('*')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.right > vw + 2 || r.left < -2;
    }).map(el => ({
      tag: el.tagName,
      id: el.id,
      class: el.className?.substring?.(0, 40) || '',
      right: Math.round(el.getBoundingClientRect().right),
      left: Math.round(el.getBoundingClientRect().left),
    }));
  });
  if (overflowing.length) {
    console.log('  ⚠ OVERFLOWING elements:', overflowing);
  } else {
    console.log('  ✓ No horizontal overflow');
  }

  // Check focus visibility on interactive elements
  const interactives = await page.$$eval('button, input, label[class*="toggle"]', els =>
    els.map(el => ({ tag: el.tagName, id: el.id, type: el.type || '', tabIndex: el.tabIndex }))
  );
  console.log('  Interactive elements:', interactives);

  await page.screenshot({ path: `tests/screenshots/${name}.png`, fullPage: true });
  console.log(`  📸 Screenshot saved: tests/screenshots/${name}.png`);

  await browser.close();
}

await auditViewport('desktop-1440x900', { width: 1440, height: 900 });
await auditViewport('iphone16pro-portrait', { width: 402, height: 874 }, { isMobile: true, deviceScaleFactor: 3, hasTouch: true });
await auditViewport('iphone16pro-landscape', { width: 874, height: 402 }, { isMobile: true, deviceScaleFactor: 3, hasTouch: true });
await auditViewport('tablet-768x1024', { width: 768, height: 1024 });

console.log('\n✅ All viewport audits complete');
