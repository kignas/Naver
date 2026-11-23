import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { preview } from 'vite';
import { statusBarStyle, statusBarTheme } from '../src/lib/statusBarTheme';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const outDir = path.join(repoRoot, 'verify', 'item10a');
const STATUS_BAR_PX = 48;
const sizes = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
];
const routes = [
  { name: 'home', path: '/', hash: '/#/', selector: '.hero-header', auth: true },
  { name: 'login', path: '/login', hash: '/#/login', selector: '.login-hero', auth: false },
  { name: 'under99', path: '/under99', hash: '/#/under99', selector: '.u99-header', auth: true },
  { name: 'category', path: '/category/Pizza', hash: '/#/category/Pizza', selector: '.cat-header', auth: true },
  { name: 'restaurant', path: '/restaurant/1', hash: '/#/restaurant/1', selector: '.top-bar', auth: true },
  { name: 'cart', path: '/cart', hash: '/#/cart', selector: '.ct-delivery-head', auth: true },
  { name: 'orders', path: '/orders', hash: '/#/orders', selector: '.orders-header', auth: true },
  { name: 'track', path: '/track/NAV-240318', hash: '/#/track/NAV-240318', selector: '.app-bar', auth: true },
  { name: 'profile', path: '/profile', hash: '/#/profile', selector: '.header', auth: true },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function rgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function hexOf(data: Buffer, offset: number): string {
  return `#${[data[offset], data[offset + 1], data[offset + 2]]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

function luminance(hex: string): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function expectedIcons(hex: string): 'light' | 'dark' {
  const bg = luminance(hex);
  return contrast(1, bg) >= contrast(0, bg) ? 'light' : 'dark';
}

function composite(pagePng: PNG, width: number, height: number, color: string): PNG {
  const out = new PNG({ width, height });
  const [r, g, b] = rgb(color);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (y < STATUS_BAR_PX) {
        out.data[offset] = r;
        out.data[offset + 1] = g;
        out.data[offset + 2] = b;
        out.data[offset + 3] = 255;
      } else {
        const src = ((y - STATUS_BAR_PX) * width + x) * 4;
        out.data[offset] = pagePng.data[src];
        out.data[offset + 1] = pagePng.data[src + 1];
        out.data[offset + 2] = pagePng.data[src + 2];
        out.data[offset + 3] = pagePng.data[src + 3];
      }
    }
  }
  return out;
}

const server = await preview({
  root: appRoot,
  preview: { host: '127.0.0.1', port: 4175, strictPort: true },
});
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const report: Array<Record<string, unknown>> = [];
try {
  await mkdir(outDir, { recursive: true });
  for (const size of sizes) {
    for (const route of routes) {
      const theme = statusBarTheme(route.path);
      const expected = expectedIcons(theme.color);
      const styleApplied = statusBarStyle(theme);
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height - STATUS_BAR_PX },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      });
      await context.addInitScript(({ auth }) => {
        localStorage.clear();
        sessionStorage.clear();
        if (auth) {
          localStorage.setItem('nearbite_token', 'demo-token');
          localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Aarav', phone: '+91 98765 43210', email: 'demo@navereat.app' }));
          localStorage.setItem('nearbite_cart', JSON.stringify({
            'Masala Dosa': {
              quantity: 1, price: 99, resId: 1, isVeg: true, image: '',
              resName: 'Foodie Dosa Restaurant', restaurantName: 'Foodie Dosa Restaurant',
              menuItem: 'fd1', name: 'Masala Dosa',
            },
          }));
        }
        sessionStorage.setItem('ew_offers_seen_v1', '["demo"]');
      }, { auth: route.auth });
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:4175${route.hash}`, { waitUntil: 'networkidle' });
      await page.waitForSelector(route.selector, { timeout: 15000 });
      await sleep(700);
      const shot = PNG.sync.read(await page.screenshot({ type: 'png' }));
      const pageTop = hexOf(shot.data, (2 * shot.width + 4) * 4);
      const composed = composite(shot, size.width, size.height, theme.color);
      const file = path.join(outDir, `${route.name}-${size.width}x${size.height}.png`);
      await writeFile(file, PNG.sync.write(composed));
      const colorMatch = theme.color === pageTop;
      const iconMatch = theme.lightIcons === (expected === 'light');
      report.push({
        route: route.name,
        size: `${size.width}x${size.height}`,
        statusBar: theme.color,
        pageTop,
        icons: theme.lightIcons ? 'light' : 'dark',
        expectedIcons: expected,
        styleApplied,
        contrast: Number(contrast(theme.lightIcons ? 1 : 0, luminance(theme.color)).toFixed(2)),
        colorMatch,
        iconMatch,
        capacitorStyle: styleApplied === 'Dark' ? 'Style.Dark (light icons)' : 'Style.Light (dark icons)',
        match: colorMatch && iconMatch,
        file: path.relative(repoRoot, file),
      });
      await context.close();
    }
  }
  await writeFile(path.join(outDir, 'statusbar-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const failed = report.filter((entry) => !entry.match);
  console.log(JSON.stringify(report, null, 2));
  if (failed.length) {
    console.error(`Status bar/header mismatch: ${failed.length}`);
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
}
