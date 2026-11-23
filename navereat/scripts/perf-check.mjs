import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const label = process.argv[2] || 'run';
const cpuRate = Number(process.env.PERF_RATE || 4);
const legacyFps = process.env.PERF_METHOD === 'legacy';
const root = process.cwd();
const port = 4210 + (label === 'after' ? 1 : 0);
const base = `http://127.0.0.1:${port}`;
const outDir = path.resolve('..', 'verify');
await mkdir(outDir, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
});
const waitServer = async () => {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`preview server did not start on ${port}`);
};

const seed = () => {
  localStorage.setItem('nearbite_token', 'demo-token');
  localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Sagnik', phone: '+91 98765 43210' }));
  localStorage.setItem('nearbite_cart', JSON.stringify({
    'Filter Coffee': {
      quantity: 1,
      price: 49,
      originalPrice: 70,
      resId: 1,
      resName: 'Foodie Dosa Restaurant',
      restaurantName: 'Foodie Dosa Restaurant',
      menuItem: 'fd9',
      name: 'Filter Coffee',
      isVeg: true,
    },
  }));
  localStorage.setItem('nearbite_orders', '[]');
};

const initScript = () => {
  const perf = (window.__perf = {
    homeAt: null,
    cls: 0,
    fpsFrames: [],
    fpsOn: false,
  });
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) perf.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {
    /* layout-shift unsupported */
  }
  const startObserving = () => {
    const observer = new MutationObserver(() => {
      if (perf.homeAt == null && document.querySelector('#home-header')) {
        perf.homeAt = performance.now();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.documentElement) startObserving();
  else document.addEventListener('DOMContentLoaded', startObserving, { once: true });
  window.__startFps = () => {
    perf.fpsFrames = [];
    perf.fpsOn = true;
    const loop = (time) => {
      if (!perf.fpsOn) return;
      perf.fpsFrames.push(time);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };
  window.__stopFps = () => {
    perf.fpsOn = false;
    const frames = perf.fpsFrames;
    const duration = frames.length > 1 ? frames[frames.length - 1] - frames[0] : 0;
    const gaps = frames.slice(1).map((time, index) => time - frames[index]);
    return {
      frames: frames.length,
      fps: duration > 0 ? ((frames.length - 1) * 1000) / duration : 0,
      maxGapMs: gaps.length ? Math.max(...gaps) : 0,
      longFrames: gaps.filter((gap) => gap > 25).length,
    };
  };
  window.__resetCls = () => {
    perf.cls = 0;
  };
  perf.transition = null;
  window.addEventListener('navereat:transition-start', () => window.__startFps());
  window.addEventListener('navereat:transition-end', () => {
    perf.transition = window.__stopFps();
  });
};

const readJson = async (page) => page.evaluate(() => window.__perf);

const coldStart = async (browser) => {
  const runs = [];
  for (let i = 0; i < 3; i += 1) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    await context.addInitScript(seed);
    await context.addInitScript(initScript);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    const started = Date.now();
    await page.goto(`${base}/#/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#home-header', { timeout: 15000 });
    const homeAt = await page.evaluate(() => window.__perf.homeAt);
    const navigation = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      return {
        domContentLoaded: nav?.domContentLoadedEventEnd ?? 0,
        load: nav?.loadEventEnd ?? 0,
        fcp: paint.find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? 0,
      };
    });
    await page.waitForTimeout(700);
    const perf = await readJson(page);
    runs.push({
      homePaintMs: homeAt,
      fcpMs: navigation.fcp,
      domContentLoadedMs: navigation.domContentLoaded,
      loadMs: navigation.load,
      cls: perf.cls,
      wallMs: Date.now() - started,
    });
    await context.close();
  }
  const avg = (key) => runs.reduce((sum, run) => sum + run[key], 0) / runs.length;
  return {
    runs,
    average: {
      homePaintMs: avg('homePaintMs'),
      fcpMs: avg('fcpMs'),
      domContentLoadedMs: avg('domContentLoadedMs'),
      loadMs: avg('loadMs'),
      cls: avg('cls'),
    },
  };
};

const interactions = async (browser) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(seed);
  await context.addInitScript(initScript);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#restaurant-list .u99-restaurant-card', { timeout: 15000 });
  await page.waitForTimeout(600);

  const homeRender = await page.evaluate(() => ({
    home: window.__homeRenders ?? 0,
    cards: window.__cardRenders ?? 0,
    cls: window.__perf.cls,
  }));

  await page.evaluate(() => {
    window.__homeRenders = 0;
    window.__cardRenders = 0;
  });
  await page.locator('#restaurant-list .u99-stepper button').last().click();
  await page.waitForTimeout(250);
  const afterQty = await page.evaluate(() => ({
    home: window.__homeRenders ?? 0,
    cards: window.__cardRenders ?? 0,
  }));

  let push;
  let pop;
  if (legacyFps) {
    await page.evaluate(() => {
      window.__perf.cls = 0;
      window.__startFps();
    });
    await page.locator('#restaurant-list .u99-restaurant-head').first().click();
    await page.waitForTimeout(650);
    push = await page.evaluate(() => window.__stopFps());
  } else {
    await page.evaluate(() => {
      window.__perf.cls = 0;
      window.__perf.transition = null;
    });
    await page.locator('#restaurant-list .u99-restaurant-head').first().click();
    await page.waitForFunction(() => window.__perf.transition != null, null, { timeout: 15000 });
    push = await page.evaluate(() => window.__perf.transition);
  }
  await page.waitForSelector('.menu-item', { timeout: 15000 });
  await page.waitForTimeout(500);
  const restaurantCls = await page.evaluate(() => window.__perf.cls);

  if (legacyFps) {
    await page.evaluate(() => {
      window.__perf.cls = 0;
      window.__startFps();
    });
    await page.locator('.ew-hd-back').first().click();
    await page.waitForTimeout(650);
    pop = await page.evaluate(() => window.__stopFps());
  } else {
    await page.evaluate(() => {
      window.__perf.cls = 0;
      window.__perf.transition = null;
    });
    await page.locator('.ew-hd-back').first().click();
    await page.waitForFunction(() => window.__perf.transition != null, null, { timeout: 15000 });
    pop = await page.evaluate(() => window.__perf.transition);
  }
  await page.waitForSelector('#home-header', { timeout: 15000 });

  await page.evaluate(() => window.__startFps());
  await page.locator('.filter-pill-sheet').first().click();
  await page.waitForTimeout(650);
  const sheet = await page.evaluate(() => window.__stopFps());

  await context.close();
  return { homeRender, afterQty, push, pop, sheet, restaurantCls };
};

const bundle = async () => {
  const dir = path.join(root, 'dist', 'assets');
  const files = await readdir(dir);
  const rows = [];
  for (const file of files) {
    if (!/\.(js|css)$/.test(file)) continue;
    const filePath = path.join(dir, file);
    const contents = await readFile(filePath);
    rows.push({
      file,
      bytes: (await stat(filePath)).size,
      gzipBytes: zlib.gzipSync(contents).length,
    });
  }
  const entry = rows.find((row) => /^index-.*\.js$/.test(row.file));
  const totalJs = rows.filter((row) => row.file.endsWith('.js')).reduce((sum, row) => sum + row.bytes, 0);
  return { rows, entry, totalJs };
};

await waitServer();
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  const result = {
    label,
    measuredAt: new Date().toISOString(),
    coldStart: await coldStart(browser),
    interactions: await interactions(browser),
    bundle: await bundle(),
  };
  await writeFile(path.join(outDir, `perf-${label}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
