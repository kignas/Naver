/* Scroll audit for the static demo. Starts the built preview, then checks
   route scrollers and every sheet/overlay at 390x844 and 360x640. */
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.SCROLL_CHECK_PORT || 4186);
const BASE = `http://127.0.0.1:${PORT}`;
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 360, height: 640 }];
const CHROME = process.env.CHROME_PATH || '/usr/bin/chromium';
const CART = {
  'Hyderabadi Chicken Biryani': { quantity: 2, price: 249, resId: 2, resName: 'Biryani Bhavan', menuItem: 'bb1' },
  Raita: { quantity: 1, price: 39, resId: 2, resName: 'Biryani Bhavan', menuItem: 'bb7' },
  'Margherita Pizza': { quantity: 1, price: 199, resId: 3, resName: 'Pizza Palace', menuItem: 'pp1' },
};

const ROUTES = [
  { name: 'Login', path: '/login', auth: false, ready: '.login-page', scroller: '.login-page', last: '.legal-text', before: 'No (clipped)', cause: '.page overflow:hidden overrode .login-page; page height was content-driven' },
  { name: 'Home', path: '/', auth: true, ready: '.home-scroll', scroller: '.home-scroll', last: '.u99-card-host', before: 'Yes', cause: 'Route scroller already worked; added overlay lock' },
  { name: '₹99 Store', path: '/under99', auth: true, ready: '.u99-page', scroller: '.u99-scroll', last: '.u99-card', before: 'Yes', cause: 'Route scroller already worked; added overlay lock' },
  { name: 'Category', path: '/category/Biryani', auth: true, ready: '.cat-page', scroller: '.cat-scroll', last: '.cat-result', before: 'Fits', cause: 'Content fits; added overlay lock' },
  { name: 'Restaurant', path: '/restaurant/2', auth: true, ready: '.rest-page', scroller: '.rest-scroll', last: '.rmf-report', before: 'Yes', cause: 'Route scroller already worked; added overlay lock' },
  { name: 'Cart', path: '/cart?offers=none', auth: true, ready: '.cart-page', scroller: '.cart-page', last: '.ct-oi-policy', before: 'No (clipped)', cause: '.page overflow:hidden loaded after .cart-page; forced auto overflow' },
  { name: 'Orders', path: '/orders', auth: true, ready: '.orders-page', scroller: '.orders-page', last: '.order-card', before: 'No (clipped)', cause: '.page overflow:hidden loaded after .orders-page; forced auto overflow' },
  { name: 'Tracking', path: '/track/NAV-240318', auth: true, ready: '.track-page', scroller: '.track-page', last: '.details-card', before: 'No (clipped)', cause: '.page overflow:hidden loaded after .track-page; forced auto overflow' },
  { name: 'Profile', path: '/profile', auth: true, ready: '.profile-page', scroller: '.profile-page', last: '.section', before: 'No (clipped)', cause: '.page overflow:hidden loaded after .profile-page; forced auto overflow' },
];

const SHEETS = [
  { name: 'Filters', path: '/', scroller: '.home-scroll', sheet: '.filter-sheet', inner: '.filter-content', open: async (page) => page.locator('.filter-pill-sheet').click(), close: async (page) => page.locator('.sheet-done').click(), closeKey: 'Escape', last: '.filter-content .filter-section', before: 'Content fits; page behind scrolled' },
  { name: 'Customise', path: '/', scroller: '.home-scroll', sheet: '#ewcs-sheet', inner: '.ewcs-body', open: async (page) => page.locator('.u99-add-cust').first().click(), close: async (page) => page.locator('.ewcs-close').click(), last: '.ewcs-group', before: 'Sheet scrolled; page behind scrolled' },
  { name: 'Search overlay', path: '/', scroller: '.home-scroll', sheet: '#ew-search-root', inner: '.ew-search-body', open: async (page) => { await page.locator('.search-box').click(); await page.waitForSelector('#ew-search-root.is-open'); await page.locator('#ew-search-input').fill('ch'); }, close: async (page) => page.locator('.ew-search-back').click(), last: '.ew-search-result', before: 'Sheet scrolled; page behind scrolled' },
  { name: 'Coupon', path: '/cart?offers=none', scroller: '.cart-page', sheet: '#ct-coupon-sheet', inner: '#ct-coupon-sheet .ct-sheet', open: async (page) => page.locator('#coupon-card').evaluate((el) => el.click()), close: async (page) => page.locator('.ct-cook-x').click(), last: '.ct-coupon-list .ct-sav-row', before: 'Fits; page behind scrolled' },
  { name: 'Tip', path: '/cart?offers=none', scroller: '.cart-page', sheet: '#ct-tip-sheet', inner: '#ct-tip-sheet', open: async (page) => { await page.locator('#ct-view-bill').click(); await page.waitForSelector('.ct-sheet-root.is-open'); await page.locator('.ctp-chip').last().click(); }, close: async (page) => page.locator('#ct-tip-sheet .ct-sheet-x').click(), last: '#ct-tip-sheet .ct-sheet-foot', before: 'Fits; page behind scrolled' },
  { name: 'Cooking', path: '/cart?offers=none', scroller: '.cart-page', sheet: '#ct-note-sheet', inner: '#ct-note-sheet', open: async (page) => page.locator('button.ct-pill-btn', { hasText: 'Cooking requests' }).first().click(), close: async (page) => page.locator('.ct-cook-x').click(), last: '.ct-sug-row .ct-sug', before: 'Fits; page behind scrolled' },
  { name: 'Payment', path: '/cart?offers=none', scroller: '.cart-page', sheet: '.ct-sheet-root.is-open', inner: '.ct-sheet', open: async (page) => page.locator('.ct-paybar .ct-cta').click(), close: async (page) => page.locator('.ct-sheet-root.is-open .ct-sheet-x').click(), last: '.navereat-place-order', before: 'Fits; page behind scrolled' },
  { name: 'Offer popup', path: '/cart?offers=single', scroller: '.cart-page', sheet: '.ew-offer.is-open', inner: '.ew-offer-card', open: async (page) => page.waitForSelector('.ew-offer.is-open', { timeout: 5000 }), close: async (page) => page.locator('#ew-offer-ok').click(), last: '.ew-offer-btn', before: 'Fits; page behind scrolled', noSeen: true },
  { name: 'Order success', path: '/cart?offers=none&hold=1', scroller: '.cart-page', sheet: '.ew-os.is-open', inner: '.ew-os__sheet', open: async (page) => { await page.locator('.ct-paybar .ct-cta').click(); await page.waitForSelector('.ct-sheet-root.is-open'); await page.locator('.navereat-place-order').click(); await page.waitForSelector('.ew-os.is-open', { timeout: 5000 }); }, close: async (page) => { await page.locator('.ew-os__btn').click(); await page.waitForSelector('.track-page'); }, last: '.ew-os__btn', before: 'Fits; page behind scrolled', closedScroller: '.track-page' },
  { name: 'Cart drawer', path: '/', scroller: '.home-scroll', sheet: '#ew-cart-drawer.show', inner: '.ew-cd-list', open: async (page) => page.locator('#wc-allup').click(), close: async (page) => page.locator('.ew-cd-close').click(), last: '.ew-cd-checkout', before: 'Fits; page behind scrolled' },
];

const failures = [];
const results = [];
const fail = (screen, viewport, message) => {
  const text = `${screen} @ ${viewport.width}x${viewport.height}: ${message}`;
  failures.push(text);
  console.log(`  FAIL ${text}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE);
      if (response.ok) return;
    } catch {
      /* server is still starting */
    }
    await sleep(250);
  }
  throw new Error(`Preview server did not start on ${BASE}`);
}

async function newContext(browser, viewport, auth, noSeen = false) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await context.addInitScript(({ cart, auth, noSeen }) => {
    localStorage.clear();
    sessionStorage.clear();
    if (auth) {
      localStorage.setItem('nearbite_token', 'demo-token');
      localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Aarav', phone: '+91 98765 43210' }));
      localStorage.setItem('nearbite_cart', JSON.stringify(cart));
    }
    if (!noSeen) sessionStorage.setItem('ew_offers_seen_v1', '["scroll-check"]');
  }, { cart: CART, auth, noSeen });
  return context;
}

async function openPage(browser, viewport, route) {
  const context = await newContext(browser, viewport, route.auth !== false, route.noSeen);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await page.goto(`${BASE}/#${route.path}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(route.ready || 'body', { timeout: 15000 });
  await page.waitForTimeout(900);
  return { context, page, cdp };
}

const scrollState = (page, selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const style = getComputedStyle(el);
  return {
    top: Math.round(el.scrollTop),
    max: el.scrollHeight - el.clientHeight,
    client: el.clientHeight,
    scroll: el.scrollHeight,
    overflowY: style.overflowY,
  };
}, selector);

async function wheel(page, selector, distance = 500) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) return false;
  // Keep the pointer away from the 24px swipe edge and the right-side action rows.
  const x = Math.round(box.x + box.width * 0.25);
  const y = Math.round(box.y + box.height * 0.7);
  await page.mouse.move(x, Math.max(1, y));
  await page.mouse.wheel(0, distance);
  await page.waitForTimeout(350);
  return true;
}

async function dragTouch(cdp, x, startY, endY) {
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: startY, id: 1 }],
    modifiers: 0,
  });
  const steps = 10;
  for (let step = 1; step <= steps; step += 1) {
    const y = Math.round(startY + ((endY - startY) * step) / steps);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y, id: 1 }],
      modifiers: 0,
    });
    await sleep(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], modifiers: 0 });
  await sleep(500);
}

async function touch(page, cdp, selector, distance = 420) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) return false;
  const x = Math.round(box.x + box.width / 2);
  const startY = Math.round(Math.min(box.y + box.height - 30, box.y + box.height * 0.65));
  const endY = Math.round(Math.max(box.y + 5, startY - distance));
  await dragTouch(cdp, x, startY, endY);
  await page.waitForTimeout(250);
  return true;
}

async function resetScroll(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollTop = 0;
  }, selector);
}

async function maxScroll(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollTop = el.scrollHeight;
  }, selector);
  await page.waitForTimeout(300);
}

async function obstructionTop(page) {
  return page.evaluate(() => {
    const candidates = [...document.querySelectorAll('.bottom-nav, #white-cart-root, .ct-footer')];
    const tops = candidates.filter((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.height > 0
        && rect.bottom >= window.innerHeight - 100 && rect.top < window.innerHeight;
    }).map((el) => el.getBoundingClientRect().top);
    return tops.length ? Math.min(...tops) : window.innerHeight;
  });
}

async function lastReachable(page, selector, useViewport = false) {
  const count = await page.locator(selector).count();
  if (!count) return { ok: false, detail: 'last selector missing' };
  const rect = await page.locator(selector).last().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), viewport: window.innerHeight, text: (el.textContent || '').trim().slice(0, 48) };
  });
  const obstruction = useViewport ? rect.viewport : await obstructionTop(page);
  return {
    ok: rect.bottom > 0 && rect.bottom <= obstruction + 2 && rect.top < rect.viewport,
    detail: `${rect.top}..${rect.bottom} (bar ${Math.round(obstruction)}) ${rect.text}`,
  };
}

const bodyLockState = (page) => page.evaluate(() => ({
  classes: document.body.className,
  style: document.body.getAttribute('style') || '',
}));

async function runRoute(browser, viewport, route) {
  const screen = route.name;
  const { context, page, cdp } = await openPage(browser, viewport, route);
  try {
    const state = await scrollState(page, route.scroller);
    if (!state) {
      fail(screen, viewport, `scroller ${route.scroller} not found`);
      return;
    }
    if (state.max > 0) {
      await resetScroll(page, route.scroller);
      await wheel(page, route.scroller);
      const afterWheel = await scrollState(page, route.scroller);
      if (!afterWheel || afterWheel.top <= 0) fail(screen, viewport, 'wheel did not scroll');
      await resetScroll(page, route.scroller);
      await touch(page, cdp, route.scroller);
      const afterTouch = await scrollState(page, route.scroller);
      if (!afterTouch || afterTouch.top <= 0) fail(screen, viewport, 'touch gesture did not scroll');
    }
    await maxScroll(page, route.scroller);
    const reachable = await lastReachable(page, route.last);
    if (!reachable.ok) fail(screen, viewport, `last item not reachable: ${reachable.detail}`);
    results.push({ screen, viewport, state, reachable, after: state.max > 0 ? 'Yes' : 'Fits' });
  } finally {
    await context.close();
  }
}

const pageBehindTop = (page, selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  return el ? Math.round(el.scrollTop) : null;
}, selector);

async function runSheet(browser, viewport, sheet) {
  const screen = sheet.name;
  const { context, page, cdp } = await openPage(browser, viewport, sheet);
  try {
    await sheet.open(page);
    await page.waitForSelector(sheet.sheet, { timeout: 8000 });
    await page.waitForTimeout(650);

    const lock = await bodyLockState(page);
    if (!lock.classes.includes('nb-scroll-lock')) fail(screen, viewport, 'page scroll lock class missing');
    const behindBefore = await pageBehindTop(page, sheet.scroller);
    const pageStyle = await scrollState(page, sheet.scroller);
    if (pageStyle && pageStyle.overflowY !== 'hidden') fail(screen, viewport, 'page scroller was not frozen');

    await page.mouse.move(5, 5);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(250);
    await dragTouch(cdp, 5, 120, 20);
    const behindAfter = await pageBehindTop(page, sheet.scroller);
    if (behindBefore !== behindAfter) fail(screen, viewport, `page behind moved ${behindBefore} -> ${behindAfter}`);

    const inner = await scrollState(page, sheet.inner);
    let innerAfterWheel = inner?.top ?? null;
    let innerAfterTouch = inner?.top ?? null;
    if (inner && inner.max > 0) {
      await resetScroll(page, sheet.inner);
      await wheel(page, sheet.inner);
      innerAfterWheel = (await scrollState(page, sheet.inner))?.top ?? 0;
      if (innerAfterWheel <= 0) fail(screen, viewport, 'sheet wheel did not scroll');
      await resetScroll(page, sheet.inner);
      await touch(page, cdp, sheet.inner);
      innerAfterTouch = (await scrollState(page, sheet.inner))?.top ?? 0;
      if (innerAfterTouch <= 0) fail(screen, viewport, 'sheet touch gesture did not scroll');
    }

    if (inner && inner.max > 0) await maxScroll(page, sheet.inner);
    const reachable = await lastReachable(page, sheet.last, true);
    if (!reachable.ok) fail(screen, viewport, `last sheet item not reachable: ${reachable.detail}`);

    if (sheet.closeKey) await page.keyboard.press(sheet.closeKey);
    else await sheet.close(page);
    await page.waitForTimeout(750);
    const unlocked = await bodyLockState(page);
    if (unlocked.classes.includes('nb-scroll-lock')) fail(screen, viewport, 'page scroll lock stuck after close');
    const closedSelector = sheet.closedScroller || sheet.scroller;
    const closed = await scrollState(page, closedSelector);
    if (!closed) fail(screen, viewport, `post-close scroller ${closedSelector} not found`);
    else {
      if (closed.overflowY === 'hidden') fail(screen, viewport, 'post-close scroller is still overflow:hidden');
      if (closed.max > 0) {
        await resetScroll(page, closedSelector);
        await wheel(page, closedSelector);
        const afterCloseWheel = await scrollState(page, closedSelector);
        if (!afterCloseWheel || afterCloseWheel.top <= 0) fail(screen, viewport, 'page does not scroll after close');
      }
    }

    results.push({ screen, viewport, state: inner, innerAfterWheel, innerAfterTouch, reachable, after: inner && inner.max > 0 ? 'Yes' : 'Fits', lock: true });
  } catch (error) {
    fail(screen, viewport, error.message.split('\n')[0]);
  } finally {
    await context.close();
  }
}

async function runNavigation(browser, viewport) {
  const screen = 'Push/pop/swipe/keyboard';
  const context = await newContext(browser, viewport, true);
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.home-scroll');
    await page.waitForTimeout(900);

    await page.locator('.u99-restaurant-head').first().click();
    await page.waitForSelector('.rest-scroll');
    await page.waitForTimeout(500);
    await resetScroll(page, '.rest-scroll');
    await wheel(page, '.rest-scroll');
    if (((await scrollState(page, '.rest-scroll'))?.top ?? 0) <= 0) fail(screen, viewport, 'restaurant does not scroll after push');

    await page.locator('.ew-hd-back').first().click();
    await page.waitForSelector('.home-scroll');
    await page.waitForTimeout(500);
    await resetScroll(page, '.home-scroll');
    await wheel(page, '.home-scroll');
    if (((await scrollState(page, '.home-scroll'))?.top ?? 0) <= 0) fail(screen, viewport, 'home does not scroll after pop');

    await page.locator('.u99-restaurant-head').first().click();
    await page.waitForSelector('.rest-scroll');
    await page.waitForTimeout(500);
    await page.mouse.move(8, 300);
    await page.mouse.down();
    await page.mouse.move(70, 300, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    if (!page.url().includes('/restaurant/')) fail(screen, viewport, 'swipe cancel navigated away');
    await resetScroll(page, '.rest-scroll');
    await wheel(page, '.rest-scroll');
    if (((await scrollState(page, '.rest-scroll'))?.top ?? 0) <= 0) fail(screen, viewport, 'restaurant does not scroll after swipe cancel');

    await page.goBack();
    await page.waitForSelector('.home-scroll');
    await page.waitForTimeout(500);
    await resetScroll(page, '.home-scroll');
    await wheel(page, '.home-scroll');
    if (((await scrollState(page, '.home-scroll'))?.top ?? 0) <= 0) fail(screen, viewport, 'home does not scroll after history back');

    await page.locator('.search-box').click();
    await page.waitForSelector('#ew-search-root.is-open');
    await page.locator('#ew-search-input').focus();
    await page.keyboard.type('ch');
    await page.waitForTimeout(500);
    await page.locator('.ew-search-back').click();
    await page.waitForTimeout(700);
    await resetScroll(page, '.home-scroll');
    await wheel(page, '.home-scroll');
    if (((await scrollState(page, '.home-scroll'))?.top ?? 0) <= 0) fail(screen, viewport, 'home does not scroll after search/keyboard close');

    results.push({ screen, viewport, state: await scrollState(page, '.home-scroll'), reachable: { ok: true }, after: 'Yes' });
  } catch (error) {
    fail(screen, viewport, error.message.split('\n')[0]);
  } finally {
    await context.close();
  }
}

async function main() {
  if (!existsSync(path.join(ROOT, 'dist', 'index.html'))) {
    console.error('dist/index.html is missing. Run `npm run build` first.');
    process.exit(1);
  }

  const viteBin = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
  const server = spawn(process.execPath, [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'],
  });
  let serverError = '';
  server.stderr.on('data', (chunk) => { serverError += String(chunk); });
  const stopServer = () => { if (!server.killed) server.kill('SIGTERM'); };
  process.on('exit', stopServer);
  process.on('SIGINT', () => { stopServer(); process.exit(130); });
  process.on('SIGTERM', () => { stopServer(); process.exit(143); });

  try {
    await waitForServer();
    const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
    try {
      for (const viewport of VIEWPORTS) {
        console.log(`\n=== ${viewport.width}x${viewport.height} ===`);
        for (const route of ROUTES) await runRoute(browser, viewport, route);
        for (const sheet of SHEETS) await runSheet(browser, viewport, sheet);
        await runNavigation(browser, viewport);
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error(error.message);
    if (serverError) console.error(serverError);
    failures.push(error.message);
  } finally {
    stopServer();
  }

  const beforeFor = (screen) => ROUTES.find((item) => item.name === screen)?.before
    || SHEETS.find((item) => item.name === screen)?.before || 'Fits';
  const causeFor = (screen) => ROUTES.find((item) => item.name === screen)?.cause
    || (screen === 'Push/pop/swipe/keyboard' ? 'Overlay lock + preserved page scrollers'
      : 'Added nb-scroll-lock, dvh sheet sizing, momentum scrolling and scrollable popup/success sheets');

  console.log('\nSCROLL AUDIT');
  console.log('screen | scrolls (before) | scrolls (after) | last item reachable | cause fixed');
  console.log('---|---|---|---|---');
  const byScreen = new Map();
  for (const row of results) {
    if (!byScreen.has(row.screen)) byScreen.set(row.screen, { after: {}, reachable: true });
    const entry = byScreen.get(row.screen);
    entry.after[`${row.viewport.width}`] = row.after || (row.state?.max > 0 ? 'Yes' : 'Fits');
    entry.reachable = entry.reachable && Boolean(row.reachable?.ok);
  }
  for (const [screen, entry] of byScreen) {
    const after = `390: ${entry.after['390'] || '-'}; 360: ${entry.after['360'] || '-'}`;
    console.log(`${screen} | ${beforeFor(screen)} | ${after} | ${entry.reachable ? 'Yes' : 'No'} | ${causeFor(screen)}`);
  }

  if (failures.length) {
    console.error(`\n${failures.length} scroll check failure(s):`);
    failures.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
  }
  console.log('\nAll scroll checks passed.');
}

main();
