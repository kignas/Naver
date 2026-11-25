/**
 * Design-parity audit: screenshots every screen/state of the original
 * Eatswada frontend and Navereat side by side, pixel-diffs them and probes
 * landmark elements for geometry/typography differences.
 *
 *   ORIGINAL_DIR=/workspace/reference/Nearbite-main npx vite-node scripts/design-parity.ts
 *
 * Outputs verify/parity/{original,navereat,diff,side}/<name>.png and
 * verify/parity/report.json. Read-only: it never writes to the reference.
 */
import http from 'node:http';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright-core';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { preview } from 'vite';
import { categories, demoOrders, demoUser, restaurants } from '../src/data/demo';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const originalDir = process.env.ORIGINAL_DIR
  ? path.resolve(process.env.ORIGINAL_DIR)
  : path.resolve(appRoot, '../../../reference/Nearbite-main');
const originalApiRoute = /https:\/\/api\.[^/]+\/.*/;
const placeholdersRoot = path.join(appRoot, 'src/assets/placeholders');
const outRoot = path.join(repoRoot, 'verify/parity');
const generatedPlaceholdersRoot = path.join(outRoot, 'placeholders');
mkdirSync(generatedPlaceholdersRoot, { recursive: true });
const originalPort = 4183;
const appPort = 4184;
const viewport = { width: 390, height: 844 };
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

const serveFile = (res: http.ServerResponse, file: string): void => {
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  createReadStream(file).pipe(res);
};

const startOriginalServer = (): Promise<http.Server> =>
  new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url ?? '/', `http://127.0.0.1:${originalPort}`);
        let pathname = decodeURIComponent(url.pathname);
        if (pathname === '/') pathname = '/index.html';
        if (pathname.startsWith('/__placeholders/')) {
          const name = path.basename(pathname);
          let file = path.join(placeholdersRoot, name);
          if (!existsSync(file)) file = path.join(generatedPlaceholdersRoot, name);
          if (existsSync(file)) return serveFile(res, file);
        }
        const file = path.join(originalDir, pathname);
        if (!file.startsWith(originalDir)) {
          res.writeHead(403).end('Forbidden');
          return;
        }
        if (!existsSync(file) || !statSync(file).isFile()) {
          if (!path.extname(pathname) && existsSync(`${file}.html`)) return serveFile(res, `${file}.html`);
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

const placeholderUrl = (value: string): string => {
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
  return `/__placeholders/${raw.split('/').pop()?.split('?')[0] ?? ''}`;
};

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

const json = (route: import('playwright-core').Route, data: unknown): Promise<void> =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

async function mockApi(route: import('playwright-core').Route): Promise<void> {
  const pathname = new URL(route.request().url()).pathname.replace(/^\/api/, '');
  if (pathname === '/platform/public-status') {
    return json(route, { canOrder: true, state: 'open', orderingOpen: true, nextOpenAt: null });
  }
  if (pathname === '/home-banners') {
    return json(route, [{ _id: 'hero-1', title: '', mobileImage: '/__placeholders/hero-dish.svg', active: true, priority: 1 }]);
  }
  if (pathname === '/users/addresses') {
    return json(route, [{ _id: 'demo-address', tag: 'Home', house: 'Demo Street', area: 'Demo City…', city: 'Demo City…', isDefault: true }]);
  }
  if (pathname === '/categories') return json(route, apiCategories);
  if (pathname === '/restaurants' || pathname === '/restaurants/under99') {
    return json(route, apiRestaurants);
  }
  if (pathname === '/restaurants/search') {
    /* search-overlay.js reads json.data.menuItems; returning the restaurant
       array here made the original render "No dishes found" for every query. */
    const query = (new URL(route.request().url()).searchParams.get('q') ?? '').trim().toLowerCase();
    const menuItems = apiRestaurants.flatMap((restaurant) =>
      restaurant.menu
        .filter((item) =>
          `${item.name} ${item.description ?? ''} ${item.category ?? ''}`.toLowerCase().includes(query),
        )
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

const isUniform = (png: PNG): boolean => {
  const step = 4 * 97;
  let first = -1;
  for (let index = 0; index < png.data.length; index += step) {
    if (first === -1) first = png.data[index];
    else if (Math.abs(png.data[index] - first) > 6) return false;
  }
  return true;
};

const cropPng = (source: PNG, width: number, height: number): PNG => {
  const out = new PNG({ width, height });
  PNG.bitblt(source, out, 0, 0, width, height, 0, 0);
  return out;
};

interface ProbeResult {
  selector: string;
  original: string;
  app: string;
  diff: string[];
}

const probe = (page: Page, selectors: string[]): Promise<Record<string, string>> =>
  page.evaluate((list) => {
    const out: Record<string, string> = {};
    for (const selector of list) {
      const element = document.querySelector(selector);
      if (!element) {
        out[selector] = 'MISSING';
        continue;
      }
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      out[selector] = [
        `x${Math.round(rect.x)} y${Math.round(rect.y)} w${Math.round(rect.width)} h${Math.round(rect.height)}`,
        `fs${style.fontSize}/${style.fontWeight}`,
        `c${style.color}`,
        `bg${style.backgroundColor}`,
        `r${style.borderRadius}`,
        `sh${style.boxShadow === 'none' ? 'none' : 'yes'}`,
        `pad${style.paddingTop},${style.paddingRight},${style.paddingBottom},${style.paddingLeft}`,
        `gap${style.rowGap}`,
      ].join(' ');
    }
    return out;
  }, selectors);

const PROBE_FIELDS = ['x', 'y', 'w', 'h', 'fs', 'c', 'bg', 'r', 'sh', 'pad', 'gap'];

const compareProbes = (selector: string, original: string, app: string): ProbeResult => {
  const diff: string[] = [];
  if (original === 'MISSING' || app === 'MISSING') {
    return { selector, original, app, diff: [original === 'MISSING' ? 'missing in original' : 'missing in app'] };
  }
  const originalParts = original.split(' ');
  const appParts = app.split(' ');
  originalParts.forEach((part, index) => {
    const other = appParts[index] ?? '';
    if (part === other) return;
    const field = PROBE_FIELDS.find((name) => part.startsWith(name) || other.startsWith(name));
    const label = field ?? `[${index}]`;
    if (label === 'x' || label === 'y' || label === 'w' || label === 'h') {
      const a = Number(part.replace(/^[xywh]/, ''));
      const b = Number(other.replace(/^[xywh]/, ''));
      if (Math.abs(a - b) <= 1) return;
    }
    if (label === 'pad' || label === 'gap') {
      const a = part.replace(/^(pad|gap)/, '');
      const b = other.replace(/^(pad|gap)/, '');
      if (a === b) return;
    }
    diff.push(`${label}: ${part} → ${other}`);
  });
  return { selector, original, app, diff };
};

interface Capture {
  name: string;
  diffPct: number;
  diffPctRaw: number;
  probes: ProbeResult[];
  note?: string;
}

// The floating bottom nav is this app's own design and it sits higher than the
// original's fixed bar, which drags the cart bar up with it. Both are excluded from
// the diff so the number reflects design work, not that intentional offset. The
// unmasked number is kept alongside.
const CHROME_SELECTORS = '.bottom-nav, #white-cart-root, #cart-bar';

const chromeRects = (page: Page): Promise<Array<{ x: number; y: number; w: number; h: number }>> =>
  page.evaluate((selector) => {
    const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
    document.querySelectorAll(selector).forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 1 && rect.height > 1) {
        rects.push({ x: rect.x, y: rect.y, w: rect.width, h: rect.height });
      }
    });
    return rects;
  }, CHROME_SELECTORS);

const maskPng = (png: PNG, rects: Array<{ x: number; y: number; w: number; h: number }>, scale: number): void => {
  for (const rect of rects) {
    const left = Math.max(0, Math.floor(rect.x * scale));
    const top = Math.max(0, Math.floor(rect.y * scale));
    const right = Math.min(png.width, Math.ceil((rect.x + rect.w) * scale));
    const bottom = Math.min(png.height, Math.ceil((rect.y + rect.h) * scale));
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const index = (y * png.width + x) * 4;
        png.data[index] = 0;
        png.data[index + 1] = 0;
        png.data[index + 2] = 0;
        png.data[index + 3] = 255;
      }
    }
  }
};

const results: Capture[] = [];

async function capture(
  name: string,
  original: Page,
  app: Page,
  options: { probes?: string[]; element?: string; cropTop?: number; note?: string } = {},
): Promise<void> {
  const { probes = [], element, cropTop, note } = options;
  const shot = async (page: Page, label: 'original' | 'navereat'): Promise<PNG> => {
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const buffer = element
        ? await page.locator(element).first().screenshot()
        : await page.screenshot({ clip: cropTop ? { x: 0, y: 0, width: viewport.width, height: cropTop } : undefined });
      const png = PNG.sync.read(buffer);
      const uniform = isUniform(png);
      if (!uniform || attempt === 3) {
        await fs.writeFile(path.join(outRoot, label, `${name}.png`), PNG.sync.write(png));
        return png;
      }
      if (uniform) await page.waitForTimeout(600);
    }
    throw new Error(`Could not capture ${name} (${label})`);
  };
  const a = await shot(original, 'original');
  const b = await shot(app, 'navereat');
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const rawA = cropPng(a, width, height);
  const rawB = cropPng(b, width, height);

  const diff = new PNG({ width, height });
  const pixelsRaw = pixelmatch(rawA.data, rawB.data, diff.data, width, height, { threshold: 0.12 });

  let pixels = pixelsRaw;
  let usableArea = width * height;
  if (!element) {
    const [originalRects, appRects] = await Promise.all([chromeRects(original), chromeRects(app)]);
    const rects = [...originalRects, ...appRects];
    const scale = width / viewport.width;
    let maskedArea = 0;
    const maskedA = cropPng(a, width, height);
    const maskedB = cropPng(b, width, height);
    for (const rect of rects) {
      const w = Math.min(rect.w, viewport.width - rect.x);
      const h = Math.min(rect.h, height / scale - rect.y);
      if (w > 0 && h > 0) maskedArea += w * h;
    }
    maskPng(maskedA, rects, scale);
    maskPng(maskedB, rects, scale);
    pixels = pixelmatch(maskedA.data, maskedB.data, diff.data, width, height, { threshold: 0.12 });
    usableArea = Math.max(1, width * height - Math.round(maskedArea * scale * scale));
  }
  await fs.writeFile(path.join(outRoot, 'diff', `${name}.png`), PNG.sync.write(diff));

  // Side-by-side strip for quick human review.
  const side = new PNG({ width: width * 2 + 8, height });
  side.data.fill(24);
  PNG.bitblt(cropPng(a, width, height), side, 0, 0, width, height, 0, 0);
  PNG.bitblt(cropPng(b, width, height), side, 0, 0, width, height, width + 8, 0);
  await fs.writeFile(path.join(outRoot, 'side', `${name}.png`), PNG.sync.write(side));

  const probeResults: ProbeResult[] = [];
  if (probes.length) {
    const [originalValues, appValues] = await Promise.all([probe(original, probes), probe(app, probes)]);
    for (const selector of probes) {
      const result = compareProbes(selector, originalValues[selector], appValues[selector]);
      if (result.diff.length) probeResults.push(result);
    }
  }
  const diffPct = Number(((pixels / usableArea) * 100).toFixed(2));
  const diffPctRaw = Number(((pixelsRaw / (width * height)) * 100).toFixed(2));
  results.push({ name, diffPct, diffPctRaw, probes: probeResults, note });
  const changed = probeResults.map((entry) => `${entry.selector}(${entry.diff.join('; ')})`).join(' | ');
  console.log(
    `[parity] ${name.padEnd(28)} ${String(diffPct).padStart(6)}% raw ${String(diffPctRaw).padStart(6)}%  ${changed.slice(0, 200)}`,
  );
}

const seedStorage = () => {
  localStorage.setItem('nearbite_token', 'demo-token');
  localStorage.setItem('token', 'demo-token');
  localStorage.setItem(
    'nearbite_user',
    JSON.stringify({ name: 'Sagnik', phone: '+91 98765 43210', email: 'demo@navereat.app' }),
  );
  const image =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23F3DDBF'/%3E%3Ccircle cx='40' cy='40' r='22' fill='%23E9546B'/%3E%3C/svg%3E";
  localStorage.setItem(
    'nearbite_cart',
    JSON.stringify({
      'Hyderabadi Chicken Biryani': {
        quantity: 2, price: 249, originalPrice: 311, resId: 2, resName: 'Biryani Bhavan',
        restaurantName: 'Biryani Bhavan', menuItem: 'bb1', image,
      },
      Raita: {
        quantity: 1, price: 39, resId: 2, resName: 'Biryani Bhavan',
        restaurantName: 'Biryani Bhavan', menuItem: 'bb7', image,
      },
    }),
  );
  localStorage.setItem('nearbite_address', JSON.stringify({ tag: 'Home', house: 'Demo Street', area: 'Demo City…', city: 'Demo City…' }));
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
        '.ew-gate,.loc-sheet,.theme-intro,.ew-theme-intro,.new-user-location-prompt,.welcome-prompt,.ps-banner,.eg-banner,.service-closed,.closed-overlay,.ew-pr,.ew-pr-scrim,.ew-pr-sheet,.ew-offer-popup,.ew-free-delivery-toast,#ew-sticky-search,#ct-location-modal',
      )
      .forEach((element) => element.remove());
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.paddingBottom = '0';
    document.body.classList.remove('ct-location-modal-open');
  });
};

const freezeText = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    document.querySelectorAll('.search-dish').forEach((el) => {
      el.textContent = '"Momos"';
    });
    document.querySelectorAll('.search-dish').forEach((el) => {
      el.textContent = '"Biryani"';
      el.classList.remove('is-sliding');
      (el as HTMLElement).style.animation = 'none';
      (el as HTMLElement).style.transform = 'none';
    });
    document
      .querySelectorAll('.header-slide.is-active .banner-badge, .header-slide.is-active .banner-title, .header-slide.is-active .banner-subtitle, .header-slide.is-active .banner-offer, .header-slide.is-active .banner-cta')
      .forEach((el) => {
        (el as HTMLElement).style.animation = 'none';
      });
  });
};

const scrollToCard = async (page: Page, isApp: boolean): Promise<void> => {
  await page.evaluate((app) => {
    const card = document.querySelector('.u99-card-host');
    if (!card) return;
    const delta = card.getBoundingClientRect().top - 80;
    const scroller = app ? document.querySelector<HTMLElement>('.home-scroll') : null;
    if (scroller) scroller.scrollTop += delta;
    else window.scrollBy(0, delta);
  }, isApp);
};

async function main(): Promise<void> {
  if (!existsSync(path.join(originalDir, 'index.html'))) {
    throw new Error(`Original frontend not found at ${originalDir}`);
  }
  for (const dir of ['original', 'navereat', 'diff', 'side']) mkdirSync(path.join(outRoot, dir), { recursive: true });

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

  const makeContext = async (storage: 'seeded' | 'empty' | 'emptycart') => {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: scale,
      isMobile: true,
      hasTouch: true,
      locale: 'en-IN',
      serviceWorkers: 'block',
    });
    if (storage === 'seeded') {
      await context.addInitScript(seedStorage);
    } else if (storage === 'emptycart') {
      await context.addInitScript(() => {
        localStorage.setItem('nearbite_token', 'demo-token');
        localStorage.setItem('token', 'demo-token');
        localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Sagnik', phone: '+91 98765 43210' }));
        localStorage.setItem('nearbite_address', JSON.stringify({ tag: 'Home', house: 'Demo Street', area: 'Demo City…', city: 'Demo City…' }));
        localStorage.setItem('eatswada_theme', 'light');
        localStorage.setItem('eatswada_header_theme', 'raspberry');
        localStorage.setItem('eatswada_new_user_location_prompt_shown', '1');
        sessionStorage.setItem('ew_gate_auto_shown', '1');
        sessionStorage.setItem('eg_screen_dismissed', '1');
        sessionStorage.setItem('eg_banner_closed', '1');
        sessionStorage.setItem('eatswada_location_prompt_dismissed', '1');
      });
    } else {
      await context.addInitScript(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
          localStorage.setItem('eatswada_theme', 'light');
          localStorage.setItem('eatswada_header_theme', 'raspberry');
          sessionStorage.setItem('ew_gate_auto_shown', '1');
          sessionStorage.setItem('eg_screen_dismissed', '1');
          sessionStorage.setItem('eg_banner_closed', '1');
          sessionStorage.setItem('eatswada_location_prompt_dismissed', '1');
        } catch {
          /* about:blank */
        }
      });
    }
    return context;
  };

  const openPair = async (context: import('playwright-core').BrowserContext, originalPath: string, appPath: string) => {
    const original = await context.newPage();
    await original.route(originalApiRoute, mockApi);
    await original.goto(`http://127.0.0.1:${originalPort}${originalPath}`, { waitUntil: 'domcontentloaded' });
    const app = await context.newPage();
    await app.goto(`http://127.0.0.1:${appPort}/#${appPath}`, { waitUntil: 'networkidle' });
    return { original, app };
  };

  // ── Login ───────────────────────────────────────────────────────────
  {
    const context = await makeContext('empty');
    const original = await context.newPage();
    await original.goto(`http://127.0.0.1:${originalPort}/login.html`, { waitUntil: 'domcontentloaded' });
    await original.waitForSelector('.auth-choice-view', { timeout: 20000 });
    await stripChrome(original);
    await original.evaluate(() => document.fonts.ready);
    await original.waitForTimeout(800);
    const app = await context.newPage();
    await app.goto(`http://127.0.0.1:${appPort}/#/login`, { waitUntil: 'networkidle' });
    await app.waitForSelector('.login-page', { timeout: 20000 });
    await app.evaluate(() => document.fonts.ready);
    await app.waitForTimeout(600);
    await capture('login', original, app, {
      probes: ['.login-page h1, .auth-choice-view h1', '.login-page button, .auth-choice-view button'],
    });
    await context.close();
  }

  // ── Home ────────────────────────────────────────────────────────────
  const mainContext = await makeContext('seeded');
  const home = await openPair(mainContext, '/index.html', '/');
  await home.original.waitForSelector('#restaurant-list .u99-card-host', { timeout: 20000 });
  await home.app.waitForSelector('#restaurant-list .u99-card-host', { timeout: 20000 });
  for (const page of [home.original, home.app]) {
    await stripChrome(page);
    await freezeText(page);
    await page.evaluate(() => document.fonts.ready);
  }
  await home.original.waitForTimeout(900);
  await home.app.waitForTimeout(900);
  await capture('home', home.original, home.app, {
    probes: [
      '.loc-name',
      '.loc-sub',
      '.search-box',
      '.veg-box',
      '.banner-title',
      '.banner-subtitle',
      '.banner-cta',
      '#restaurants-title',
      '.cat-name',
      '.filter-pill',
      '.u99-restaurant-name',
      '.u99-meta',
      '#white-cart-root',
    ],
    note: 'Home at scrollTop 0',
  });

  await scrollToCard(home.original, false);
  await scrollToCard(home.app, true);
  await home.original.waitForTimeout(400);
  await home.app.waitForTimeout(400);
  await capture('home-scrolled', home.original, home.app, {
    probes: ['.u99-restaurant-name', '.u99-meta', '.u99-add-cust', '#white-cart-root'],
    note: 'scrolled to the restaurant list',
  });

  await home.original.evaluate(() => window.scrollTo(0, 0));
  await home.app.evaluate(() => document.querySelector<HTMLElement>('.home-scroll')?.scrollTo(0, 0));
  await home.original.waitForTimeout(300);
  await home.app.waitForTimeout(300);

  // Header: static (scrollTop 0) vs Navereat's collapsed bar at the same scroll.
  await home.original.evaluate(() => window.scrollTo(0, 120));
  await home.app.evaluate(() => document.querySelector<HTMLElement>('.home-scroll')?.scrollTo(0, 120));
  await home.original.waitForTimeout(300);
  await home.app.waitForTimeout(300);
  await capture('home-header-collapsed', home.original, home.app, {
    cropTop: 140,
    probes: ['.search-box'],
    note: 'Navereat pinned search bar vs original (header has scrolled away)',
  });
  await home.original.evaluate(() => window.scrollTo(0, 0));
  await home.original.waitForTimeout(250);
  await capture('home-searchrow-style', home.original, home.app, {
    element: '.search-row',
    probes: ['.search-box', '.veg-box'],
    note: 'original static search row vs Navereat pinned/compacted row',
  });
  await home.original.evaluate(() => window.scrollTo(0, 120));
  await home.original.waitForTimeout(250);
  await home.original.evaluate(() => window.scrollTo(0, 0));
  await home.app.evaluate(() => document.querySelector<HTMLElement>('.home-scroll')?.scrollTo(0, 0));
  await home.original.waitForTimeout(300);
  await home.app.waitForTimeout(300);

  // Filter sheet.
  await home.original.click('#filter-sheet-btn');
  await home.original.waitForSelector('#filter-sheet.open', { timeout: 5000 });
  await home.app.locator('.filter-pill-sheet').click();
  await home.app.waitForSelector('.filter-sheet.open', { timeout: 5000 });
  await home.original.waitForTimeout(550);
  await home.app.waitForTimeout(550);
  await capture('home-filter-sheet', home.original, home.app, {
    probes: ['#filter-sheet', '#filter-sheet .sheet-done', '.u99-filter-row, .filter-row'],
  });
  await home.original.click('#filter-sheet .sheet-done');
  await home.app.locator('.filter-sheet .sheet-done').click();
  await home.original.waitForTimeout(400);
  await home.app.waitForTimeout(400);

  // Cart bar clear state.
  await home.original.click('#wc-close-btn');
  await home.app.click('#wc-close-btn');
  await home.original.waitForTimeout(250);
  await home.app.waitForSelector('#wc-clear-actions', { state: 'visible', timeout: 5000 });
  await home.app.waitForTimeout(250);
  await capture('home-cartbar-clear', home.original, home.app, {
    probes: ['#white-cart-root', '#wc-clear-actions', '#wc-clear-cancel'],
  });
  await home.original.evaluate(() => localStorage.removeItem('nearbite_cart'));
  await home.app.evaluate(() => localStorage.removeItem('nearbite_cart'));
  await home.original.reload({ waitUntil: 'domcontentloaded' });
  await home.app.reload({ waitUntil: 'networkidle' });
  await home.original.waitForSelector('#restaurant-list .u99-card-host', { timeout: 20000 });
  await home.app.waitForSelector('#restaurant-list .u99-card-host', { timeout: 20000 });
  for (const page of [home.original, home.app]) {
    await stripChrome(page);
    await freezeText(page);
  }
  await home.original.waitForTimeout(800);
  await home.app.waitForTimeout(800);
  await capture('home-cartbar-empty', home.original, home.app, {
    probes: ['#white-cart-root', '.u99-card-host'],
    note: 'no items in cart',
  });

  // ── Search overlay ──────────────────────────────────────────────────
  {
    const original = await mainContext.newPage();
    await original.route(originalApiRoute, mockApi);
    await original.goto(`http://127.0.0.1:${originalPort}/index.html`, { waitUntil: 'domcontentloaded' });
    await original.waitForSelector('#restaurant-list .u99-card-host', { timeout: 20000 });
    await stripChrome(original);
    await original.evaluate(() => document.querySelector<HTMLElement>('.search-box')?.click());
    await original.waitForSelector('#ew-search-root.is-open', { timeout: 5000 });
    await original.waitForTimeout(450);
    const app = await mainContext.newPage();
    await app.goto(`http://127.0.0.1:${appPort}/#/`, { waitUntil: 'networkidle' });
    await app.waitForSelector('#restaurant-list .u99-card-host', { timeout: 20000 });
    await app.evaluate(() => document.querySelector<HTMLElement>('.search-box')?.click());
    await app.waitForSelector('#ew-search-root.is-open', { timeout: 5000 });
    await app.waitForTimeout(450);
    await capture('search-idle', original, app, {
      element: '.ew-search-sheet',
      probes: ['.ew-search-input', '.ew-search-head', '.ew-search-context', '.ew-search-clear'],
    });
    await original.fill('#ew-search-input', 'biry');
    await app.fill('#ew-search-input', 'biry');
    await original.waitForTimeout(150);
    await app.waitForTimeout(150);
    await capture('search-typing', original, app, { element: '.ew-search-sheet', probes: ['.ew-search-input'] });
    await Promise.allSettled([
      original.waitForSelector('.ew-search-result', { timeout: 10000 }),
      app.waitForSelector('.ew-search-result', { timeout: 10000 }),
    ]);
    await original.waitForTimeout(350);
    await app.waitForTimeout(350);
    await capture('search-results', original, app, {
      element: '.ew-search-sheet',
      probes: ['.ew-search-result, .result-card', '.result-title-row strong, .ew-search-name', '.result-main p, .ew-search-meta'],
    });
    await original.fill('#ew-search-input', 'zzzz');
    await app.fill('#ew-search-input', 'zzzz');
    await original.waitForSelector('.ew-search-state', { timeout: 10000 });
    await app.waitForSelector('.ew-search-state', { timeout: 10000 });
    await original.waitForTimeout(350);
    await app.waitForTimeout(350);
    await capture('search-empty', original, app, { element: '.ew-search-sheet', probes: ['.ew-search-state'] });
    await original.close();
    await app.close();
  }

  // ── ₹99 Store ───────────────────────────────────────────────────────
  {
    const original = await mainContext.newPage();
    await original.route(originalApiRoute, mockApi);
    await original.goto(`http://127.0.0.1:${originalPort}/under99.html`, { waitUntil: 'domcontentloaded' });
    await original.waitForSelector('#u99-product-grid .u99-product-card', { timeout: 20000 });
    await stripChrome(original);
    await original.evaluate(() => document.fonts.ready);
    await original.waitForTimeout(800);
    const app = await mainContext.newPage();
    await app.goto(`http://127.0.0.1:${appPort}/#/under99`, { waitUntil: 'networkidle' });
    await app.waitForSelector('#u99-product-grid .u99-product-card', { timeout: 20000 });
    await app.evaluate(() => document.fonts.ready);
    await app.waitForTimeout(700);
    await capture('under99', original, app, {
      probes: [
        '.u99-header, .store-header',
        '.header-title, .u99-header-title',
        '.hero',
        '.filter-pill',
        '.u99-product-card',
        '.u99-product-name, .item-name',
        '.u99-add-btn',
      ],
    });
    await original.close();
    await app.close();
  }

  // ── Category ────────────────────────────────────────────────────────
  {
    const original = await mainContext.newPage();
    await original.route(originalApiRoute, mockApi);
    await original.goto(`http://127.0.0.1:${originalPort}/category.html?type=Biryani`, { waitUntil: 'domcontentloaded' });
    await original.waitForSelector('#cat-results .res-card', { timeout: 20000 });
    await stripChrome(original);
    await original.evaluate(() => document.fonts.ready);
    await original.waitForTimeout(800);
    const app = await mainContext.newPage();
    await app.goto(`http://127.0.0.1:${appPort}/#/category/Biryani`, { waitUntil: 'networkidle' });
    await app.waitForSelector('.cat-page .cat-result', { timeout: 20000 });
    await app.evaluate(() => document.fonts.ready);
    await app.waitForTimeout(700);
    await capture('category', original, app, {
      probes: [
        '.store-header, .cat-head',
        '.res-card, .cat-result',
        '.res-name, .cat-result-name',
        '.res-cuisine, .cat-result-cuisine',
        '.filter-pill',
      ],
    });
    await original.close();
    await app.close();
  }

  // ── Restaurant ──────────────────────────────────────────────────────
  {
    const original = await mainContext.newPage();
    await original.route(originalApiRoute, mockApi);
    await original.goto(`http://127.0.0.1:${originalPort}/restaurant-shell.html?id=1`, { waitUntil: 'domcontentloaded' });
    await original.waitForSelector('#menu-container .menu-item', { timeout: 20000 });
    await stripChrome(original);
    await original.evaluate(() => document.fonts.ready);
    await original.waitForTimeout(900);
    await original.evaluate(() => window.scrollTo(0, 0));
    await original.waitForTimeout(250);
    const app = await mainContext.newPage();
    await app.goto(`http://127.0.0.1:${appPort}/#/restaurant/1`, { waitUntil: 'networkidle' });
    await app.waitForSelector('.rest-page .menu-item', { timeout: 20000 });
    await app.evaluate(() => document.fonts.ready);
    await app.waitForTimeout(700);
    await capture('restaurant-top', original, app, {
      probes: ['#res-name', '#res-cuisine', '#res-distance', '#res-time', '#res-rating-pill', '#res-offer-text', '#res-tabs', '#restaurant-filter-bar', '.menu-item'],
    });

    await original.evaluate(() => {
      const bar = document.querySelector('#restaurant-filter-bar');
      if (bar) window.scrollTo(0, bar.getBoundingClientRect().top + window.scrollY - 70);
    });
    await app.evaluate(() => {
      const bar = document.querySelector('#restaurant-filter-bar');
      const scroller = document.querySelector<HTMLElement>('.rest-scroll');
      if (bar && scroller) scroller.scrollTop += bar.getBoundingClientRect().top - 70;
    });
    await original.waitForTimeout(400);
    await app.waitForTimeout(400);
    await capture('restaurant-filters', original, app, {
      element: '#restaurant-filter-bar',
      probes: ['#filter-popular', '#filter-rating', '#filter-price', '#filter-veg', '#filter-nonveg'],
    });

    await original.evaluate(() => {
      const item = document.querySelector('.menu-item');
      if (item) window.scrollTo(0, item.getBoundingClientRect().top + window.scrollY - 200);
    });
    await app.evaluate(() => {
      const item = document.querySelector('.menu-item');
      const scroller = document.querySelector<HTMLElement>('.rest-scroll');
      if (item && scroller) scroller.scrollTop += item.getBoundingClientRect().top - 200;
    });
    await original.waitForTimeout(350);
    await app.waitForTimeout(350);
    await capture('restaurant-scrolled', original, app, {
      probes: ['.menu-item', '.menu-cat-title', '.nb-item-title, .menu-item-name', '.nb-add-btn--cust'],
      note: 'menu items scrolled into view',
    });

    // Customization sheet states.
    await original.locator('.nb-add-btn--cust').first().click();
    await app.locator('.nb-add-btn--cust').first().click();
    await original.waitForSelector('#ewcs-sheet.show', { timeout: 5000 });
    await app.waitForSelector('#ewcs-sheet.show', { timeout: 5000 });
    await original.waitForTimeout(500);
    await app.waitForTimeout(500);
    await capture('customization-open', original, app, {
      probes: ['#ewcs-sheet', '.ewcs-head h3', '.ewcs-gtitle', '.ewcs-opt', '.ewcs-add', '.ewcs-qty'],
    });
    await original.locator('.ewcs-opt', { hasText: 'Extra chutney' }).click();
    await app.locator('.ewcs-opt', { hasText: 'Extra chutney' }).click();
    await original.waitForTimeout(300);
    await app.waitForTimeout(300);
    await capture('customization-selected', original, app, { probes: ['.ewcs-opt input:checked', '.ewcs-add'] });
    await original.evaluate(() => {
      const body = document.querySelector<HTMLElement>('#ewcs-sheet .ewcs-body');
      if (body) body.scrollTop = body.scrollHeight;
    });
    await app.evaluate(() => {
      const body = document.querySelector<HTMLElement>('#ewcs-sheet .ewcs-body');
      if (body) body.scrollTop = body.scrollHeight;
    });
    await original.waitForTimeout(350);
    await app.waitForTimeout(350);
    await capture('customization-scrolled', original, app, { probes: ['.ewcs-body', '.ewcs-foot'] });
    await original.evaluate(() => {
      const body = document.querySelector<HTMLElement>('#ewcs-sheet .ewcs-body');
      if (body) body.scrollTop = 0;
    });
    await app.evaluate(() => {
      const body = document.querySelector<HTMLElement>('#ewcs-sheet .ewcs-body');
      if (body) body.scrollTop = 0;
    });
    await original.locator('.ewcs-close').click();
    await app.locator('.ewcs-close').click();
    await original.waitForTimeout(400);
    await app.waitForTimeout(400);

    // Validation error state (restaurant 3 requires options).
    const originalPizza = await mainContext.newPage();
    await originalPizza.route(originalApiRoute, mockApi);
    await originalPizza.goto(`http://127.0.0.1:${originalPort}/restaurant-shell.html?id=3`, { waitUntil: 'domcontentloaded' });
    await originalPizza.waitForFunction(() => document.querySelector('#res-name')?.textContent?.includes('Pizza Palace'), { timeout: 20000 });
    await stripChrome(originalPizza);
    await originalPizza.waitForTimeout(700);
    const appPizza = await mainContext.newPage();
    await appPizza.goto(`http://127.0.0.1:${appPort}/#/restaurant/3`, { waitUntil: 'networkidle' });
    await appPizza.waitForFunction(() => document.querySelector('#res-name')?.textContent?.includes('Pizza Palace'), { timeout: 20000 });
    await appPizza.waitForTimeout(600);
    await originalPizza.locator('.nb-add-btn--cust').first().scrollIntoViewIfNeeded();
    await appPizza.locator('.nb-add-btn--cust').first().scrollIntoViewIfNeeded();
    await originalPizza.waitForTimeout(300);
    await appPizza.waitForTimeout(300);
    await originalPizza.locator('.nb-add-btn--cust').first().click();
    await appPizza.locator('.nb-add-btn--cust').first().click();
    await originalPizza.waitForSelector('#ewcs-sheet.show', { timeout: 5000 });
    await appPizza.waitForSelector('#ewcs-sheet.show', { timeout: 5000 });
    // The original surfaces a validation error; the app disables the button.
    await originalPizza.locator('.ewcs-add').click({ force: true, timeout: 3000 }).catch(() => undefined);
    await appPizza.locator('.ewcs-add').click({ force: true, timeout: 3000 }).catch(() => undefined);
    await originalPizza.waitForTimeout(600);
    await appPizza.waitForTimeout(600);
    await capture('customization-error', originalPizza, appPizza, { probes: ['#ewcs-sheet', '.ewcs-error, .ewcs-grule .req'] });
    await originalPizza.close();
    await appPizza.close();
    await original.close();
    await app.close();
  }

  // ── Cart ────────────────────────────────────────────────────────────
  {
    const original = await mainContext.newPage();
    await original.route(originalApiRoute, mockApi);
    await original.goto(`http://127.0.0.1:${originalPort}/cart.html`, { waitUntil: 'domcontentloaded' });
    await original.waitForSelector('#coupon-card', { timeout: 20000 });
    await stripChrome(original);
    await original.waitForTimeout(700);
    const app = await mainContext.newPage();
    await app.goto(`http://127.0.0.1:${appPort}/#/cart?offers=none&unavailable=1`, { waitUntil: 'networkidle' });
    await app.waitForSelector('#coupon-card', { timeout: 20000 });
    await app.waitForTimeout(600);
    await capture('cart-items', original, app, {
      probes: [
        '#ct-dh-restaurant',
        '#ct-meal',
        '#ct-oi-row, .ct-oi-row',
        '#ct-sav-title',
        '#ct-bill, .ct-bill',
        '#ct-total-bill-row, .ct-total-row',
        '#ct-view-bill',
        '#ct-footer-save',
      ],
      note: 'cart with items + unavailable item',
    });

    const scrollCart = async (page: Page, selector: string, offset: number) => {
      await page.evaluate(
        ({ selector, offset }) => {
          const element = document.querySelector(selector);
          if (!element) return;
          const scroller = document.querySelector('.cart-page');
          const scrollable = scroller instanceof HTMLElement && scroller.scrollHeight > scroller.clientHeight + 4;
          const current = scrollable ? (scroller as HTMLElement).scrollTop : window.scrollY;
          const next = Math.max(0, current + element.getBoundingClientRect().top - 160 + offset);
          if (scrollable) (scroller as HTMLElement).scrollTop = next;
          else window.scrollTo(0, next);
        },
        { selector, offset },
      );
    };
    await scrollCart(original, '#ct-meal', -90);
    await scrollCart(app, '#ct-meal', -90);
    await original.waitForTimeout(350);
    await app.waitForTimeout(350);
    await capture('cart-scrolled', original, app, { probes: ['.ct-oi-row', '#ct-bill'] });

    for (const page of [original, app]) {
      await page.evaluate(() => {
        const scroller = document.querySelector('.cart-page');
        if (scroller instanceof HTMLElement) scroller.scrollTop = 0;
        else window.scrollTo(0, 0);
      });
    }
    await original.waitForTimeout(300);
    await app.waitForTimeout(300);

    // Coupon sheet (list + empty).
    await original.click('#coupon-card');
    await original.waitForSelector('#ct-coupon-sheet.is-open', { timeout: 5000 });
    await app.click('#coupon-card');
    await app.waitForSelector('#ct-coupon-sheet.is-open', { timeout: 5000 });
    await original.waitForTimeout(550);
    await app.waitForTimeout(550);
    await capture('cart-coupon-list', original, app, {
      probes: ['#ct-coupon-sheet', '.ct-coupon-card', '.ct-coupon-title, .ct-cp-title'],
    });
    await original.locator('#ct-coupon-sheet .ct-cook-x').click();
    await app.locator('#ct-coupon-sheet .ct-cook-x').click();
    await original.waitForTimeout(400);
    await app.waitForTimeout(400);

    // Cooking instructions sheet.
    await original.getByText('Cooking requests', { exact: true }).first().click();
    await app.getByText('Cooking requests', { exact: true }).first().click();
    await original.waitForSelector('#ct-note-sheet.is-open', { timeout: 5000 });
    await app.waitForSelector('#ct-note-sheet.is-open', { timeout: 5000 });
    await original.waitForTimeout(550);
    await app.waitForTimeout(550);
    await capture('cart-cooking-sheet', original, app, { probes: ['#ct-note-sheet', '#note-sheet-title'] });
    await original.locator('#ct-note-sheet .ct-cook-x').click();
    await app.locator('#ct-note-sheet .ct-cook-x').click();
    await original.waitForTimeout(400);
    await app.waitForTimeout(400);

    // Tip sheet.
    await original.evaluate(() => (window as unknown as { openSheet?: (id: string) => void }).openSheet?.('ct-tip-sheet'));
    await original.waitForSelector('#ct-tip-sheet.is-open', { timeout: 5000 });
    await app.click('#ct-view-bill');
    await app.waitForSelector('.ct-sheet-root.is-open', { timeout: 5000 });
    await app.getByRole('button', { name: 'Other' }).click();
    await app.waitForSelector('#ct-tip-sheet.is-open', { timeout: 5000 });
    await original.waitForTimeout(550);
    await app.waitForTimeout(550);
    await capture('cart-tip-sheet', original, app, { probes: ['#ct-tip-sheet', '#tip-sheet-title'] });
    for (const page of [original, app]) {
      await page.evaluate(() => {
        document.querySelector('#ct-tip-sheet')?.remove();
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
      });
    }
    await original.waitForTimeout(400);
    await app.waitForTimeout(400);

    await original.close();
    await app.close();
  }

  // ── Cart: payment sheet (fresh pages; the cart must be untouched) ────
  {
    const original = await mainContext.newPage();
    await original.route(originalApiRoute, mockApi);
    await original.goto(`http://127.0.0.1:${originalPort}/cart.html`, { waitUntil: 'domcontentloaded' });
    await original.waitForSelector('#coupon-card', { timeout: 20000 });
    await stripChrome(original);
    await original.waitForTimeout(600);
    /* The sheet is populated only when more than one method is eligible. The
       public-status mock leaves COD off, so `startPayment()` would place the
       order instead of opening the sheet; enable COD here so the original is
       driven through the same user path as the app (Proceed to Pay -> sheet).
       The quote mock also leaves the CTA locked, so unlock it for this state:
       the capture is about the sheet's design, not cart eligibility. */
    await original.evaluate(() => {
      const platform = (window as unknown as {
        EWPlatform?: { current: () => Record<string, unknown> };
      }).EWPlatform;
      if (platform) {
        const base = platform.current();
        platform.current = () => ({ ...base, isCodEnabled: true, isUpiEnabled: true, maxCodOrderAmount: 2000 });
      }
      const ct = window as unknown as { CtX?: { refreshPayment?: () => void; startPayment?: () => void } };
      ct.CtX?.refreshPayment?.();
      const button = document.getElementById('btn-checkout') as HTMLButtonElement | null;
      if (button) {
        button.classList.remove('locked');
        button.removeAttribute('disabled');
        button.setAttribute('aria-disabled', 'false');
      }
      ct.CtX?.startPayment?.();
    });
    await original.waitForSelector('#ct-pay-sheet.is-open', { timeout: 5000 });
    await original.waitForSelector('#ct-pay-sheet-opts .ct-pay-opt', { timeout: 5000 });
    const app = await mainContext.newPage();
    await app.goto(`http://127.0.0.1:${appPort}/#/cart?offers=none`, { waitUntil: 'networkidle' });
    await app.waitForSelector('#coupon-card', { timeout: 20000 });
    await app.waitForTimeout(500);
    await app.click('#btn-checkout');
    await app.waitForSelector('#ct-pay-sheet.is-open', { timeout: 5000 });
    await app.waitForSelector('#ct-pay-sheet-opts .ct-pay-opt', { timeout: 5000 });
    await original.waitForTimeout(500);
    await app.waitForTimeout(450);
    /* Both sheets auto-focus their close button; only the programmatically
       opened original then paints a :focus-visible ring, so clear focus on
       both to compare the resting design. */
    await original.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await app.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await capture('cart-payment-sheet', original, app, {
      probes: ['#ct-pay-sheet', '#pay-sheet-title', '#ct-pay-sheet-opts', '#ct-pay-confirm-btn', '.ct-sheet-x', '#btn-checkout'],
    });
    await original.close();
    await app.close();
  }

  // ── Cart: empty + offer popup + processing + placed ─────────────────
  {
    const context = await makeContext('emptycart');
    const original = await context.newPage();
    await original.route(originalApiRoute, mockApi);
    await original.goto(`http://127.0.0.1:${originalPort}/cart.html`, { waitUntil: 'domcontentloaded' });
    await original.waitForSelector('.ct-empty', { timeout: 20000 });
    await stripChrome(original);
    await original.evaluate(() => document.fonts.ready);
    await original.waitForTimeout(700);
    const app = await context.newPage();
    await app.goto(`http://127.0.0.1:${appPort}/#/cart?offers=none`, { waitUntil: 'networkidle' });
    await app.waitForSelector('.ct-empty', { timeout: 20000 });
    await app.evaluate(() => document.fonts.ready);
    await app.waitForTimeout(600);
    await capture('cart-empty', original, app, { probes: ['.ct-empty', '.ct-empty-title', '.ct-empty-sub'] });
    await context.close();
  }

  {
    const original = await mainContext.newPage();
    await original.route(originalApiRoute, mockApi);
    await original.goto(`http://127.0.0.1:${originalPort}/offer-popup-preview.html`, { waitUntil: 'domcontentloaded' });
    await original.click('#d-delivery');
    await original.waitForSelector('.ew-offer.is-open', { timeout: 5000 });
    const app = await mainContext.newPage();
    // The offer sheet closes itself after 5.2 s. `networkidle` can eat most of
    // that window, so the sheet sometimes vanished mid-capture. Neutralise long
    // timers on this page only; short open/close animations still run.
    await app.addInitScript(() => {
      const nativeSetTimeout = window.setTimeout.bind(window);
      (window as unknown as { setTimeout: typeof window.setTimeout }).setTimeout = ((
        handler: TimerHandler,
        timeout?: number,
        ...args: unknown[]
      ) => (typeof timeout === 'number' && timeout >= 4000 ? 0 : nativeSetTimeout(handler, timeout, ...args))) as typeof window.setTimeout;
    });
    await app.goto(`http://127.0.0.1:${appPort}/#/cart?offers=single`, { waitUntil: 'networkidle' });
    await app.waitForSelector('.ew-offer.is-open', { timeout: 7000 });
    await original.waitForTimeout(500);
    await app.waitForTimeout(500);
    await capture('offer-popup', original, app, { probes: ['.ew-offer', '.ew-offer-card, .ew-offer__card'] });
    await original.close();
    await app.close();
  }

  {
    const original = await mainContext.newPage();
    await original.route(originalApiRoute, mockApi);
    await original.goto(`http://127.0.0.1:${originalPort}/cart.html`, { waitUntil: 'domcontentloaded' });
    await original.waitForSelector('#coupon-card', { timeout: 20000 });
    await stripChrome(original);
    await original.addScriptTag({ path: path.join(originalDir, 'js/order-success-sheet.js') });
    await original.evaluate(() => {
      (window as unknown as { EWOrderSuccess?: { processing?: (o?: object) => void } }).EWOrderSuccess?.processing?.({
        title: 'Processing',
        message: 'Placing your order',
      });
    });
    await original.waitForSelector('.ew-os.is-open', { timeout: 5000 });
    await original.waitForTimeout(600);
    const app = await mainContext.newPage();
    await app.goto(`http://127.0.0.1:${appPort}/#/cart?offers=none&hold=1`, { waitUntil: 'networkidle' });
    await app.waitForSelector('#coupon-card', { timeout: 20000 });
    await app.getByRole('button', { name: 'Proceed to Pay' }).click();
    await app.waitForSelector('#ct-pay-confirm-btn', { timeout: 5000 });
    await app.click('#ct-pay-confirm-btn');
    await app.waitForSelector('.ew-os.is-open', { timeout: 5000 });
    await app.waitForTimeout(150);
    await capture('order-processing', original, app, { probes: ['.ew-os', '.ew-os__title, .ew-os-title'] });
    await original.close();

    const originalPlaced = await mainContext.newPage();
    await originalPlaced.route(originalApiRoute, mockApi);
    await originalPlaced.goto(`http://127.0.0.1:${originalPort}/cart.html`, { waitUntil: 'domcontentloaded' });
    await originalPlaced.waitForSelector('#coupon-card', { timeout: 20000 });
    await stripChrome(originalPlaced);
    await originalPlaced.addScriptTag({ path: path.join(originalDir, 'js/order-success-sheet.js') });
    await originalPlaced.evaluate(() => {
      (window as unknown as { EWOrderSuccess?: { show?: (o?: object) => void } }).EWOrderSuccess?.show?.({ autoMs: 0 });
    });
    await originalPlaced.waitForSelector('.ew-os.is-open', { timeout: 5000 });
    await originalPlaced.waitForTimeout(1000);
    await app.waitForTimeout(2400);
    await app.waitForSelector('.ew-os--done.is-open', { timeout: 5000 });
    await capture('order-placed', originalPlaced, app, { probes: ['.ew-os--done', '.ew-os__btn'] });
    await originalPlaced.close();
    await app.close();
  }

  // ── Orders / Tracking / Profile ─────────────────────────────────────
  {
    const original = await mainContext.newPage();
    await original.route(originalApiRoute, mockApi);
    await original.goto(`http://127.0.0.1:${originalPort}/orders.html`, { waitUntil: 'domcontentloaded' });
    await original.waitForSelector('#live-orders-container .order-card, #past-orders-container .order-card', { timeout: 20000 });
    await stripChrome(original);
    await original.evaluate(() => document.fonts.ready);
    await original.waitForTimeout(800);
    const app = await mainContext.newPage();
    await app.goto(`http://127.0.0.1:${appPort}/#/orders`, { waitUntil: 'networkidle' });
    await app.evaluate(() => localStorage.removeItem('nearbite_orders'));
    await app.reload({ waitUntil: 'networkidle' });
    await app.waitForSelector('.orders-page .order-card', { timeout: 20000 });
    await app.evaluate(() => document.fonts.ready);
    await app.waitForTimeout(700);
    await capture('orders', original, app, {
      probes: ['.order-card', '.order-card-title, .order-res-name', '.order-status, .order-badge', '.orders-tabs'],
    });
    await original.close();
    await app.close();
  }

  {
    const original = await mainContext.newPage();
    await original.route(originalApiRoute, mockApi);
    await original.goto(`http://127.0.0.1:${originalPort}/track-order.html?id=NAV-240318`, { waitUntil: 'domcontentloaded' });
    await original.waitForSelector('#status-title', { timeout: 20000 });
    await original.waitForFunction(() => !document.querySelector('#status-title')?.textContent?.includes('Loading'), { timeout: 20000 });
    await stripChrome(original);
    await original.evaluate(() => document.fonts.ready);
    await original.waitForTimeout(1000);
    const app = await mainContext.newPage();
    await app.goto(`http://127.0.0.1:${appPort}/#/track/NAV-240318`, { waitUntil: 'networkidle' });
    await app.waitForSelector('.track-page', { timeout: 20000 });
    await app.evaluate(() => document.fonts.ready);
    await app.waitForTimeout(900);
    await capture('tracking', original, app, {
      probes: ['#status-title, .status-title', '.track-map, #map, .map-wrap', '.rider-card', '.track-steps, .steps'],
    });
    await original.close();
    await app.close();
  }

  {
    const original = await mainContext.newPage();
    await original.route(originalApiRoute, mockApi);
    await original.goto(`http://127.0.0.1:${originalPort}/profile.html`, { waitUntil: 'domcontentloaded' });
    await original.waitForSelector('#userName', { timeout: 20000 });
    await original.waitForTimeout(1200);
    await stripChrome(original);
    await original.evaluate(() => document.fonts.ready);
    await original.waitForTimeout(500);
    const app = await mainContext.newPage();
    await app.goto(`http://127.0.0.1:${appPort}/#/profile`, { waitUntil: 'networkidle' });
    await app.waitForSelector('.profile-page', { timeout: 20000 });
    await app.evaluate(() => document.fonts.ready);
    await app.waitForTimeout(700);
    await capture('profile', original, app, {
      probes: ['#userName', '.profile-card, .pf-card', '.pf-row, .profile-row', '.pf-avatar, .profile-avatar'],
    });
    await original.close();
    await app.close();
  }

  await mainContext.close();
  await browser.close();
  await new Promise<void>((resolve) => originalServer.close(() => resolve()));
  previewServer.httpServer.close();

  await fs.writeFile(path.join(outRoot, 'report.json'), JSON.stringify(results, null, 2));
  console.log('\n| screen/state | diff % (raw) | probe differences |');
  console.log('| --- | --- | --- |');
  for (const entry of results) {
    const detail = entry.probes.map((p) => `${p.selector}: ${p.diff.join(', ')}`).join('; ') || '—';
    console.log(`| ${entry.name} | ${entry.diffPct}% (${entry.diffPctRaw}%) | ${detail} |`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
