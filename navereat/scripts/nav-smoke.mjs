/**
 * End-to-end navigation smoke test: every card, tab, badge and route.
 *
 *   npm run nav-smoke
 *
 * Serves the production build against the demo data, taps every entry point
 * (restaurant card, UNDER 99 pill, hero CTA, search bar, profile, History tab,
 * cart pill, category tile, deep links) and asserts that each target renders
 * its full UI, pops back cleanly, keeps the bottom-nav pill animation alive,
 * runs the page slide, and produces zero page errors / console errors.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const outDir = path.join(repoRoot, 'verify', 'nav-smoke');
const base = 'http://127.0.0.1:4179';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];

function check(name, condition, detail = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

const SEED_SESSION = () => {
  localStorage.setItem('nearbite_token', 'demo-token');
  localStorage.setItem('token', 'demo-token');
  localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Sagnik', phone: '+91 98765 43210', email: 'demo@navereat.app' }));
  localStorage.setItem(
    'nearbite_address',
    JSON.stringify({ tag: 'Home', house: 'Demo Street', area: 'Demo City', city: 'Demo City', pincode: '735101' }),
  );
  localStorage.setItem('eatswada_theme', 'light');
  localStorage.setItem('eatswada_header_theme', 'raspberry');
  sessionStorage.setItem('ew_offers_seen_v1', '["demo"]');
};

await mkdir(outDir, { recursive: true });
const server = await preview({ root: appRoot, logLevel: 'error', preview: { host: '127.0.0.1', port: 4179, strictPort: true } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await context.addInitScript(SEED_SESSION);
const page = await context.newPage();

const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});

const state = () =>
  page.evaluate(() => {
    // The active tab cache stays mounted (and sized) underneath a detail page,
    // so "what is on screen" is the top pushed layer, or the active tab when
    // nothing is pushed on top of it.
    const pushed = document.querySelector('.route-layer.is-top:not(.route-tab-cache)');
    const activeTab = document.querySelector('.route-tab-cache.is-active');
    const surface = pushed ?? activeTab;
    const shown = (selector) => {
      const node = surface ? surface.querySelector(selector) : null;
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const errorCard = [...document.querySelectorAll('[data-route-error]')].some((node) => {
      if (!surface || !surface.contains(node)) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== 'hidden';
    });
    // The route stylesheets are injected raw and switched with `media`, so a
    // sheet that is off (or a surface that never got one) renders the page with
    // no styles at all: metadata stacks and bare SVGs fill the viewport.
    const SHEET = {
      'home-screen': 'navereatHome',
      'orders-page': 'navereatOrders',
      'rest-page': 'navereatRestaurant',
      'cart-page': 'navereatCart',
      'u99-page': 'navereatUnder99',
      'profile-page': 'navereatProfile',
      'track-page': 'navereatTrack',
      'login-page': 'navereatLogin',
      'cat-page': 'navereatCategory',
    };
    const surfacePage = [...(surface?.querySelectorAll('*') ?? [])].find((node) => [...node.classList].some((name) => SHEET[name]));
    const pageClass = surfacePage ? [...surfacePage.classList].find((name) => SHEET[name]) : null;
    const sheetKey = pageClass ? SHEET[pageClass] : null;
    const sheet = sheetKey
      ? [...document.querySelectorAll('style')].find((node) => node.dataset[sheetKey] === 'true')
      : null;
    // A stylesheet-less page blows every inline SVG up to the container width.
    // The verified badge and the rider illustration are the two that made it
    // visible, so they carry an explicit intrinsic size of their own.
    const iconBox = (selector) => {
      const node = surface?.querySelector(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { w: Math.round(rect.width), h: Math.round(rect.height) };
    };
    const verified = iconBox('.ew-verified');
    const rider = iconBox('#delivery-rider-fallback');
    const oversizedIcons =
      (verified && (verified.w > 40 || verified.h > 40) ? 1 : 0) +
      (rider && (rider.w > 130 || rider.h > 70) ? 1 : 0);
    return {
      hash: location.hash,
      covered: Boolean(pushed),
      home: !pushed && activeTab?.getAttribute('data-route') === '/' && shown('.home-screen'),
      hero: shown('#hero-banner-region'),
      restaurant: shown('.rest-page'),
      under99: shown('.u99-page'),
      cart: shown('.cart-page'),
      orders: shown('.orders-page'),
      track: shown('.track-page'),
      profile: shown('.profile-page'),
      category: shown('.cat-page'),
      login: shown('.login-page'),
      search: Boolean(document.querySelector('.ew-search-sheet')),
      nav: shown('.bottom-nav') || Boolean(document.querySelector('.bottom-nav')),
      navTabs: document.querySelectorAll('.bottom-nav .nav-tab').length,
      errorCard,
      title: (surface?.querySelector('#restaurants-title') ?? document.querySelector('#restaurants-title'))?.textContent ?? null,
      sheet: pageClass,
      sheetOn: sheet ? sheet.media === 'all' : null,
      verified,
      rider,
      oversizedIcons,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

const tap = async (selector, timeout = 15000) => {
  const target = page.locator(selector).first();
  await target.waitFor({ state: 'visible', timeout });
  await target.tap();
};

const waitFor = async (predicate, label, timeout = 8000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const snapshot = await state();
    if (predicate(snapshot)) return snapshot;
    await sleep(120);
  }
  throw new Error(`${label}: timed out after ${timeout} ms (hash=${await page.evaluate(() => location.hash)})`);
};

const backToHome = async (label) => {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const snapshot = await state();
    if (snapshot.home && !snapshot.errorCard) return;
    const button = page.locator('.route-layer.is-top .ew-hd-back, .route-layer.is-top .ct-dh-back, .route-layer.is-top .cat-back, .route-layer.is-top .icon-btn.back').first();
    if (await button.count()) {
      await button.tap().catch(() => {});
    } else {
      await page.evaluate(() => history.back());
    }
    await sleep(260);
  }
  throw new Error(`${label}: could not get back to Home`);
};

/**
 * A route's stylesheet is injected raw and toggled with `media`, so a page can
 * render with no styles at all: metadata stacks and bare SVGs fill the width.
 * Every surface must have its own sheet on, no oversized SVG and no overflow.
 */
const audit = (label, snapshot) => {
  check(`${label}: its route stylesheet is applied`, snapshot.sheetOn === true, `${snapshot.sheet}=${snapshot.sheetOn}`);
  check(
    `${label}: badge and rider art keep their size`,
    snapshot.oversizedIcons === 0,
    `verified=${JSON.stringify(snapshot.verified)} rider=${JSON.stringify(snapshot.rider)}`,
  );
  check(`${label}: no horizontal overflow`, snapshot.overflow === 0, `${snapshot.overflow}px`);
};

const navTo = async (path) => {
  await page.evaluate((target) => {
    location.hash = target;
  }, path);
  await sleep(500);
};

try {
  await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#home-header', { timeout: 20000 });
  await sleep(600);

  // --- Home renders with static hero, feed, nav ---------------------------
  const home = await state();
  const cards = await page.locator('#restaurant-list [data-home99-restaurant]').count();
  check('home: header, hero and nav render', home.home && home.hero && home.nav, `home=${home.home} hero=${home.hero} nav=${home.nav}`);
  check('home: demo restaurants are listed', cards > 0, `${cards} cards`);
  check('home: bottom nav has both tabs', home.navTabs === 2, `${home.navTabs} tabs`);
  audit('home', home);
  await page.screenshot({ path: path.join(outDir, '01-home.png') });

  // --- Hero CTA opens the deals route (the original's /deals) ------------
  await tap('#hero-banner-region .banner-cta');
  await waitFor(() => page.locator('.u99-page').count().then((n) => n > 0), 'hero CTA → /under99');
  await sleep(320);
  check('hero CTA: opens /under99', page.url().endsWith('#/under99'), page.url());
  await page.goBack();
  await waitFor(async () => page.evaluate(() => Boolean(document.querySelector('.home-screen'))), 'back to Home');
  await sleep(320);

  // --- Search bar: query and results --------------------------------------
  await tap('#home-header .search-box');
  await page.waitForSelector('#ew-search-input', { timeout: 15000 });
  await page.fill('#ew-search-input', 'dosa');
  await sleep(700);
  const results = await page.locator('.ew-search-result').count();
  check('search bar: opens overlay and returns results', results > 0, `${results} results for "dosa"`);
  check('search: overlay has no page errors yet', pageErrors.length === 0, pageErrors.join(' | '));
  await page.keyboard.press('Escape');
  await sleep(420);
  check('search: closes back to Home', (await state()).home, 'home visible');

  // --- UNDER ₹99 pill -----------------------------------------------------
  await tap('#home-header .btn-store');
  await page.waitForSelector('.u99-page', { timeout: 15000 });
  await sleep(420);
  const under99 = await state();
  check('UNDER ₹99 pill: opens /under99 with content', under99.hash === '#/under99' && under99.under99, under99.hash);
  audit('under99', under99);
  await page.screenshot({ path: path.join(outDir, '02-under99.png') });
  await backToHome('under99');

  // --- Profile ------------------------------------------------------------
  await tap('#home-header .btn-profile');
  await page.waitForSelector('.profile-page', { timeout: 15000 });
  await sleep(380);
  const profile = await state();
  check('profile button: opens /profile', profile.profile, 'profile-page visible');
  audit('profile', profile);
  await backToHome('profile');

  // --- Restaurant card + page slide ---------------------------------------
  const layerTransforms = [];
  await page.evaluate(() => {
    window.__navTransforms = [];
    const sample = () => {
      document.querySelectorAll('.route-layer').forEach((layer) => {
        const transform = getComputedStyle(layer).transform;
        if (transform !== 'none' && transform !== 'matrix(1, 0, 0, 1, 0, 0)') window.__navTransforms.push(transform);
      });
      if (window.__navTransforms.length < 12) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await tap('#restaurant-list .u99-restaurant-head');
  await page.waitForSelector('.menu-item', { timeout: 15000 });
  await sleep(500);
  const restaurant = await state();
  const menuItems = await page.locator('.menu-item').count();
  layerTransforms.push(...(await page.evaluate(() => window.__navTransforms)));
  check('restaurant card: opens the menu page', restaurant.restaurant && restaurant.hash.startsWith('#/restaurant/'), restaurant.hash);
  check('restaurant card: menu renders its dishes', menuItems > 0, `${menuItems} dishes`);
  check('page transition: the incoming layer slides', layerTransforms.length > 0, `${layerTransforms.length} moving frames`);
  audit('restaurant', restaurant);

  // --- Two layers of the same route (regression) --------------------------
  // A push lands before the page it covers finishes leaving, so for ~260ms two
  // layers of the same route are mounted. The route sheet is reference counted:
  // the leaving layer's detach must not switch it off under the visible page.
  await page.evaluate(() => {
    location.hash = '#/restaurant/2';
  });
  await sleep(1400);
  const stacked = await state();
  const stackedTitle = await page.evaluate(() => {
    const node = document.querySelector('.route-layer.is-top .res-name');
    return node ? getComputedStyle(node).fontSize : null;
  });
  check(
    'stacked restaurants: the second layer keeps its styles',
    stacked.restaurant && stacked.sheetOn === true && stacked.oversizedIcons === 0 && stacked.overflow === 0,
    `${stacked.hash} sheet=${stacked.sheetOn} verified=${JSON.stringify(stacked.verified)} rider=${JSON.stringify(stacked.rider)} overflow=${stacked.overflow}`,
  );
  check('stacked restaurants: the title keeps its 28px size', stackedTitle === '28px', String(stackedTitle));

  // --- Cart pill from an added dish ---------------------------------------
  await page.locator('.nb-add-btn:not(.nb-add-btn--cust)').first().tap();
  await page.waitForSelector('#es-pink-inner', { timeout: 15000 });
  await sleep(400);
  await page.locator('#es-pink-inner').tap();
  await page.waitForSelector('.cart-page', { timeout: 15000 });
  await sleep(500);
  const cart = await state();
  check('cart pill: opens /cart with the item list', cart.cart && cart.hash === '#/cart', cart.hash);
  audit('cart', cart);
  await page.screenshot({ path: path.join(outDir, '04-cart.png') });
  await backToHome('cart');

  // --- Cart bar on Home ---------------------------------------------------
  const cartBar = await page.evaluate(() => {
    const node = document.querySelector('#white-cart-root');
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { visible: rect.height > 0 && getComputedStyle(node).visibility !== 'hidden' };
  });
  check('home: the white cart bar reflects the cart', cartBar?.visible === true, JSON.stringify(cartBar));

  // --- Bottom nav: History tab + indicator animation ----------------------
  const indicatorBefore = await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const ind = nav ? nav.querySelector('.nav-indicator') : null;
    if (!ind) return null;
    return String(Math.round(new DOMMatrixReadOnly(getComputedStyle(ind).transform).m41));
  });
  await page.evaluate(() => {
    window.__navPill = { enter: 0, leave: 0 };
    const nav = document.querySelector('.bottom-nav');
    new MutationObserver((records) => {
      records.forEach((record) => {
        const target = record.target;
        if (!target.classList || !target.classList.contains('nav-tab')) return;
        if (target.classList.contains('is-enter')) window.__navPill.enter += 1;
        if (target.classList.contains('is-leave')) window.__navPill.leave += 1;
      });
    }).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
  await tap('.bottom-nav .nav-tab[data-nav-item="/orders"]');
  await page.waitForSelector('.orders-page', { timeout: 15000 });
  await sleep(520);
  const orders = await state();
  const indicatorAfter = await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const ind = nav ? nav.querySelector('.nav-indicator') : null;
    if (!ind) return null;
    return String(Math.round(new DOMMatrixReadOnly(getComputedStyle(ind).transform).m41));
  });
  const pillAnimated = await page.evaluate(() => window.__navPill);
  check('History tab: opens /orders', orders.orders && orders.hash === '#/orders', orders.hash);
  audit('orders', orders);
  check('History tab: the nav pill moves', indicatorBefore !== indicatorAfter, `${indicatorBefore} → ${indicatorAfter}`);
  check(
    'History tab: the pill swap animation runs',
    pillAnimated.enter > 0 && pillAnimated.leave > 0,
    `enter=${pillAnimated.enter} leave=${pillAnimated.leave}`,
  );
  await page.screenshot({ path: path.join(outDir, '05-orders.png') });

  // --- Track live ---------------------------------------------------------
  await page.locator('.orders-page .live-state').first().tap();
  await page.waitForSelector('.track-page', { timeout: 15000 });
  await sleep(520);
  const track = await state();
  check('Track live: opens the tracking page', track.track, 'track-page visible');
  audit('track', track);
  await backToHome('track');
  await tap('.bottom-nav .nav-tab[data-nav-item="/"]');
  await page.waitForSelector('.route-tab-cache.is-active #home-header', { timeout: 15000 });
  await sleep(420);
  check('History → Home: back on the Home tab', (await state()).home, 'home visible');

  // --- Category tile filters Home in place --------------------------------
  await tap('#cat-scroll .cat-item');
  await sleep(700);
  const filtered = await state();
  check('category tile: filters the Home feed in place', filtered.home && filtered.title && filtered.title.endsWith('near you'), filtered.title ?? 'no title');
  await tap('#cat-scroll .cat-item');
  await sleep(500);

  // --- Deep links ---------------------------------------------------------
  await navTo('#/under99');
  const under99Deep = await waitFor((snapshot) => snapshot.under99, 'deep link /under99');
  check('deep link /under99 renders', under99Deep.under99 && under99Deep.hash === '#/under99', under99Deep.hash);
  audit('deep-linked under99', under99Deep);
  await navTo('#/category/Biryani');
  const category = await waitFor((snapshot) => snapshot.category, 'deep link /category/Biryani');
  await page.waitForSelector('.cat-result', { timeout: 8000 }).catch(() => {});
  const catResults = await page.locator('.cat-result').count();
  check('deep link /category/:type renders results', category.category && catResults > 0, `${catResults} results`);
  await page.screenshot({ path: path.join(outDir, '06-category.png') });
  await page.locator('.cat-result').first().tap();
  await page.waitForSelector('.menu-item', { timeout: 15000 });
  await sleep(420);
  const categoryResult = await state();
  check('category result: opens the restaurant', categoryResult.restaurant, 'rest-page visible');
  audit('category result', categoryResult);
  await backToHome('category result');

  // --- Login (fresh session) ---------------------------------------------
  const anon = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const anonPage = await anon.newPage();
  const anonErrors = [];
  anonPage.on('pageerror', (error) => anonErrors.push(error.message));
  await anonPage.goto(`${base}/#/login`, { waitUntil: 'networkidle' });
  await anonPage.waitForSelector('.login-page', { timeout: 20000 });
  await sleep(400);
  const loginVisible = await anonPage.evaluate(() => {
    const node = document.querySelector('.login-page');
    return Boolean(node) && node.getBoundingClientRect().height > 0;
  });
  await anonPage.screenshot({ path: path.join(outDir, '07-login.png') });
  check('login route: renders for a logged-out visitor', loginVisible && anonErrors.length === 0, anonErrors.join(' | ') || 'no errors');
  await anon.close();

  // --- Global health ------------------------------------------------------
  await navTo('#/');
  await sleep(500);
  const final = await state();
  check('final: back on Home with no error card', final.home && !final.errorCard, `hash=${final.hash} errorCard=${final.errorCard}`);
  check('zero page errors', pageErrors.length === 0, pageErrors.join(' | ') || 'none');
  check('zero console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | ') || 'none');

  await writeFile(
    path.join(outDir, 'report.json'),
    `${JSON.stringify({ failures, pageErrors, consoleErrors, screens: ['01-home', '02-under99', '03-restaurant', '04-cart', '05-orders', '06-category', '07-login'] }, null, 2)}\n`,
  );
} finally {
  await context.close();
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

console.log(`\n${failures.length === 0 ? 'ALL NAV SMOKE CHECKS PASSED' : `${failures.length} FAILED`}`);
if (failures.length) process.exitCode = 1;
