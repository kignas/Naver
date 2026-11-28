/**
 * Pixel-parity report for the screens this task names.
 *
 * Serves the reference frontend (`kignas/Nearbite`, cloned read-only outside
 * this repo) statically and the built app with `vite preview`, answers every
 * `/api` call from Playwright route interception with the demoApi fixtures, and
 * screenshots identical journeys on both sides at 360, 393 and 412 CSS px.
 *
 *   ORIGINAL_DIR=../Nearbite npm run parity
 *   PARITY_WIDTH=393 ORIGINAL_DIR=../Nearbite npm run parity     # one width
 *
 * Writes parity-report/<width>/{old,new,diff}/<screen>.png, an index.html that
 * shows all three side by side, and index.json with the totals. The Nearbite
 * commit the reference was served from is pinned in both indexes.
 */
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { chromium, type Browser, type BrowserContext, type Page, type Route } from 'playwright-core';
import { preview } from 'vite';
import { categories, demoOrders, demoUser, restaurants } from '../src/data/demo';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const originalDir = process.env.ORIGINAL_DIR
  ? path.resolve(appRoot, process.env.ORIGINAL_DIR)
  : path.resolve(appRoot, '../../Nearbite');
const outRoot = path.join(appRoot, 'parity-report');
const originalPort = 4185;
const appPort = 4186;
const THRESHOLD = Number(process.env.PARITY_THRESHOLD ?? 0.5);
const widths = process.env.PARITY_WIDTH
  ? [Number(process.env.PARITY_WIDTH)]
  : [360, 393, 412];
const height = 844;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
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

const serveFile = (res: http.ServerResponse, file: string): void => {
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(file).pipe(res);
};

const startOriginalServer = (): Promise<http.Server> =>
  new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${originalPort}`);
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === '/') pathname = '/index.html';
      const file = path.join(originalDir, pathname);
      if (!file.startsWith(originalDir)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      if (!existsSync(file) || !statSync(file).isFile()) {
        if (!path.extname(pathname) && existsSync(`${file}.html`)) {
          serveFile(res, `${file}.html`);
          return;
        }
        res.writeHead(404).end('Not found');
        return;
      }
      serveFile(res, file);
    });
    server.once('error', reject);
    server.listen(originalPort, '127.0.0.1', () => resolve(server));
  });

/* ---- The same fixtures demoApi serves, in the shape the reference reads. --- */
// The reference only accepts absolute URLs, protocol-relative URLs, base64
// data URIs and relative paths (`resolveMenuImage`). The demo art is inline SVG,
// so it is sent base64: otherwise the reference drops it and draws the
// placeholder while the app draws the image, and every media box differs.
const toDataUri = (raw: string): string => {
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(raw)) return raw;
  const match = raw.match(/^data:image\/[a-z0-9.+-]+(;charset=[^;,]+)?,(.*)$/i);
  if (!match) return raw;
  const [, charset, payload] = match;
  const decoded = payload.includes('%') ? decodeURIComponent(payload) : Buffer.from(payload, 'base64').toString('utf8');
  return `data:image/svg+xml${charset ?? ''};base64,${Buffer.from(decoded).toString('base64')}`;
};

const dataUri = (value: string): string => {
  const raw = String(value);
  if (raw.startsWith('data:')) return toDataUri(raw);
  if (raw.startsWith('http')) return raw;
  return `/__img/${path.basename(raw)}`;
};

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
  image: dataUri(restaurant.image),
  images: [dataUri(restaurant.image)],
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
    image: dataUri(item.image),
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

const apiCategories = categories.map((category, index) => ({
  _id: category.id,
  name: category.name,
  type: category.name,
  image: dataUri(category.image),
  isActive: true,
  order: index,
}));

const apiOrders = demoOrders.map((order) => ({
  _id: order.id,
  restaurantId: order.restaurantId,
  restaurantName: order.restaurantName,
  status: order.status === 'on_the_way' ? 'out_for_delivery' : order.status,
  total: order.total,
  createdAt: order.placedAt,
  items: order.lines.map((line, index) => ({
    name: line.name,
    quantity: line.qty,
    price: line.price,
    menuItem: `${order.restaurantId}-${index + 1}`,
  })),
  deliveryAddress: order.address,
  paymentMethod: order.paymentMethod,
  estimatedDelivery: order.eta,
  rider: { name: 'Rahul Das', phone: '+91 90000 12345', rating: 4.8, vehicle: 'WB 64 AB 1234' },
}));

const json = (route: Route, data: unknown): Promise<void> =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

async function mockApi(route: Route): Promise<void> {
  const pathname = new URL(route.request().url()).pathname.replace(/^\/api/, '');
  if (pathname === '/platform/public-status') {
    return json(route, { canOrder: true, state: 'open', orderingOpen: true, nextOpenAt: null });
  }
  if (pathname === '/categories') return json(route, apiCategories);
  if (pathname === '/restaurants' || pathname === '/restaurants/under99') return json(route, apiRestaurants);
  if (pathname === '/restaurants/search') {
    const query = (new URL(route.request().url()).searchParams.get('q') ?? '').trim().toLowerCase();
    const menuItems = apiRestaurants.flatMap((restaurant) =>
      restaurant.menu
        .filter((item) => `${item.name} ${item.description ?? ''} ${item.category}`.toLowerCase().includes(query))
        .map((item) => ({
          _id: item._id,
          id: item.id,
          name: item.name,
          price: item.price,
          description: item.description,
          image: item.image,
          restaurantId: restaurant._id,
          restaurant: { _id: restaurant._id, name: restaurant.name, image: restaurant.image },
        })),
    );
    return json(route, { menuItems });
  }
  if (pathname === '/orders') return json(route, apiOrders);
  if (pathname === '/users/profile') return json(route, demoUser);
  if (pathname === '/users/addresses') {
    return json(route, [{ _id: 'demo-address', tag: 'Home', house: 'Demo Street', area: 'Demo City', city: 'Demo City', isDefault: true }]);
  }
  if (pathname === '/home-banners') return json(route, []);
  if (pathname === '/pricing/restaurant-cards') return json(route, { cards: [] });
  if (/^\/restaurants\/[^/]+\/reviews$/.test(pathname)) return json(route, { items: [], total: 0, page: 1, pages: 0, summary: null });
  const menuMatch = pathname.match(/^\/restaurants\/([^/]+)\/menu$/);
  if (menuMatch) {
    const restaurant = apiRestaurants.find((entry) => entry._id === menuMatch[1]);
    return json(route, restaurant?.menu ?? []);
  }
  const restaurantMatch = pathname.match(/^\/restaurants\/([^/]+)$/);
  if (restaurantMatch) {
    const restaurant = apiRestaurants.find((entry) => entry._id === restaurantMatch[1]);
    return json(route, restaurant ?? null);
  }
  return json(route, []);
}

const seedStorage = (): void => {
  const image =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23F3DDBF'/%3E%3Ccircle cx='40' cy='40' r='22' fill='%23E9546B'/%3E%3C/svg%3E";
  localStorage.setItem('nearbite_token', 'demo-token');
  localStorage.setItem('token', 'demo-token');
  localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Sagnik', phone: '+91 98765 43210', email: 'demo@navereat.app' }));
  localStorage.setItem('nearbite_address', JSON.stringify({ tag: 'Home', house: 'Demo Street', area: 'Demo City', city: 'Demo City' }));
  localStorage.setItem(
    'nearbite_cart',
    JSON.stringify({
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
        image,
      },
    }),
  );
  localStorage.setItem('eatswada_theme', 'light');
  localStorage.setItem('eatswada_header_theme', 'raspberry');
  localStorage.setItem('eatswada_new_user_location_prompt_shown', '1');
  localStorage.setItem('eatswada_new_user_location_prompt_shown:current', '1');
  sessionStorage.setItem('ew_gate_auto_shown', '1');
  sessionStorage.setItem('eg_screen_dismissed', '1');
  sessionStorage.setItem('eg_banner_closed', '1');
  sessionStorage.setItem('eatswada_location_prompt_dismissed', '1');
};

const stripChrome = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    document
      .querySelectorAll(
        '.ew-gate,.loc-sheet,.theme-intro,.ew-theme-intro,.new-user-location-prompt,.welcome-prompt,.ps-banner,.eg-banner,.service-closed,.closed-overlay,.ew-pr,.ew-pr-scrim,.ew-pr-sheet,.ew-offer-popup,.ew-free-delivery-toast,#ct-location-modal',
      )
      .forEach((element) => element.remove());
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.classList.remove('ct-location-modal-open');
  });
};

const freeze = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    document.getAnimations().forEach((animation) => {
      try {
        animation.finish();
      } catch {
        animation.pause();
        animation.currentTime = 0;
      }
    });
  });
};

interface Result {
  width: number;
  name: string;
  diffPct: number | null;
  error?: string;
  note?: string;
}

const results: Result[] = [];

const dirs = ['old', 'new', 'diff'];
const reportRootFor = (width: number): string => path.join(outRoot, `w${width}`);

const capture = async (
  width: number,
  name: string,
  oldPage: Page,
  newPage: Page,
  note?: string,
): Promise<void> => {
  try {
    await freeze(oldPage);
    await freeze(newPage);
    const [oldBuffer, newBuffer] = await Promise.all([
      oldPage.screenshot({ animations: 'disabled' }),
      newPage.screenshot({ animations: 'disabled' }),
    ]);
    const oldPng = PNG.sync.read(oldBuffer);
    const newPng = PNG.sync.read(newBuffer);
    const w = Math.min(oldPng.width, newPng.width);
    const h = Math.min(oldPng.height, newPng.height);
    const diff = new PNG({ width: w, height: h });
    const mismatched = pixelmatch(oldPng.data, newPng.data, diff.data, w, h, { threshold: 0.1 });
    const diffPct = (mismatched / (w * h)) * 100;
    for (const dir of dirs) mkdirSync(path.join(reportRootFor(width), dir), { recursive: true });
    writeFileSync(path.join(reportRootFor(width), 'old', `${name}.png`), oldBuffer);
    writeFileSync(path.join(reportRootFor(width), 'new', `${name}.png`), newBuffer);
    writeFileSync(path.join(reportRootFor(width), 'diff', `${name}.png`), PNG.sync.write(diff));
    results.push({ width, name, diffPct, note });
    console.log(`[parity ${width}] ${name.padEnd(34)} ${diffPct.toFixed(2)}%${note ? `  ${note}` : ''}`);
  } catch (error) {
    results.push({ width, name, diffPct: null, error: String(error).slice(0, 200) });
    console.log(`[parity ${width}] ${name.padEnd(34)} ERROR ${String(error).slice(0, 120)}`);
  }
};

const openPair = async (context: BrowserContext, oldPath: string, appPath: string) => {
  const oldPage = await context.newPage();
  await oldPage.route(/https:\/\/api\.[^/]+\/.*/, mockApi);
  await oldPage.goto(`http://127.0.0.1:${originalPort}${oldPath}`, { waitUntil: 'domcontentloaded' });
  const newPage = await context.newPage();
  await newPage.goto(`http://127.0.0.1:${appPort}/#${appPath}`, { waitUntil: 'networkidle' });
  return { oldPage, newPage };
};

const settle = async (pages: Page[], ms = 700): Promise<void> => {
  for (const page of pages) {
    await page.evaluate(() => document.fonts.ready);
  }
  await pages[0].waitForTimeout(ms);
};

const scrollRestaurantTop = async (page: Page, isApp: boolean): Promise<void> => {
  await page.evaluate((app) => {
    const scroller = app ? document.querySelector<HTMLElement>('.rest-scroll') : null;
    if (scroller) scroller.scrollTop = 0;
    else window.scrollTo(0, 0);
  }, isApp);
};

const scrollTo = async (page: Page, isApp: boolean, selector: string, offset: number): Promise<void> => {
  await page.evaluate(
    ({ app, sel, off }) => {
      const target = document.querySelector(sel);
      if (!target) return;
      const scroller = app ? document.querySelector<HTMLElement>('.rest-scroll') : null;
      const scrollerTop = scroller ? scroller.getBoundingClientRect().top : 0;
      const delta = target.getBoundingClientRect().top - scrollerTop + (scroller ? scroller.scrollTop : window.scrollY) - off;
      if (scroller) scroller.scrollTo({ top: delta, behavior: 'instant' });
      else window.scrollTo(0, delta);
    },
    { app: isApp, sel: selector, off: offset },
  );
};

/** Dispatches the tap in-page: Playwright's click scrolls the element into
 * view first, which moves the header back onto the screen and changes state. */
const tap = (page: Page, selector: string, index = 0): Promise<void> =>
  page
    .evaluate(
      ({ sel, i }) => {
        const element = document.querySelectorAll<HTMLElement>(sel)[i];
        element?.click();
      },
      { sel: selector, i: index },
    )
    .then(
      () => undefined,
      () => undefined,
    );

const restaurantJourney = async (
  browser: Browser,
  width: number,
  restaurantQuery: string,
  appPath: string,
  id: string,
): Promise<void> => {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'en-IN',
    serviceWorkers: 'block',
  });
  await context.addInitScript(seedStorage);
  try {
    const { oldPage, newPage } = await openPair(
      context,
      `/restaurant-shell.html?id=${restaurantQuery}`,
      appPath,
    );
    await Promise.all([
      oldPage.waitForSelector('#menu-container .menu-item', { timeout: 25000 }),
      newPage.waitForSelector('.rest-page .menu-item', { timeout: 25000 }),
    ]);
    await Promise.all([stripChrome(oldPage), stripChrome(newPage)]);
    await settle([oldPage, newPage], 1200);
    await Promise.all([scrollRestaurantTop(oldPage, false), scrollRestaurantTop(newPage, true)]);
    await settle([oldPage, newPage], 300);
    await capture(width, `restaurant-${id}-top`, oldPage, newPage);

    await Promise.all([scrollTo(oldPage, false, '#restaurant-filter-bar', 70), scrollTo(newPage, true, '#restaurant-filter-bar', 70)]);
    await settle([oldPage, newPage], 350);
    await capture(width, `restaurant-${id}-sticky`, oldPage, newPage, 'sticky bar + tabs + chips');

    for (const chip of ['popular', 'rating', 'price', 'veg', 'nonveg']) {
      const selector = `#filter-${chip}`;
      await tap(oldPage, selector);
      await tap(newPage, selector);
      await settle([oldPage, newPage], 450);
      await capture(width, `restaurant-${id}-filter-${chip}`, oldPage, newPage);
      await tap(oldPage, selector);
      await tap(newPage, selector);
      await settle([oldPage, newPage], 350);
    }

    await tap(oldPage, '#res-tab-info');
    await tap(newPage, '#res-tab-info');
    await settle([oldPage, newPage], 600);
    await capture(width, `restaurant-${id}-info`, oldPage, newPage);
    await tap(oldPage, '#res-tab-menu');
    await tap(newPage, '#res-tab-menu');
    await settle([oldPage, newPage], 500);

    await Promise.all([scrollTo(oldPage, false, '#restaurant-filter-bar', 70), scrollTo(newPage, true, '#restaurant-filter-bar', 70)]);
    await settle([oldPage, newPage], 300);
    await tap(oldPage, '#ew-mj-btn');
    await tap(newPage, '#ew-mj-btn');
    await settle([oldPage, newPage], 500);
    await capture(width, `restaurant-${id}-menu-jump`, oldPage, newPage);
    await oldPage.keyboard.press('Escape').catch(() => undefined);
    await newPage.keyboard.press('Escape').catch(() => undefined);
    await settle([oldPage, newPage], 400);

    await Promise.all([
      scrollTo(oldPage, false, '.menu-cat-header', 90),
      scrollTo(newPage, true, '.menu-cat-header', 90),
    ]);
    await settle([oldPage, newPage], 300);
    await tap(oldPage, '.menu-cat-header');
    await tap(newPage, '.menu-cat-header');
    await settle([oldPage, newPage], 600);
    await capture(width, `restaurant-${id}-collapse`, oldPage, newPage);
    await tap(oldPage, '.menu-cat-header');
    await tap(newPage, '.menu-cat-header');
    await settle([oldPage, newPage], 500);

    // ---- Search page -------------------------------------------------
    // Dispatch the tap on the button itself: the header has scrolled out, and
    // Playwright would scroll it back into view before clicking.
    await oldPage.evaluate(() => document.getElementById('menu-search-btn')?.click());
    await newPage.evaluate(() => document.getElementById('menu-search-btn')?.click());
    for (const [label, page] of [['old', oldPage], ['new', newPage]] as const) {
      try {
        await page.waitForSelector('#ss-root', { state: 'attached', timeout: 6000 });
      } catch {
        const state = await page.evaluate(() => ({
          button: Boolean(document.getElementById('menu-search-btn')),
          paneHidden: document.getElementById('menu-pane')?.hidden ?? null,
        }));
        console.log(`[parity ${width}] search did not open on ${label}: ${JSON.stringify(state)}`);
      }
    }
    await oldPage.waitForFunction(() => document.querySelector('#ss-root')?.classList.contains('is-in'), null, { timeout: 4000 }).catch(() => undefined);
    await newPage.waitForFunction(() => document.querySelector('#ss-root')?.classList.contains('is-in'), null, { timeout: 4000 }).catch(() => undefined);
    await settle([oldPage, newPage], 700);
    await capture(width, `restaurant-${id}-search-empty`, oldPage, newPage, 'Browse the menu + categories');

    await oldPage.fill('#ss-input', 'biryani');
    await newPage.fill('#ss-input', 'biryani');
    await settle([oldPage, newPage], 500);
    await capture(width, `restaurant-${id}-search-query`, oldPage, newPage);

    await oldPage.fill('#ss-input', 'zzzzzz');
    await newPage.fill('#ss-input', 'zzzzzz');
    await settle([oldPage, newPage], 500);
    await capture(width, `restaurant-${id}-search-none`, oldPage, newPage);

    await oldPage.fill('#ss-input', '');
    await newPage.fill('#ss-input', '');
    await settle([oldPage, newPage], 400);
    await tap(oldPage, '.ss-diet-chip[data-diet="veg"]');
    await tap(newPage, '.ss-diet-chip[data-diet="veg"]');
    await settle([oldPage, newPage], 450);
    await capture(width, `restaurant-${id}-search-veg`, oldPage, newPage);

    await tap(oldPage, '.ss-back');
    await tap(newPage, '.ss-back');
    await settle([oldPage, newPage], 600);

    // ---- Add item + cart bar ----------------------------------------
    await Promise.all([scrollRestaurantTop(oldPage, false), scrollRestaurantTop(newPage, true)]);
    await settle([oldPage, newPage], 300);
    const addSelector = '#menu-container .nb-add-btn:not(.nb-add-btn--cust)';
    await tap(oldPage, addSelector);
    await tap(newPage, addSelector);
    await settle([oldPage, newPage], 700);
    await capture(width, `restaurant-${id}-add-item`, oldPage, newPage);

    // ---- Customize sheet --------------------------------------------
    await tap(oldPage, '#menu-container .nb-add-btn--cust');
    await tap(newPage, '#menu-container .nb-add-btn--cust');
    await Promise.all([
      oldPage.waitForSelector('#ewcs-sheet.show', { timeout: 6000 }),
      newPage.waitForSelector('#ewcs-sheet.show', { timeout: 6000 }),
    ]);
    await settle([oldPage, newPage], 650);
    await capture(width, `restaurant-${id}-customize`, oldPage, newPage);
    await oldPage.close();
    await newPage.close();
  } finally {
    await context.close();
  }
};

const cartScreen = async (browser: Browser, width: number): Promise<void> => {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'en-IN',
    serviceWorkers: 'block',
  });
  await context.addInitScript(seedStorage);
  try {
    const { oldPage, newPage } = await openPair(context, '/cart.html', '/cart');
    await Promise.all([
      oldPage.waitForSelector('#coupon-card', { timeout: 25000 }),
      newPage.waitForSelector('#coupon-card', { timeout: 25000 }),
    ]);
    await Promise.all([stripChrome(oldPage), stripChrome(newPage)]);
    await settle([oldPage, newPage], 1200);
    await capture(width, 'cart-bar', oldPage, newPage, 'cart page + pink bar');
  } finally {
    await context.close();
  }
};

const homeScreen = async (browser: Browser, width: number): Promise<void> => {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'en-IN',
    serviceWorkers: 'block',
  });
  await context.addInitScript(seedStorage);
  try {
    const { oldPage, newPage } = await openPair(context, '/index.html', '/');
    await Promise.all([
      oldPage.waitForSelector('#restaurant-list .u99-card-host', { timeout: 25000 }),
      newPage.waitForSelector('#restaurant-list .u99-card-host', { timeout: 25000 }),
    ]);
    await Promise.all([stripChrome(oldPage), stripChrome(newPage)]);
    await settle([oldPage, newPage], 1200);
    await capture(width, 'home-with-nav', oldPage, newPage);
  } finally {
    await context.close();
  }
};

const git = (cwd: string, args: string[]): string => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
};

const writeIndex = (pinned: { nearbite: string; app: string }): void => {
  mkdirSync(outRoot, { recursive: true });
  const names = [...new Set(results.map((result) => result.name))];
  const passed = results.filter((result) => result.diffPct !== null && result.diffPct < THRESHOLD);
  const measured = results.filter((result) => result.diffPct !== null);
  const worst = [...measured].sort((a, b) => (b.diffPct ?? 0) - (a.diffPct ?? 0)).slice(0, 5);

  const rows = names
    .map((name) => {
      const cells = widths
        .map((width) => {
          const result = results.find((entry) => entry.name === name && entry.width === width);
          if (!result) return '<td>—</td>';
          if (result.diffPct === null) return `<td class="fail" title="${result.error ?? ''}">ERROR</td>`;
          const cls = result.diffPct < THRESHOLD ? 'pass' : 'fail';
          return `<td class="${cls}">${result.diffPct.toFixed(2)}%<br><a href="w${width}/diff/${name}.png">diff</a> · <a href="w${width}/old/${name}.png">old</a> · <a href="w${width}/new/${name}.png">new</a></td>`;
        })
        .join('');
      return `<tr><th>${name}</th>${cells}</tr>`;
    })
    .join('\n');

  const html = `<!doctype html><meta charset="utf-8"><title>Parity report</title>
<style>body{font:14px/1.5 system-ui;margin:24px;color:#111}table{border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 10px;text-align:left;vertical-align:top}th{background:#fafafa}.pass{color:#0b7a2a}.fail{color:#b42318}a{color:#2563eb}</style>
<h1>Pixel parity — reference vs port</h1>
<p>Reference <code>kignas/Nearbite</code> @ <code>${pinned.nearbite}</code>, port <code>${pinned.app}</code>.
Screenshots at deviceScaleFactor 1, viewport ${height}px tall, pixelmatch threshold 0.1, pass line
<strong>&lt; ${THRESHOLD}%</strong> of pixels.</p>
<p><strong>${passed.length} / ${results.length}</strong> measurements under ${THRESHOLD}%
(${measured.length} measured, ${results.length - measured.length} could not be captured).</p>
<table><thead><tr><th>screen</th>${widths.map((width) => `<th>${width}px</th>`).join('')}</tr></thead>
<tbody>${rows}</tbody></table>
<h2>Worst 5</h2><ol>${worst.map((result) => `<li>${result.name} @${result.width}px — ${(result.diffPct ?? 0).toFixed(2)}%</li>`).join('')}</ol>
<p>Images: <code>w&lt;width&gt;/{old,new,diff}/&lt;screen&gt;.png</code>.</p>`;
  writeFileSync(path.join(outRoot, 'index.html'), html);
  writeFileSync(
    path.join(outRoot, 'index.json'),
    JSON.stringify({ nearbite: pinned.nearbite, app: pinned.app, threshold: THRESHOLD, widths, results, passed: passed.length, total: results.length, worst }, null, 2),
  );
};

async function main(): Promise<void> {
  if (!existsSync(path.join(originalDir, 'index.html'))) {
    throw new Error(`Reference frontend not found at ${originalDir} (set ORIGINAL_DIR)`);
  }
  const pinned = {
    nearbite: git(originalDir, ['rev-parse', 'HEAD']),
    app: git(repoRoot, ['rev-parse', 'HEAD']),
  };
  console.log(`Reference: ${originalDir} @ ${pinned.nearbite}`);
  console.log(`Port: ${repoRoot} @ ${pinned.app}`);
  mkdirSync(outRoot, { recursive: true });
  writeFileSync(path.join(outRoot, 'pinned.json'), JSON.stringify(pinned, null, 2));

  const server = await startOriginalServer();
  const previewServer = await preview({
    root: appRoot,
    logLevel: 'error',
    preview: { host: '127.0.0.1', port: appPort, strictPort: true },
  });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    for (const width of widths) {
      await homeScreen(browser, width);
      await restaurantJourney(browser, width, '1', '/restaurant/1', '1');
      await cartScreen(browser, width);
    }
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => previewServer.httpServer.close(() => resolve()));
    server.close();
  }

  writeIndex(pinned);
  const measured = results.filter((result) => result.diffPct !== null);
  const passed = measured.filter((result) => (result.diffPct ?? 100) < THRESHOLD);
  console.log(`\nParity: ${passed.length}/${results.length} under ${THRESHOLD}% (${measured.length} measured)`);
  console.log(`Report: ${path.join(outRoot, 'index.html')}`);
  if (passed.length !== results.length) process.exitCode = 1;
}

void main();
