import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const phase = process.argv[2] || 'after';
const root = process.cwd();
const port = 4240;
const base = `http://127.0.0.1:${port}`;
const outDir = path.resolve('..', 'verify', 'item10c', phase);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await mkdir(outDir, { recursive: true });

const server = spawn(
  path.join(root, 'node_modules', '.bin', 'vite'),
  ['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: root, stdio: 'ignore' },
);
const waitServer = async () => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(150);
  }
  throw new Error(`preview server did not start on ${port}`);
};

const initScript = () => {
  localStorage.setItem('nearbite_token', 'demo-token');
  localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Aarav', phone: '+91 98765 43210' }));
  sessionStorage.setItem('ew_offers_seen_v1', '["demo"]');
  localStorage.setItem('nearbite_cart', JSON.stringify({
    'Masala Dosa': {
      quantity: 1,
      price: 99,
      resId: 1,
      isVeg: true,
      image: '',
      resName: 'Foodie Dosa Restaurant',
      restaurantName: 'Foodie Dosa Restaurant',
      menuItem: 'fd1',
      name: 'Masala Dosa',
    },
  }));
  window.__clsEntries = [];
  window.__transitionStart = null;
  window.__clickAt = null;
  document.addEventListener('click', () => { window.__clickAt = Date.now(); }, true);
  const describe = (node) => {
    if (!node) return 'unknown';
    const el = node.nodeType === 3 ? node.parentElement : node;
    if (!(el instanceof Element)) return String(node.nodeName || node);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      cls: typeof el.className === 'string' ? el.className.slice(0, 100) : null,
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50),
    };
  };
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      window.__clsEntries.push({
        value: entry.value,
        hadRecentInput: entry.hadRecentInput,
        startTime: entry.startTime,
        sources: (entry.sources || []).map((source) => ({
          node: describe(source.node),
          previousRect: source.previousRect
            ? { x: source.previousRect.x, y: source.previousRect.y, w: source.previousRect.width, h: source.previousRect.height }
            : null,
          currentRect: source.currentRect
            ? { x: source.currentRect.x, y: source.currentRect.y, w: source.currentRect.width, h: source.currentRect.height }
            : null,
        })),
      });
    }
  });
  observer.observe({ type: 'layout-shift', buffered: true });
  window.__resetCls = () => {
    window.__clsEntries = [];
    observer.takeRecords();
  };
  window.__readCls = () => window.__clsEntries.slice();
  window.addEventListener('navereat:transition-start', () => {
    window.__transitionStart = Date.now();
  });
};

await waitServer();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});

const results = [];
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(initScript);
  const page = await context.newPage();
  await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#home-header', { timeout: 15000 });
  await sleep(1100);

  const readStyles = () =>
    page.evaluate(() => {
      const read = (selector) =>
        Array.from(document.querySelectorAll(selector)).map((el) => {
          const style = getComputedStyle(el);
          return {
            selector,
            cls: el.className,
            opacity: style.opacity,
            transform: style.transform,
            animationName: style.animationName,
          };
        });
      return {
        layers: read('.route-layer'),
        pages: read('.page, .home-screen, .u99-page, .rest-page, .cart-page, .track-page'),
        cards: read('.u99-restaurant-card, .nb-menu-item, .order-card, .ct-oi-section').slice(0, 8),
      };
    });

  const measure = async (name, action, waitAfter = 700) => {
    await page.evaluate(() => {
      window.__resetCls();
      window.__transitionStart = null;
      window.__clickAt = null;
    });
    const frames = [];
    const cdp = await context.newCDPSession(page);
    cdp.on('Page.screencastFrame', (event) => {
      frames.push({ data: event.data, ts: Date.now() });
      void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => undefined);
    });
    await cdp.send('Page.enable');
    await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: 390, maxHeight: 844 });
    await sleep(90);

    const clickedAt = Date.now();
    await action();
    await sleep(120);
    let transitionStart = await page.evaluate(() => window.__transitionStart);
    if (!transitionStart && !name.startsWith('tab-')) {
      for (let wait = 0; wait < 20 && !transitionStart; wait += 1) {
        await sleep(100);
        transitionStart = await page.evaluate(() => window.__transitionStart);
      }
    }
    const clickAt = await page.evaluate(() => window.__clickAt);
    const startEpoch = transitionStart || clickAt || clickedAt;
    await sleep(waitAfter);
    const styles = await readStyles();
    await cdp.send('Page.stopScreencast');
    const clsEntries = await page.evaluate(() => window.__readCls());
    await cdp.detach().catch(() => undefined);

    const pool = frames.filter((frame) => frame.ts >= startEpoch - 20);
    const source = pool.length ? pool : frames;
    const targets = [0, 60, 120, 180, 240, 300, 360];
    const selected = targets.map((target) => {
      const wanted = startEpoch + target;
      let best = source[0];
      for (const frame of source) {
        if (Math.abs(frame.ts - wanted) < Math.abs(best.ts - wanted)) best = frame;
      }
      return { target, actual: best ? best.ts - startEpoch : null, data: best?.data };
    });

    const width = 195;
    const height = Math.round((844 * width) / 390);
    const labelHeight = 24;
    const gap = 4;
    const stripWidth = selected.length * width + (selected.length - 1) * gap;
    const composites = [];
    const labels = [];
    const saved = [];
    for (let index = 0; index < selected.length; index += 1) {
      const entry = selected[index];
      if (!entry.data) continue;
      const file = path.join(outDir, `${name}-${String(entry.target).padStart(3, '0')}ms.png`);
      const buffer = Buffer.from(entry.data, 'base64');
      await writeFile(file, buffer);
      saved.push({ target: entry.target, actual: entry.actual, file: path.relative(path.resolve('..'), file) });
      const resized = await sharp(buffer).resize(width, height, { fit: 'cover' }).png().toBuffer();
      composites.push({ input: resized, left: index * (width + gap), top: labelHeight });
      labels.push(
        `<text x="${index * (width + gap) + width / 2}" y="16" fill="#ffffff" font-family="Arial, sans-serif" font-size="11" text-anchor="middle">${entry.target} ms</text>`,
      );
    }
    let strip = null;
    if (composites.length) {
      const labelSvg = Buffer.from(
        `<svg width="${stripWidth}" height="${height + labelHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111111"/>${labels.join('')}</svg>`,
      );
      strip = path.join(outDir, `${name}-strip.png`);
      await sharp(labelSvg).composite(composites).png().toFile(strip);
      strip = path.relative(path.resolve('..'), strip);
    }

    const total = clsEntries.reduce((sum, entry) => sum + entry.value, 0);
    const result = {
      name,
      startEpoch,
      cls: Number(total.toFixed(6)),
      clsEntries,
      frames: saved,
      strip,
      styles,
    };
    results.push(result);
    await writeFile(path.join(outDir, 'summary.json'), `${JSON.stringify(results, null, 2)}\n`);
    console.log(`${name}: cls=${result.cls} frames=${saved.length} strip=${strip || 'none'}`);
    return result;
  };

  await measure('tab-home-under99', () => page.locator('[data-nav-item="/under99"]').click());
  await measure('tab-under99-search', () => page.locator('[data-nav-item="/search"]').click());
  await measure('tab-search-orders', () => page.locator('[data-nav-item="/orders"]').click());
  await measure('tab-orders-profile', () => page.locator('[data-nav-item="/profile"]').click());
  await measure('tab-profile-home', () => page.locator('[data-nav-item="/"]').click());
  await sleep(400);

  await measure('push-home-restaurant', () => page.locator('.u99-restaurant-head').first().click());
  await page.waitForSelector('.menu-item', { timeout: 15000 });
  await sleep(350);
  await measure('push-restaurant-cart', () => page.locator('#es-pink-inner').click());
  await page.waitForSelector('.ct-cta', { timeout: 15000 });
  await page.locator('.ct-cta').first().click();
  await page.waitForSelector('#btn-checkout', { timeout: 15000 });
  await measure(
    'push-cart-tracking',
    async () => {
      await page.locator('#btn-checkout').click();
      await page.waitForSelector('.ew-os__btn', { timeout: 15000 });
      await page.locator('.ew-os__btn').click();
    },
    900,
  );
  await page.waitForSelector('.floating-back', { timeout: 15000 });
  await sleep(350);
  await measure('pop-tracking-cart', () => page.locator('.floating-back').first().click());
  await sleep(400);

  await writeFile(path.join(outDir, 'summary.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(`\nSaved ${path.relative(path.resolve('..'), outDir)}`);
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
