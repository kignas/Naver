import http from 'node:http';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { preview } from 'vite';
import { categories, restaurants } from '../src/data/demo';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const originalDir = process.env.ORIGINAL_DIR
  ? path.resolve(process.env.ORIGINAL_DIR)
  : path.resolve(appRoot, '../../../reference/Nearbite-main');
const originalApiRoute = /https:\/\/api\.[^/]+\/.*/;
const placeholdersRoot = path.join(appRoot, 'src/assets/placeholders');
const verifyRoot = path.join(repoRoot, 'verify');
const generatedPlaceholdersRoot = path.join(verifyRoot, 'placeholders');
mkdirSync(generatedPlaceholdersRoot, { recursive: true });
const originalPort = 4173;
const appPort = 4174;
const viewport = { width: Number(process.env.VISUAL_WIDTH) || 390, height: 844 };
const scale = 2;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function serveFile(res: http.ServerResponse, file: string): void {
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  createReadStream(file).pipe(res);
}

function startOriginalServer(): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://127.0.0.1:${originalPort}`);
        let pathname = decodeURIComponent(url.pathname);
        if (pathname === '/') pathname = '/index.html';

        if (pathname.startsWith('/__placeholders/')) {
          const name = path.basename(pathname);
          let file = path.join(placeholdersRoot, name);
          if (!existsSync(file)) file = path.join(generatedPlaceholdersRoot, name);
          if (existsSync(file)) {
            serveFile(res, file);
            return;
          }
        }

        let file = path.join(originalDir, pathname);
        if (!file.startsWith(originalDir)) {
          res.writeHead(403).end('Forbidden');
          return;
        }
        if (!existsSync(file) || !statSync(file).isFile()) {
          if (!path.extname(pathname)) {
            const html = `${file}.html`;
            if (existsSync(html)) {
              serveFile(res, html);
              return;
            }
          }
          res.writeHead(404).end('Not found');
          return;
        }
        serveFile(res, file);
      } catch (error) {
        res.writeHead(500).end(String(error));
      }
    });
    server.once('error', reject);
    server.listen(originalPort, '127.0.0.1', () => resolve(server));
  });
}

function placeholderUrl(value: string): string {
  const raw = String(value);
  const dataMatch = raw.match(/^data:image\/svg\+xml(;base64)?,(.*)$/s);
  if (dataMatch) {
    const buffer = dataMatch[1]
      ? Buffer.from(dataMatch[2], 'base64')
      : Buffer.from(decodeURIComponent(dataMatch[2]), 'utf8');
    const hash = createHash('sha1').update(buffer).digest('hex').slice(0, 12);
    writeFileSync(path.join(generatedPlaceholdersRoot, `${hash}.svg`), buffer);
    return `/__placeholders/${hash}.svg`;
  }
  const name = raw.split('/').pop()?.split('?')[0] ?? '';
  return `/__placeholders/${name}`;
}

const apiCategories = categories.map((category, index) => ({
  _id: category.id,
  name: category.name,
  type: category.name,
  image: placeholderUrl(category.image),
  isActive: true,
  order: index,
}));

const apiRestaurants = restaurants.map((restaurant) => ({
  _id: String(restaurant.id),
  name: restaurant.name,
  cuisine: restaurant.cuisine,
  rating: Number(restaurant.rating),
  ratingCount: restaurant.ratingCount,
  estimatedDeliveryMin: restaurant.deliveryMin,
  estimatedDeliveryMax: restaurant.deliveryMax,
  distanceKm: restaurant.distanceKm,
  offer: restaurant.offer || 'UP TO 30% OFF',
  verified: restaurant.verified !== false,
  isOpen: true,
  serviceable: true,
  area: 'Demo City',
  freeDeliveryAbove: restaurant.freeDeliveryAbove ?? 399,
  image: placeholderUrl(restaurant.image),
  images: [placeholderUrl(restaurant.image)],
  menu: restaurant.menu.map((item) => ({
    _id: item.id,
    id: item.id,
    name: item.name,
    price: item.price,
    originalPrice: item.originalPrice,
    discountPercent: item.discountPercent,
    isVeg: item.isVeg,
    isBestseller: item.bestseller,
    category: item.category ?? 'Recommended',
    description: item.desc,
    image: placeholderUrl(item.image),
    inStock: true,
    customizations: item.customizationGroups ?? item.customizations ?? [],
    customisable: Boolean(item.customizationGroups?.length || item.customizations?.length),
  })),
  pricing: {
    serviceable: true,
    distanceKm: restaurant.distanceKm,
    deliveryFee: 30,
    effectiveDeliveryFee: 30,
    freeDelivery: {
      available: true,
      enabled: true,
      threshold: 399,
      baseThreshold: 399,
      eligibleSubtotal: 0,
      amountRemaining: restaurant.freeDeliveryRemaining ?? 0,
      unlocked: false,
      reachedThreshold: false,
      subsidised: false,
      reason: 'below_threshold',
      deliveryFee: 30,
      effectiveDeliveryFee: 30,
    },
    minimumOrder: { amount: restaurant.minimumOrder ?? 0 },
  },
}));

const apiBanners = [
  {
    _id: 'hero-1',
    title: '',
    mobileImage: '/__placeholders/hero-dish.svg',
    active: true,
    priority: 1,
  },
];

function json(route: import('playwright-core').Route, data: unknown): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  });
}

async function mockApi(route: import('playwright-core').Route): Promise<void> {
  const url = new URL(route.request().url());
  const pathname = url.pathname.replace(/^\/api/, '');

  if (pathname === '/platform/public-status') {
    await json(route, { canOrder: true, state: 'open', orderingOpen: true, nextOpenAt: null });
    return;
  }
  if (pathname === '/home-banners') {
    await json(route, apiBanners);
    return;
  }
  if (pathname === '/users/addresses') {
    await json(route, [
      {
        _id: 'demo-address',
        tag: 'Home',
        house: 'Demo Street',
        area: 'Demo City…',
        city: 'Demo City…',
        isDefault: true,
      },
    ]);
    return;
  }
  if (pathname === '/categories') {
    await json(route, apiCategories);
    return;
  }
  if (pathname === '/restaurants' || pathname === '/restaurants/search') {
    await json(route, apiRestaurants);
    return;
  }
  if (pathname === '/pricing/restaurant-cards') {
    await json(route, { cards: [] });
    return;
  }
  const reviewsMatch = pathname.match(/^\/restaurants\/([^/]+)\/reviews$/);
  if (reviewsMatch) {
    await json(route, { items: [], total: 0, page: 1, pages: 0, summary: null });
    return;
  }
  const restaurantMatch = pathname.match(/^\/restaurants\/([^/]+)$/);
  if (restaurantMatch) {
    const restaurant = apiRestaurants.find((entry) => entry._id === restaurantMatch[1]);
    if (restaurant) await json(route, restaurant);
    else await json(route, null);
    return;
  }
  const menuMatch = pathname.match(/^\/restaurants\/([^/]+)\/menu$/);
  if (menuMatch) {
    const restaurant = apiRestaurants.find((entry) => entry._id === menuMatch[1]);
    await json(route, restaurant?.menu ?? []);
    return;
  }
  await json(route, []);
}

function cropPng(source: PNG, width: number, height: number): PNG {
  const out = new PNG({ width, height });
  PNG.bitblt(source, out, 0, 0, width, height, 0, 0);
  return out;
}


async function writePairDiff(
  name: string,
  originalPage: import('playwright-core').Page,
  appPage: import('playwright-core').Page,
  contentHeightCss = 760,
): Promise<void> {
  await originalPage.screenshot({ path: path.join(verifyRoot, `original/${name}.png`) });
  await appPage.screenshot({ path: path.join(verifyRoot, `navereat/${name}.png`) });
  const originalPng = PNG.sync.read(await fs.readFile(path.join(verifyRoot, `original/${name}.png`)));
  const appPng = PNG.sync.read(await fs.readFile(path.join(verifyRoot, `navereat/${name}.png`)));
  const width = Math.min(originalPng.width, appPng.width);
  const height = Math.min(originalPng.height, appPng.height);
  const originalCrop = cropPng(originalPng, width, height);
  const appCrop = cropPng(appPng, width, height);
  const diff = new PNG({ width, height });
  const pixels = pixelmatch(originalCrop.data, appCrop.data, diff.data, width, height, { threshold: 0.12 });
  await fs.writeFile(path.join(verifyRoot, `diff/${name}.png`), PNG.sync.write(diff));
  const contentHeight = Math.round(contentHeightCss * scale);
  const originalContent = cropPng(originalPng, width, contentHeight);
  const appContent = cropPng(appPng, width, contentHeight);
  const diffContent = new PNG({ width, height: contentHeight });
  const contentPixels = pixelmatch(originalContent.data, appContent.data, diffContent.data, width, contentHeight, {
    threshold: 0.12,
  });
  await fs.writeFile(path.join(verifyRoot, `diff/${name}-content.png`), PNG.sync.write(diffContent));
  console.log(`Saved: ${path.join(verifyRoot, `original/${name}.png`)}`);
  console.log(`Saved: ${path.join(verifyRoot, `navereat/${name}.png`)}`);
  console.log(`Saved: ${path.join(verifyRoot, `diff/${name}.png`)}`);
  console.log(`${name} full diff: ${((pixels / (width * height)) * 100).toFixed(2)}%`);
  console.log(`${name} content diff (top ${contentHeightCss}px): ${((contentPixels / (width * contentHeight)) * 100).toFixed(2)}%`);
}

async function writeElementPairDiff(
  name: string,
  originalPage: import('playwright-core').Page,
  appPage: import('playwright-core').Page,
  selector: string,
): Promise<void> {
  const originalPng = PNG.sync.read(await originalPage.locator(selector).first().screenshot());
  const appPng = PNG.sync.read(await appPage.locator(selector).first().screenshot());
  await fs.writeFile(path.join(verifyRoot, `original/${name}.png`), PNG.sync.write(originalPng));
  await fs.writeFile(path.join(verifyRoot, `navereat/${name}.png`), PNG.sync.write(appPng));
  const width = Math.min(originalPng.width, appPng.width);
  const height = Math.min(originalPng.height, appPng.height);
  const originalCrop = cropPng(originalPng, width, height);
  const appCrop = cropPng(appPng, width, height);
  const diff = new PNG({ width, height });
  const pixels = pixelmatch(originalCrop.data, appCrop.data, diff.data, width, height, { threshold: 0.12 });
  await fs.writeFile(path.join(verifyRoot, `diff/${name}.png`), PNG.sync.write(diff));
  console.log(`Saved: ${path.join(verifyRoot, `original/${name}.png`)}`);
  console.log(`Saved: ${path.join(verifyRoot, `navereat/${name}.png`)}`);
  console.log(`Saved: ${path.join(verifyRoot, `diff/${name}.png`)}`);
  console.log(`${name} element diff: ${((pixels / (width * height)) * 100).toFixed(2)}%`);
}

async function main(): Promise<void> {
  if (!existsSync(path.join(originalDir, 'index.html'))) {
    throw new Error(
      `Original frontend not found at ${originalDir}. Set ORIGINAL_DIR to a read-only copy outside this repo.`,
    );
  }
  mkdirSync(path.join(verifyRoot, 'original'), { recursive: true });
  mkdirSync(path.join(verifyRoot, 'navereat'), { recursive: true });
  mkdirSync(path.join(verifyRoot, 'diff'), { recursive: true });

  console.log(`Original frontend: ${originalDir}`);
  const originalServer = await startOriginalServer();
  const previewServer = await preview({
    root: appRoot,
    logLevel: 'error',
    preview: { host: '127.0.0.1', port: appPort, strictPort: true },
  });

  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: scale,
    isMobile: true,
    hasTouch: true,
    locale: 'en-IN',
    serviceWorkers: 'block',
  });

  await context.addInitScript(() => {
    try {
      localStorage.setItem('nearbite_token', 'demo-token');
      localStorage.setItem('token', 'demo-token');
      localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Sagnik', phone: '+91 98765 43210', email: 'demo@navereat.app' }));
      const demoCartImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23F3DDBF'/%3E%3Ccircle cx='40' cy='40' r='22' fill='%23E9546B'/%3E%3C/svg%3E";
      localStorage.setItem(
        'nearbite_cart',
        JSON.stringify({
          'Hyderabadi Chicken Biryani': {
            quantity: 2,
            price: 249,
            originalPrice: 311,
            resId: 2,
            resName: 'Biryani Bhavan',
            restaurantName: 'Biryani Bhavan',
            menuItem: 'bb1',
            image: demoCartImage,
          },
          Raita: {
            quantity: 1,
            price: 39,
            resId: 2,
            resName: 'Biryani Bhavan',
            restaurantName: 'Biryani Bhavan',
            menuItem: 'bb7',
            image: demoCartImage,
          },
        }),
      );
      localStorage.setItem(
        'nearbite_address',
        JSON.stringify({ tag: 'Home', house: 'Demo Street', area: 'Demo City…', city: 'Demo City…' }),
      );
      localStorage.setItem('eatswada_theme', 'light');
      localStorage.setItem('eatswada_header_theme', 'raspberry');
      localStorage.setItem('eatswada_new_user_location_prompt_shown', '1');
      localStorage.setItem('eatswada_new_user_location_prompt_shown:current', '1');
      sessionStorage.setItem('ew_gate_auto_shown', '1');
      sessionStorage.setItem('eg_screen_dismissed', '1');
      sessionStorage.setItem('eg_banner_closed', '1');
      sessionStorage.setItem('eatswada_location_prompt_dismissed', '1');
    } catch {
      /* about:blank has no storage */
    }
  });

  const original = await context.newPage();
  await original.route(originalApiRoute, mockApi);
  await original.goto(`http://127.0.0.1:${originalPort}/index.html`, { waitUntil: 'domcontentloaded' });
  await original.waitForSelector('#restaurant-list .u99-card-host', { timeout: 20000 });
  await original.evaluate(() => document.fonts.ready);
  await original.waitForTimeout(900);

  await original.evaluate(() => {
    document.querySelectorAll(
      '.ew-gate,.loc-sheet,.theme-intro,.ew-theme-intro,.new-user-location-prompt,.welcome-prompt,.ps-banner,#home-platform-banners,.eg-banner,.service-closed,.closed-overlay,.ew-pr,.ew-pr-scrim,.ew-pr-sheet,.ew-offer-popup',
    ).forEach((element) => element.remove());
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.paddingBottom = '0';

    const style = document.createElement('style');
    style.textContent = `
      #mind-section .cat-ring, #mind-section .cat-image-placeholder { border-radius:0 !important; background:transparent !important; box-shadow:none !important; }
      #mind-section .cat-ring img { object-fit:contain !important; border-radius:0 !important; transform:none !important; }
      #mind-section .cat-item.is-selected .cat-ring { border-radius:0 !important; background:transparent !important; box-shadow:none !important; }
    `;
    document.head.appendChild(style);

    const strip = document.querySelector('.ew-strip');
    if (strip) strip.textContent = 'Nearby restaurants · Demo City';
    const title = document.getElementById('restaurants-title');
    if (title) title.textContent = 'Restaurants near you';
    const placeholder = document.getElementById('search-placeholder');
    if (placeholder) placeholder.innerHTML = 'Search <span class="search-dish" style="animation:none">"Chowmein"</span>';
    const locName = document.getElementById('loc-name');
    if (locName) locName.textContent = 'Home';
    const locSub = document.getElementById('loc-sub');
    if (locSub) locSub.textContent = 'Demo Street, Demo City…';
    if (!document.querySelector('.profile-initial')) {
      const profile = document.querySelector('.btn-profile');
      if (profile) profile.innerHTML = '<span class="profile-initial">S</span>';
    }
  });
  await original.screenshot({ path: path.join(verifyRoot, 'original/home.png') });

  const app = await context.newPage();
  await app.goto(`http://127.0.0.1:${appPort}/#/`, { waitUntil: 'networkidle' });
  await app.waitForSelector('#restaurant-list .u99-card-host', { timeout: 20000 });
  await app.evaluate(() => document.fonts.ready);
  await app.waitForTimeout(900);
  const order = await app.$$eval('#restaurant-list .u99-name-text', (nodes) => nodes.slice(0, 8).map((node) => node.textContent?.trim()));
  console.log(`App restaurant order: ${order.join(' | ')}`);
  const boxes = async (page: typeof app) =>
    page.evaluate(() => {
      const selectors = ['.banner-title', '.cat-name', '.filter-pill', '.u99-restaurant-name', '.u99-meta', '.loc-sub', '#restaurants-title'];
      return selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return `${selector}:missing`;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return `${selector}:${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)},${Math.round(rect.height)}:${style.fontFamily}:${style.fontSize}:${style.fontWeight}`;
      });
    });
  console.log('Original boxes:', (await boxes(original)).join(' | '));
  console.log('App boxes:', (await boxes(app)).join(' | '));
  await app.screenshot({ path: path.join(verifyRoot, 'navereat/home.png') });

  await original.click('#filter-sheet-btn');
  await original.waitForSelector('#filter-sheet.open', { timeout: 5000 });
  await app.locator('.filter-pill-sheet').click();
  await app.waitForSelector('.filter-sheet.open', { timeout: 5000 });
  await original.waitForTimeout(550);
  await app.waitForTimeout(550);
  await writePairDiff('home-filter', original, app, 844);
  await original.click('#filter-sheet .sheet-done');
  await app.locator('.filter-sheet .sheet-done').click();
  await original.waitForTimeout(300);
  await app.waitForTimeout(300);

  const dismissOverlays = async (page: import('playwright-core').Page) => {
    await page.evaluate(() => {
      document.querySelector('#ct-location-modal')?.remove();
      try {
        (window as unknown as { EWOffers?: { close?: () => void } }).EWOffers?.close?.();
      } catch {
        /* offer popup is optional */
      }
      document.querySelector('.ew-offer')?.remove();
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    });
  };

  const originalCart = await context.newPage();
  await originalCart.route(originalApiRoute, mockApi);
  await originalCart.goto(`http://127.0.0.1:${originalPort}/cart.html`, { waitUntil: 'domcontentloaded' });
  await originalCart.waitForSelector('#coupon-card', { timeout: 20000 });
  await dismissOverlays(originalCart);
  await originalCart.waitForTimeout(700);

  const appCart = await context.newPage();
  await appCart.goto(`http://127.0.0.1:${appPort}/#/cart?offers=none&unavailable=1`, { waitUntil: 'networkidle' });
  await appCart.waitForSelector('#coupon-card', { timeout: 20000 });
  await appCart.waitForTimeout(500);
  await writePairDiff('cart-page', originalCart, appCart, 844);

  await originalCart.click('#coupon-card');
  await originalCart.waitForSelector('#ct-coupon-sheet.is-open', { timeout: 5000 });
  const appCouponEmpty = await context.newPage();
  await appCouponEmpty.goto(`http://127.0.0.1:${appPort}/#/cart?coupons=empty&offers=none`, { waitUntil: 'networkidle' });
  await appCouponEmpty.waitForSelector('#coupon-card', { timeout: 20000 });
  await appCouponEmpty.click('#coupon-card');
  await appCouponEmpty.waitForSelector('#ct-coupon-sheet.is-open', { timeout: 5000 });
  await originalCart.waitForTimeout(550);
  await appCouponEmpty.waitForTimeout(550);
  await writePairDiff('cart-coupon-empty', originalCart, appCouponEmpty, 844);
  await appCouponEmpty.close();

  await appCart.click('#coupon-card');
  await appCart.waitForSelector('#ct-coupon-sheet.is-open', { timeout: 5000 });
  await appCart.waitForTimeout(550);
  await writePairDiff('cart-coupon-list', originalCart, appCart, 844);
  await originalCart.locator('#ct-coupon-sheet .ct-cook-x').click();
  await appCart.locator('#ct-coupon-sheet .ct-cook-x').click();
  await originalCart.waitForTimeout(350);
  await appCart.waitForTimeout(350);

  await originalCart.getByText('Cooking requests', { exact: true }).first().click();
  await appCart.getByText('Cooking requests', { exact: true }).first().click();
  await originalCart.waitForSelector('#ct-note-sheet.is-open', { timeout: 5000 });
  await appCart.waitForSelector('#ct-note-sheet.is-open', { timeout: 5000 });
  await originalCart.waitForTimeout(550);
  await appCart.waitForTimeout(550);
  await writePairDiff('cart-cooking', originalCart, appCart, 844);
  await originalCart.locator('#ct-note-sheet .ct-cook-x').click();
  await appCart.locator('#ct-note-sheet .ct-cook-x').click();
  await originalCart.waitForTimeout(350);
  await appCart.waitForTimeout(350);

  await originalCart.evaluate(() => {
    (window as unknown as { openSheet?: (id: string) => void }).openSheet?.('ct-tip-sheet');
  });
  await originalCart.waitForSelector('#ct-tip-sheet.is-open', { timeout: 5000 });
  await appCart.click('#ct-view-bill');
  await appCart.waitForSelector('.ct-sheet-root.is-open', { timeout: 5000 });
  await appCart.getByRole('button', { name: 'Other' }).click();
  await appCart.waitForSelector('#ct-tip-sheet.is-open', { timeout: 5000 });
  await originalCart.waitForTimeout(550);
  await appCart.waitForTimeout(550);
  await writePairDiff('cart-tip', originalCart, appCart, 844);
  for (const page of [originalCart, appCart]) {
    await page.evaluate(() => {
      document.querySelector('#ct-tip-sheet')?.remove();
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    });
  }
  await originalCart.waitForTimeout(350);
  await appCart.waitForTimeout(350);
  const scrollCart = async (page: import('playwright-core').Page, target: string, offset: number) => {
    await page.evaluate(
      ({ target, offset }) => {
        const element = document.querySelector(target);
        if (!element) return;
        const scroller = document.querySelector('.cart-page');
        const scrollable = scroller instanceof HTMLElement && scroller.scrollHeight > scroller.clientHeight + 4;
        const current = scrollable ? (scroller as HTMLElement).scrollTop : window.scrollY;
        const next = Math.max(0, current + element.getBoundingClientRect().top - 160 + offset);
        if (scrollable) (scroller as HTMLElement).scrollTop = next;
        else window.scrollTo(0, next);
      },
      { target, offset },
    );
  };
  await scrollCart(originalCart, '#ct-meal', -90);
  await scrollCart(appCart, '#ct-meal', -90);
  await originalCart.waitForTimeout(350);
  await appCart.waitForTimeout(350);
  await writePairDiff('cart-middle', originalCart, appCart, 844);

  await originalCart.evaluate(() => {
    const scroller = document.querySelector('.cart-page');
    if (scroller instanceof HTMLElement) scroller.scrollTop = scroller.scrollHeight;
    else window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await appCart.evaluate(() => {
    const scroller = document.querySelector('.cart-page');
    if (scroller instanceof HTMLElement) scroller.scrollTop = scroller.scrollHeight;
    else window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await originalCart.waitForTimeout(350);
  await appCart.waitForTimeout(350);
  await writePairDiff('cart-bottom', originalCart, appCart, 844);

  await originalCart.evaluate(() => {
    const scroller = document.querySelector('.cart-page');
    if (scroller instanceof HTMLElement) scroller.scrollTop = 0;
    else window.scrollTo(0, 0);
  });
  await appCart.evaluate(() => {
    const scroller = document.querySelector('.cart-page');
    if (scroller instanceof HTMLElement) scroller.scrollTop = 0;
    else window.scrollTo(0, 0);
  });
  await originalCart.waitForTimeout(300);
  await appCart.waitForTimeout(300);
  await originalCart.locator('[data-name="Raita"] .ct-step-down').click();
  await appCart.locator('[data-name="Raita"] .ct-step-down').click();
  await originalCart.waitForTimeout(450);
  await appCart.waitForTimeout(450);
  await writePairDiff('cart-item-removed', originalCart, appCart, 844);

  await originalCart.close();
  await appCart.close();

  const emptyContext = await browser.newContext({
    viewport,
    deviceScaleFactor: scale,
    isMobile: true,
    hasTouch: true,
    locale: 'en-IN',
    serviceWorkers: 'block',
  });
  await emptyContext.addInitScript(() => {
    try {
      localStorage.setItem('nearbite_token', 'demo-token');
      localStorage.setItem('token', 'demo-token');
      localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Sagnik', phone: '+91 98765 43210' }));
      localStorage.setItem('nearbite_address', JSON.stringify({ tag: 'Home', house: 'Demo Street', area: 'Demo City…', city: 'Demo City…' }));
      localStorage.setItem('eatswada_theme', 'light');
      localStorage.setItem('eatswada_header_theme', 'raspberry');
      localStorage.setItem('eatswada_new_user_location_prompt_shown', '1');
      localStorage.setItem('eatswada_new_user_location_prompt_shown:current', '1');
      sessionStorage.setItem('ew_gate_auto_shown', '1');
      sessionStorage.setItem('eg_screen_dismissed', '1');
      sessionStorage.setItem('eg_banner_closed', '1');
      sessionStorage.setItem('eatswada_location_prompt_dismissed', '1');
    } catch {
      /* about:blank has no storage */
    }
  });
  const originalEmpty = await emptyContext.newPage();
  await originalEmpty.route(originalApiRoute, mockApi);
  await originalEmpty.goto(`http://127.0.0.1:${originalPort}/cart.html`, { waitUntil: 'domcontentloaded' });
  await originalEmpty.waitForSelector('.ct-empty', { timeout: 20000 });
  await originalEmpty.evaluate(() => {
    document.getElementById('ct-location-modal')?.setAttribute('hidden', '');
    document.body.classList.remove('ct-location-modal-open');
  });
  await originalEmpty.evaluate(() => document.fonts.ready);
  await originalEmpty.waitForTimeout(700);
  const appEmpty = await emptyContext.newPage();
  await appEmpty.goto(`http://127.0.0.1:${appPort}/#/cart?offers=none`, { waitUntil: 'networkidle' });
  await appEmpty.waitForSelector('.ct-empty', { timeout: 20000 });
  await appEmpty.evaluate(() => document.fonts.ready);
  await appEmpty.waitForTimeout(500);
  await writePairDiff('cart-empty', originalEmpty, appEmpty, 844);
  await originalEmpty.close();
  await appEmpty.close();
  await emptyContext.close();

  const originalOffer = await context.newPage();
  await originalOffer.goto(`http://127.0.0.1:${originalPort}/offer-popup-preview.html`, { waitUntil: 'domcontentloaded' });
  await originalOffer.click('#d-delivery');
  await originalOffer.waitForSelector('.ew-offer.is-open', { timeout: 5000 });
  const appOffer = await context.newPage();
  await appOffer.goto(`http://127.0.0.1:${appPort}/#/cart?offers=single`, { waitUntil: 'networkidle' });
  await appOffer.waitForSelector('.ew-offer.is-open', { timeout: 7000 });
  await originalOffer.waitForTimeout(500);
  await appOffer.waitForTimeout(500);
  await writePairDiff('cart-offer-popup', originalOffer, appOffer, 844);
  await originalOffer.close();
  await appOffer.close();

  const originalProcessing = await context.newPage();
  await originalProcessing.route(originalApiRoute, mockApi);
  await originalProcessing.goto(`http://127.0.0.1:${originalPort}/cart.html`, { waitUntil: 'domcontentloaded' });
  await originalProcessing.waitForSelector('#coupon-card', { timeout: 20000 });
  await dismissOverlays(originalProcessing);
  await originalProcessing.addScriptTag({ path: path.join(originalDir, 'js/order-success-sheet.js') });
  await originalProcessing.evaluate(() => {
    (window as unknown as { EWOrderSuccess?: { processing?: (options?: object) => void } }).EWOrderSuccess?.processing?.({
      title: 'Processing',
      message: 'Placing your order',
    });
  });
  await originalProcessing.waitForSelector('.ew-os.is-open', { timeout: 5000 });
  await originalProcessing.waitForTimeout(600);

  const appProcessing = await context.newPage();
  await appProcessing.goto(`http://127.0.0.1:${appPort}/#/cart?offers=none&hold=1`, { waitUntil: 'networkidle' });
  await appProcessing.waitForSelector('#coupon-card', { timeout: 20000 });
  await appProcessing.getByRole('button', { name: 'Proceed to Pay' }).click();
  await appProcessing.waitForSelector('#btn-checkout', { timeout: 5000 });
  await appProcessing.click('#btn-checkout');
  await appProcessing.waitForSelector('.ew-os.is-open', { timeout: 5000 });
  await appProcessing.waitForTimeout(100);
  await writePairDiff('cart-processing', originalProcessing, appProcessing, 844);
  await originalProcessing.close();

  const originalPlaced = await context.newPage();
  await originalPlaced.route(originalApiRoute, mockApi);
  await originalPlaced.goto(`http://127.0.0.1:${originalPort}/cart.html`, { waitUntil: 'domcontentloaded' });
  await originalPlaced.waitForSelector('#coupon-card', { timeout: 20000 });
  await dismissOverlays(originalPlaced);
  await originalPlaced.addScriptTag({ path: path.join(originalDir, 'js/order-success-sheet.js') });
  await originalPlaced.evaluate(() => {
    (window as unknown as { EWOrderSuccess?: { show?: (options?: object) => void } }).EWOrderSuccess?.show?.({
      autoMs: 0,
    });
  });
  await originalPlaced.waitForSelector('.ew-os.is-open', { timeout: 5000 });
  await originalPlaced.waitForTimeout(1000);

  await appProcessing.waitForTimeout(2350);
  await appProcessing.waitForSelector('.ew-os--done.is-open', { timeout: 5000 });
  await writePairDiff('cart-order-placed', originalPlaced, appProcessing, 844);
  await originalPlaced.close();
  await appProcessing.close();

  await original.click('#wc-close-btn');
  await app.click('#wc-close-btn');
  await original.waitForTimeout(200);
  await app.waitForSelector('#wc-clear-actions', { state: 'visible', timeout: 5000 });
  await app.waitForTimeout(200);
  await writePairDiff('home-clear', original, app);

  const originalPng = PNG.sync.read(await fs.readFile(path.join(verifyRoot, 'original/home.png')));
  const appPng = PNG.sync.read(await fs.readFile(path.join(verifyRoot, 'navereat/home.png')));

  const width = Math.min(originalPng.width, appPng.width);
  const height = Math.min(originalPng.height, appPng.height);
  const a = cropPng(originalPng, width, height);
  const b = cropPng(appPng, width, height);
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.12 });
  await fs.writeFile(path.join(verifyRoot, 'diff/home.png'), PNG.sync.write(diff));

  const contentHeight = Math.round(760 * scale);
  const aContent = cropPng(originalPng, width, contentHeight);
  const bContent = cropPng(appPng, width, contentHeight);
  const diffContent = new PNG({ width, height: contentHeight });
  const contentPixels = pixelmatch(aContent.data, bContent.data, diffContent.data, width, contentHeight, {
    threshold: 0.12,
  });
  await fs.writeFile(path.join(verifyRoot, 'diff/home-content.png'), PNG.sync.write(diffContent));

  console.log(`Saved: ${path.join(verifyRoot, 'original/home.png')}`);
  console.log(`Saved: ${path.join(verifyRoot, 'navereat/home.png')}`);
  console.log(`Saved: ${path.join(verifyRoot, 'diff/home.png')}`);
  console.log(`Full diff: ${((diffPixels / (width * height)) * 100).toFixed(2)}%`);
  console.log(`Content diff (top 760px): ${((contentPixels / (width * contentHeight)) * 100).toFixed(2)}%`);

  const originalRestaurant = await context.newPage();
  await originalRestaurant.route(originalApiRoute, mockApi);
  await originalRestaurant.goto(`http://127.0.0.1:${originalPort}/restaurant-shell.html?id=1`, {
    waitUntil: 'domcontentloaded',
  });
  await originalRestaurant.waitForSelector('#menu-container .menu-item', { timeout: 20000 });
  await originalRestaurant.evaluate(() => document.fonts.ready);
  await originalRestaurant.waitForTimeout(900);
  await originalRestaurant.evaluate(() => {
    document.querySelectorAll(
      '.ew-gate,.loc-sheet,.theme-intro,.ew-theme-intro,.new-user-location-prompt,.welcome-prompt,.ps-banner,.eg-banner,.service-closed,.closed-overlay,.ew-pr,.ew-pr-scrim,.ew-pr-sheet,.ew-offer-popup,.ew-free-delivery-toast,#ew-sticky-search',
    ).forEach((element) => element.remove());
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    window.scrollTo(0, 0);
  });
  await originalRestaurant.waitForTimeout(300);
  await originalRestaurant.evaluate(() => window.scrollTo(0, 0));
  await originalRestaurant.screenshot({ path: path.join(verifyRoot, 'original/restaurant.png') });

  const appRestaurant = await context.newPage();
  await appRestaurant.goto(`http://127.0.0.1:${appPort}/#/restaurant/1`, { waitUntil: 'networkidle' });
  await appRestaurant.waitForSelector('.rest-page .menu-item', { timeout: 20000 });
  await appRestaurant.evaluate(() => document.fonts.ready);
  await appRestaurant.waitForTimeout(600);
  await appRestaurant.screenshot({ path: path.join(verifyRoot, 'navereat/restaurant.png') });

  const originalRestPng = PNG.sync.read(await fs.readFile(path.join(verifyRoot, 'original/restaurant.png')));
  const appRestPng = PNG.sync.read(await fs.readFile(path.join(verifyRoot, 'navereat/restaurant.png')));
  const restWidth = Math.min(originalRestPng.width, appRestPng.width);
  const restHeight = Math.min(originalRestPng.height, appRestPng.height);
  const restA = cropPng(originalRestPng, restWidth, restHeight);
  const restB = cropPng(appRestPng, restWidth, restHeight);
  const restDiff = new PNG({ width: restWidth, height: restHeight });
  const restPixels = pixelmatch(restA.data, restB.data, restDiff.data, restWidth, restHeight, { threshold: 0.12 });
  await fs.writeFile(path.join(verifyRoot, 'diff/restaurant.png'), PNG.sync.write(restDiff));

  const restContentHeight = Math.round(760 * scale);
  const restAContent = cropPng(originalRestPng, restWidth, restContentHeight);
  const restBContent = cropPng(appRestPng, restWidth, restContentHeight);
  const restDiffContent = new PNG({ width: restWidth, height: restContentHeight });
  const restContentPixels = pixelmatch(restAContent.data, restBContent.data, restDiffContent.data, restWidth, restContentHeight, {
    threshold: 0.12,
  });
  await fs.writeFile(path.join(verifyRoot, 'diff/restaurant-content.png'), PNG.sync.write(restDiffContent));

  console.log(`Saved: ${path.join(verifyRoot, 'original/restaurant.png')}`);
  console.log(`Saved: ${path.join(verifyRoot, 'navereat/restaurant.png')}`);
  console.log(`Saved: ${path.join(verifyRoot, 'diff/restaurant.png')}`);
  console.log(`Restaurant full diff: ${((restPixels / (restWidth * restHeight)) * 100).toFixed(2)}%`);
  console.log(
    `Restaurant content diff (top 760px): ${((restContentPixels / (restWidth * restContentHeight)) * 100).toFixed(2)}%`,
  );



  const originalPizza = await context.newPage();
  await originalPizza.route(originalApiRoute, mockApi);
  await originalPizza.goto(`http://127.0.0.1:${originalPort}/restaurant-shell.html?id=3`, {
    waitUntil: 'domcontentloaded',
  });
  await originalPizza.waitForFunction(() => document.querySelector('#res-name')?.textContent?.includes('Pizza Palace'), {
    timeout: 20000,
  });
  await originalPizza.evaluate(() => document.fonts.ready);
  await originalPizza.waitForTimeout(700);
  await originalPizza.evaluate(() => {
    document.querySelectorAll(
      '.ew-gate,.loc-sheet,.theme-intro,.ew-theme-intro,.new-user-location-prompt,.welcome-prompt,.ps-banner,.eg-banner,.service-closed,.closed-overlay,.ew-pr,.ew-pr-scrim,.ew-pr-sheet,.ew-offer-popup,.ew-free-delivery-toast,#ew-sticky-search',
    ).forEach((element) => element.remove());
  });

  const appPizza = await context.newPage();
  await appPizza.goto(`http://127.0.0.1:${appPort}/#/restaurant/3`, { waitUntil: 'networkidle' });
  await appPizza.waitForFunction(() => document.querySelector('#res-name')?.textContent?.includes('Pizza Palace'), {
    timeout: 20000,
  });
  await appPizza.waitForTimeout(600);

  await originalRestaurant.locator('.nb-add-btn--cust').first().scrollIntoViewIfNeeded();
  await appRestaurant.locator('.nb-add-btn--cust').first().scrollIntoViewIfNeeded();
  await originalRestaurant.waitForTimeout(300);
  await appRestaurant.waitForTimeout(300);
  await writePairDiff('restaurant-custom-menu', originalRestaurant, appRestaurant, 844);

  await originalRestaurant.locator('.nb-add-btn--cust').first().click();
  await appRestaurant.locator('.nb-add-btn--cust').first().click();
  await originalRestaurant.waitForSelector('#ewcs-sheet.show', { timeout: 5000 });
  await appRestaurant.waitForSelector('#ewcs-sheet.show', { timeout: 5000 });
  await originalRestaurant.waitForTimeout(500);
  await appRestaurant.waitForTimeout(500);
  await writePairDiff('restaurant-custom-sheet', originalRestaurant, appRestaurant, 844);

  await originalRestaurant.locator('.ewcs-opt', { hasText: 'Extra chutney' }).click();
  await appRestaurant.locator('.ewcs-opt', { hasText: 'Extra chutney' }).click();
  await originalRestaurant.waitForTimeout(300);
  await appRestaurant.waitForTimeout(300);
  await writePairDiff('restaurant-custom-selected', originalRestaurant, appRestaurant, 844);

  await originalRestaurant.locator('.ewcs-close').click();
  await appRestaurant.locator('.ewcs-close').click();
  await originalRestaurant.waitForTimeout(400);
  await appRestaurant.waitForTimeout(400);

  await originalRestaurant.locator('.nb-add-btn--cust').first().click();
  await appRestaurant.locator('.nb-add-btn--cust').first().click();
  await originalRestaurant.waitForSelector('#ewcs-sheet.show', { timeout: 5000 });
  await appRestaurant.waitForSelector('#ewcs-sheet.show', { timeout: 5000 });
  await originalRestaurant.locator('.ewcs-add').click();
  await appRestaurant.locator('.ewcs-add').click();
  await originalRestaurant.waitForTimeout(700);
  await appRestaurant.waitForTimeout(700);
  await originalRestaurant.locator('.nb-add-btn--cust').first().scrollIntoViewIfNeeded();
  await appRestaurant.locator('.nb-add-btn--cust').first().scrollIntoViewIfNeeded();
  await originalRestaurant.waitForTimeout(300);
  await appRestaurant.waitForTimeout(300);
  await writePairDiff('restaurant-custom-quantity', originalRestaurant, appRestaurant, 844);

  await originalPizza.locator('.nb-add-btn--cust').first().scrollIntoViewIfNeeded();
  await appPizza.locator('.nb-add-btn--cust').first().scrollIntoViewIfNeeded();
  await originalPizza.waitForTimeout(300);
  await appPizza.waitForTimeout(300);
  await originalPizza.locator('.nb-add-btn--cust').first().click();
  await appPizza.locator('.nb-add-btn--cust').first().click();
  await originalPizza.waitForSelector('#ewcs-sheet.show', { timeout: 5000 });
  await appPizza.waitForSelector('#ewcs-sheet.show', { timeout: 5000 });
  await originalPizza.waitForTimeout(500);
  await appPizza.waitForTimeout(500);
  await writePairDiff('restaurant-custom-error', originalPizza, appPizza, 844);
  await originalPizza.close();
  await appPizza.close();

  await original.evaluate(() => localStorage.removeItem('nearbite_cart'));
  await app.evaluate(() => localStorage.removeItem('nearbite_cart'));
  await original.reload({ waitUntil: 'domcontentloaded' });
  await app.reload({ waitUntil: 'networkidle' });
  await original.waitForSelector('.u99-add-cust', { timeout: 20000 });
  await app.waitForSelector('.u99-add-cust', { timeout: 20000 });
  await original.waitForTimeout(800);
  await app.waitForTimeout(800);
  const alignFirstCard = async (page: import('playwright-core').Page, isApp: boolean) => {
    await page.evaluate((native) => {
      const card = document.querySelector('.u99-card-host');
      if (!card) return;
      const scroller = native ? document.querySelector<HTMLElement>('.home-scroll') : null;
      const delta = card.getBoundingClientRect().top - 80;
      if (scroller) scroller.scrollTop += delta;
      else window.scrollBy(0, delta);
    }, isApp);
  };
  await alignFirstCard(original, false);
  await alignFirstCard(app, true);
  await original.waitForTimeout(300);
  await app.waitForTimeout(300);
  await writeElementPairDiff('home-custom-rail', original, app, '.u99-card-host');
  await writeElementPairDiff('home-custom-add', original, app, '.u99-add-cust');

  const originalSearch = await context.newPage();
  await originalSearch.route(originalApiRoute, mockApi);
  await originalSearch.goto(`http://127.0.0.1:${originalPort}/index.html`, { waitUntil: 'domcontentloaded' });
  await originalSearch.waitForSelector('#restaurant-list .u99-card-host', { timeout: 20000 });
  await originalSearch.evaluate(() => {
    document.querySelectorAll('.ew-pr,.ew-pr-scrim,.ew-pr-sheet,.ew-offer-popup').forEach((element) => element.remove());
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.querySelector<HTMLElement>('.search-box')?.click();
  });
  await originalSearch.waitForSelector('#ew-search-root.is-open', { timeout: 5000 });
  await originalSearch.waitForTimeout(450);

  const appSearch = await context.newPage();
  await appSearch.goto(`http://127.0.0.1:${appPort}/#/`, { waitUntil: 'networkidle' });
  await appSearch.waitForSelector('#restaurant-list .u99-card-host', { timeout: 20000 });
  await appSearch.evaluate(() => document.querySelector<HTMLElement>('.search-box')?.click());
  await appSearch.waitForSelector('#ew-search-root.is-open', { timeout: 5000 });
  await appSearch.waitForTimeout(450);
  await writeElementPairDiff('search-overlay-idle', originalSearch, appSearch, '.ew-search-sheet');

  await browser.close();
  await new Promise<void>((resolve) => originalServer.close(() => resolve()));
  previewServer.httpServer.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
