/**
 * Item 19 part 3 — "What's on your mind?" behaves like the original website:
 * tapping a category filters the Home feed in place instead of navigating.
 *
 *   npm run category-check
 *
 * Demo mode is the built app with its demo feed; api mode is the same build
 * with `navereat_data_source=api` and the API host answered here, so both
 * transports are exercised against the real component tree.
 *
 * Home stays mounted in several route layers (the tab caches), so every lookup
 * is scoped to the visible Home layer rather than to `document`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const outDir = path.join(repoRoot, 'verify', 'item19');
const base = 'http://127.0.0.1:4178';
const failures = [];

function check(name, condition, detail = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

/** Logged-in demo session, so the app lands on Home instead of /login. */
const SEED_SESSION = () => {
  localStorage.setItem('nearbite_token', 'demo-token');
  localStorage.setItem('token', 'demo-token');
  localStorage.setItem(
    'nearbite_user',
    JSON.stringify({ name: 'Sagnik', phone: '+91 98765 43210', email: 'demo@navereat.app' }),
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

/** Installed before every navigation: one accessor for the live Home. */
const HOME_HELPERS = () => {
  window.__homeLayer = () =>
    [...document.querySelectorAll('.route-layer')].find(
      (layer) => layer.querySelector('.home-screen') && getComputedStyle(layer).visibility !== 'hidden',
    ) ?? null;
  window.__q = (selector) => window.__homeLayer()?.querySelector(selector) ?? null;
  window.__qa = (selector) => [...(window.__homeLayer()?.querySelectorAll(selector) ?? [])];
};

/** Records every distinct shape the feed passes through during one tap. */
const watchList = (page) =>
  page.evaluate(() => {
    window.__catWatch = { steps: [] };
    const sample = () => {
      const list = window.__q('#restaurant-list');
      const skeletons = list ? list.querySelectorAll('.rs-skeleton').length : 0;
      const cards = list ? list.querySelectorAll('.u99-card-host:not(.rs-skeleton)').length : 0;
      const title = list && list.classList.contains('state-block') ? list.querySelector('.state-title')?.textContent ?? '' : '';
      const label = `skeleton:${skeletons}|cards:${cards}${title ? `|state:${title}` : ''}`;
      if (window.__catWatch.steps.at(-1) !== label) window.__catWatch.steps.push(label);
    };
    const section = window.__q('#restaurants-section');
    window.__catObserver?.disconnect();
    window.__catObserver = new MutationObserver(sample);
    window.__catObserver.observe(section, { childList: true, subtree: true, characterData: true });
    sample();
  });

const readWatch = (page) => page.evaluate(() => window.__catWatch?.steps.slice() ?? []);

const readHome = (page) =>
  page.evaluate(() => {
    const list = window.__q('#restaurant-list');
    const cards = [...(list?.querySelectorAll('.u99-card-host:not(.rs-skeleton)') ?? [])];
    const badge = window.__q('#cat-scroll .cat-item.is-selected .cat-selected-badge');
    return {
      hash: location.hash,
      title: window.__q('#restaurants-title')?.textContent?.trim() ?? '',
      cards: cards.length,
      names: cards.map((card) => card.querySelector('.u99-restaurant-name')?.textContent?.trim() ?? ''),
      offers: cards.filter((card) => {
        const line = card.querySelector('.u99-discount-line');
        return Boolean(line && line.textContent && line.textContent.trim());
      }).length,
      skeleton: list ? list.querySelectorAll('.rs-skeleton').length : 0,
      isEmptyBlock: Boolean(list?.classList.contains('state-block')),
      emptyTitle: list?.querySelector('.state-title')?.textContent?.trim() ?? '',
      emptySub: list?.querySelector('.state-sub')?.textContent?.trim() ?? '',
      emptyButton: list?.querySelector('.state-btn')?.textContent?.trim() ?? '',
      selected: window.__qa('#cat-scroll .cat-item.is-selected').map((item) => item.getAttribute('data-category-name') ?? ''),
      selectedOpacity: badge ? Number(getComputedStyle(badge).opacity) : null,
      pills: window.__qa('#filter-bar .filter-pill.active').map((pill) => pill.textContent?.trim() ?? ''),
      cardAnimations: document.getAnimations().filter((animation) => {
        const target = animation.effect?.target;
        return target instanceof Element && target.closest('.u99-card-host') !== null;
      }).length,
    };
  });

const collectCls = (page) =>
  page.evaluate(() => {
    window.__cls = 0;
    window.__clsObserver?.disconnect();
    window.__clsObserver = new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
    });
    window.__clsObserver.observe({ type: 'layout-shift', buffered: false });
  });

const readCls = (page) =>
  page.evaluate(() => {
    window.__clsObserver?.disconnect();
    return Number((window.__cls ?? 0).toFixed(4));
  });

const countCards = (page, expected) =>
  page.waitForFunction(
    (n) => {
      const list = window.__q('#restaurant-list');
      if (!list) return n === 0;
      if (list.classList.contains('state-block')) return n === 0;
      return list.querySelectorAll('.u99-card-host:not(.rs-skeleton)').length === n;
    },
    expected,
    { timeout: 8000 },
  );

const apiRestaurants = [
  {
    _id: 'r-pizza',
    name: 'Pizza Palace',
    cuisine: ['Pizza', 'Italian'],
    rating: 4.3,
    ratingCount: 812,
    estimatedDeliveryMin: 25,
    estimatedDeliveryMax: 35,
    distanceMeters: 1800,
    image: '/__placeholders/wide-pizza.svg',
    menu: [
      { _id: 'p1', name: 'Margherita Pizza', price: 249, isVeg: false, image: '/__placeholders/square-pizza.svg' },
      { _id: 'p2', name: 'Farmhouse Pizza', price: 349, isVeg: false, image: '/__placeholders/square-pizza.svg' },
    ],
  },
  {
    _id: 'r-rolls',
    name: 'Rolls Mania',
    cuisine: ['Rolls'],
    rating: 4.0,
    ratingCount: 402,
    estimatedDeliveryMin: 20,
    estimatedDeliveryMax: 30,
    distanceMeters: 2600,
    image: '/__placeholders/wide-rolls.svg',
    menu: [
      { _id: 'g1', name: 'Chicken Cheese Roll', price: 149, isVeg: false, image: '/__placeholders/square-rolls.svg' },
      { _id: 'g2', name: 'Paneer Tikka Roll', price: 139, isVeg: true, image: '/__placeholders/square-rolls.svg' },
    ],
  },
  {
    _id: 'r-biryani',
    name: 'Biryani Bhavan',
    cuisine: ['Biryani'],
    rating: 4.4,
    ratingCount: 1204,
    estimatedDeliveryMin: 30,
    estimatedDeliveryMax: 45,
    distanceMeters: 3200,
    image: '/__placeholders/wide-biryani.svg',
    menu: [
      { _id: 'b1', name: 'Hyderabadi Chicken Biryani', price: 249, isVeg: false, image: '/__placeholders/square-biryani.svg' },
    ],
  },
];

const apiSearchHits = (query, mode) => {
  if (mode === 'empty') return [];
  const needle = query.toLowerCase();
  return apiRestaurants.flatMap((restaurant) =>
    restaurant.menu
      .filter((item) => item.name.toLowerCase().includes(needle))
      .map((item) => ({
        _id: item._id,
        id: item._id,
        name: item.name,
        price: item.price,
        image: item.image,
        restaurantId: restaurant._id,
        restaurant: { _id: restaurant._id, name: restaurant.name, image: restaurant.image },
      })),
  );
};

const server = await preview({
  root: appRoot,
  logLevel: 'error',
  preview: { host: '127.0.0.1', port: 4178, strictPort: true },
});
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});

const report = { demo: {}, api: {} };

const openPage = async (context, { api = false, slowFeed = false } = {}) => {
  const page = await context.newPage();
  const searchCalls = [];
  const state = { mode: slowFeed ? 'feedslow' : 'normal' };
  await page.addInitScript(SEED_SESSION);
  await page.addInitScript(HOME_HELPERS);
  if (api) {
    await page.addInitScript(() => localStorage.setItem('navereat_data_source', 'api'));
    await page.route('https://api.eatswada.com/api/**', async (route) => {
      const url = new URL(route.request().url());
      const pathname = url.pathname.replace(/^\/api/, '');
      const reply = (data) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
      if (pathname === '/platform/public-status') return reply({ canOrder: true, state: 'open', orderingOpen: true });
      if (pathname === '/categories') {
        return reply([
          { _id: 'c1', name: 'Pizza', type: 'Pizza', image: '/__placeholders/mind-pizza.svg', isActive: true, order: 1 },
          { _id: 'c2', name: 'Rolls', type: 'Rolls', image: '/__placeholders/mind-rolls.svg', isActive: true, order: 2 },
        ]);
      }
      if (pathname === '/restaurants' || pathname === '/restaurants/under99') {
        if (state.mode === 'feedslow') await new Promise((resolve) => setTimeout(resolve, 600));
        return reply(apiRestaurants);
      }
      if (pathname === '/restaurants/search') {
        const query = url.searchParams.get('q') ?? '';
        searchCalls.push({ query, scope: url.searchParams.get('scope') ?? '', mode: state.mode });
        if (state.mode === 'slow') await new Promise((resolve) => setTimeout(resolve, 600));
        if (state.mode === 'boom') {
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, message: 'Search is down' }),
          });
        }
        return reply({ menuItems: apiSearchHits(query, state.mode) });
      }
      if (pathname === '/pricing/restaurant-cards') return reply({ cards: [] });
      return reply([]);
    });
  }
  await page.goto(`${base}/#/`, { waitUntil: 'domcontentloaded' });
  if (!slowFeed) {
    await page.waitForFunction(
      () => window.__qa('#restaurant-list .u99-card-host:not(.rs-skeleton)').length > 0,
      null,
      { timeout: 25000 },
    );
    await page.waitForTimeout(900);
  } else {
    await page.waitForTimeout(250);
  }
  return { page, searchCalls, setSearchMode: (mode) => { state.mode = mode; } };
};

try {
  await mkdir(outDir, { recursive: true });

  // ── Demo mode ───────────────────────────────────────────────────────
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: 'en-IN',
    });
    const { page } = await openPage(context);
    const idle = await readHome(page);
    report.demo.idle = idle;
    check('demo: the unfiltered feed is 8 cards', idle.cards === 8, `${idle.cards} cards · "${idle.title}"`);
    check('demo: nothing is selected to start with', idle.selected.length === 0);

    // Selected + filtered in place.
    await watchList(page);
    await collectCls(page);
    await page.click('[data-category-name="Rolls"]:visible');
    await page.waitForFunction(() => window.__qa('#cat-scroll .cat-item.is-selected').length === 1, null, { timeout: 5000 });
    await countCards(page, 2);
    await page.waitForTimeout(260);
    const rollsCls = await readCls(page);
    const rolls = await readHome(page);
    const rollsSteps = await readWatch(page);
    report.demo.rolls = { ...rolls, steps: rollsSteps, cls: rollsCls };
    check('demo: the category never leaves Home', rolls.hash === '#/', `hash ${rolls.hash}`);
    check('demo: the title becomes "<category> near you"', rolls.title === 'Rolls near you', rolls.title);
    check('demo: the tile is marked selected', rolls.selected.join(',') === 'Rolls', rolls.selected.join(','));
    check('demo: the selected badge is visible', rolls.selectedOpacity === 1, String(rolls.selectedOpacity));
    check('demo: only the matching restaurants remain', rolls.cards === 2, rolls.names.join(' / '));
    check(
      'demo: the matches are the restaurants selling a roll',
      rolls.names.includes('Rolls Mania') && rolls.names.includes('China Town'),
      rolls.names.join(' / '),
    );
    check(
      'demo: the original skeleton is shown first',
      rollsSteps.some((step) => step.startsWith('skeleton:2|cards:0')),
      rollsSteps.join(' → '),
    );
    check('demo: no layout shift on the category tap', rollsCls <= 0.01, `cls=${rollsCls}`);
    check('demo: no entrance animation replays', rolls.cardAnimations === 0, `${rolls.cardAnimations} running`);

    // A chip narrows the category.
    await page.click('#filter-bar .filter-pill:nth-child(3):visible');
    await countCards(page, 1);
    const rollsRating = await readHome(page);
    report.demo.rollsRating = rollsRating;
    check('demo: a chip narrows the category', rollsRating.cards === 1 && rollsRating.names[0] === 'Rolls Mania', rollsRating.names.join(' / '));
    check('demo: the chip reads as active', rollsRating.pills.some((label) => /Rating 4\.0/.test(label)), rollsRating.pills.join(' / '));

    // Veg + category has no match -> the original "filters" block.
    await page.click('#veg-toggle-btn:visible');
    await page.waitForFunction(() => window.__q('#restaurant-list')?.classList.contains('state-block'), null, { timeout: 5000 });
    const vegEmpty = await readHome(page);
    report.demo.vegEmpty = vegEmpty;
    check(
      'demo: the filters empty state is the original one',
      vegEmpty.emptyTitle === 'No restaurants match your filters' &&
        vegEmpty.emptySub === 'Try changing or clearing your filters.' &&
        vegEmpty.emptyButton === 'Clear filters',
      `${vegEmpty.emptyTitle} | ${vegEmpty.emptySub} | ${vegEmpty.emptyButton}`,
    );
    await page.click('#home-clear-filters:visible');
    await countCards(page, 2);
    const cleared = await readHome(page);
    report.demo.cleared = cleared;
    check(
      'demo: Clear filters keeps the category',
      cleared.cards === 2 && cleared.selected.join(',') === 'Rolls',
      `${cleared.cards} cards · ${cleared.selected.join(',')}`,
    );

    // Tapping the same category again restores the feed.
    await collectCls(page);
    await watchList(page);
    await page.click('[data-category-name="Rolls"]:visible');
    await page.waitForFunction(() => window.__qa('#cat-scroll .cat-item.is-selected').length === 0, null, { timeout: 5000 });
    await countCards(page, 8);
    const restoredCls = await readCls(page);
    const restored = await readHome(page);
    report.demo.restored = { ...restored, cls: restoredCls, steps: await readWatch(page) };
    check('demo: tapping again restores the feed', restored.cards === 8 && restored.selected.length === 0, `${restored.cards} cards`);
    // The original picks the heading from the data: the deal copy only when the
    // visible cards actually carry an offer.
    const expectedTitle = restored.offers > 0 ? 'Recommended with deals' : 'Restaurants near you';
    check('demo: the title returns to the feed heading', restored.title === expectedTitle, `${restored.title} (${restored.offers} cards with an offer)`);
    check('demo: restoring does not shift layout', restoredCls <= 0.01, `cls=${restoredCls}`);

    // A category nobody sells -> the original "nothing available" block.
    await page.click('[data-category-name="Sweets"]:visible');
    await page.waitForFunction(() => window.__q('#restaurant-list')?.classList.contains('state-block'), null, { timeout: 5000 });
    const noMatch = await readHome(page);
    report.demo.noMatch = noMatch;
    check(
      'demo: a category with no dishes shows the search-empty block',
      noMatch.emptyTitle === 'No restaurants available yet' &&
        noMatch.emptySub === "We're not delivering here right now. Please check back soon." &&
        noMatch.emptyButton === 'Refresh',
      `${noMatch.emptyTitle} | ${noMatch.emptyButton}`,
    );

    // The selection survives a Restaurant round trip.
    await page.click('[data-category-name="Rolls"]:visible');
    await countCards(page, 2);
    await page.click('#restaurant-list .u99-restaurant-head:visible');
    await page.waitForFunction(() => location.hash.startsWith('#/restaurant/'), null, { timeout: 8000 });
    await page.waitForTimeout(700);
    const detailHash = await page.evaluate(() => location.hash);
    await page.click('.ew-hd-back:visible');
    await page.waitForFunction(() => location.hash === '#/', null, { timeout: 8000 });
    await page.waitForTimeout(800);
    const returned = await readHome(page);
    report.demo.returned = returned;
    check('demo: the restaurant page opened', detailHash.startsWith('#/restaurant/'), detailHash);
    check(
      'demo: back on Home the category is still selected and applied',
      returned.selected.join(',') === 'Rolls' && returned.cards === 2,
      `${returned.selected.join(',')} · ${returned.cards} cards`,
    );
    check('demo: back on Home the title is still the category', returned.title === 'Rolls near you', returned.title);

    // ...and a Cart round trip: the selection is Home state, not page state.
    await page.evaluate(() => {
      location.hash = '#/cart';
    });
    await page.waitForFunction(() => location.hash.startsWith('#/cart'), null, { timeout: 8000 });
    await page.waitForTimeout(500);
    await page.goBack();
    await page.waitForFunction(() => location.hash === '#/', null, { timeout: 8000 });
    await page.waitForTimeout(800);
    const fromCart = await readHome(page);
    report.demo.fromCart = fromCart;
    check(
      'demo: back from the cart the category is still selected and applied',
      fromCart.selected.join(',') === 'Rolls' && fromCart.cards === 2 && fromCart.title === 'Rolls near you',
      `${fromCart.selected.join(',')} · ${fromCart.cards} cards · ${fromCart.title}`,
    );

    // The category page is still reachable, but only by deep link.
    // A cold load, the way a shared link arrives.
    const deepPage = await context.newPage();
    await deepPage.addInitScript(SEED_SESSION);
    await deepPage.addInitScript(HOME_HELPERS);
    await deepPage.goto(`${base}/#/category/Rolls`, { waitUntil: 'domcontentloaded' });
    await deepPage.waitForSelector('.cat-page', { timeout: 15000 });
    const deepLink = await deepPage.evaluate(() => ({
      hash: location.hash,
      title: document.querySelector('.cat-title')?.textContent ?? '',
      subtitle: document.querySelector('.cat-sub')?.textContent ?? '',
    }));
    report.demo.deepLink = deepLink;
    check('demo: /category/:type still opens by deep link', deepLink.hash.startsWith('#/category/Rolls'), `${deepLink.hash} · ${deepLink.title}`);

    await context.close();
  }

  // ── Api mode ────────────────────────────────────────────────────────
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: 'en-IN',
    });
    const cold = await openPage(context, { api: true, slowFeed: true });
    const coldSkeleton = await cold.page.evaluate(() => {
      const skeleton = window.__q('#restaurant-list .rs-skeleton');
      return skeleton ? Number(skeleton.getBoundingClientRect().height.toFixed(1)) : 0;
    });
    report.api.coldSkeleton = coldSkeleton;
    await cold.page.close();

    const { page, searchCalls, setSearchMode } = await openPage(context, { api: true });
    const idle = await readHome(page);
    report.api.idle = idle;
    check('api: the feed comes from the API', idle.cards === 3, `${idle.cards} cards`);

    setSearchMode('slow');
    await watchList(page);
    await collectCls(page);
    await page.click('[data-category-name="Pizza"]:visible');
    await page.waitForTimeout(200);
    const midLoad = await page.evaluate(() => {
      const list = window.__q('#restaurant-list');
      const skeleton = list?.querySelector('.rs-skeleton');
      return {
        skeleton: list ? list.querySelectorAll('.rs-skeleton').length : 0,
        cards: list ? list.querySelectorAll('.u99-card-host:not(.rs-skeleton)').length : 0,
        skeletonHeight: skeleton ? Number(skeleton.getBoundingClientRect().height.toFixed(1)) : 0,
      };
    });
    report.api.midLoad = midLoad;
    await writeFile(
      path.join(outDir, 'category-skeleton-frame.png'),
      await page.screenshot({ clip: { x: 0, y: 240, width: 390, height: 460 } }),
    );
    check('api: the skeleton holds the list while the search runs', midLoad.skeleton === 2 && midLoad.cards === 0, JSON.stringify(midLoad));

    const pizzaCls = await readCls(page);
    await countCards(page, 1);
    await page.waitForTimeout(240);
    const cardHeight = await page.evaluate(() => {
      const card = window.__q('#restaurant-list .u99-card-host:not(.rs-skeleton)');
      return card ? Number(card.getBoundingClientRect().height.toFixed(1)) : 0;
    });
    const pizza = await readHome(page);
    report.api.pizza = { ...pizza, cardHeight, cls: pizzaCls, steps: await readWatch(page) };
    report.api.searchCalls = searchCalls;
    check(
      'api: the category skeleton is exactly the cold-start skeleton',
      coldSkeleton > 0 && Math.abs(midLoad.skeletonHeight - coldSkeleton) < 0.5,
      `category ${midLoad.skeletonHeight}px vs cold start ${coldSkeleton}px`,
    );
    check('api: no layout shift on the category tap', pizzaCls <= 0.01, `cls=${pizzaCls}`);
    check(
      'api: it asks the original endpoint with the category as the query',
      searchCalls.some((call) => call.query === 'Pizza' && call.scope === 'home'),
      JSON.stringify(searchCalls),
    );
    check('api: only the matching restaurant is listed', pizza.cards === 1 && pizza.names[0] === 'Pizza Palace', pizza.names.join(' / '));
    check('api: the tile is selected', pizza.selected.join(',') === 'Pizza', pizza.selected.join(','));
    check('api: the title is the category title', pizza.title === 'Pizza near you', pizza.title);
    check('api: nothing navigated', pizza.hash === '#/', pizza.hash);

    setSearchMode('empty');
    await page.click('[data-category-name="Rolls"]:visible');
    await page.waitForFunction(() => window.__q('#restaurant-list')?.classList.contains('state-block'), null, { timeout: 8000 });
    const apiEmpty = await readHome(page);
    report.api.empty = apiEmpty;
    check('api: an empty search shows the original empty block', apiEmpty.emptyTitle === 'No restaurants available yet', `${apiEmpty.emptyTitle} · ${apiEmpty.emptyButton}`);

    const before = searchCalls.filter((call) => call.query === 'Rolls').length;
    await page.click('#home-retry-btn:visible');
    await page.waitForTimeout(900);
    const retried = await readHome(page);
    const after = searchCalls.filter((call) => call.query === 'Rolls').length;
    report.api.retried = { ...retried, rollsCalls: after };
    check('api: Refresh re-runs the search behind the state', after === before + 1, `${before} → ${after}`);
    check('api: Refresh keeps the honest empty state', retried.isEmptyBlock && retried.emptyTitle === 'No restaurants available yet', retried.emptyTitle);

    // A failed search hands the failure to the original error block.
    setSearchMode('boom');
    await page.click('[data-category-name="Pizza"]:visible');
    await page.waitForFunction(
      () => window.__q('#restaurant-list .state-title')?.textContent === "Couldn't load restaurants",
      null,
      { timeout: 8000 },
    );
    const failed = await readHome(page);
    report.api.failed = failed;
    check('api: a failed search shows the original error block', failed.emptyButton === 'Try Again', `${failed.emptyTitle} · ${failed.emptyButton}`);
    check('api: a failed search clears the category', failed.selected.length === 0, failed.selected.join(','));
    setSearchMode('normal');
    await page.click('#home-retry-btn:visible');
    await countCards(page, 3);
    const recovered = await readHome(page);
    report.api.recovered = recovered;
    check('api: Try Again brings the feed back', recovered.cards === 3 && !recovered.isEmptyBlock, `${recovered.cards} cards`);

    await context.close();
  }

  report.api.note =
    'The skeleton is the cold-start card shape (the original shows the same thing), so it is taller than the thin 2-item mock card; the swap is measured by CLS, not by equal pixel heights.';
  await writeFile(path.join(outDir, 'category-report.json'), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

if (failures.length) {
  console.error(`\n${failures.length} category check(s) failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\nAll "what\'s on your mind" checks passed.');
