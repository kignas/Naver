import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { preview } from 'vite';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const outDir = path.join(repoRoot, 'verify', 'item10b');
const base = 'http://127.0.0.1:4176';
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
    const active = document.querySelector('.nav-tab.is-active');
    const indicator = document.querySelector('.nav-indicator');
    const label = active?.querySelector('.nav-label');
    const navRect = nav?.getBoundingClientRect();
    const activeRect = active?.getBoundingClientRect();
    const indicatorRect = indicator?.getBoundingClientRect();
    return {
      hash: location.hash,
      navClass: nav?.className ?? '',
      navRect: navRect ? { x: navRect.x, y: navRect.y, width: navRect.width, height: navRect.height, bottom: innerHeight - navRect.bottom } : null,
      navStyle: nav ? { background: getComputedStyle(nav).backgroundColor, radius: getComputedStyle(nav).borderRadius, opacity: getComputedStyle(nav).opacity, z: getComputedStyle(nav).zIndex } : null,
      active: active?.getAttribute('data-nav-item') ?? '',
      activeLabel: label?.textContent ?? '',
      activeLabelWidth: label?.getBoundingClientRect().width ?? 0,
      activeLabelScrollWidth: label?.scrollWidth ?? 0,
      activeTabWidth: activeRect?.width ?? 0,
      indicator: indicatorRect ? { x: indicatorRect.x, y: indicatorRect.y, width: indicatorRect.width, height: indicatorRect.height, background: getComputedStyle(indicator).backgroundColor, transform: getComputedStyle(indicator).transform } : null,
      sameNode: window.__navNode === nav,
    };
  });
}

const server = await preview({
  root: appRoot,
  preview: { host: '127.0.0.1', port: 4176, strictPort: true },
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
  });

  const shots = {};
  const scrollerByPage = { home: '.home-scroll', under99: '.u99-scroll', orders: '.orders-page', profile: '.profile-page' };
  const capture = async (name) => {
    const state = await navState(page);
    if (scrollerByPage[name]) {
      state.paddingBottom = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).paddingBottom : null;
      }, scrollerByPage[name]);
    }
    shots[name] = state;
    await page.screenshot({ path: path.join(outDir, `${name}.png`) });
    check(`${name}: nav visible`, state.navClass.includes('is-visible') && state.navStyle?.opacity === '1');
    const expected = { home: '/', under99: '/under99', search: '/search', orders: '/orders', profile: '/profile' };
    check(`${name}: active label`, state.active === expected[name], state.activeLabel);
    check(`${name}: nav node preserved`, state.sameNode);
    check(`${name}: pill color`, state.indicator?.background === 'rgb(93, 13, 24)', state.indicator?.background);
    check(`${name}: label not clipped`, state.activeLabelWidth > 0 && state.activeLabelScrollWidth <= state.activeLabelWidth + 1, `${state.activeLabelScrollWidth}/${state.activeLabelWidth}`);
    return state;
  };

  const home = await capture('home');
  check('home: 5 tabs fit', home.navRect.width > 300, `${home.navRect.width}px`);
  check('home: nav above route/sheet layers', Number(home.navStyle.z) >= 2000, home.navStyle.z);
  check('home: floating geometry', home.navRect.height === 62 && home.navRect.bottom === 12 && home.navStyle.radius === '999px', JSON.stringify(home.navRect));
  check('home: indicator over Home', home.active === '/' && home.indicator.x >= home.navRect.x - 20 && home.indicator.x + home.indicator.width <= home.navRect.x + home.navRect.width + 20);

  await page.click('[data-nav-item="/under99"]');
  await sleep(550);
  await capture('under99');

  await page.click('[data-nav-item="/search"]');
  await sleep(550);
  const search = await capture('search');
  const overlay = await page.evaluate(() => {
    const root = document.querySelector('.ew-search-root');
    return { open: root?.classList.contains('is-open') ?? false, z: root ? Number(getComputedStyle(root).zIndex) : 0 };
  });
  check('search: overlay open', overlay.open);
  check('search: nav above scrim', overlay.z > 0 && Number(search.navStyle.z) > overlay.z, `${search.navStyle.z} > ${overlay.z}`);
  check('search: Search tab active', search.active === '/search');

  await page.click('[data-nav-item="/search"]');
  await sleep(350);
  await page.click('[data-nav-item="/orders"]');
  await sleep(550);
  await capture('orders');

  await page.click('[data-nav-item="/profile"]');
  await sleep(550);
  await capture('profile');

  const padding = Object.fromEntries(
    ['home', 'under99', 'orders', 'profile'].map((name) => [name, shots[name]?.paddingBottom ?? null]),
  );
  check('tab pages reserve nav height', Object.values(padding).every((value) => value && parseFloat(value) >= 86), JSON.stringify(padding));

  // A sheet opened from a tab page must keep its footer actions above the nav.
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
    return { navTop: nav.getBoundingClientRect().top, buttonBottom: Math.max(...buttons), padding: getComputedStyle(footer).paddingBottom };
  });
  check('filter sheet: actions clear nav', Boolean(sheet) && sheet.buttonBottom <= sheet.navTop, JSON.stringify(sheet));
  await sheetPage.screenshot({ path: path.join(outDir, 'filter-sheet.png') });
  await sheetPage.close();

  // Hidden-nav routes.
  for (const [name, hash] of [['restaurant', '/restaurant/1'], ['cart', '/cart'], ['category', '/category/Pizza']]) {
    const routePage = await context.newPage();
    await routePage.goto(`${base}/#${hash}`, { waitUntil: 'networkidle' });
    await sleep(900);
    const state = await navState(routePage);
    const rendered = await routePage.evaluate(() => document.body.innerText.trim().length);
    check(`${name}: route rendered`, rendered > 80, `${rendered} chars`);
    check(`${name}: nav hidden`, state.navClass.includes('is-hidden') && state.navStyle.opacity === '0', state.navClass);
    await routePage.screenshot({ path: path.join(outDir, `hidden-${name}.png`) });
    await routePage.close();
  }

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

  // Fit checks at 360 and 430 with the widest label active.
  for (const size of [{ width: 360, height: 800 }, { width: 430, height: 900 }]) {
    const fitContext = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: true, hasTouch: true });
    await seed(fitContext);
    const fitPage = await fitContext.newPage();
    await fitPage.goto(`${base}/#/under99`, { waitUntil: 'networkidle' });
    await sleep(700);
    const state = await navState(fitPage);
    check(`fit ${size.width}: nav inside viewport`, state.navRect.x >= 11 && state.navRect.x + state.navRect.width <= size.width - 11, JSON.stringify(state.navRect));
    check(`fit ${size.width}: active label fits`, state.activeLabelWidth > 0 && state.activeLabelScrollWidth <= state.activeLabelWidth + 1, `${state.activeLabelScrollWidth}/${state.activeLabelWidth}`);
    await fitPage.screenshot({ path: path.join(outDir, `fit-${size.width}x${size.height}.png`) });
    await fitContext.close();
  }

  // Drag the indicator from Home to Orders.
  const dragContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await seed(dragContext);
  const dragPage = await dragContext.newPage();
  await dragPage.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await sleep(700);
  const centers = await dragPage.locator('.nav-tab').evaluateAll((tabs) =>
    tabs.map((tab) => {
      const rect = tab.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }),
  );
  await dragPage.mouse.move(centers[0].x, centers[0].y);
  await dragPage.mouse.down();
  await dragPage.mouse.move(centers[3].x, centers[3].y, { steps: 10 });
  await sleep(60);
  await dragPage.screenshot({ path: path.join(outDir, 'drag-mid.png') });
  await dragPage.mouse.up();
  await sleep(650);
  const dragState = await navState(dragPage);
  check('drag: lands on Orders', dragState.hash === '#/orders' && dragState.active === '/orders', `${dragState.hash} ${dragState.active}`);
  await dragPage.screenshot({ path: path.join(outDir, 'drag-end.png') });
  await dragContext.close();

  // Six-frame indicator strip: Home -> Orders.
  const stripContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await seed(stripContext);
  const stripPage = await stripContext.newPage();
  await stripPage.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await sleep(800);
  const navBox = await stripPage.locator('.bottom-nav').boundingBox();
  const grabFrame = async () => {
    const png = PNG.sync.read(await stripPage.screenshot({ type: 'png' }));
    const cropY = Math.max(0, Math.floor((navBox?.y ?? 770) - 8));
    const cropHeight = Math.min(png.height - cropY, 96);
    return scale(crop(png, 0, cropY, png.width, cropHeight), 0.65);
  };
  const frames = [await grabFrame()];
  await stripPage.evaluate(() => document.querySelector('[data-nav-item="/orders"]')?.click());
  await stripPage.waitForFunction(
    () => document.querySelector('.nav-tab.is-active')?.getAttribute('data-nav-item') === '/orders',
    { timeout: 3000 },
  );
  for (let index = 1; index < 6; index += 1) {
    await sleep(45);
    frames.push(await grabFrame());
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
  report.strip = 'verify/item10b/nav-slide-strip.png';
  await stripContext.close();

  report.screens = shots;
  report.padding = padding;
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
