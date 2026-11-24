/**
 * Item 12D - Android-like layout-shift walk.
 *
 * Emulates a mid-range Android phone on a slow network and walks every route,
 * sheet and lifecycle change, recording each layout shift with its source
 * element. Fails when any shift that is not caused by recent input is above
 * the budget (0.01 by default).
 *
 *   node scripts/stress-walk.mjs [label]
 *
 * Environment:
 *   STRESS_FONT_SCALES=1,1.15,1.3   text scales to run (text-size-adjust)
 *   STRESS_CLS_BUDGET=0.01          budget for any single non-input shift
 *   STRESS_DEBUG_PANEL=1            also assert the in-app debug panel adds no CLS
 *   STRESS_RATE=4                   CPU throttle (Playwright rate)
 *   STRESS_OFFLINE_NET=0            skip the slow-3G throttling
 *
 * Writes ../verify/item12d/<label>/stress-walk.json and stress-walk.md.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const label = process.argv[2] || 'after';
const root = process.cwd();
const port = 4270;
const base = `http://127.0.0.1:${port}`;
const outDir = path.resolve('..', 'verify', 'item12d', label);
const fontScales = (process.env.STRESS_FONT_SCALES || '1,1.15,1.3').split(',').map((value) => Number(value.trim()));
const budget = Number(process.env.STRESS_CLS_BUDGET || 0.01);
const reportFloor = 0.001;
const cpuRate = Number(process.env.STRESS_RATE || 4);
const slowNetwork = process.env.STRESS_OFFLINE_NET !== '0';
const debugPanel = process.env.STRESS_DEBUG_PANEL !== '0';
const passes = Math.max(1, Number(process.env.STRESS_REPEAT || 3));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await mkdir(outDir, { recursive: true });

const server = spawn(
  path.join(root, 'node_modules', '.bin', 'vite'),
  ['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: root, stdio: 'ignore' },
);

const waitServer = async () => {
  for (let i = 0; i < 120; i += 1) {
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(150);
  }
  throw new Error(`preview server did not start on ${port}`);
};

const initScript = (scale, debugPanel = false) => {
  try {
  if (debugPanel) localStorage.setItem('nbp-debug', '1');
  localStorage.setItem('nearbite_token', 'demo-token');
  localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Aarav', phone: '+91 98765 43210' }));
  sessionStorage.setItem('ew_offers_seen_v1', '["demo"]');
  localStorage.setItem(
    'nearbite_cart',
    JSON.stringify({
      'Masala Dosa': {
        quantity: 1,
        price: 99,
        resId: 1,
        isVeg: true,
        image: '',
        resName: 'Foodie Dosa Restaurant',
        restaurantName: 'Foodie Dosa Restaurant',
        menuItem: 'fd1',
        name: 'Masala Dosa',
      },
    }),
  );
  if (scale !== 1) {
    const style = document.createElement('style');
    style.textContent = `html{-webkit-text-size-adjust:${scale * 100}% !important}`;
    const attach = () => document.head && document.head.appendChild(style);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true });
    else attach();
  }
  /** Selector that identifies the source node, closest id first. */
  const describe = (node) => {
    if (!node) return 'unknown';
    const el = node.nodeType === 3 ? node.parentElement : node;
    if (!(el instanceof Element)) return String(node.nodeName || node);
    if (el.id) return '#' + el.id;
    const parts = [];
    let cur = el;
    for (let depth = 0; depth < 3 && cur && cur.nodeType === 1; depth += 1) {
      const cls = typeof cur.className === 'string' ? cur.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      parts.unshift(cur.tagName.toLowerCase() + (cls ? '.' + cls : ''));
      if (cur.id) {
        parts[0] = '#' + cur.id;
        break;
      }
      cur = cur.parentElement;
    }
    return parts.join('>');
  };
  const probe = (window.__stress = { entries: [], actionAt: 0 });
  const opaque = (color) => {
    const match = /rgba?\(([^)]+)\)/.exec(color || '');
    if (!match) return false;
    const parts = match[1].split(',').map((value) => Number(value.trim()));
    return parts.length < 4 || parts[3] >= 1;
  };
  // Assertion for "a shift behind the page you are looking at does not count":
  //  1. the route stage is not animating (no slide is in progress, so no part of
  //     an outgoing page is still on screen),
  //  2. the top route layer is opaque, untransformed and covers the viewport, so
  //     nothing behind it can be seen,
  //  3. every source of the shift either belongs to a route layer that is not
  //     the top one, or is no longer in the document (the outgoing page being
  //     replaced). React reuses the layer element, so a source can still resolve
  //     closest('.route-layer') to the top layer while being detached.
  // A shift that moves anything on the visible page fails (3): that node is
  // attached and inside the top layer. Detached sources are the outgoing page
  // being torn down; their collapse is reported by Chrome with the layer's own
  // elements as sources, and any visible consequence would surface as an extra,
  // attached source.
  const topSettled = () => {
    const stage = document.querySelector('.route-stage');
    if (stage && stage.classList.contains('is-animating')) return false;
    const top = document.querySelector('.route-layer.is-top');
    if (!top) return false;
    const style = getComputedStyle(top);
    if (style.visibility !== 'visible' || Number(style.opacity) !== 1) return false;
    if (style.transform !== 'none' && style.transform !== 'matrix(1, 0, 0, 1, 0, 0)') return false;
    if (!opaque(style.backgroundColor)) return false;
    const rect = top.getBoundingClientRect();
    return rect.left <= 0 && rect.top <= 0 && rect.right >= window.innerWidth && rect.bottom >= window.innerHeight;
  };
  const behindTop = (node) => {
    if (!node || node.nodeType !== 1) return true;
    // Not in the document any more: the outgoing page is being torn down. React
    // can reuse the layer element for the incoming page, so closest() still
    // finds a (now top) layer; membership is the honest test.
    if (!document.contains(node)) return true;
    const layer = node.closest('.route-layer');
    return !!layer && !layer.classList.contains('is-top');
  };
  const coveredNow = (sources) =>
    sources.length > 0 && topSettled() && sources.every((source) => behindTop(source.node));
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      probe.entries.push({
        t: Math.round(performance.now() - probe.actionAt),
        value: Number(entry.value.toFixed(5)),
        input: entry.hadRecentInput,
        // A modal that is animating its own exit is not a page shift: nothing
        // behind it moves and the overlay is leaving on purpose.
        overlay: !!document.querySelector(
          '.ew-os, .ewcs-sheet, .ct-sheet-root, .sheet-panel, #ew-search-root.is-open, .ew-theme-intro',
        ),
        covered: coveredNow(entry.sources || []),
        sources: (entry.sources || []).slice(0, 4).map((source) => ({
          selector: describe(source.node),
          layer: source.node && source.node.closest
            ? (source.node.closest('.route-layer') || { className: 'outside' }).className
            : 'detached',
          previous: source.previousRect
            ? {
                x: Math.round(source.previousRect.x),
                y: Math.round(source.previousRect.y),
                w: Math.round(source.previousRect.width),
                h: Math.round(source.previousRect.height),
              }
            : null,
          current: source.currentRect
            ? {
                x: Math.round(source.currentRect.x),
                y: Math.round(source.currentRect.y),
                w: Math.round(source.currentRect.width),
                h: Math.round(source.currentRect.height),
              }
            : null,
        })),
      });
    }
  }).observe({ type: 'layout-shift', buffered: true });
  window.__stressStart = () => {
    probe.entries = [];
    probe.actionAt = performance.now();
  };
  window.__stressRead = () => probe.entries.slice();
  } catch (error) {
    window.__stressError = String(error && error.stack ? error.stack : error);
  }
};

/** Known fixes, matched against the source selectors of a scenario. */
const FIXES = [
  {
    match: /#menu-footer|rmf-dis|\.menu-item|nb-item-media|nb-item-image/,
    fix: 'restaurant page renders its full menu during prepare (ready on first render); image boxes are aspect-ratio reserved',
  },
  { match: /u99-item-img|u99-item-image/, fix: 'food image boxes use aspect-ratio so late loads cannot resize the card' },
  { match: /ew-search-thumb|ew-search-/, fix: 'search thumbs are fixed-size boxes' },
  { match: /cat-result-img/, fix: 'category results reserve the image box' },
  { match: /login-hero-art/, fix: 'login hero has intrinsic width/height' },
  { match: /header-slide__art|hero-art/, fix: 'hero art is absolutely positioned inside a fixed-aspect banner' },
  { match: /wc-img|ew-cd-logo/, fix: 'cart thumbnails use fixed boxes' },
  { match: /u99-restaurant-name|u99-meta|u99-free-row|u99-discount-line|u99-card/, fix: 'home cards keep a fixed copy block; fonts are primed before the first route' },
  { match: /filter-pill|u99-filter|chip/, fix: 'filter rows keep a fixed row height' },
  { match: /font/i, fix: 'bundled fonts are primed before render' },
];

const fixFor = (selectors) => {
  for (const rule of FIXES) if (selectors.some((selector) => rule.match.test(selector))) return rule.fix;
  return '';
};

await waitServer();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});

const ensureCartBar = async (page) => {
  // Closing the customization sheet cancels the pending add, and a completed
  // checkout empties the cart, so later passes can reach this step with an
  // empty cart and no bar to tap. Add one plain item (no sheet) in that case.
  if (await page.locator('#es-pink-inner').count()) return;
  const plain = page.locator('.nb-add-btn:not(.nb-add-btn--cust)').first();
  await plain.click({ timeout: 15000 });
  await page.waitForSelector('#es-pink-inner', { timeout: 15000 });
};

const scenarios = [];

const record = async (page, name, action, settle = 1200) => {
  // The probe lives in an init script, so it only exists once a document of the
  // app is loaded (the first scenario navigates as its action).
  await page.evaluate(() => {
    if (typeof window.__stressStart === 'function') window.__stressStart();
  });
  let skipped = '';
  try {
    await action();
  } catch (error) {
    skipped = String(error && error.message ? error.message.split('\n')[0] : error);
  }
  await sleep(settle);
  const entries = await page.evaluate(() => {
    const describe = (node) => {
      if (!node || node.nodeType !== 1) return null;
      const parts = [];
      let cur = node;
      for (let depth = 0; depth < 4 && cur && cur.nodeType === 1; depth += 1) {
        const cls = typeof cur.className === 'string' ? cur.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
        parts.unshift(cur.tagName.toLowerCase() + (cls ? '.' + cls : '') + (cur.id ? '#' + cur.id : ''));
        cur = cur.parentElement;
      }
      return parts.join('>');
    };
    window.__stressLastRead = null;
    const entries = window.__stressRead();
    // When Chrome drops the source node (the element was removed) the rect is
    // still reported: name whatever occupies that band now, so the table can
    // point at a real selector instead of "unknown".
    for (const entry of entries) {
      for (const source of entry.sources) {
        if (source.selector !== 'unknown' || !source.previous) continue;
        const probeY = Math.max(0, Math.min(window.innerHeight - 1, source.previous.y + 2));
        const probeX = Math.round(window.innerWidth / 2);
        source.selector = `region@y${Math.round(probeY)}:${describe(document.elementFromPoint(probeX, probeY)) || 'none'}`;
      }
    }
    return entries;
  });
  const coveredDriven = entries.filter((entry) => !entry.input && !entry.overlay && entry.covered);
  const nonInput = entries.filter((entry) => !entry.input && !entry.overlay && !entry.covered);
  const overlayDriven = entries.filter((entry) => !entry.input && entry.overlay);
  const inputDriven = entries.filter((entry) => entry.input);
  const selectors = [...new Set(nonInput.flatMap((entry) => entry.sources.map((source) => source.selector)))];
  const scenario = {
    name,
    skipped,
    nonInputTotal: Number(nonInput.reduce((sum, entry) => sum + entry.value, 0).toFixed(5)),
    overlayTotal: Number(overlayDriven.reduce((sum, entry) => sum + entry.value, 0).toFixed(5)),
    coveredTotal: Number(coveredDriven.reduce((sum, entry) => sum + entry.value, 0).toFixed(5)),
    inputDrivenTotal: Number(inputDriven.reduce((sum, entry) => sum + entry.value, 0).toFixed(5)),
    shifts: entries
      .filter((entry) => entry.value > reportFloor)
      .map((entry) => ({
        t: entry.t,
        value: entry.value,
        input: entry.input,
        covered: !!entry.covered,
        sources: entry.sources,
      })),
    selectors,
    fix: fixFor(selectors),
  };
  scenarios.push(scenario);
  const worst = nonInput.reduce((max, entry) => Math.max(max, entry.value), 0);
  const flag = skipped || worst > budget ? 'FAIL' : 'PASS';
  console.log(
    `${flag} [${scenario.name}] non-input ${scenario.nonInputTotal.toFixed(4)} (worst ${worst.toFixed(4)}), ` +
      `input ${scenario.inputDrivenTotal.toFixed(4)}` +
      (scenario.overlayTotal > 0 ? `, modal-exit ${scenario.overlayTotal.toFixed(4)}` : '') +
      (scenario.coveredTotal > 0 ? `, covered ${scenario.coveredTotal.toFixed(4)}` : '') +
      (selectors.length ? ` :: ${selectors.slice(0, 3).join(' | ')}` : '') +
      (skipped ? ` [SKIPPED: ${skipped}]` : ''),
  );
  return scenario;
};

try {
  for (const scale of fontScales) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2.75,
      isMobile: true,
      hasTouch: true,
    });
    await context.addInitScript(initScript, scale);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    if (slowNetwork) {
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 400,
        downloadThroughput: (400 * 1024) / 8,
        uploadThroughput: (400 * 1024) / 8,
        connectionType: 'cellular3g',
      });
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });

    const runJourney = async (pass, suffix = '') => {
      const tag = `font-scale ${scale}, pass ${pass}${suffix}`;
      const visit = async (hash, readySelector) => {
        await page.goto(`${base}/#${hash}`, { waitUntil: 'domcontentloaded' });
        if (readySelector) await page.waitForSelector(readySelector, { timeout: 90000 });
        await sleep(900);
      };

      await record(
        page,
        `load: Home (${tag}, slow 3G, ${cpuRate}x CPU)`,
        () => visit('/', '#restaurant-list .u99-restaurant-card'),
        1600,
      );

      await record(
        page,
        `tab: Home -> History -> Home (${tag})`,
        async () => {
          await page.locator('[data-nav-item="/orders"]').click();
          await page.waitForTimeout(700);
          await page.locator('[data-nav-item="/"]').click();
        },
        1300,
      );

      await record(
        page,
        `sheet: Home filter open+drag+close (${tag})`,
        async () => {
          await page.locator('.filter-pill-sheet').first().click();
          await page.waitForSelector('.filter-sheet .sheet-panel', { timeout: 30000 });
          await sleep(700);
          await page.keyboard.press('Escape');
        },
        1000,
      );

      await record(
        page,
        `overlay: search open+close (${tag})`,
        async () => {
          await page.locator('.search-box').first().click();
          await page.waitForSelector('#ew-search-root.is-open', { state: 'attached', timeout: 30000 });
          await sleep(800);
          await page.keyboard.press('Escape');
        },
        1100,
      );

      await record(
        page,
        `push: Home -> Restaurant (${tag})`,
        async () => {
          await page.locator('.u99-restaurant-head').first().click();
          await page.waitForSelector('.menu-item', { timeout: 60000 });
        },
        1500,
      );

      await record(
        page,
        `sheet: Restaurant customization open+close (${tag})`,
        async () => {
          const customise = page.locator('.nb-add-btn--cust, .nb-add-btn').first();
          await customise.click();
          await page.waitForSelector('.ewcs-sheet.show', { timeout: 30000 });
          await sleep(600);
          // Close it for good, otherwise the backdrop keeps the ADD buttons and
          // the cart bar covered and the next scenario cannot tap. The explicit
          // close control is the only path that survives a large text scale at
          // 4x CPU, where Escape and the backdrop tap can both land on a
          // still-animating layer.
          for (const attempt of [0, 1, 2]) {
            if (!(await page.locator('.ewcs-sheet.show').count())) break;
            if (attempt === 0) {
              await page.locator('#ewcs-sheet .ewcs-close').first().click({ timeout: 5000 }).catch(() => undefined);
            } else if (attempt === 1) {
              await page.keyboard.press('Escape');
            } else {
              await page.locator('.ewcs-backdrop.show').first().click({ timeout: 3000 }).catch(() => undefined);
            }
            await page.waitForSelector('.ewcs-sheet.show', { state: 'detached', timeout: 5000 }).catch(() => undefined);
          }
          await page
            .waitForSelector('.ewcs-backdrop.show', { state: 'detached', timeout: 8000 })
            .catch(() => {
              throw new Error('customize sheet did not close; next scenario would tap a covered layer');
            });
        },
        1200,
      );

      await record(
        page,
        `push: Restaurant -> Cart (${tag})`,
        async () => {
          try {
            await ensureCartBar(page);
            await page.locator('#es-pink-inner').click({ timeout: 8000 });
          } catch (error) {
            const state = await page.evaluate(() => {
              const bar = document.querySelector('#white-cart-root');
              const inner = document.querySelector('#es-pink-inner');
              if (!bar || !inner) return { bar: false, inner: false, body: document.body.className };
              const r = bar.getBoundingClientRect();
              const ri = inner.getBoundingClientRect();
              const hit = document.elementFromPoint(Math.round(ri.x + ri.width / 2), Math.round(ri.y + ri.height / 2));
              const cs = getComputedStyle(bar);
              return {
                bar: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`,
                inner: `${Math.round(ri.x)},${Math.round(ri.y)} ${Math.round(ri.width)}x${Math.round(ri.height)}`,
                display: cs.display,
                opacity: cs.opacity,
                transform: cs.transform,
                pointerEvents: cs.pointerEvents,
                animations: bar.getAnimations().map((a) => `${a.animationName || a.id}:${a.playState}`),
                hit: hit ? `${hit.tagName.toLowerCase()}${hit.id ? '#' + hit.id : ''}` : 'none',
                sheetsOpen: document.querySelectorAll('.ewcs-sheet.show, .ewcs-backdrop.show').length,
                body: document.body.className,
                vh: innerHeight,
              };
            });
            console.log(`  cart-bar state on failed tap: ${JSON.stringify(state)}`);
            throw error;
          }
          await page.waitForSelector('.ct-cta', { timeout: 60000 });
        },
        1300,
      );

      await record(
        page,
        `sheet: Cart coupon open+close (${tag})`,
        async () => {
          const coupon = page.locator('#coupon-card').first();
          await coupon.scrollIntoViewIfNeeded().catch(() => undefined);
          await coupon.click({ timeout: 15000 });
          await page.waitForSelector('#ct-coupon-sheet.is-open', { state: 'attached', timeout: 30000 });
          await sleep(700);
          await page.keyboard.press('Escape');
        },
        1200,
      );

      await record(
        page,
        `push: Cart -> Tracking (checkout + success sheet) (${tag})`,
        async () => {
          await page.locator('.ct-cta').first().click();
          await page.waitForSelector('#btn-checkout', { timeout: 60000 });
          await page.locator('#btn-checkout').click();
          await page.waitForSelector('.ew-os__btn', { timeout: 60000 });
        },
        1800,
      );

      await record(
        page,
        `pop: order success -> Tracking (${tag})`,
        async () => {
          await page.locator('.ew-os__btn').click();
          await page.waitForSelector('.floating-back', { timeout: 60000 });
        },
        1500,
      );

      await record(
        page,
        `pop: Tracking -> back (${tag})`,
        async () => {
          await page.locator('.floating-back').first().click();
          await sleep(1200);
        },
        1300,
      );

      // The exact path a user takes from a menu to the cart, in one
      // continuous sequence: restaurant -> customisation sheet open+close ->
      // add -> cart. Gated on its own so a stylesheet or layout change that
      // only shows up when the two pages are mounted together cannot hide in
      // two separate scenarios.
      // Getting back to a menu is setup, not the measured path: the Home tab
      // re-entry has its own reflow characteristics that belong to the Home
      // scenarios, and folding them in would attribute them to the cart push.
      await page.evaluate(() => {
        window.location.hash = '#/';
      });
      await page.waitForSelector('.u99-restaurant-head', { timeout: 60000 });
      await sleep(900);
      await page.locator('.u99-restaurant-head').first().click();
      await page.waitForSelector('.menu-item', { timeout: 60000 });
      await sleep(900);

      await record(
        page,
        `restaurant -> customise -> add -> cart (${tag})`,
        async () => {
          const customise = page.locator('.nb-add-btn--cust').first();
          if (await customise.count()) {
            await customise.click({ timeout: 8000 });
            await page.waitForSelector('.ewcs-sheet.show', { timeout: 30000 });
            await sleep(500);
            await page.locator('#ewcs-sheet .ewcs-close').first().click({ timeout: 5000 });
            await page
              .waitForSelector('.ewcs-backdrop.show', { state: 'detached', timeout: 8000 });
          }
          await ensureCartBar(page);
          await page.locator('#es-pink-inner').click({ timeout: 15000 });
          await page.waitForSelector('.ct-cta', { timeout: 60000 });
        },
        1500,
      );

      await record(
        page,
        `lifecycle: background -> foreground (${tag})`,
        async () => {
          await cdp.send('Page.setWebLifecycleState', { state: 'frozen' }).catch(() => undefined);
          await sleep(700);
          await cdp.send('Page.setWebLifecycleState', { state: 'active' }).catch(() => undefined);
        },
        1400,
      );

    };
    for (let pass = 1; pass <= passes; pass += 1) {
      await runJourney(pass);
    }
    await context.close();

    // The field debug panel must not move anything: same cart sequence with the
    // overlay mounted, gated like every other scenario.
    if (debugPanel && scale === fontScales[0]) {
      const debugContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2.75,
        isMobile: true,
        hasTouch: true,
      });
      await debugContext.addInitScript(initScript, [scale, true]);
      const debugPage = await debugContext.newPage();
      const debugCdp = await debugContext.newCDPSession(debugPage);
      if (slowNetwork) {
        await debugCdp.send('Network.enable');
        await debugCdp.send('Network.emulateNetworkConditions', {
          offline: false,
          latency: 400,
          downloadThroughput: (400 * 1024) / 8,
          uploadThroughput: (400 * 1024) / 8,
          connectionType: 'cellular3g',
        });
      }
      await debugCdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
      // Settle Home outside the probe: the panel assertion is about the cart
      // sequence, not about the cold first paint of the home tab.
      await debugPage.goto(`${base}/#/`, { waitUntil: 'domcontentloaded' });
      await debugPage.waitForSelector('.u99-restaurant-head', { timeout: 90000 });
      await sleep(1500);
      await record(
        debugPage,
        `restaurant -> customise -> add -> cart (debug panel on, font-scale ${scale})`,
        async () => {
          await debugPage.locator('.u99-restaurant-head').first().click();
          await debugPage.waitForSelector('.menu-item', { timeout: 60000 });
          await sleep(600);
          await debugPage.locator('.nb-add-btn--cust, .nb-add-btn').first().click();
          await debugPage.waitForSelector('.ewcs-sheet.show', { timeout: 30000 });
          await sleep(500);
          await debugPage.locator('#ewcs-sheet .ewcs-close').first().click({ timeout: 5000 }).catch(() => undefined);
          await debugPage.waitForSelector('.ewcs-sheet.show', { state: 'detached', timeout: 8000 }).catch(() => undefined);
          await debugPage
            .waitForSelector('.ewcs-backdrop.show', { state: 'detached', timeout: 8000 })
            .catch(() => undefined);
          await sleep(300);
          await ensureCartBar(debugPage);
          await debugPage.locator('#es-pink-inner').click();
          await debugPage.waitForSelector('.ct-cta', { timeout: 60000 });
        },
        1300,
      );
      await debugContext.close();
    }
  }
} finally {
  await browser.close();
  server.kill('SIGTERM');
}

// A shift that only shows up in one of the two passes is cold-cache noise (the
// first launch of the app pays for a font or a chunk); a shift that reproduces
// in every pass is a real layout bug and fails the gate.
const family = (name) => name.replace(/, pass \d+/, '');
const byFamily = new Map();
for (const scenario of scenarios) {
  const key = family(scenario.name);
  const entry = byFamily.get(key) || { key, totals: [], worst: 0 };
  entry.totals.push(scenario.nonInputTotal);
  entry.worst = Math.max(entry.worst, scenario.nonInputTotal);
  byFamily.set(key, entry);
}
const reproducible = [];
const flaky = [];
for (const entry of byFamily.values()) {
  if (entry.worst <= budget) continue;
  if (entry.totals.every((total) => total > budget)) reproducible.push(entry);
  else flaky.push(entry);
}
for (const scenario of scenarios) {
  const entry = byFamily.get(family(scenario.name));
  scenario.reproducible = entry.totals.every((total) => total > budget) && entry.worst > budget;
  scenario.flaky = !scenario.reproducible && entry.worst > budget;
}
// Gate on single entries: one non-input shift above the budget in any pass is a
// failure, not only a shift that reproduces in every pass.
const overBudget = [];
for (const scenario of scenarios) {
  if (scenario.skipped) {
    overBudget.push(`${scenario.name}: did not run (${scenario.skipped}) — a skipped scenario is a failure`);
  }
  for (const shift of scenario.shifts) {
    if (shift.input || shift.covered || shift.value <= budget) continue;
    const source = shift.sources.map((item) => item.selector).filter(Boolean).slice(0, 2).join(' | ') || 'unknown';
    overBudget.push(`${scenario.name}: entry ${shift.value.toFixed(4)} > ${budget} :: ${source}`);
    if (process.env.STRESS_TRACE_SHIFT) console.log(`  shift detail: ${JSON.stringify(shift)}`);
  }
}
const failures = overBudget;

const summary = {
  label,
  measuredAt: new Date().toISOString(),
  config: { fontScales, cpuRate, budget, reportFloor, slowNetwork, viewport: '390x844@2.75', passes },
  scenarios,
  failures,
  flaky: flaky.map((entry) => `${entry.key}: worst ${entry.worst.toFixed(4)} on one pass only`),
  skipped: scenarios.filter((scenario) => scenario.skipped).length,
  failuresByEntry: overBudget,
  pass: failures.length === 0,
};
await writeFile(path.join(outDir, 'stress-walk.json'), `${JSON.stringify(summary, null, 2)}\n`);

const rows = [
  '| route / action | shifts > 0.001 (non-input) | source element | fix |',
  '| --- | --- | --- | --- |',
];
for (const scenario of scenarios) {
  const shifts = scenario.shifts.filter((shift) => !shift.input);
  const total = shifts.reduce((sum, shift) => sum + shift.value, 0);
  const source = shifts.length ? shifts[0].sources.map((item) => item.selector).slice(0, 2).join('<br>') : '—';
  const value = shifts.length ? `${shifts.length} · Σ ${total.toFixed(4)} (worst ${Math.max(...shifts.map((shift) => shift.value)).toFixed(4)})` : '0';
  const modal = scenario.overlayTotal > 0 ? ` *(modal exit Σ ${scenario.overlayTotal.toFixed(4)}, excluded)*` : '';
  const note = scenario.skipped ? ` (skipped: ${scenario.skipped.slice(0, 60)})` : '';
  rows.push(`| ${scenario.name}${note} | ${value} | ${source} | ${shifts.length ? scenario.fix || '—' : '—'} |`);
}
await writeFile(path.join(outDir, 'stress-walk.md'), `${rows.join('\n')}\n`);

console.log(`\nSaved ${path.relative(path.resolve('..'), outDir)}`);
if (summary.flaky.length) {
  console.warn(`\nSingle-pass shifts above the budget (now gated by entry):\n${summary.flaky.join('\n')}`);
}
if (failures.length) {
  console.error(`\n${failures.length} stress-walk CLS failure(s) (any entry > budget):\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('\nStress walk clean: no non-input shift above the budget.');
