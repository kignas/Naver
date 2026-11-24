import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { preview } from 'vite';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const outDir = path.join(repoRoot, 'verify', 'item12a');
const base = 'http://127.0.0.1:4177';
const NAV_RESERVE = 86;
const PILL = 'rgb(31, 31, 35)';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];

function check(name, condition, detail = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

function crop(source, x, y, width, height) {
  const out = new PNG({ width, height });
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const src = ((y + row) * source.width + x + col) * 4;
      const dst = (row * width + col) * 4;
      out.data[dst] = source.data[src];
      out.data[dst + 1] = source.data[src + 1];
      out.data[dst + 2] = source.data[src + 2];
      out.data[dst + 3] = source.data[src + 3];
    }
  }
  return out;
}

function scale(source, factor) {
  const width = Math.max(1, Math.round(source.width * factor));
  const height = Math.max(1, Math.round(source.height * factor));
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(source.width - 1, Math.floor(x / factor));
      const sy = Math.min(source.height - 1, Math.floor(y / factor));
      const src = (sy * source.width + sx) * 4;
      const dst = (y * width + x) * 4;
      out.data[dst] = source.data[src];
      out.data[dst + 1] = source.data[src + 1];
      out.data[dst + 2] = source.data[src + 2];
      out.data[dst + 3] = source.data[src + 3];
    }
  }
  return out;
}

async function seed(context, auth = true) {
  await context.addInitScript(({ auth }) => {
    localStorage.clear();
    sessionStorage.clear();
    if (auth) {
      localStorage.setItem('nearbite_token', 'demo-token');
      localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Aarav', phone: '+91 98765 43210', email: 'demo@navereat.app' }));
    }
    sessionStorage.setItem('ew_offers_seen_v1', '["demo"]');
  }, { auth });
}

async function navState(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const tabs = Array.from(document.querySelectorAll('.nav-tab'));
    const active = document.querySelector('.nav-tab.is-active');
    const indicator = document.querySelector('.nav-indicator');
    const label = active?.querySelector('.nav-label');
    const navRect = nav?.getBoundingClientRect();
    const indicatorRect = indicator?.getBoundingClientRect();
    const box = (rect) => (rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: innerHeight - rect.bottom } : null);
    return {
      hash: location.hash,
      navClass: nav?.className ?? '',
      navRect: box(navRect),
      navStyle: nav
        ? {
            background: getComputedStyle(nav).backgroundColor,
            radius: getComputedStyle(nav).borderRadius,
            border: getComputedStyle(nav).borderTopWidth,
            shadow: getComputedStyle(nav).boxShadow !== 'none',
            opacity: getComputedStyle(nav).opacity,
            z: getComputedStyle(nav).zIndex,
          }
        : null,
      tabs: tabs.map((tab) => ({
        item: tab.getAttribute('data-nav-item'),
        label: tab.querySelector('.nav-label')?.textContent ?? '',
        active: tab.classList.contains('is-active'),
        rect: box(tab.getBoundingClientRect()),
        labelWidth: tab.querySelector('.nav-label')?.getBoundingClientRect().width ?? 0,
        labelScrollWidth: tab.querySelector('.nav-label')?.scrollWidth ?? 0,
        icon: Boolean(tab.querySelector('svg')),
      })),
      active: active?.getAttribute('data-nav-item') ?? '',
      activeLabel: label?.textContent ?? '',
      activeColor: active ? getComputedStyle(active).color : '',
      indicator: indicatorRect
        ? {
            ...box(indicatorRect),
            background: getComputedStyle(indicator).backgroundColor,
            transform: getComputedStyle(indicator).transform,
          }
        : null,
      sameNode: window.__navNode === nav,
      bodyHasNav: document.body.classList.contains('has-bottom-nav'),
    };
  });
}

const server = await preview({
  root: appRoot,
  preview: { host: '127.0.0.1', port: 4177, strictPort: true },
});
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const report = {};

try {
  await mkdir(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await seed(context);
  const page = await context.newPage();
  await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.bottom-nav');
  await sleep(800);
  await page.evaluate(() => {
    window.__navNode = document.querySelector('.bottom-nav');
    window.__homeNode = document.querySelector('.home-screen');
    window.__ordersNode = document.querySelector('.orders-page');
  });

  const shots = {};
  const capture = async (name, scroller) => {
    const state = await navState(page);
    if (scroller) {
      state.paddingBottom = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).paddingBottom : null;
      }, scroller);
    }
    shots[name] = state;
    await page.screenshot({ path: path.join(outDir, `${name}.png`) });
    return state;
  };

  // 1. Home: two tabs, dark pill on the active tab.
  const home = await capture('home', '.home-scroll');
  check('home: exactly two tabs', home.tabs.length === 2, home.tabs.map((tab) => tab.item).join(','));
  check('home: labels are Home and History', home.tabs[0]?.label === 'Home' && home.tabs[1]?.label === 'History', home.tabs.map((tab) => tab.label).join('/'));
  check('home: every tab shows icon and label', home.tabs.every((tab) => tab.icon && tab.label.length > 0));
  check('home: nav visible', home.navClass.includes('is-visible') && home.navStyle?.opacity === '1' && home.bodyHasNav);
  check('home: active is Home', home.active === '/', home.active);
  check('home: pill colour', home.indicator?.background === PILL, home.indicator?.background);
  check('home: active label is white', home.activeColor === 'rgb(255, 255, 255)', home.activeColor);
  check('home: pill covers the active tab', Math.abs(home.indicator.x - home.tabs[0].rect.x) <= 1 && Math.abs(home.indicator.width - home.tabs[0].rect.width) <= 1, `${JSON.stringify(home.indicator)} vs ${JSON.stringify(home.tabs[0].rect)}`);
  check('home: white surface, hairline, full radius', home.navStyle?.background === 'rgb(255, 255, 255)' && parseFloat(home.navStyle.border) === 1 && home.navStyle.radius === '999px' && home.navStyle.shadow, JSON.stringify(home.navStyle));
  check('home: floating geometry', home.navRect.height === 62 && home.navRect.bottom === 12 && home.navRect.x === 14, JSON.stringify(home.navRect));
  check('home: nav above route/sheet layers', Number(home.navStyle.z) >= 2000, home.navStyle.z);
  check('home: tab touch targets >= 44px', home.tabs.every((tab) => tab.rect.height >= 44), home.tabs.map((tab) => tab.rect.height).join('/'));
  check('home: labels are not clipped', home.tabs.every((tab) => tab.labelWidth > 0 && tab.labelScrollWidth <= tab.labelWidth + 1), home.tabs.map((tab) => `${tab.labelScrollWidth}/${tab.labelWidth}`).join(' '));
  check('home: reserves nav height', parseFloat(home.paddingBottom) >= NAV_RESERVE, home.paddingBottom);
  check('home: nav node preserved', home.sameNode);

  // 2. History.
  await page.click('[data-nav-item="/orders"]');
  await sleep(550);
  const history = await capture('history', '.orders-page');
  check('history: active is History', history.active === '/orders' && history.activeLabel === 'History', `${history.active} ${history.activeLabel}`);
  check('history: pill moved to History', Math.abs(history.indicator.x - history.tabs[1].rect.x) <= 1 && Math.abs(history.indicator.width - history.tabs[1].rect.width) <= 1, JSON.stringify(history.indicator));
  check('history: pill colour', history.indicator?.background === PILL, history.indicator?.background);
  check('history: reserves nav height', parseFloat(history.paddingBottom) >= NAV_RESERVE, history.paddingBottom);
  check('history: nav node preserved', history.sameNode);
  const mounted = await page.evaluate(() => ({
    home: window.__homeNode === document.querySelector('.home-screen'),
    orders: window.__ordersNode === document.querySelector('.orders-page'),
  }));
  check('tabs: layers stay mounted', mounted.home && mounted.orders, JSON.stringify(mounted));

  // 3. Indicator slide strip (History -> Home) with mid-flight positions.
  const navBox = await page.locator('.bottom-nav').boundingBox();
  const grabFrame = async () => {
    const png = PNG.sync.read(await page.screenshot({ type: 'png' }));
    const cropY = Math.max(0, Math.floor((navBox?.y ?? 770) - 8));
    const cropHeight = Math.min(png.height - cropY, 96);
    return scale(crop(png, 0, cropY, png.width, cropHeight), 0.65);
  };
  const pillStart = history.indicator.x;
  const frames = [await grabFrame()];
  await page.evaluate(() => document.querySelector('[data-nav-item="/"]')?.click());
  await page.waitForFunction(
    () => document.querySelector('.nav-tab.is-active')?.getAttribute('data-nav-item') === '/',
    { timeout: 3000 },
  );
  const midFlight = [];
  for (let index = 1; index < 6; index += 1) {
    midFlight.push(await page.evaluate(() => document.querySelector('.nav-indicator')?.getBoundingClientRect().x ?? -1));
    frames.push(await grabFrame());
    await sleep(45);
  }
  for (let index = 0; index < frames.length; index += 1) {
    await writeFile(path.join(outDir, `slide-frame-${index + 1}.png`), PNG.sync.write(frames[index]));
  }
  const strip = new PNG({ width: frames.reduce((sum, frame) => sum + frame.width, 0), height: Math.max(...frames.map((frame) => frame.height)) });
  let offsetX = 0;
  frames.forEach((frame) => {
    for (let y = 0; y < frame.height; y += 1) {
      for (let x = 0; x < frame.width; x += 1) {
        const src = (y * frame.width + x) * 4;
        const dst = (y * strip.width + offsetX + x) * 4;
        strip.data[dst] = frame.data[src];
        strip.data[dst + 1] = frame.data[src + 1];
        strip.data[dst + 2] = frame.data[src + 2];
        strip.data[dst + 3] = frame.data[src + 3];
      }
    }
    offsetX += frame.width;
  });
  await writeFile(path.join(outDir, 'nav-slide-strip.png'), PNG.sync.write(strip));
  report.frames = frames.length;
  report.strip = 'verify/item12a/nav-slide-strip.png';
  report.midFlight = midFlight;
  check('slide: indicator travels between tabs', midFlight.some((x) => Math.abs(x - pillStart) > 4), midFlight.map((x) => Math.round(x)).join(','));
  await sleep(450);

  // 4. Search overlay hides the bar; closing restores it.
  await page.locator('.search-box').first().click();
  await sleep(600);
  const duringSearch = await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const root = document.querySelector('.ew-search-root');
    return { cls: nav?.className ?? '', opacity: nav ? getComputedStyle(nav).opacity : null, open: root?.classList.contains('is-open') ?? false };
  });
  check('search: overlay open', duringSearch.open);
  check('search: nav hidden under the overlay', duringSearch.cls.includes('is-hidden') && duringSearch.opacity === '0', JSON.stringify(duringSearch));
  await page.screenshot({ path: path.join(outDir, 'search-open.png') });
  await page.keyboard.press('Escape');
  await sleep(500);
  const afterSearch = await navState(page);
  check('search: nav back after close', afterSearch.navClass.includes('is-visible') && afterSearch.active === '/', `${afterSearch.navClass} ${afterSearch.active}`);

  // 5. Pushed pages: nav hidden, back arrow returns Home.
  const pushed = [
    { name: 'under99', open: () => page.locator('.btn-store').first().click(), back: '.u99-circle-btn[aria-label="Back"]', wait: '.u99-page' },
    { name: 'profile', open: () => page.locator('.btn-profile').first().click(), back: '.profile-page .icon-btn.back', wait: '.profile-page' },
  ];
  for (const route of pushed) {
    await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
    await sleep(700);
    await route.open();
    await page.waitForSelector(route.wait, { timeout: 4000 });
    await sleep(650);
    const state = await capture(`pushed-${route.name}`);
    check(`${route.name}: nav hidden`, state.navClass.includes('is-hidden') && state.navStyle?.opacity === '0', state.navClass);
    check(`${route.name}: body no longer reserves nav`, !state.bodyHasNav);
    const arrow = page.locator(route.back).first();
    check(`${route.name}: back arrow visible`, await arrow.isVisible(), route.back);
    const arrowBox = await arrow.boundingBox();
    check(`${route.name}: back arrow touch target`, Boolean(arrowBox) && arrowBox.width >= 32 && arrowBox.height >= 32, JSON.stringify(arrowBox));
    await arrow.click();
    await sleep(650);
    const restored = await navState(page);
    check(`${route.name}: back returns Home`, restored.hash === '#/' || restored.hash === '', restored.hash);
    check(`${route.name}: nav returns`, restored.navClass.includes('is-visible') && restored.active === '/', `${restored.navClass} ${restored.active}`);
  }

  const categoryPage = await context.newPage();
  await categoryPage.goto(`${base}/#/category/Pizza`, { waitUntil: 'networkidle' });
  await sleep(900);
  const category = await navState(categoryPage);
  check('category: nav hidden', category.navClass.includes('is-hidden') && category.navStyle?.opacity === '0', category.navClass);
  check('category: back arrow present', await categoryPage.locator('.cat-back').first().isVisible());
  await categoryPage.screenshot({ path: path.join(outDir, 'pushed-category.png') });
  await categoryPage.close();

  for (const [name, hash] of [['restaurant', '/restaurant/1'], ['cart', '/cart']]) {
    const routePage = await context.newPage();
    await routePage.goto(`${base}/#${hash}`, { waitUntil: 'networkidle' });
    await sleep(900);
    const state = await navState(routePage);
    check(`${name}: nav hidden`, state.navClass.includes('is-hidden') && state.navStyle?.opacity === '0', state.navClass);
    await routePage.screenshot({ path: path.join(outDir, `hidden-${name}.png`) });
    await routePage.close();
  }

  // 6. Filter sheet keeps its actions above the nav.
  const sheetPage = await context.newPage();
  await sheetPage.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await sleep(700);
  await sheetPage.locator('.filter-pill').first().click();
  await sleep(450);
  const sheet = await sheetPage.evaluate(() => {
    const footer = document.querySelector('.sheet-footer');
    const nav = document.querySelector('.bottom-nav');
    if (!footer || !nav) return null;
    const buttons = Array.from(footer.querySelectorAll('button')).map((button) => button.getBoundingClientRect().bottom);
    return { navTop: nav.getBoundingClientRect().top, buttonBottom: Math.max(...buttons) };
  });
  check('filter sheet: actions clear nav', Boolean(sheet) && sheet.buttonBottom <= sheet.navTop, JSON.stringify(sheet));
  await sheetPage.screenshot({ path: path.join(outDir, 'filter-sheet.png') });
  await sheetPage.close();

  const loginContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await seed(loginContext, false);
  const loginPage = await loginContext.newPage();
  await loginPage.goto(`${base}/#/login`, { waitUntil: 'networkidle' });
  await sleep(700);
  const loginState = await loginPage.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    return { cls: nav?.className ?? '', opacity: nav ? getComputedStyle(nav).opacity : null };
  });
  check('login: nav hidden', loginState.cls.includes('is-hidden') && loginState.opacity === '0', JSON.stringify(loginState));
  await loginPage.screenshot({ path: path.join(outDir, 'hidden-login.png') });
  await loginContext.close();

  // 7. Fit at 360 / 390 / 430.
  for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 900 }]) {
    const fitContext = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: true, hasTouch: true });
    await seed(fitContext);
    const fitPage = await fitContext.newPage();
    await fitPage.goto(`${base}/#/orders`, { waitUntil: 'networkidle' });
    await sleep(900);
    const state = await navState(fitPage);
    check(`fit ${size.width}: nav inside viewport`, state.navRect.x >= 11 && state.navRect.x + state.navRect.width <= size.width - 11, JSON.stringify(state.navRect));
    check(`fit ${size.width}: both labels fit`, state.tabs.length === 2 && state.tabs.every((tab) => tab.labelWidth > 0 && tab.labelScrollWidth <= tab.labelWidth + 1), state.tabs.map((tab) => `${tab.labelScrollWidth}/${tab.labelWidth}`).join(' '));
    check(`fit ${size.width}: pill on History`, Math.abs(state.indicator.x - state.tabs[1].rect.x) <= 1, `${state.indicator.x} vs ${state.tabs[1].rect.x}`);
    await fitPage.screenshot({ path: path.join(outDir, `fit-${size.width}x${size.height}.png`) });
    await fitContext.close();
  }

  // 8. Drag the pill from History to Home.
  const dragContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await seed(dragContext);
  const dragPage = await dragContext.newPage();
  await dragPage.goto(`${base}/#/orders`, { waitUntil: 'networkidle' });
  await sleep(800);
  const centers = await dragPage.locator('.nav-tab').evaluateAll((tabs) =>
    tabs.map((tab) => {
      const rect = tab.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }),
  );
  await dragPage.mouse.move(centers[1].x, centers[1].y);
  await dragPage.mouse.down();
  await dragPage.mouse.move(centers[0].x, centers[0].y, { steps: 10 });
  await sleep(60);
  await dragPage.screenshot({ path: path.join(outDir, 'drag-mid.png') });
  await dragPage.mouse.up();
  await sleep(650);
  const dragState = await navState(dragPage);
  check('drag: lands on Home', (dragState.hash === '#/' || dragState.hash === '') && dragState.active === '/', `${dragState.hash} ${dragState.active}`);
  await dragPage.screenshot({ path: path.join(outDir, 'drag-end.png') });
  await dragContext.close();

  report.screens = shots;
  report.failures = failures;
  await writeFile(path.join(outDir, 'nav-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (failures.length) {
    console.error(`\n${failures.length} nav check failure(s)`);
    process.exitCode = 1;
  } else {
    console.log('\nAll floating-nav checks passed.');
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(() => resolve()));
}
