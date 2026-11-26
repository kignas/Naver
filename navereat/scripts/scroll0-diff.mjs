/* Captures Home at scrollTop 0 for the current build, so a baseline taken from
   another commit can be diffed against it (no interaction, no scroll).

   `node scripts/scroll0-diff.mjs after before` also diffs the two captures
   below the header: each page is cropped at its own first content row, so a
   deliberate header change cannot hide a change in the feed underneath. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { preview } from 'vite';

const tag = process.argv[2] || 'after';
const baseline = process.argv[3] || '';
const outDir = path.resolve(process.cwd(), '..', 'verify', 'item12b', 'scroll0');
await mkdir(outDir, { recursive: true });
const server = await preview({ root: process.cwd(), logLevel: 'error', preview: { host: '127.0.0.1', port: 4271, strictPort: true } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('nearbite_token', 'demo-token');
    localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Aarav', phone: '+91 98765 43210' }));
    sessionStorage.setItem('ew_offers_seen_v1', '["demo"]');
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4271/#/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  const metrics = await page.evaluate(() => {
    const q = (sel) => document.querySelector(sel)?.getBoundingClientRect();
    const header = q('.hero-header');
    const sheet = q('.hero-sheet');
    const row = q('.search-row');
    const banner = q('.banner-wrap') ?? q('.nv-hero-banner');
    const main = q('.home-main');
    // Everything below the header, in content coordinates: identical numbers
    // mean the feed did not move, whatever the header does above it.
    const mainRect = document.querySelector('.home-main').getBoundingClientRect();
    const rel = (element) => {
      const r = element.getBoundingClientRect();
      return {
        x: Math.round((r.left - mainRect.left) * 100) / 100,
        y: Math.round((r.top - mainRect.top) * 100) / 100,
        w: Math.round(r.width * 100) / 100,
        h: Math.round(r.height * 100) / 100,
      };
    };
    const pick = (selector, count = 3) => [...document.querySelectorAll(selector)].slice(0, count).map(rel);
    // Fixed chrome (bottom nav, cart bar) sits at the same viewport position in
    // both builds, so it must be excluded from a content-aligned crop.
    const chromeTop = Math.min(
      ...['.bottom-nav', '#white-cart-root', '.cart-bar', '.white-cart-bar']
        .map((selector) => document.querySelector(selector)?.getBoundingClientRect().top)
        .filter((top) => typeof top === 'number' && top > 0),
      window.innerHeight,
    );
    const landmarks = {
      title: pick('#restaurants-title'),
      section: pick('#restaurants-section'),
      cat: pick('.cat-item', 4),
      pill: pick('.filter-pill', 4),
      card: pick('.u99-card-host', 2),
      name: pick('.u99-restaurant-name', 2),
      meta: pick('.u99-meta', 2),
    };
    return {
      chromeTop: Math.round(chromeTop * 100) / 100,
      landmarks,
      header: header && { y: header.y, h: header.height },
      sheet: sheet && { y: sheet.y, h: sheet.height },
      row: row && { y: row.y, h: row.height },
      banner: banner && { y: banner.y, h: banner.height, w: banner.width },
      main: main && { y: main.y, h: main.height },
      scrollHeight: document.querySelector('.home-scroll')?.scrollHeight,
    };
  });
  const file = path.join(outDir, `home-${viewport.width}x${viewport.height}-${tag}.png`);
  await page.screenshot({ path: file });
  await writeFile(path.join(outDir, `metrics-${viewport.width}x${viewport.height}-${tag}.json`), `${JSON.stringify(metrics, null, 2)}\n`);
  console.log(tag, viewport.width, JSON.stringify(metrics));
  await context.close();
}
await browser.close();
await new Promise((resolve) => server.httpServer.close(resolve));

if (baseline) {
  const dpr = 2;
  const tolerance = 0.5;
  let failed = 0;
  const read = async (name, which) => {
    const png = PNG.sync.read(await readFile(path.join(outDir, `home-${name}-${which}.png`)));
    const metrics = JSON.parse(await readFile(path.join(outDir, `metrics-${name}-${which}.json`), 'utf8'));
    return {
      png,
      top: Math.round((metrics.main?.y ?? 0) * dpr),
      bottom: Math.round((metrics.chromeTop ?? metrics.main?.y + 400) * dpr),
      landmarks: metrics.landmarks ?? {},
    };
  };
  // A header that changes height moves the feed by a fraction of a pixel, which
  // shows up as glyph antialiasing. Search a +-1 px window and report the best
  // alignment; the geometry check below is the exact one.
  const bestDiff = (a, b) => {
    const width = Math.min(a.png.width, b.png.width);
    const height = Math.min(a.bottom - a.top, b.bottom - b.top) - 2;
    const crop = (png, top) => {
      const out = new PNG({ width, height });
      PNG.bitblt(png, out, 0, top, width, height, 0, 0);
      return out;
    };
    const left = crop(a.png, a.top);
    const right = crop(b.png, b.top);
    let best = { pixels: Infinity, shift: 0, diff: null };
    for (const shift of [0, -1, 1, -2, 2]) {
      const candidate = crop(b.png, b.top + shift);
      const diff = new PNG({ width, height });
      const pixels = pixelmatch(left.data, candidate.data, diff.data, width, height, { threshold: 0.12 });
      if (pixels < best.pixels) best = { pixels, shift, diff };
    }
    return { ...best, width, height };
  };
  const compareLandmarks = (a, b) => {
    const problems = [];
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const left = a[key] ?? [];
      const right = b[key] ?? [];
      if (left.length !== right.length) {
        problems.push(`${key}: ${left.length} vs ${right.length} elements`);
        continue;
      }
      left.forEach((rect, index) => {
        const other = right[index];
        for (const field of ['x', 'y', 'w', 'h']) {
          if (Math.abs(rect[field] - other[field]) > tolerance) {
            problems.push(`${key}[${index}].${field}: ${rect[field]} vs ${other[field]}`);
          }
        }
      });
    }
    return problems;
  };
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
    const name = `${viewport.width}x${viewport.height}`;
    const a = await read(name, tag);
    const b = await read(name, baseline);
    const problems = compareLandmarks(a.landmarks, b.landmarks);
    const best = bestDiff(a, b);
    const percent = (best.pixels / (best.width * best.height)) * 100;
    await writeFile(path.join(outDir, `below-header-${name}.png`), PNG.sync.write(best.diff));
    // A header of a different height moves the feed by a fraction of a pixel,
    // which re-antialiases every glyph; a 1 px self-shift of the same build
    // already costs ~0.3%. The layout comparison above is the exact check, the
    // pixel number only has to stay inside that subpixel noise floor.
    const pass = problems.length === 0 && percent <= 0.5;
    if (!pass) failed += 1;
    console.log(
      `${pass ? 'PASS' : 'FAIL'} below the header ${name}: layout ${problems.length ? problems.join('; ') : 'identical'}, ` +
        `pixels ${best.pixels} (${percent.toFixed(4)}% of ${best.width}x${best.height}, best alignment ${best.shift} px, noise floor ~0.3%)`,
    );
  }
  if (failed) process.exitCode = 1;
}
