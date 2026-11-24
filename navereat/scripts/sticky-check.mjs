/* Sticky search bar audit for the Home header.

   Scrolls with real touch gestures (CDP Input.synthesizeScrollGesture, not
   scrollTop writes), then checks that the search row stays glued to the top of
   the viewport at 390x844 and 360x640, after the Home -> Restaurant -> back
   round trip, after the search overlay opens and closes, and after the tab goes
   to the background and comes back. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const outDir = path.join(repoRoot, 'verify', 'item12b');
const base = 'http://127.0.0.1:4188';
const TARGETS = [100, 400, 1500, 3000];
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];

function check(name, condition, detail = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

const clsProbe = () => {
  window.__cls = 0;
  window.__clsEntries = [];
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        window.__cls += entry.value;
        window.__clsEntries.push({ value: entry.value });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {
    /* layout-shift unsupported */
  }
  window.__resetCls = () => {
    window.__cls = 0;
    window.__clsEntries = [];
  };
};

async function seed(context) {
  await context.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('nearbite_token', 'demo-token');
    localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Aarav', phone: '+91 98765 43210', email: 'demo@navereat.app' }));
    sessionStorage.setItem('ew_offers_seen_v1', '["demo"]');
  });
}

async function state(page) {
  return page.evaluate(() => {
    const row = document.querySelector('.search-row');
    const box = document.querySelector('.search-row .search-box');
    const header = document.querySelector('.hero-header');
    const sheet = document.querySelector('.hero-sheet');
    const scroller = document.querySelector('.home-scroll');
    const screen = document.querySelector('.home-screen');
    const rect = (element) => {
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return { x: Math.round(r.x * 100) / 100, y: Math.round(r.y * 100) / 100, width: Math.round(r.width * 100) / 100, height: Math.round(r.height * 100) / 100 };
    };
    const boxRect = box?.getBoundingClientRect();
    const hit = boxRect ? document.elementFromPoint(boxRect.x + boxRect.width / 2, boxRect.y + boxRect.height / 2) : null;
    return {
      scrollTop: scroller ? Math.round(scroller.scrollTop) : -1,
      row: rect(row),
      box: rect(box),
      header: rect(header),
      sheet: rect(sheet),
      headerPosition: header ? getComputedStyle(header).position : '',
      headerTop: header ? getComputedStyle(header).top : '',
      hp: screen ? getComputedStyle(screen).getPropertyValue('--hp').trim() : '',
      pinTop: screen ? getComputedStyle(screen).getPropertyValue('--pin-top').trim() : '',
      flowHeight: header && sheet ? Math.round((header.offsetHeight + sheet.offsetHeight) * 100) / 100 : -1,
      scrollHeight: scroller ? scroller.scrollHeight : -1,
      feedTop: document.querySelector('.home-main') ? document.querySelector('.home-main').offsetTop : -1,
      hitInRow: Boolean(hit && hit.closest('.search-row')),
      hitClass: hit ? String(hit.className).slice(0, 48) : '',
      cls: window.__cls ?? -1,
    };
  });
}

// A real finger drag: touchStart, stepped touchMove, touchEnd. Chromium scrolls
// the route scroller natively and keeps the fling, so this exercises the same
// path as a phone (no scrollTop writes).
async function dragByTouch(cdp, page, distance, { fling = false, startRatio = distance >= 0 ? 0.9 : 0.15 } = {}) {
  const view = page.viewportSize();
  const x = Math.round(view.width / 2);
  const startY = Math.round(view.height * startRatio);
  const steps = 12;
  const step = distance / steps;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
  for (let i = 1; i <= steps; i += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(startY - step * i) }] });
    await sleep(fling ? 5 : 14);
  }
  if (!fling) {
    // Creep the last pixels so the release velocity is near zero: the gesture
    // lands where the finger stopped instead of flinging past it, and it stays
    // a scroll (a still finger would be read as a tap).
    let y = Math.round(startY - distance);
    for (let i = 0; i < 3; i += 1) {
      y -= 1;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
      await sleep(35);
    }
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

// Real pointer tap at the element's on-screen centre, without Playwright's
// scroll-into-view (which would move the page under test).
async function tapVisible(page, selector, minY = 80) {
  const point = await page.evaluate(([sel, floor]) => {
    const nodes = [...document.querySelectorAll(sel)];
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (rect.width < 4 || rect.height < 4) continue;
      if (cy < floor || cy > window.innerHeight - 20) continue;
      if (cx < 4 || cx > window.innerWidth - 4) continue;
      const hit = document.elementFromPoint(cx, cy);
      if (hit && (hit === node || node.contains(hit))) return { x: Math.round(cx), y: Math.round(cy) };
    }
    return null;
  }, [selector, minY]);
  if (!point) throw new Error(`no on-screen ${selector} to tap`);
  await page.mouse.click(point.x, point.y);
}

async function onHome(page) {
  const hash = await page.evaluate(() => location.hash);
  return !hash || hash === '#/' || hash === '#';
}

async function recoverHome(page) {
  if (await onHome(page)) return;
  const back = page.locator('.ew-hd-back, .floating-back').first();
  if (await back.count()) await back.click({ force: true }).catch(() => {});
  await page.waitForTimeout(800);
}

const readTop = (page) => page.evaluate(() => Math.round(document.querySelector('.home-scroll')?.scrollTop ?? 0));

// One drag from a start point that is over a plain vertical scroll area. Some
// start points sit on a horizontal carousel that swallows the gesture, so the
// drag is retried from another spot when nothing moved.
async function dragWithFallback(page, cdp, delta, fling = false) {
  const before = await readTop(page);
  const ratios = delta >= 0 ? [0.9, 0.72, 0.55] : [0.15, 0.3, 0.45];
  for (const ratio of ratios) {
    await dragByTouch(cdp, page, delta, { fling, startRatio: ratio });
    await sleep(fling ? 120 : 260);
    const after = await readTop(page);
    if (after !== before) return after;
  }
  return readTop(page);
}

async function scrollTo(page, cdp, target) {
  let current = 0;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    current = await readTop(page);
    const diff = target - current;
    const tolerance = target === 0 ? 2 : 40;
    // A drag under ~16px reads as a tap and would open whatever card sits under
    // the finger, so small corrections are only made down to that size.
    if (Math.abs(diff) <= tolerance || (target !== 0 && Math.abs(diff) < 16)) break;
    const span = Math.round((page.viewportSize()?.height ?? 800) * 0.45);
    const delta = Math.max(-span, Math.min(span, diff));
    await dragWithFallback(page, cdp, delta);
  }
  return current;
}

const server = await preview({ root: appRoot, logLevel: 'error', preview: { host: '127.0.0.1', port: 4188, strictPort: true } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const report = { viewports: {}, failures };

try {
  await mkdir(outDir, { recursive: true });

  for (const viewport of VIEWPORTS) {
    const label = `${viewport.width}x${viewport.height}`;
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await seed(context);
    await context.addInitScript(clsProbe);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.search-row');
    await sleep(900);

    const rest = await state(page);
    check(`[${label}] header is sticky`, rest.headerPosition === 'sticky', `${rest.headerPosition} top=${rest.headerTop}`);
    check(`[${label}] pin distance measured`, parseInt(rest.pinTop, 10) > 0, rest.pinTop);
    check(`[${label}] at rest the row is in flow`, rest.row.y > 0, `row.y=${rest.row.y}`);
    const rowHeight = rest.row.height;
    const flowHeight = rest.flowHeight;
    await page.screenshot({ path: path.join(outDir, `sticky-${label}-scroll-0.png`) });

    report.viewports[label] = { rest, rowHeight, flowHeight, positions: {} };

    for (const target of TARGETS) {
      await page.evaluate(() => window.__resetCls?.());
      await scrollTo(page, cdp, target);
      await sleep(260);
      if (!(await onHome(page))) {
        // A mis-read gesture opened a restaurant; go back and try again.
        await recoverHome(page);
        await scrollTo(page, cdp, target);
        await sleep(320);
      }
      const now = await state(page);
      report.viewports[label].positions[target] = now;
      const pinned = Math.abs(now.row.y) <= 1;
      check(`[${label}] scrollTop ${target}: row pinned at top`, pinned, `row.y=${now.row.y} scrollTop=${now.scrollTop}`);
      check(`[${label}] scrollTop ${target}: row keeps its height`, Math.abs(now.row.height - rowHeight) <= 0.5, `${now.row.height} vs ${rowHeight}`);
      check(`[${label}] scrollTop ${target}: collapse complete`, now.hp === '1.000', `--hp=${now.hp}`);
      check(`[${label}] scrollTop ${target}: search box is hittable`, now.hitInRow, now.hitClass);
      check(`[${label}] scrollTop ${target}: no layout shift while scrolling`, now.cls <= 0.01, `cls=${now.cls}`);
      check(`[${label}] scrollTop ${target}: header flow height unchanged`, Math.abs(now.flowHeight - flowHeight) <= 0.5, `${now.flowHeight} vs ${flowHeight}`);
      check(`[${label}] scrollTop ${target}: layout height unchanged`, now.scrollHeight === rest.scrollHeight, `${now.scrollHeight} vs ${rest.scrollHeight}`);
      check(`[${label}] scrollTop ${target}: feed keeps its flow offset`, Math.abs(now.feedTop - rest.feedTop) <= 0.5, `${now.feedTop} vs ${rest.feedTop}`);
      await page.screenshot({ path: path.join(outDir, `sticky-${label}-scroll-${target}.png`) });
    }

    // A fast flick (momentum scrolling) must keep the bar glued too.
    await scrollTo(page, cdp, 600);
    await sleep(250);
    await page.evaluate(() => window.__resetCls?.());
    await dragWithFallback(page, cdp, 320, true);
    const flingSamples = [];
    for (let i = 0; i < 6; i += 1) {
      flingSamples.push(await state(page));
      await sleep(90);
    }
    const flingTop = await state(page);
    report.viewports[label].fling = { samples: flingSamples.map((entry) => ({ scrollTop: entry.scrollTop, rowY: entry.row.y })), cls: flingTop.cls };
    check(`[${label}] fling: momentum carried past the finger`, flingTop.scrollTop > flingSamples[0].scrollTop + 40, flingSamples.map((entry) => entry.scrollTop).join(','));
    check(`[${label}] fling: row pinned through every sample`, flingSamples.every((entry) => Math.abs(entry.row.y) <= 1) && Math.abs(flingTop.row.y) <= 1, flingSamples.map((entry) => entry.row.y).join(','));
    check(`[${label}] fling: no layout shift`, flingTop.cls <= 0.01, `cls=${flingTop.cls}`);
    await page.screenshot({ path: path.join(outDir, `sticky-${label}-fling.png`) });

    // Search overlay open/close keeps the pin.
    await scrollTo(page, cdp, 1500);
    await sleep(200);
    await page.locator('.search-row .search-box').click();
    await page.waitForSelector('#ew-search-root.is-open', { timeout: 5000 });
    await sleep(450);
    await page.keyboard.press('Escape');
    await sleep(550);
    const afterOverlay = await state(page);
    report.viewports[label].afterOverlay = afterOverlay;
    check(`[${label}] after search open/close: row still pinned`, Math.abs(afterOverlay.row.y) <= 1, `row.y=${afterOverlay.row.y} scrollTop=${afterOverlay.scrollTop}`);
    check(`[${label}] after search open/close: tap target alive`, afterOverlay.hitInRow, afterOverlay.hitClass);
    await page.screenshot({ path: path.join(outDir, `sticky-${label}-after-search.png`) });

    // Home -> Restaurant -> back, tapping a card that is actually on screen
    // (a locator click would scroll it into view first and move the page).
    await tapVisible(page, '.u99-restaurant-head');
    await page.waitForSelector('.rest-page', { timeout: 8000 });
    await sleep(700);
    await tapVisible(page, '.rest-page .ew-hd-back', 4);
    await page.waitForSelector('.home-screen', { timeout: 8000 });
    await sleep(800);
    const afterBack = await state(page);
    report.viewports[label].afterBack = afterBack;
    check(`[${label}] after Home -> Restaurant -> back: scroll restored`, Math.abs(afterBack.scrollTop - 1500) <= 40, `scrollTop=${afterBack.scrollTop}`);
    check(`[${label}] after back: row pinned`, Math.abs(afterBack.row.y) <= 1, `row.y=${afterBack.row.y}`);
    check(`[${label}] after back: collapse matches scroll`, afterBack.scrollTop < 100 ? afterBack.hp === '0.000' : afterBack.hp === '1.000', `--hp=${afterBack.hp}`);
    await page.screenshot({ path: path.join(outDir, `sticky-${label}-after-back.png`) });

    // Background / foreground.
    const other = await context.newPage();
    await other.goto('about:blank');
    await other.bringToFront();
    await sleep(700);
    await page.bringToFront();
    await page.waitForFunction(() => document.visibilityState === 'visible', null, { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await sleep(500);
    const afterBg = await state(page);
    report.viewports[label].afterBackground = afterBg;
    check(`[${label}] after background/foreground: row pinned`, Math.abs(afterBg.row.y) <= 1, `row.y=${afterBg.row.y} scrollTop=${afterBg.scrollTop}`);
    check(`[${label}] after background/foreground: no stale collapse`, afterBg.hp === '1.000', `--hp=${afterBg.hp}`);
    await page.screenshot({ path: path.join(outDir, `sticky-${label}-after-background.png`) });
    await other.close();

    // Back to the top: the row must return to its original place.
    await scrollTo(page, cdp, 0);
    await sleep(400);
    let top = await state(page);
    if (top.scrollTop > 2) {
      await scrollTo(page, cdp, 0);
      await sleep(400);
    }
    report.viewports[label].backToTop = top;
    // A slow drag lands within a few px of the top; the header must then be
    // back in its at-rest geometry (row.y = pin distance - scrollTop).
    const topOffset = top.scrollTop;
    check(`[${label}] back at top: scrollTop near 0`, topOffset <= 24, `scrollTop=${topOffset}`);
    check(`[${label}] back at top: row in its original slot`, Math.abs(top.row.y - (rest.row.y - topOffset)) <= 1, `${top.row.y} vs ${rest.row.y - topOffset}`);
    check(`[${label}] back at top: collapse matches scroll`, Math.abs(parseFloat(top.hp) - Math.min(1, topOffset / parseInt(rest.pinTop, 10))) <= 0.02, `--hp=${top.hp}`);
    check(`[${label}] back at top: banner restored`, Math.abs(top.sheet.y - (rest.sheet.y - topOffset)) <= 1, `${top.sheet?.y} vs ${rest.sheet?.y - topOffset}`);
    await page.screenshot({ path: path.join(outDir, `sticky-${label}-back-to-top.png`) });

    await context.close();
  }

  // Print the evidence table.
  console.log('\n| viewport | scrollTop | row.y | row.h | --hp | cls | pinned |');
  console.log('| --- | --- | --- | --- | --- | --- | --- |');
  for (const [label, data] of Object.entries(report.viewports)) {
    for (const target of TARGETS) {
      const entry = data.positions[target];
      if (!entry) continue;
      console.log(`| ${label} | ${entry.scrollTop} | ${entry.row.y} | ${entry.row.height} | ${entry.hp} | ${entry.cls} | ${Math.abs(entry.row.y) <= 1 ? 'yes' : 'no'} |`);
    }
    for (const [name, entry] of Object.entries({ afterSearch: data.afterOverlay, afterBack: data.afterBack, afterBackground: data.afterBackground, backToTop: data.backToTop })) {
      if (!entry) continue;
      console.log(`| ${label} | ${name} (${entry.scrollTop}) | ${entry.row.y} | ${entry.row.height} | ${entry.hp} | ${entry.cls} | ${Math.abs(entry.row.y) <= 1 || name === 'backToTop' ? 'n/a' : 'no'} |`);
    }
  }

  await writeFile(path.join(outDir, 'sticky-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (failures.length) {
    console.error(`\n${failures.length} sticky check failure(s)`);
    process.exitCode = 1;
  } else {
    console.log('\nAll sticky-bar checks passed.');
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(() => resolve()));
}
