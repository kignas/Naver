/**
 * Item 12C gate: only the incoming page moves.
 *
 * Records real screencast frames of Home -> Restaurant (push) and back (pop),
 * builds 8-frame strips, and asserts:
 *   - the outgoing page keeps an identity transform and full opacity for every
 *     sampled frame of the push, and the revealed page does the same on pop,
 *   - the incoming page is fully painted (real content, decoded images) before
 *     the slide starts,
 *   - tab switches do not animate,
 *   - a left-edge swipe-back never moves the page underneath,
 *   - push/pop FPS and tap -> first frame stay inside the budgets,
 *   - the Home hero is the original's static slide: nothing on Home animates
 *     and the banner keeps its box across every round trip.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const label = process.argv[2] || 'after';
const minFps = Number(process.env.PERF_MIN_FPS || 55);
const maxLatency = Number(process.env.PERF_MAX_LATENCY_MS || 60);
const root = process.cwd();
const port = 4260;
const base = `http://127.0.0.1:${port}`;
const outDir = path.resolve('..', 'verify', 'item12c', label);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await mkdir(outDir, { recursive: true });

const server = spawn(
  path.join(root, 'node_modules', '.bin', 'vite'),
  ['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: root, stdio: 'ignore' },
);
const waitServer = async () => {
  for (let i = 0; i < 100; i += 1) {
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

const initScript = () => {
  localStorage.setItem('nearbite_token', 'demo-token');
  localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Aarav', phone: '+91 98765 43210' }));
  sessionStorage.setItem('ew_offers_seen_v1', '["demo"]');
  const probe = (window.__rm = {
    clickAt: 0,
    firstFrameMs: null,
    start: null,
    end: null,
    frames: [],
    identity: null,
    incomingAtStart: null,
    incomingFaded: 0,
    incomingOpacity: null,
    tab: null,
  });
  document.addEventListener(
    'click',
    () => {
      probe.clickAt = performance.now();
      probe.firstFrameMs = null;
      requestAnimationFrame(() => {
        if (probe.firstFrameMs == null) probe.firstFrameMs = performance.now() - probe.clickAt;
      });
    },
    true,
  );
  const IDENTITY = (transform, opacity) =>
    (transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)') && opacity === '1';
  window.addEventListener('navereat:transition-start', (event) => {
    const direction = event.detail?.direction ?? 'push';
    const stage = document.querySelector('.route-stage');
    const layers = [...stage.querySelectorAll('.route-layer')];
    const stack = stage.querySelector('.tab-stack');
    const moving = (element) => (direction === 'push' ? element.classList.contains('is-enter') : element.classList.contains('is-leave'));
    // Classes settle one commit after the event; re-check per frame.
    const candidates = [...(stack ? [stack] : []), ...layers];
    const incoming = layers.find((element) => element.classList.contains('is-enter'));
    probe.start = performance.now() - probe.clickAt;
    probe.incomingAtStart = incoming
      ? {
          real: !incoming.querySelector('.route-shell') || incoming.querySelectorAll('.menu-item, .ct-cta, .order-card, .u99-restaurant-card').length > 0,
          images: incoming.querySelectorAll('img').length,
          decoded: [...incoming.querySelectorAll('img')].every((image) => image.complete && image.naturalWidth > 0),
        }
      : null;
    probe.frames = [];
    probe.identity = { direction, samples: 0, offenders: [] };
    let on = true;
    const tick = () => {
      if (!on) return;
      probe.identity.samples += 1;
      for (const element of candidates) {
        if (!element.isConnected || moving(element)) continue;
        const style = getComputedStyle(element);
        if (!IDENTITY(style.transform, style.opacity)) {
          probe.identity.offenders.push({ cls: element.className, transform: style.transform, opacity: style.opacity });
        }
      }
      if (incoming) {
        const style = getComputedStyle(incoming);
        probe.frames.push(style.transform);
        probe.incomingOpacity ??= { first: style.opacity, last: style.opacity };
        probe.incomingOpacity.last = style.opacity;
        if (style.opacity !== '1') probe.incomingFaded = (probe.incomingFaded ?? 0) + 1;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.addEventListener(
      'navereat:transition-end',
      () => {
        on = false;
        probe.end = performance.now() - probe.clickAt;
        probe.identity.offenders = probe.identity.offenders.slice(0, 8);
        probe.identity.identity = probe.identity.offenders.length === 0;
      },
      { once: true },
    );
  });
  window.__rmReset = () => {
    probe.start = null;
    probe.end = null;
    probe.firstFrameMs = null;
  };
  window.__rmTabProbe = () => {
    probe.tab = { layers: document.querySelectorAll('.route-layer').length, animations: document.getAnimations().filter((a) => a.playState === 'running').length };
  };
  // The Home hero is the original's single static slide, so "idle" is the
  // whole contract: nothing on Home may animate, and the banner box must not
  // change across a round trip. Property transitions belong to the route
  // machinery and are reported without failing the run.
  window.__rmHero = () => {
    // Scoped to the Home tab: the original pulses its live-order dot on the
    // cached History tab, which is off screen and must not fail this audit.
    const home = document.querySelector('.route-tab-cache[data-route="/"]');
    const node = home ? home.querySelector('#hero-banner-region') : null;
    const rect = node ? node.getBoundingClientRect() : null;
    const named = (a) => typeof a.animationName === 'string' && a.animationName.length > 0;
    const inHome = (a) => Boolean(home && a.effect && a.effect.target && home.contains(a.effect.target));
    const running = document.getAnimations().filter((a) => a.playState === 'running' && inHome(a));
    const transitions = running.filter((a) => !named(a)).map((a) => a.transitionProperty || 'transition');
    return {
      present: Boolean(node),
      banner: rect ? { y: Math.round(rect.y), h: Math.round(rect.height), w: Math.round(rect.width) } : null,
      runningNamed: [...new Set(running.filter(named).map((a) => a.animationName))],
      transitions: [...new Set(transitions)],
    };
  };
  window.__rmRead = () => probe;
};

await waitServer();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(`${name}${detail ? ` (${detail})` : ''}`);
};

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await context.addInitScript(initScript);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', (event) => {
    frames.push({ data: event.data, ts: Date.now() });
    void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => undefined);
  });
  await cdp.send('Page.enable');
  await page.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#home-header', { timeout: 15000 });
  await sleep(1200);

  // Scrolls the first candidate into view and probes a few heights, because the
  // floating nav and cart bar sit on top of the feed and can cover a card's
  // midpoint without covering the card.
  const visiblePoint = (selector, minY = 120) =>
    page.evaluate(
      async ({ sel, minY: floor }) => {
        for (const node of document.querySelectorAll(sel)) {
          node.scrollIntoView({ block: 'center', behavior: 'instant' });
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const r = node.getBoundingClientRect();
          const cx = Math.round(r.left + r.width / 2);
          for (const fraction of [0.5, 0.3, 0.7]) {
            const cy = Math.round(r.top + r.height * fraction);
            if (cy <= floor || cy >= window.innerHeight - 40) continue;
            const hit = document.elementFromPoint(cx, cy);
            if (hit && (hit === node || node.contains(hit))) return { x: cx, y: cy };
          }
        }
        return null;
      },
      { sel: selector, minY },
    );

  const record = async (name, targets, waitAfter) => {
    const start = Date.now();
    frames.length = 0;
    await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: 390, maxHeight: 844 });
    await sleep(70);
    return { name, targets, start, waitAfter, stop: async () => {
      await sleep(waitAfter);
      await cdp.send('Page.stopScreencast');
      const probe = await page.evaluate(() => window.__rmRead());
      const startEpoch = start + 70;
      const pool = frames.filter((frame) => frame.ts >= startEpoch - 30);
      const source = pool.length ? pool : [...frames];
      const selected = targets.map((target) => {
        const wanted = startEpoch + target;
        let best = source[0];
        for (const frame of source) if (Math.abs(frame.ts - wanted) < Math.abs(best.ts - wanted)) best = frame;
        return { target, actual: best ? best.ts - startEpoch : null, data: best?.data };
      });
      const width = 195;
      const height = Math.round((844 * width) / 390);
      const labelHeight = 24;
      const gap = 4;
      const stripWidth = selected.length * width + (selected.length - 1) * gap;
      const composites = [];
      const labels = [];
      const saved = [];
      for (let index = 0; index < selected.length; index += 1) {
        const entry = selected[index];
        if (!entry.data) continue;
        const buffer = Buffer.from(entry.data, 'base64');
        const file = path.join(outDir, `${name}-${String(entry.target).padStart(3, '0')}ms.png`);
        await writeFile(file, buffer);
        saved.push({ target: entry.target, actual: entry.actual, file: path.relative(path.resolve('..'), file) });
        const resized = await sharp(buffer).resize(width, height, { fit: 'cover' }).png().toBuffer();
        composites.push({ input: resized, left: index * (width + gap), top: labelHeight });
        labels.push(
          `<text x="${index * (width + gap) + width / 2}" y="16" fill="#ffffff" font-family="Arial, sans-serif" font-size="11" text-anchor="middle">${entry.target} ms</text>`,
        );
      }
      const labelSvg = Buffer.from(
        `<svg width="${stripWidth}" height="${height + labelHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111111"/>${labels.join('')}</svg>`,
      );
      const strip = path.join(outDir, `${name}-strip.png`);
      await sharp(labelSvg).composite(composites).png().toFile(strip);
      return { name, probe, frames: saved, strip: path.relative(path.resolve('..'), strip) };
    } };
  };

  const results = [];
  const card = await visiblePoint('#restaurant-list .u99-restaurant-head');
  const push = await record('push-home-restaurant', [0, 60, 120, 180, 240, 300, 360, 420], 900);
  await page.mouse.click(card.x, card.y);
  const pushResult = await push.stop();
  results.push(pushResult);
  const p = pushResult.probe;
  check('push: slide starts only after the incoming page is painted', Boolean(p.incomingAtStart?.real && p.incomingAtStart?.decoded), JSON.stringify(p.incomingAtStart));
  check('push: tap → first frame within budget', p.firstFrameMs != null && p.firstFrameMs <= maxLatency, `${p.firstFrameMs?.toFixed(1)} ms`);
  // PUSH_DURATION is 260 ms since e7cd885 retuned the slide to read as native;
  // the 420 ms bound predated that.
  check('push: slide duration ≈ 260 ms', p.end - p.start > 220 && p.end - p.start < 400, `${Math.round(p.end - p.start)} ms (start ${Math.round(p.start)} ms)`);
  check('push: covered page keeps identity transform + full opacity', p.identity?.identity === true, `${p.identity?.samples} samples, ${p.identity?.offenders?.length ?? '?'} offenders`);
  // Step 1 replaced the full-width slide with a 24 px fade-in: the arriving page
  // must start transparent and end opaque instead of staying opaque throughout.
  // The last rAF sample can land a fraction of a millisecond before the tween's
  // final frame, so "opaque" is >= 0.999 rather than an exact '1'.
  check(
    'push: incoming page fades in from transparent',
    (p.incomingFaded ?? 0) > 0 && Number(p.incomingOpacity?.last) >= 0.999,
    `${p.frames.length} frames, ${p.incomingFaded ?? 0} faded, first ${p.incomingOpacity?.first ?? '?'}, last ${p.incomingOpacity?.last ?? '?'}`,
  );
  const translateOf = (transform) => {
    const match = /matrix\(1, 0, 0, 1, (-?[\d.]+), 0\)/.exec(transform ?? '');
    return match ? Number(match[1]) : null;
  };
  const translates = (p.frames ?? []).map(translateOf).filter((value) => value != null);
  const maxTranslate = translates.length ? Math.max(...translates) : 0;
  const lastTranslate = translates.length ? translates[translates.length - 1] : null;
  // Step 1: the arriving page settles 24 px (PAGE_OFFSET_PX), it no longer
  // travels the full width.
  check(
    'push: incoming page settles from 24 px',
    maxTranslate >= 20 && maxTranslate <= 26 && lastTranslate != null && lastTranslate <= 1 && new Set(translates.map((value) => Math.round(value))).size >= 3,
    `max ${Math.round(maxTranslate)} px, last ${lastTranslate} px, ${translates.length} samples`,
  );

  await page.waitForSelector('.menu-item', { timeout: 15000 });
  await sleep(500);
  const pop = await record('pop-restaurant-home', [0, 50, 100, 150, 200, 250, 300, 360], 800);
  const back = await visiblePoint('.ew-hd-back', 8);
  await page.mouse.click(back.x, back.y);
  const popResult = await pop.stop();
  results.push(popResult);
  const q = popResult.probe;
  check('pop: page underneath stays still', q.identity?.identity === true, `${q.identity?.samples} samples`);
  // POP_DURATION is 220 ms since e7cd885 (was 360 ms).
  check('pop: slide duration ≈ 220 ms', q.end - q.start > 180 && q.end - q.start < 360, `${Math.round(q.end - q.start)} ms`);
  check('pop: tap → first frame within budget', q.firstFrameMs != null && q.firstFrameMs <= maxLatency, `${q.firstFrameMs?.toFixed(1)} ms`);

  await page.waitForSelector('#home-header', { timeout: 15000 });
  await sleep(400);

  // Tab switch: instant, no route animation.
  await page.evaluate(() => { window.__rmReset(); window.__rmTabProbe(); });
  const tabStart = Date.now();
  const historyTab = await visiblePoint('[data-nav-item="/orders"]');
  await page.mouse.click(historyTab.x, historyTab.y);
  await sleep(260);
  const tabProbe = await page.evaluate(() => window.__rmRead());
  const tabElapsed = Date.now() - tabStart;
  check('tab switch: no transition events fire', tabProbe.start === null, `click→probe ${tabElapsed} ms`);
  const homeTab = await visiblePoint('[data-nav-item="/"]');
  await page.mouse.click(homeTab.x, homeTab.y);
  await sleep(400);

  // Left-edge swipe-back from a detail page: the page underneath must not move.
  const card2 = await visiblePoint('#restaurant-list .u99-restaurant-head');
  await page.mouse.click(card2.x, card2.y);
  await page.waitForSelector('.menu-item', { timeout: 15000 });
  await sleep(600);
  const swipeTrace = await page.evaluate(async () => {
    const stack = document.querySelector('.tab-stack');
    const top = document.querySelector('.route-layer.is-top');
    const samples = [];
    const edge = document.querySelector('.swipe-edge');
    const rect = edge.getBoundingClientRect();
    const startX = rect.left + 4;
    const y = Math.round(window.innerHeight / 2);
    const pointer = (type, x) => edge.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: true, buttons: type === 'pointerup' ? 0 : 1 }));
    pointer('pointerdown', startX);
    for (const dx of [30, 70, 110, 150]) {
      pointer('pointermove', startX + dx);
      samples.push({
        dx,
        top: getComputedStyle(top).transform,
        stack: stack ? getComputedStyle(stack).transform : null,
      });
    }
    pointer('pointerup', startX + 60);
    await new Promise((resolve) => setTimeout(resolve, 520));
    return samples;
  });
  const stackMoved = swipeTrace.some((sample) => sample.stack && sample.stack !== 'none' && sample.stack !== 'matrix(1, 0, 0, 1, 0, 0)');
  check('swipe-back: the page underneath never moves', !stackMoved, swipeTrace.map((s) => s.stack).join(' | '));
  check('swipe-back: the top page follows the finger', swipeTrace.some((s) => s.top !== 'none' && s.top !== 'matrix(1, 0, 0, 1, 0, 0)'), swipeTrace.map((s) => s.top).join(' | '));
  await sleep(500);

  // Back to Home for the banner checks: the swipe above can leave the
  // restaurant header collapsed, so use the tab bar.
  const waitForHome = async () => {
    await page.waitForSelector('.route-tab-cache.is-active #home-header', { timeout: 15000 });
    await sleep(260);
  };
  const navPoint = async (path) => visiblePoint(`[data-nav-item="${path}"]`);
  const clickPoint = async (point) => {
    if (!point) throw new Error('nothing to click');
    await page.mouse.click(point.x, point.y);
  };
  // Cart uses .ct-dh-back, restaurant and store pages use .ew-hd-back. The page
  // is still sliding in when the content first paints, so retry briefly.
  const backOnce = async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      for (const selector of ['.ct-dh-back', '.ew-hd-back']) {
        const point = await visiblePoint(selector, 0);
        if (point) return clickPoint(point);
      }
      await sleep(100);
    }
    throw new Error('no back button on screen');
  };
  await clickPoint(await navPoint('/'));
  await waitForHome();

  // The hero is static (no carousel, no autoplay, no scroll-linked motion), so
  // the contract is: nothing on Home animates, and the banner keeps its box
  // across every round trip.
  const heroState = () => page.evaluate(() => window.__rmHero());
  const homeToTop = async () => {
    await page.evaluate(() => document.querySelector('.home-scroll')?.scrollTo(0, 0));
    await sleep(160);
  };
  const roundTrip = async (name, leave, returnHome) => {
    await homeToTop();
    const before = await heroState();
    await leave();
    await sleep(420);
    const covered = await heroState();
    await returnHome();
    await waitForHome();
    await homeToTop();
    const after = await heroState();
    check(
      `${name}: hero stays static while Home is covered`,
      covered.present && covered.runningNamed.length === 0,
      covered.runningNamed.join(', ') || 'no running animation',
    );
    check(
      `${name}: hero stays static after returning`,
      after.present && after.runningNamed.length === 0,
      after.runningNamed.join(', ') || `none (transitions: ${after.transitions.join(', ') || 'none'})`,
    );
    check(
      `${name}: banner keeps its box`,
      JSON.stringify(before.banner) === JSON.stringify(after.banner),
      `${JSON.stringify(before.banner)} → ${JSON.stringify(after.banner)}`,
    );
  };

  await roundTrip(
    'return from History',
    async () => {
      await clickPoint(await navPoint('/orders'));
      await page.waitForSelector('.orders-page', { timeout: 15000 });
    },
    async () => {
      await clickPoint(await navPoint('/'));
    },
  );

  const openRestaurant = async () => {
    const card3 = await visiblePoint('#restaurant-list .u99-restaurant-head');
    await clickPoint(card3);
    await page.waitForSelector('.menu-item', { timeout: 15000 });
    await sleep(200);
  };
  await roundTrip('return from Restaurant', openRestaurant, async () => {
    await backOnce();
    await waitForHome();
  });

  await roundTrip(
    'return from Cart',
    async () => {
      await openRestaurant();
      await page.locator('.nb-add-btn:not(.nb-add-btn--cust)').first().click();
      await page.waitForSelector('#es-pink-inner', { timeout: 15000 });
      await sleep(300);
      await page.locator('#es-pink-inner').click();
      await page.waitForSelector('.ct-cta', { timeout: 15000 });
      await sleep(250);
    },
    async () => {
      await backOnce();
      await page.waitForSelector('.menu-item', { timeout: 15000 });
      await sleep(450);
      // The restaurant restores its scroll offset, which puts the header back
      // button off-screen; scroll it up before tapping.
      await page.evaluate(() => document.querySelector('.route-layer.is-top .rest-scroll')?.scrollTo(0, 0));
      await sleep(320);
      await backOnce();
    },
  );

  await roundTrip(
    'return from Profile',
    async () => {
      await page.evaluate(() => document.querySelector('.route-tab-cache.is-active .home-scroll')?.scrollTo(0, 0));
      await sleep(320);
      await clickPoint(await visiblePoint('.btn-profile', 0));
      await page.waitForSelector('.profile-page', { timeout: 15000 });
      await sleep(200);
    },
    async () => {
      await page.locator('.profile-page .icon-btn.back').first().click();
    },
  );

  await roundTrip(
    'return from Search',
    async () => {
      await page.locator('.search-box').first().click();
      await sleep(400);
    },
    async () => {
      await page.keyboard.press('Escape');
    },
  );

  // FPS from the per-frame samples taken during each slide.
  const fpsOf = (probe) => {
    const duration = probe.end - probe.start;
    const frames = probe.identity?.samples ?? 0;
    return { fps: duration > 0 && frames > 1 ? ((frames - 1) * 1000) / duration : 0, frames, duration: Math.round(duration) };
  };
  const fps = { push: fpsOf(p), pop: fpsOf(q) };
  check('push FPS at 1x', fps.push.fps >= minFps, `${fps.push.fps.toFixed(1)} fps (${fps.push.frames} frames / ${fps.push.duration} ms)`);
  check('pop FPS at 1x', fps.pop.fps >= minFps, `${fps.pop.fps.toFixed(1)} fps (${fps.pop.frames} frames / ${fps.pop.duration} ms)`);

  const summary = { label, checks: results.map((r) => ({ name: r.name, strip: r.strip, frames: r.frames, probe: { start: r.probe.start, end: r.probe.end, firstFrameMs: r.probe.firstFrameMs, identity: r.probe.identity, incomingAtStart: r.probe.incomingAtStart } })), swipeTrace, fps, failures };
  await writeFile(path.join(outDir, 'route-motion.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`\nSaved ${path.relative(path.resolve('..'), outDir)}`);
} finally {
  await browser.close();
  server.kill('SIGTERM');
}

if (failures.length) {
  console.error(`\n${failures.length} route-motion failure(s)`);
  process.exit(1);
}
console.log('\nAll route-motion checks passed.');
