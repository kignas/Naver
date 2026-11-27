/**
 * Home hero evidence: the animated breakfast banner in `.hero-sheet`.
 *
 * Serves the production build and writes, for 390x844 and 360x800:
 *   - hero-<vp>.png        the banner as it paints,
 *   - scroll-<vp>-strip.png the header at scrollTop 0, 60, 120 and 200 (the
 *                          banner is in flow: it leaves with the sheet and must
 *                          not move, resize or parallax on its own),
 *   - report.json          geometry, overflow and the animation audit.
 *
 * The banner is driven by GSAP (transform/opacity on inline styles), not by CSS
 * animations, so the audit still fails if a named CSS animation starts on Home.
 *
 * Usage: node scripts/hero-banner-evidence.mjs [--out verify/hero]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { preview } from 'vite';

const root = process.cwd();
const outDir = path.resolve(root, process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : '../verify/hero');
const viewports = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];

const check = (name, condition, detail = '') => {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
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

await mkdir(outDir, { recursive: true });
const server = await preview({ root, logLevel: 'error', preview: { host: '127.0.0.1', port: 4287, strictPort: true } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });

const seed = () => {
  localStorage.setItem('nearbite_token', 'demo-token');
  localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Aarav', phone: '+91 98765 43210' }));
  sessionStorage.setItem('ew_offers_seen_v1', '["demo"]');
};

const report = { viewports: {} };

try {
  for (const viewport of viewports) {
    const label = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await context.addInitScript(seed);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:4287/#/', { waitUntil: 'networkidle' });
    await page.waitForSelector('#hero-banner-region', { timeout: 20000 });
    await page.waitForTimeout(1200);

    const audit = await page.evaluate(() => {
      const banner = document.querySelector('#hero-banner-region');
      const sheet = document.querySelector('.hero-sheet');
      const art = document.querySelector('.hb-dish--a');
      const box = (node) => (node ? node.getBoundingClientRect() : null);
      const named = (a) => typeof a.animationName === 'string' && a.animationName.length > 0;
      const running = document.getAnimations().filter((a) => a.playState === 'running' && named(a));
      const lines = ['.hb-line--with', '.hb-line--free', '.hb-line--delivery', '.hb-cta', '.hb-strip__text'].map((selector) => {
        const node = document.querySelector(selector);
        return {
          selector,
          present: Boolean(node),
          clipped: node ? node.scrollWidth > node.clientWidth + 1 : true,
          text: node ? node.textContent.replace(/\s+/g, ' ').trim() : null,
        };
      });
      const bannerBox = box(banner);
      const sheetBox = box(sheet);
      const artBox = box(art);
      return {
        banner: bannerBox && { y: Math.round(bannerBox.y), h: Math.round(bannerBox.height), w: Math.round(bannerBox.width) },
        sheet: sheetBox && { y: Math.round(sheetBox.y), h: Math.round(sheetBox.height) },
        art: artBox && { x: Math.round(artBox.x), y: Math.round(artBox.y), w: Math.round(artBox.width), h: Math.round(artBox.height) },
        rules: getComputedStyle(banner).borderRadius,
        banners: document.querySelectorAll('#hero-banner-region').length,
        dots: document.querySelectorAll('#hero-banner-region .banner-dot').length,
        runningAnimations: [...new Set(running.map((a) => a.animationName))],
        transitions: [...new Set(document.getAnimations().filter((a) => a.playState === 'running' && !named(a)).map((a) => a.transitionProperty || 'transition'))],
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        lines,
      };
    });

    // 5 s of idle time must not start anything: that is the whole point of
    // replacing the carousel with the original's single static slide.
    await page.evaluate(() => {
      window.__heroMutations = 0;
      const node = document.querySelector('#hero-banner-region');
      new MutationObserver((records) => {
        window.__heroMutations += records.length;
      }).observe(node, { childList: true, subtree: true, attributes: true, characterData: true });
    });
    await sleep(5000);
    const idle = await page.evaluate(() => {
      const named = (a) => typeof a.animationName === 'string' && a.animationName.length > 0;
      const running = document.getAnimations().filter((a) => a.playState === 'running' && named(a));
      return { mutations: window.__heroMutations, running: [...new Set(running.map((a) => a.animationName))] };
    });

    await page.screenshot({ path: path.join(outDir, `hero-${label}.png`), clip: { x: 0, y: 0, width: viewport.width, height: Math.ceil(audit.sheet.y + audit.sheet.h) } });

    // Scroll strip: the banner is in flow, so it must leave with the sheet and
    // keep its own height while doing it.
    const scrollFiles = [];
    const scrollRows = [];
    for (const y of [0, 60, 120, 200]) {
      await page.evaluate((top) => {
        document.querySelector('.home-scroll').scrollTop = top;
      }, y);
      await sleep(320);
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
    await context.close();

    const heights = new Set(scrollRows.map((row) => row.bannerHeight));
    check(`${label}: one hero banner`, audit.banners === 1 && audit.dots === 0, `banners=${audit.banners} dots=${audit.dots}`);
    check(`${label}: no hero animation on open`, audit.runningAnimations.length === 0, audit.runningAnimations.join(', ') || 'none');
    check(`${label}: still inert after 5 s`, idle.running.length === 0 && idle.mutations === 0, `running=${idle.running.join(', ') || 'none'} mutations=${idle.mutations}`);
    check(`${label}: banner keeps its height while scrolling`, heights.size === 1, [...heights].join(', '));
    check(`${label}: banner scrolls with the sheet`, scrollRows.every((row, index) => index === 0 || row.bannerTop < scrollRows[index - 1].bannerTop + 0.5), scrollRows.map((row) => row.bannerTop).join(' → '));
    check(`${label}: no horizontal overflow`, audit.overflowX === 0, `${audit.overflowX}px`);
    // <br> makes textContent run the lines together, in the original too, so the
    // copy is compared with whitespace removed.
    const copy = Object.fromEntries(audit.lines.map((line) => [line.selector, line.text]));
    const flat = (value) => (value || '').replace(/\s+/g, '');
    check(`${label}: copy is not clipped`, audit.lines.every((line) => line.present && !line.clipped), audit.lines.filter((line) => !line.present || line.clipped).map((line) => line.selector).join(', ') || 'every line fits');
    check(
      `${label}: copy matches the banner`,
      flat(copy['.hb-line--with']) === 'with' &&
        flat(copy['.hb-line--free']) === 'FREE' &&
        flat(copy['.hb-line--delivery']) === 'Delivery' &&
        flat(copy['.hb-cta']) === 'ORDERNOW' &&
        flat(copy['.hb-strip__text']) === 'Breakfaststaples·servedfresh',
      JSON.stringify(copy),
    );
    check(`${label}: no page errors`, errors.length === 0, errors.join(' | '));

    report.viewports[label] = {
      geometry: { banner: audit.banner, sheet: audit.sheet, art: audit.art, radius: audit.rules },
      idle,
      scroll: scrollRows,
      copy: audit.lines.map((line) => ({ selector: line.selector, text: line.text })),
      runningAnimations: audit.runningAnimations,
      transitions: audit.transitions,
      overflowX: audit.overflowX,
      heroShot: path.relative(root, path.join(outDir, `hero-${label}.png`)),
      scrollStrip: path.relative(root, scrollStrip),
      errors,
    };
    console.log(label, JSON.stringify({ banner: audit.banner, art: audit.art, banners: audit.banners, overflowX: audit.overflowX }));
  }
  await writeFile(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nSaved ${path.relative(path.resolve(root, '..'), outDir)}`);
  if (failures.length) {
    console.error(`\n${failures.length} FAILED`);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
