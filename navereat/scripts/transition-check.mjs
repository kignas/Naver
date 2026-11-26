import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const label = process.argv[2] || 'after';
const cpuRate = Number(process.env.PERF_RATE || 1);
const root = process.cwd();
const port = 4220 + (label === 'after' ? 1 : 0);
const base = `http://127.0.0.1:${port}`;
const outDir = path.resolve('..', 'verify');
const frameDir = path.join(outDir, 'frames');
await mkdir(frameDir, { recursive: true });

const server = spawn(path.join(root, 'node_modules', '.bin', 'vite'), ['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
});
const waitServer = async () => {
  for (let i = 0; i < 100; i += 1) {
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
  const perf = (window.__perf = { transition: null, fpsFrames: [], fpsStart: 0, fpsOn: false });
  window.__startFps = () => {
    perf.fpsFrames = [];
    perf.fpsStart = performance.now();
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
      frameTimes: frames.map((time) => Number((time - perf.fpsStart).toFixed(1))),
    };
  };
  window.addEventListener('navereat:transition-start', () => window.__startFps());
  window.addEventListener('navereat:transition-end', () => {
    perf.transition = window.__stopFps();
  });
};

const measure = async (page, name, action) => {
  await page.evaluate(() => {
    window.__perf.transition = null;
  });
  await action();
  await page.waitForFunction(() => window.__perf.transition != null, null, { timeout: 15000 });
  const result = await page.evaluate(() => window.__perf.transition);
  return {
    name,
    fps: Number(result.fps.toFixed(1)),
    longestFrameMs: Number(result.maxGapMs.toFixed(1)),
    frames: result.frames,
    frameTimes: result.frameTimes,
  };
};

const captureStrip = async (browser) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(seed);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', (event) => {
    frames.push({ data: event.data, ts: Date.now() });
    void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => undefined);
  });
  await cdp.send('Page.enable');
  await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#restaurant-list .u99-restaurant-card', { timeout: 15000 });
  await page.waitForTimeout(900);
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: 390, maxHeight: 844 });
  const started = page.evaluate(
    () => new Promise((resolve) => {
      window.addEventListener('navereat:transition-start', () => {
        window.__startEpoch = Date.now();
        resolve();
      }, { once: true });
    }),
  );
  await page.locator('#restaurant-list .u99-restaurant-head').first().click();
  await started;
  await page.waitForTimeout(380);
  await cdp.send('Page.stopScreencast');
  const startEpoch = await page.evaluate(() => window.__startEpoch || Date.now());
  console.error('SCREENCAST', { frames: frames.length, first: frames[0]?.ts, last: frames[frames.length-1]?.ts, startEpoch, span: frames.length ? frames[frames.length-1].ts - frames[0].ts : 0 });
  await context.close();

  const after = frames.filter((frame) => frame.ts >= startEpoch);
  const pool = after.length >= 7 ? after : frames;
  const wanted = [16, 50, 100, 150, 200, 250, 300];
  const selected = wanted.map((time) => {
    const target = startEpoch + time;
    let best = pool[0];
    for (const frame of pool) {
      if (Math.abs(frame.ts - target) < Math.abs(best.ts - target)) best = frame;
    }
    return { time, frame: best };
  });
  console.error('SELECTED', selected.map((entry) => entry.frame.ts - startEpoch));
  if (selected.some((entry) => !entry.frame)) throw new Error('screencast produced no frames');

  const width = 195;
  const height = Math.round((844 * width) / 390);
  const labelHeight = 24;
  const gap = 4;
  const stripWidth = selected.length * width + (selected.length - 1) * gap;
  const stripHeight = height + labelHeight;
  const composites = [];
  const labels = [];
  const files = [];
  for (let index = 0; index < selected.length; index += 1) {
    const left = index * (width + gap);
    const file = path.join(frameDir, `home-restaurant-${String(selected[index].time).padStart(3, '0')}ms.png`);
    const buffer = Buffer.from(selected[index].frame.data, 'base64');
    await writeFile(file, buffer);
    const resized = await sharp(buffer).resize(width, height, { fit: 'cover' }).png().toBuffer();
    composites.push({ input: resized, left, top: labelHeight });
    labels.push(
      `<text x="${left + width / 2}" y="16" fill="#ffffff" font-family="Arial, sans-serif" font-size="11" text-anchor="middle">${selected[index].time} ms</text>`,
    );
    files.push({ time: selected[index].time, file });
  }
  const labelSvg = Buffer.from(
    `<svg width="${stripWidth}" height="${stripHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111111"/>${labels.join('')}</svg>`,
  );
  const strip = path.join(frameDir, 'home-restaurant-strip.png');
  await sharp(labelSvg).composite(composites).png().toFile(strip);
  return { strip, files };
};

await waitServer();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
try {
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
  await page.waitForTimeout(900);

  const transitions = [];
  transitions.push(
    await measure(page, 'Home → Restaurant', () => page.locator('#restaurant-list .u99-restaurant-head').first().click()),
  );
  await page.waitForSelector('.menu-item', { timeout: 15000 });
  await page.waitForTimeout(400);
  transitions.push(
    await measure(page, 'Restaurant → Cart', () => page.locator('#es-pink-inner').click()),
  );
  await page.waitForSelector('.ct-cta', { timeout: 15000 });
  await page.waitForTimeout(300);

  // The cart CTA (#btn-checkout) opens the payment sheet; the order is placed
  // from the sheet's confirm button.
  await page.locator('.ct-cta').first().click();
  await page.waitForSelector('#ct-pay-confirm-btn', { timeout: 15000 });
  await page.locator('#ct-pay-confirm-btn').click();
  await page.waitForSelector('.ew-os__btn', { timeout: 15000 });
  transitions.push(
    await measure(page, 'Cart → Tracking', () => page.locator('.ew-os__btn').click()),
  );
  await page.waitForSelector('.floating-back', { timeout: 15000 });
  await page.waitForTimeout(300);
  transitions.push(
    await measure(page, 'Tracking → Cart (pop)', () => page.locator('.floating-back').first().click()),
  );
  await context.close();

  const strip = await captureStrip(browser);
  const result = {
    label,
    cpuRate,
    measuredAt: new Date().toISOString(),
    transitions,
    strip,
  };
  await writeFile(path.join(outDir, `transitions-${label}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
