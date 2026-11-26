/**
 * Item 11A evidence: Home header collapse and the pinned search row.
 *
 * Serves the production build, captures the six scroll frames, composes a
 * labelled strip, and verifies that the header's flow height is identical at
 * every scroll position. Frame-rate and layout-shift numbers come from
 * `npm run perf-check` (motion.homeScroll).
 *
 * Usage: node scripts/motion-evidence.mjs [--out verify/item11a]
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'verify/item11a');
const framesDir = path.join(outDir, 'frames');
const port = Number(process.env.MOTION_PORT || 4218);

const seed = () => {
  localStorage.setItem('nearbite_token', 'demo-token');
  localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Sagnik', phone: '+91 98765 43210' }));
  localStorage.setItem('nearbite_orders', '[]');
  sessionStorage.setItem('ew_offers_seen_v1', '["demo"]');
};

await rm(outDir, { recursive: true, force: true });
await mkdir(framesDir, { recursive: true });

const server = spawn(path.join(root, 'node_modules/.bin/vite'), ['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
});
const waitForServer = async () => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('vite preview did not start');
};

try {
  await waitForServer();
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await context.addInitScript(seed);
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/#/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#restaurant-list .u99-restaurant-card');
  await page.waitForTimeout(1200);

  // The placeholder dish and the hero loop are time-based; freeze both before
  // every capture so two runs of this script are byte-comparable.
  const freeze = () =>
    page.evaluate(() => {
      document.querySelectorAll('.search-dish').forEach((el) => {
        el.textContent = '"Biryani"';
        el.classList.remove('is-sliding');
        el.style.animation = 'none';
        el.style.transform = 'none';
      });
      document.getAnimations().forEach((animation) => {
        if (/^nv-hero-/.test(animation.animationName || '')) {
          animation.pause();
          animation.currentTime = 0;
        }
      });
    });
  await freeze();

  const stops = [
    { label: 'scrollTop 0', y: 0 },
    { label: 'scrollTop 30', y: 30 },
    { label: 'scrollTop 60', y: 60 },
    { label: 'scrollTop 90', y: 90 },
    { label: 'scrollTop 150', y: 150 },
    { label: 'back to 0', y: 0 },
  ];
  const frames = [];
  for (const stop of stops) {
    await page.evaluate((y) => {
      document.querySelector('.home-scroll').scrollTop = y;
    }, stop.y);
    await page.waitForTimeout(360);
    await freeze();
    const file = path.join(framesDir, `${String(frames.length).padStart(2, '0')}-${stop.y}.png`);
    await page.screenshot({ path: file });
    frames.push({ ...stop, file });
  }

  const layout = await page.evaluate(() => {
    const scroller = document.querySelector('.home-scroll');
    const header = document.querySelector('.hero-header');
    const row = document.querySelector('.search-row');
    const rows = [];
    for (const y of [0, 30, 60, 90, 150, 500]) {
      scroller.scrollTop = y;
      rows.push({
        y,
        headerHeight: Number(header.getBoundingClientRect().height.toFixed(2)),
        searchRowTop: Number(row.getBoundingClientRect().top.toFixed(2)),
        scrollHeight: scroller.scrollHeight,
      });
    }
    scroller.scrollTop = 0;
    return rows;
  });
  const headerHeights = [...new Set(layout.map((row) => row.headerHeight))];
  const scrollHeights = [...new Set(layout.map((row) => row.scrollHeight))];

  // Compose the labelled strip.
  const stripPage = await context.newPage();
  await stripPage.setViewportSize({ width: 390 * frames.length + 12 * (frames.length + 1), height: 920 });
  const images = await Promise.all(
    frames.map(async (frame) => `data:image/png;base64,${(await readFile(frame.file)).toString('base64')}`),
  );
  await stripPage.setContent(`<html><body style="margin:0;background:#0b0b0f;display:flex;gap:12px;padding:12px;font-family:system-ui,sans-serif">
${images
  .map(
    (src, index) =>
      `<figure style="margin:0"><img src="${src}" style="width:390px;display:block;border-radius:8px"/><figcaption style="color:#fff;font:600 15px system-ui;text-align:center;padding-top:8px">${frames[index].label}</figcaption></figure>`,
  )
  .join('')}
</body></html>`);
  await stripPage.waitForTimeout(300);
  const strip = path.join(outDir, 'header-strip.png');
  await stripPage.screenshot({ path: strip, fullPage: true });

  const report = {
    viewport: '390x844 @2x',
    frames: frames.map((frame) => path.relative(root, frame.file)),
    strip: path.relative(root, strip),
    layout,
    headerHeightConstant: headerHeights.length === 1,
    scrollHeightConstant: scrollHeights.length === 1,
  };
  await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
} finally {
  server.kill('SIGTERM');
}
