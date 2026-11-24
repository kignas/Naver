import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const label = process.argv[2] || 'run';
const cpuRate = Number(process.env.PERF_RATE || 1);
const minFps = Number(process.env.PERF_MIN_FPS || 55);
const legacyFps = process.env.PERF_METHOD === 'legacy';
const root = process.cwd();
const port = 4210 + (label === 'after' ? 1 : 0);
const base = `http://127.0.0.1:${port}`;
const outDir = path.resolve('..', 'verify');
await mkdir(outDir, { recursive: true });

const server = spawn(path.join(root, 'node_modules', '.bin', 'vite'), ['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
});
const waitServer = async () => {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`preview server did not start on ${port}`);
};

const seed = () => {
  localStorage.setItem('nearbite_token', 'demo-token');
  localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Sagnik', phone: '+91 98765 43210' }));
  localStorage.setItem('nearbite_cart', JSON.stringify({
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
    },
  }));
  localStorage.setItem('nearbite_orders', '[]');
};

const initScript = () => {
  const perf = (window.__perf = {
    homeAt: null,
    cls: 0,
    fpsFrames: [],
    fpsStart: 0,
    fpsOn: false,
  });
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) perf.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {
    /* layout-shift unsupported */
  }
  const startObserving = () => {
    const observer = new MutationObserver(() => {
      if (perf.homeAt == null && document.querySelector('#home-header')) {
        perf.homeAt = performance.now();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.documentElement) startObserving();
  else document.addEventListener('DOMContentLoaded', startObserving, { once: true });
  window.__startFps = () => {
    perf.fpsFrames = [];
    perf.fpsStart = performance.now();
    perf.fpsOn = true;
    const loop = (time) => {
      if (!perf.fpsOn) return;
      perf.fpsFrames.push(time);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };
  window.__stopFps = () => {
    perf.fpsOn = false;
    const frames = perf.fpsFrames;
    const duration = frames.length > 1 ? frames[frames.length - 1] - frames[0] : 0;
    const gaps = frames.slice(1).map((time, index) => time - frames[index]);
    return {
      frames: frames.length,
      fps: duration > 0 ? ((frames.length - 1) * 1000) / duration : 0,
      maxGapMs: gaps.length ? Math.max(...gaps) : 0,
      longFrames: gaps.filter((gap) => gap > 25).length,
      frameTimes: frames.map((time) => Number((time - perf.fpsStart).toFixed(1))),
    };
  };
  window.__resetCls = () => {
    perf.cls = 0;
  };
  perf.transition = null;
  window.addEventListener('navereat:transition-start', () => window.__startFps());
  window.addEventListener('navereat:transition-end', () => {
    perf.transition = window.__stopFps();
  });
};

const readJson = async (page) => page.evaluate(() => window.__perf);

const coldStart = async (browser) => {
  const runs = [];
  for (let i = 0; i < 3; i += 1) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    await context.addInitScript(seed);
    await context.addInitScript(initScript);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    const started = Date.now();
    await page.goto(`${base}/#/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#home-header', { timeout: 15000 });
    const homeAt = await page.evaluate(() => window.__perf.homeAt);
    const navigation = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      return {
        domContentLoaded: nav?.domContentLoadedEventEnd ?? 0,
        load: nav?.loadEventEnd ?? 0,
        fcp: paint.find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? 0,
      };
    });
    await page.waitForTimeout(700);
    const perf = await readJson(page);
    runs.push({
      homePaintMs: homeAt,
      fcpMs: navigation.fcp,
      domContentLoadedMs: navigation.domContentLoaded,
      loadMs: navigation.load,
      cls: perf.cls,
      wallMs: Date.now() - started,
    });
    await context.close();
  }
  const avg = (key) => runs.reduce((sum, run) => sum + run[key], 0) / runs.length;
  return {
    runs,
    average: {
      homePaintMs: avg('homePaintMs'),
      fcpMs: avg('fcpMs'),
      domContentLoadedMs: avg('domContentLoadedMs'),
      loadMs: avg('loadMs'),
      cls: avg('cls'),
    },
  };
};

const interactions = async (browser) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(seed);
  await context.addInitScript(initScript);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#restaurant-list .u99-restaurant-card', { timeout: 15000 });
  await page.waitForTimeout(600);

  const homeRender = await page.evaluate(() => ({
    home: window.__homeRenders ?? 0,
    cards: window.__cardRenders ?? 0,
    cls: window.__perf.cls,
  }));

  await page.evaluate(() => {
    window.__homeRenders = 0;
    window.__cardRenders = 0;
  });
  await page.locator('#restaurant-list .u99-stepper button').last().click();
  await page.waitForTimeout(250);
  const afterQty = await page.evaluate(() => ({
    home: window.__homeRenders ?? 0,
    cards: window.__cardRenders ?? 0,
  }));

  let push;
  let pop;
  if (legacyFps) {
    await page.evaluate(() => {
      window.__perf.cls = 0;
      window.__startFps();
    });
    await page.locator('#restaurant-list .u99-restaurant-head').first().click();
    await page.waitForTimeout(650);
    push = await page.evaluate(() => window.__stopFps());
  } else {
    await page.evaluate(() => {
      window.__perf.cls = 0;
      window.__perf.transition = null;
    });
    await page.locator('#restaurant-list .u99-restaurant-head').first().click();
    await page.waitForFunction(() => window.__perf.transition != null, null, { timeout: 15000 });
    push = await page.evaluate(() => window.__perf.transition);
  }
  await page.waitForSelector('.menu-item', { timeout: 15000 });
  await page.waitForTimeout(500);
  const restaurantCls = await page.evaluate(() => window.__perf.cls);

  if (legacyFps) {
    await page.evaluate(() => {
      window.__perf.cls = 0;
      window.__startFps();
    });
    await page.locator('.ew-hd-back').first().click();
    await page.waitForTimeout(650);
    pop = await page.evaluate(() => window.__stopFps());
  } else {
    await page.evaluate(() => {
      window.__perf.cls = 0;
      window.__perf.transition = null;
    });
    await page.locator('.ew-hd-back').first().click();
    await page.waitForFunction(() => window.__perf.transition != null, null, { timeout: 15000 });
    pop = await page.evaluate(() => window.__perf.transition);
  }
  await page.waitForSelector('#home-header', { timeout: 15000 });

  await page.evaluate(() => window.__startFps());
  await page.locator('.filter-pill-sheet').first().click();
  await page.waitForTimeout(650);
  const sheet = await page.evaluate(() => window.__stopFps());

  await context.close();
  return { homeRender, afterQty, push, pop, sheet, restaurantCls };
};

const latencyInitScript = () => {
  localStorage.setItem('nearbite_token', 'demo-token');
  localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Aarav', phone: '+91 98765 43210' }));
  sessionStorage.setItem('ew_offers_seen_v1', '["demo"]');
  localStorage.setItem('nearbite_cart', JSON.stringify({
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
  }));
  window.__latency = { tapAt: null, startAt: null, firstFrameAt: null };
  window.addEventListener('pointerdown', () => { window.__latency.tapAt = performance.now(); }, true);
  window.addEventListener('navereat:transition-start', () => {
    window.__latency.startAt = performance.now();
    requestAnimationFrame(() => {
      if (window.__latency.firstFrameAt == null) window.__latency.firstFrameAt = performance.now();
    });
  });
  window.__resetLatency = () => { window.__latency = { tapAt: null, startAt: null, firstFrameAt: null }; };
  window.__readLatency = () => ({
    tapAt: window.__latency.tapAt,
    startAt: window.__latency.startAt,
    firstFrameAt: window.__latency.firstFrameAt,
  });
};

const pushLatency = async (browser, rate) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(latencyInitScript);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#restaurant-list .u99-restaurant-card', { timeout: 15000 });
  await page.waitForTimeout(1200);

  const rows = [];
  const measure = async (name, action) => {
    await page.evaluate(() => window.__resetLatency());
    await action();
    await page.waitForFunction(() => window.__readLatency().firstFrameAt != null, null, { timeout: 15000 });
    const data = await page.evaluate(() => window.__readLatency());
    rows.push({
      transition: name,
      tapToFirstAnimationFrameMs: Number((data.firstFrameAt - data.tapAt).toFixed(1)),
      tapToTransitionStartMs: Number((data.startAt - data.tapAt).toFixed(1)),
      firstFrameAfterStartMs: Number((data.firstFrameAt - data.startAt).toFixed(1)),
    });
  };

  await measure('Home→Restaurant', () => page.locator('.u99-restaurant-head').first().click());
  await page.waitForSelector('.menu-item', { timeout: 15000 });
  await page.waitForTimeout(500);

  await measure('Restaurant→Cart', () => page.locator('#es-pink-inner').click());
  await page.waitForSelector('.ct-cta', { timeout: 15000 });
  await page.locator('.ct-cta').first().click();
  await page.waitForSelector('#btn-checkout', { timeout: 15000 });
  await page.locator('#btn-checkout').click();
  await page.waitForSelector('.ew-os__btn', { timeout: 15000 });
  await page.waitForTimeout(250);

  await measure('Cart→Tracking', () => page.locator('.ew-os__btn').click());
  await page.waitForSelector('.floating-back', { timeout: 15000 });
  await context.close();
  return { rate, rows };
};

const clsInitScript = () => {
  localStorage.setItem('nearbite_token', 'demo-token');
  localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Aarav', phone: '+91 98765 43210' }));
  sessionStorage.setItem('ew_offers_seen_v1', '["demo"]');
  localStorage.setItem('nearbite_cart', JSON.stringify({
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
  }));
  window.__clsEntries = [];
  const describe = (node) => {
    if (!node) return 'unknown';
    const el = node.nodeType === 3 ? node.parentElement : node;
    if (!(el instanceof Element)) return String(node.nodeName || node);
    return { tag: el.tagName.toLowerCase(), id: el.id || null, cls: typeof el.className === 'string' ? el.className.slice(0, 80) : null };
  };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      window.__clsEntries.push({
        value: entry.value,
        hadRecentInput: entry.hadRecentInput,
        sources: (entry.sources || []).map((source) => ({
          node: describe(source.node),
          previousRect: source.previousRect ? { x: source.previousRect.x, y: source.previousRect.y, w: source.previousRect.width, h: source.previousRect.height } : null,
          currentRect: source.currentRect ? { x: source.currentRect.x, y: source.currentRect.y, w: source.currentRect.width, h: source.currentRect.height } : null,
        })),
      });
    }
  }).observe({ type: 'layout-shift', buffered: true });
  window.__resetCls = () => { window.__clsEntries = []; };
  window.__readCls = () => window.__clsEntries.slice();
};

const clsTransitions = async (browser) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(clsInitScript);
  const page = await context.newPage();
  await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#home-header', { timeout: 15000 });
  await page.waitForTimeout(1100);

  // CLS by definition excludes shifts caused by recent input. A route push/pop is
  // driven by the tap that starts it, so counting those shifts measured the tap
  // itself (and flipped with runner speed). Only unexpected shifts count here;
  // the input-driven total is still recorded for transparency.
  const measure = async (name, action, waitMs = 650) => {
    await page.evaluate(() => window.__resetCls());
    await action();
    await page.waitForTimeout(waitMs);
    const entries = await page.evaluate(() => window.__readCls());
    const sum = (list) => list.reduce((total, entry) => total + entry.value, 0);
    const expected = entries.filter((entry) => !entry.hadRecentInput);
    return {
      name,
      cls: Number(sum(expected).toFixed(6)),
      inputDrivenCls: Number(sum(entries.filter((entry) => entry.hadRecentInput)).toFixed(6)),
      entries: expected.filter((entry) => entry.value > 0.00001),
    };
  };

  const transitions = [];
  // Two-tab nav: Home <-> History switch instantly; the rest are pushed pages.
  transitions.push(await measure('tab: Home → History', () => page.locator('[data-nav-item="/orders"]').click()));
  transitions.push(await measure('tab: History → Home', () => page.locator('[data-nav-item="/"]').click()));
  transitions.push(await measure('push: Home → Under99 Store', () => page.locator('.btn-store').first().click(), 900));
  transitions.push(await measure('pop: Under99 Store → Home', () => page.locator('.u99-circle-btn[aria-label="Back"]').first().click(), 700));
  transitions.push(await measure('push: Home → Profile', () => page.locator('.btn-profile').first().click(), 900));
  transitions.push(await measure('pop: Profile → Home', () => page.locator('.profile-page .icon-btn.back').first().click(), 700));
  transitions.push(await measure('overlay: Home → Search', () => page.locator('.search-box').first().click(), 700));
  transitions.push(await measure('overlay: Search → Home', () => page.keyboard.press('Escape'), 700));
  await page.waitForTimeout(400);

  transitions.push(await measure('push: Home → Restaurant', () => page.locator('.u99-restaurant-head').first().click(), 900));
  await page.waitForSelector('.menu-item', { timeout: 15000 });
  await page.waitForTimeout(350);
  transitions.push(await measure('push: Restaurant → Cart', () => page.locator('#es-pink-inner').click(), 900));
  await page.waitForSelector('.ct-cta', { timeout: 15000 });
  await page.locator('.ct-cta').first().click();
  await page.waitForSelector('#btn-checkout', { timeout: 15000 });
  transitions.push(await measure('push: Cart → Tracking', async () => {
    await page.locator('#btn-checkout').click();
    await page.waitForSelector('.ew-os__btn', { timeout: 15000 });
    await page.locator('.ew-os__btn').click();
  }, 1000));
  await page.waitForSelector('.floating-back', { timeout: 15000 });
  await page.waitForTimeout(350);
  transitions.push(await measure('pop: Tracking → Cart', () => page.locator('.floating-back').first().click(), 700));

  await context.close();
  return transitions;
};

const motionChecks = async (browser) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(seed);
  await context.addInitScript(initScript);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#restaurant-list .u99-restaurant-card', { timeout: 15000 });
  await page.waitForTimeout(900);

  // Home header collapse: a rAF-driven scroll down and back up.
  const homeScroll = await page.evaluate(async () => {
    const scroller = document.querySelector('.home-scroll');
    window.__perf.cls = 0;
    window.__startFps();
    await new Promise((resolve) => {
      let y = 0;
      let direction = 1;
      let frames = 0;
      const step = () => {
        y += direction * 22;
        if (y >= 1210) {
          y = 1210;
          direction = -1;
        }
        scroller.scrollTop = y;
        frames += 1;
        if (frames > 90) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const frames = window.__stopFps();
    return { fps: frames.fps, maxGapMs: frames.maxGapMs, cls: window.__perf.cls };
  });

  // Sheet drag: grab the filter handle and move it without dismissing.
  await page.locator('.filter-pill-sheet').first().click();
  await page.waitForSelector('.filter-sheet .sheet-panel', { timeout: 15000 });
  await page.waitForTimeout(650);
  const grabber = await page.locator('.filter-sheet .sheet-grabber').first().boundingBox();
  await page.evaluate(() => {
    window.__perf.cls = 0;
    window.__startFps();
  });
  if (grabber) {
    const cx = grabber.x + grabber.width / 2;
    const cy = grabber.y + grabber.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 1; i <= 14; i += 1) await page.mouse.move(cx, cy + i * 5);
    for (let i = 13; i >= 0; i -= 1) await page.mouse.move(cx, cy + i * 5);
    await page.mouse.up();
  }
  const sheetDrag = await page.evaluate(() => {
    const frames = window.__stopFps();
    return { fps: frames.fps, maxGapMs: frames.maxGapMs, cls: window.__perf.cls };
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(450);

  // Shared-element push: Home card image to the restaurant page.
  await page.evaluate(() => {
    window.__perf.cls = 0;
    window.__perf.transition = null;
  });
  await page.locator('.u99-restaurant-head').first().click();
  await page.waitForFunction(() => window.__perf.transition != null, null, { timeout: 15000 });
  await page.waitForTimeout(500);
  const sharedElement = await page.evaluate(() => ({
    fps: window.__perf.transition.fps,
    maxGapMs: window.__perf.transition.maxGapMs,
    cls: window.__perf.cls,
  }));

  await context.close();
  return {
    homeScroll: { fps: Number(homeScroll.fps.toFixed(1)), maxGapMs: Number(homeScroll.maxGapMs.toFixed(1)), cls: Number(homeScroll.cls.toFixed(6)) },
    sheetDrag: { fps: Number(sheetDrag.fps.toFixed(1)), maxGapMs: Number(sheetDrag.maxGapMs.toFixed(1)), cls: Number(sheetDrag.cls.toFixed(6)) },
    sharedElement: { fps: Number(sharedElement.fps.toFixed(1)), maxGapMs: Number(sharedElement.maxGapMs.toFixed(1)), cls: Number(sharedElement.cls.toFixed(6)) },
  };
};

const bundle = async () => {
  const dir = path.join(root, 'dist', 'assets');
  const files = await readdir(dir);
  const rows = [];
  for (const file of files) {
    if (!/\.(js|css)$/.test(file)) continue;
    const filePath = path.join(dir, file);
    const contents = await readFile(filePath);
    rows.push({
      file,
      bytes: (await stat(filePath)).size,
      gzipBytes: zlib.gzipSync(contents).length,
    });
  }
  const entry = rows.find((row) => /^index-.*\.js$/.test(row.file));
  const totalJs = rows.filter((row) => row.file.endsWith('.js')).reduce((sum, row) => sum + row.bytes, 0);
  return { rows, entry, totalJs };
};

await waitServer();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const result = {
    label,
    measuredAt: new Date().toISOString(),
    coldStart: await coldStart(browser),
    interactions: await interactions(browser),
    pushLatency: {
      '1x': await pushLatency(browser, 1),
      '4x': await pushLatency(browser, 4),
    },
    clsTransitions: await clsTransitions(browser),
    motion: await motionChecks(browser),
    bundle: await bundle(),
  };
  const pushFps = result.interactions.push.fps;
  const popFps = result.interactions.pop.fps;
  const gateRequired = cpuRate === 1;
  const clsBudget = Number(process.env.PERF_CLS_BUDGET || 0.01);
  const maxTransitionCls = result.clsTransitions.reduce((max, transition) => Math.max(max, transition.cls), 0);
  const clsPass = result.clsTransitions.every((transition) => transition.cls <= clsBudget);
  const latencyBudget = Number(process.env.PERF_LATENCY_BUDGET || 60);
  const latency1xRows = result.pushLatency['1x'].rows;
  const latencySamples = latency1xRows.map((row) => row.tapToFirstAnimationFrameMs).sort((a, b) => a - b);
  // The tap→frame metric includes the wait for the next rAF after the slide
  // starts, which adds 0–17 ms of pure scheduling jitter. Gate on the median
  // of the three pushes and keep a hard ceiling for the worst single sample.
  const medianTapToFrame1x = latencySamples[Math.floor(latencySamples.length / 2)];
  const maxTapToFrame1x = latencySamples[latencySamples.length - 1];
  const latencyPass = medianTapToFrame1x <= latencyBudget && maxTapToFrame1x <= latencyBudget * 1.4;
  const motion = result.motion;
  const motionFpsPass =
    motion.homeScroll.fps >= minFps && motion.sheetDrag.fps >= minFps && motion.sharedElement.fps >= minFps;
  const motionClsPass = motion.homeScroll.cls <= clsBudget && motion.sharedElement.cls <= clsBudget;
  result.gate = {
    required: gateRequired,
    pushFps: Number(pushFps.toFixed(1)),
    popFps: Number(popFps.toFixed(1)),
    minFps,
    clsBudget,
    maxTransitionCls: Number(maxTransitionCls.toFixed(6)),
    clsPass,
    latencyBudgetMs: latencyBudget,
    medianTapToFirstFrameMs1x: Number(medianTapToFrame1x.toFixed(1)),
    maxTapToFirstFrameMs1x: Number(maxTapToFrame1x.toFixed(1)),
    latencyPass,
    motion,
    motionFpsPass,
    motionClsPass,
    pass:
      (!gateRequired || (pushFps >= minFps && popFps >= minFps && motionFpsPass)) &&
      clsPass &&
      motionClsPass &&
      latencyPass,
  };
  await writeFile(path.join(outDir, `perf-${label}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.gate.pass) {
    console.error(
      `FAIL: performance gate (push ${pushFps.toFixed(1)} fps, pop ${popFps.toFixed(1)} fps, ` +
        `home scroll ${motion.homeScroll.fps.toFixed(1)} fps, sheet drag ${motion.sheetDrag.fps.toFixed(1)} fps, ` +
        `shared element ${motion.sharedElement.fps.toFixed(1)} fps, max transition CLS ${maxTransitionCls.toFixed(6)}, ` +
        `scroll CLS ${motion.homeScroll.cls.toFixed(6)}, budget ${clsBudget}, max tap→frame ${maxTapToFrame1x.toFixed(1)} ms, ` +
        `median tap→frame ${medianTapToFrame1x.toFixed(1)} ms / max ${maxTapToFrame1x.toFixed(1)} ms, budget ${latencyBudget} ms)`,
    );
    process.exitCode = 1;
  }
} finally {
  await browser.close();
  server.kill('SIGTERM');
}
