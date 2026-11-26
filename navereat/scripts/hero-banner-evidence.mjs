/**
 * Item 18 evidence: the animated Home hero banner.
 *
 * Serves the production build and writes, for 390x844 and 360x800:
 *   - loop-<vp>-strip.png   the 5 s loop at 0, 1.5, 2.2, 2.7, 4.0 and 4.8 s
 *                           (all hero animations held and seeked, so the frames
 *                           are reproducible),
 *   - scroll-<vp>-strip.png the header at scrollTop 0, 60, 120 and 200 (the
 *                           banner must not move, resize or parallax),
 *   - paused-<vp>.json      the covered-page proof: animation states, the
 *                           currentTime before and after a 6 s covered window,
 *                           and the style/layout/mutation counters for it.
 *
 * Usage: node scripts/hero-banner-evidence.mjs [--out verify/item18]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { preview } from 'vite';

const root = process.cwd();
const outDir = path.resolve(root, process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : '../verify/item18');
const viewports = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
];
const LOOP_MS = [0, 1500, 2200, 2700, 4000, 4800];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await mkdir(outDir, { recursive: true });
const server = await preview({ root, logLevel: 'error', preview: { host: '127.0.0.1', port: 4287, strictPort: true } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });

const seed = () => {
  localStorage.setItem('nearbite_token', 'demo-token');
  localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Aarav', phone: '+91 98765 43210' }));
  sessionStorage.setItem('ew_offers_seen_v1', '["demo"]');
};

const strip = async (files, labels, out, width) => {
  const images = await Promise.all(files.map(async (file) => sharp(file).resize(width).toBuffer()));
  const metas = await Promise.all(images.map((image) => sharp(image).metadata()));
  const height = Math.max(...metas.map((meta) => meta.height));
  const gap = 8;
  const labelHeight = 22;
  const total = images.length * width + (images.length - 1) * gap;
  const composites = images.map((input, index) => ({ input, left: index * (width + gap), top: labelHeight }));
  const svg = Buffer.from(
    `<svg width="${total}" height="${height + labelHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0b0b0f"/>${labels
      .map((label, index) => `<text x="${index * (width + gap) + width / 2}" y="15" fill="#ffffff" font-family="Arial, sans-serif" font-size="11" text-anchor="middle">${label}</text>`)
      .join('')}</svg>`,
  );
  await sharp(svg).composite(composites).png().toFile(out);
};

const report = { viewports: {}, loopMs: LOOP_MS };

try {
  for (const viewport of viewports) {
    const label = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await context.addInitScript(seed);
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4287/#/', { waitUntil: 'networkidle' });
    await page.waitForSelector('#hero-banner-region', { timeout: 20000 });
    await page.waitForTimeout(1200);

    const geometry = await page.evaluate(() => {
      const banner = document.querySelector('#hero-banner-region').getBoundingClientRect();
      const sheet = document.querySelector('.hero-sheet').getBoundingClientRect();
      const lines = ['.nv-hero-a-line1', '.nv-hero-a-line2', '.nv-hero-b-line1', '.nv-hero-b-line2', '.nv-hero-cta'].map((selector) => {
        const node = document.querySelector(selector);
        return { selector, clipped: node.scrollWidth > node.clientWidth + 1, text: node.textContent };
      });
      return {
        banner: { y: banner.y, h: banner.height, w: banner.width },
        sheet: { y: sheet.y, h: sheet.height },
        lines,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    // Hold every hero animation so the six frames are exactly the requested times.
    const seek = (ms) =>
      page.evaluate((time) => {
        document.getAnimations().forEach((animation) => {
          if (/^nv-hero-/.test(animation.animationName || '')) {
            animation.pause();
            animation.currentTime = time;
          }
        });
      }, ms);

    const loopFiles = [];
    for (const ms of LOOP_MS) {
      await seek(ms);
      await sleep(80);
      const file = path.join(outDir, `loop-${label}-${ms}.png`);
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width: viewport.width, height: Math.ceil(geometry.sheet.y + geometry.sheet.h) } });
      loopFiles.push(file);
    }
    const loopStrip = path.join(outDir, `loop-${label}-strip.png`);
    await strip(loopFiles, LOOP_MS.map((ms) => `${ms} ms`), loopStrip, 300);

    // Scroll strip: the banner is in flow, so it must leave with the sheet.
    const scrollFiles = [];
    const scrollRows = [];
    for (const y of [0, 60, 120, 200]) {
      await page.evaluate((top) => {
        document.querySelector('.home-scroll').scrollTop = top;
      }, y);
      await sleep(320);
      await seek(0);
      const file = path.join(outDir, `scroll-${label}-${y}.png`);
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width: viewport.width, height: 320 } });
      scrollFiles.push(file);
      scrollRows.push(
        await page.evaluate(() => {
          const banner = document.querySelector('#hero-banner-region').getBoundingClientRect();
          const header = document.querySelector('.hero-header').getBoundingClientRect();
          return {
            bannerTop: Number(banner.top.toFixed(2)),
            bannerHeight: Number(banner.height.toFixed(2)),
            headerHeight: Number(header.height.toFixed(2)),
          };
        }),
      );
    }
    const scrollStrip = path.join(outDir, `scroll-${label}-strip.png`);
    await strip(scrollFiles, ['0', '60', '120', '200'], scrollStrip, 300);
    await page.evaluate(() => {
      document.querySelector('.home-scroll').scrollTop = 0;
    });
    await sleep(320);

    // Covered-page proof on a fresh document: the loop/scroll captures above
    // seek the animations through the Web Animations API, which would outlive
    // the capture and mask the class-driven pause.
    await page.close();
    const proof = await context.newPage();
    await proof.goto('http://127.0.0.1:4287/#/', { waitUntil: 'networkidle' });
    await proof.waitForSelector('#restaurant-list [data-home99-restaurant]', { timeout: 20000 });
    await proof.waitForTimeout(1200);

    // Covered-page proof: hold Home behind a restaurant page for 6 s.
    const heroState = () =>
      proof.evaluate(() => {
        const node = document.querySelector('#hero-banner-region');
        const own = document.getAnimations().filter((a) => /^nv-hero-/.test(a.animationName || ''));
        return {
          paused: node ? node.classList.contains('is-paused') : null,
          running: own.filter((a) => a.playState === 'running').length,
          held: own.filter((a) => a.playState === 'paused').length,
          time: own.length ? Math.max(...own.map((a) => Number(a.currentTime) || 0)) : -1,
        };
      });
    const metrics = async () => {
      const cdp = await context.newCDPSession(proof);
      await cdp.send('Performance.enable');
      const read = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
      return { read, cdp };
    };
    const perf = await metrics();
    const before = await heroState();
    await proof.waitForSelector('#restaurant-list [data-home99-restaurant]', { timeout: 20000 });
    await proof.locator('#restaurant-list .u99-card-host:not(.rs-skeleton) .u99-restaurant-head').first().click();
    await proof.waitForSelector('.menu-item', { timeout: 20000 });
    await proof.evaluate(() => {
      window.__item18 = { mutations: 0 };
      const layer = [...document.querySelectorAll('.route-layer')].find((l) => l.querySelector('.home-screen'));
      if (layer) {
        new MutationObserver((records) => {
          window.__item18.mutations += records.length;
        }).observe(layer, { childList: true, subtree: true, attributes: true, characterData: true });
      }
    });
    await sleep(700);
    const coveredStart = await heroState();
    const countersStart = await perf.read();
    await sleep(6000);
    const countersEnd = await perf.read();
    const coveredEnd = await heroState();
    const mutations = await proof.evaluate(() => window.__item18.mutations);
    await proof.locator('.rest-page .ew-hd-back').first().click();
    await proof.waitForSelector('#home-header', { timeout: 20000 });
    await sleep(200);
    const after = await heroState();
    await proof.screenshot({ path: path.join(outDir, `resumed-${label}.png`), clip: { x: 0, y: 0, width: viewport.width, height: Math.ceil(geometry.sheet.y + geometry.sheet.h) } });
    await context.close();

    const delta = (key) => Number((countersEnd[key] - countersStart[key]).toFixed(2));
    const paused = {
      geometry,
      scroll: scrollRows,
      before,
      coveredStart,
      coveredEnd,
      after,
      coveredWindowMs: 6000,
      coveredRecalcStyle: delta('RecalcStyleCount'),
      coveredLayout: delta('LayoutCount'),
      coveredMutations: mutations,
      advancedMs: Math.round(after.time - before.time),
      heldWhileCovered: coveredStart.paused === true && coveredStart.running === 0 && coveredEnd.time === coveredStart.time,
      notRestarted: after.time > before.time,
    };
    await writeFile(path.join(outDir, `paused-${label}.json`), `${JSON.stringify(paused, null, 2)}\n`);
    report.viewports[label] = {
      geometry,
      loopStrip: path.relative(root, loopStrip),
      scrollStrip: path.relative(root, scrollStrip),
      paused: {
        heldWhileCovered: paused.heldWhileCovered,
        notRestarted: paused.notRestarted,
        advancedMs: paused.advancedMs,
        coveredRecalcStyle: paused.coveredRecalcStyle,
        coveredLayout: paused.coveredLayout,
        coveredMutations: paused.coveredMutations,
      },
    };
    console.log(
      label,
      JSON.stringify({
        banner: geometry.banner,
        overflowX: geometry.overflowX,
        clipped: geometry.lines.filter((line) => line.clipped).map((line) => line.selector),
        ...report.viewports[label].paused,
      }),
    );
  }
  await writeFile(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nSaved ${path.relative(path.resolve(root, '..'), outDir)}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
