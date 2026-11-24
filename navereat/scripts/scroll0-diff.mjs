/* Captures Home at scrollTop 0 for the current build, so a baseline taken from
   another commit can be diffed against it (no interaction, no scroll). */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const tag = process.argv[2] || 'after';
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
    const banner = q('.banner-wrap');
    return {
      header: header && { y: header.y, h: header.height },
      sheet: sheet && { y: sheet.y, h: sheet.height },
      row: row && { y: row.y, h: row.height },
      banner: banner && { y: banner.y, h: banner.height, w: banner.width },
      scrollHeight: document.querySelector('.home-scroll')?.scrollHeight,
    };
  });
  const file = path.join(outDir, `home-${viewport.width}x${viewport.height}-${tag}.png`);
  await page.screenshot({ path: file });
  console.log(viewport.width, JSON.stringify(metrics));
  await context.close();
}
await browser.close();
await new Promise((resolve) => server.httpServer.close(resolve));
