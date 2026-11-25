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
 *   - push/pop FPS and tap -> first frame stay inside the budgets.
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

  const visiblePoint = (selector, minY = 120) =>
    page.evaluate(({ sel, minY: floor }) => {
      for (const node of document.querySelectorAll(sel)) {
        const r = node.getBoundingClientRect();
        const cx = Math.round(r.left + r.width / 2);
        const cy = Math.round(r.top + r.height / 2);
        if (cy > floor && cy < window.innerHeight - 40) {
          const hit = document.elementFromPoint(cx, cy);
          if (hit && (hit === node || node.contains(hit))) return { x: cx, y: cy };
        }
      }
      return null;
    }, { sel: selector, minY });

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
  check('push: incoming page stays fully opaque', (p.incomingFaded ?? 0) === 0, `${p.frames.length} frames, ${p.incomingFaded ?? 0} faded`);
  const translateOf = (transform) => {
    const match = /matrix\(1, 0, 0, 1, (-?[\d.]+), 0\)/.exec(transform ?? '');
    return match ? Number(match[1]) : null;
  };
  const translates = (p.frames ?? []).map(translateOf).filter((value) => value != null);
  const maxTranslate = translates.length ? Math.max(...translates) : 0;
  const lastTranslate = translates.length ? translates[translates.length - 1] : null;
  check(
    'push: incoming page travels the full width',
    maxTranslate >= 380 && lastTranslate != null && lastTranslate <= 1 && new Set(translates.map((value) => Math.round(value))).size >= 3,
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
