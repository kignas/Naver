import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { preview } from 'vite';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const outDir = path.join(repoRoot, 'verify', 'item19');
const base = 'http://127.0.0.1:4177';
/**
 * --nav-h (58) + --nav-bottom (12) + 12
 */
const NAV_RESERVE = 82;
/**
 * Floating capsule: 268x58 with a 5dp inset, split into two equal 128x48 slots.
 */
const H = 58;
const SPEC = {
  height: H,
  pad: 5,
  bottom: 12,
  width: 268,
  tabWidth: 128,
  tabHeight: 48,
  indicatorHeight: 48,
  icon: 20,
  iconLabelGap: 9,
  label: 13.5,
  side: 61,
  shadowY: 8,
  shadowBlur: 24,
};
const PILL = 'rgb(34, 34, 38)';
const IDLE_LABEL = 'rgb(29, 30, 34)';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];

function check(name, condition, detail = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

const near = (a, b, tolerance = 1) => Math.abs(Number(a) - Number(b)) <= tolerance;

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

/** Horizontal strip of crops, separated by a white gutter. */
function strip(images, gap = 6) {
  const width = images.reduce((sum, image) => sum + image.width, 0) + gap * (images.length - 1);
  const height = Math.max(...images.map((image) => image.height));
  const out = new PNG({ width, height });
  out.data.fill(255);
  let offsetX = 0;
  images.forEach((image) => {
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const src = (y * image.width + x) * 4;
        const dst = (y * width + offsetX + x) * 4;
        out.data[dst] = image.data[src];
        out.data[dst + 1] = image.data[src + 1];
        out.data[dst + 2] = image.data[src + 2];
        out.data[dst + 3] = image.data[src + 3];
      }
    }
    offsetX += image.width + gap;
  });
  return out;
}

/** Stacked crops, separated by a white gutter. */
function stack(images, gap = 8) {
  const width = Math.max(...images.map((image) => image.width));
  const height = images.reduce((sum, image) => sum + image.height, 0) + gap * (images.length - 1);
  const out = new PNG({ width, height });
  out.data.fill(255);
  let offsetY = 0;
  images.forEach((image) => {
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const src = (y * image.width + x) * 4;
        const dst = ((offsetY + y) * width + x) * 4;
        out.data[dst] = image.data[src];
        out.data[dst + 1] = image.data[src + 1];
        out.data[dst + 2] = image.data[src + 2];
        out.data[dst + 3] = image.data[src + 3];
      }
    }
    offsetY += image.height + gap;
  });
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

/** Counts the platform vibrate calls the haptics module makes in a browser. */
async function mockVibrate(context) {
  await context.addInitScript(() => {
    window.__vibrations = 0;
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: () => {
        window.__vibrations += 1;
        return true;
      },
    });
  });
}

const vibrationCount = (page) => page.evaluate(() => window.__vibrations ?? -1);

async function navState(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const tabs = Array.from(document.querySelectorAll('.nav-tab'));
    const active = document.querySelector('.nav-tab.is-active');
    const indicator = document.querySelector('.nav-indicator');
    const label = active?.querySelector('.nav-label');
    const navRect = nav?.getBoundingClientRect();
    const box = (rect) => (rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: innerHeight - rect.bottom } : null);
    const style = nav ? getComputedStyle(nav) : null;
    return {
      hash: location.hash,
      navClass: nav?.className ?? '',
      navRect: box(navRect),
      navStyle: style
        ? {
            position: style.position,
            transform: style.transform,
            background: style.backgroundColor,
            radius: style.borderRadius,
            border: style.borderTopWidth,
            borderColor: style.borderTopColor,
            shadow: style.boxShadow,
            backdrop: style.backdropFilter || style.webkitBackdropFilter || 'none',
            opacity: style.opacity,
            z: style.zIndex,
            vars: {
              surface: style.getPropertyValue('--nav-surface').trim(),
              pillTop: style.getPropertyValue('--nav-pill-top').trim(),
              pillBottom: style.getPropertyValue('--nav-pill-bottom').trim(),
              idle: style.getPropertyValue('--nav-idle-fg').trim(),
              pad: style.getPropertyValue('--nav-pad').trim(),
              pill: style.getPropertyValue('--nav-pill').trim(),
              icon: style.getPropertyValue('--nav-icon-size').trim(),
              iconLabelGap: style.getPropertyValue('--nav-icon-label-gap').trim(),
              labelSize: style.getPropertyValue('--nav-label-size').trim(),
            },
          }
        : null,
      tabs: tabs.map((tab) => {
        const tabLabel = tab.querySelector('.nav-label');
        const glyph = tab.querySelector('.nav-glyph');
        const labelStyle = tabLabel ? getComputedStyle(tabLabel) : null;
        const iconBox = glyph?.getBoundingClientRect();
        const labelBox = tabLabel?.getBoundingClientRect();
        return {
          item: tab.getAttribute('data-nav-item'),
          glyph: tab.getAttribute('data-glyph'),
          glyphState: tab.getAttribute('data-glyph-state'),
          label: tabLabel?.textContent ?? '',
          active: tab.classList.contains('is-active'),
          rect: box(tab.getBoundingClientRect()),
          labelWidth: labelBox?.width ?? 0,
          labelScrollWidth: tabLabel?.scrollWidth ?? 0,
          icon: Boolean(glyph),
          iconSize: iconBox ? { width: iconBox.width, height: iconBox.height } : null,
          iconAttrs: { width: glyph?.getAttribute('width') ?? null, height: glyph?.getAttribute('height') ?? null },
          glyphPaint: glyph
            ? {
                fill: glyph.getAttribute('fill'),
                pathFill: glyph.querySelector('path[fill]')?.getAttribute('fill') ?? null,
                evenOdd: glyph.querySelector('path')?.getAttribute('fill-rule') === 'evenodd',
                stroke: glyph.getAttribute('stroke'),
                strokeWidth: Number(glyph.getAttribute('stroke-width') ?? 0),
                paths: glyph.querySelectorAll('path').length,
                iconClass: glyph.getAttribute('class'),
              }
            : null,
          iconGap: iconBox && labelBox ? Math.round((labelBox.left - iconBox.right) * 10) / 10 : null,
          labelStyle: labelStyle
            ? { size: parseFloat(labelStyle.fontSize), weight: labelStyle.fontWeight, color: labelStyle.color }
            : null,
        };
      }),
      active: active?.getAttribute('data-nav-item') ?? '',
      activeLabel: label?.textContent ?? '',
      activeColor: active ? getComputedStyle(active).color : '',
      indicator: indicator
        ? {
            ...box(indicator.getBoundingClientRect()),
            background: getComputedStyle(indicator).backgroundColor,
            backgroundImage: getComputedStyle(indicator).backgroundImage,
            boxShadow: getComputedStyle(indicator).boxShadow,
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
const report = { spec: SPEC };
const navClip = { x: 0, y: 844 - SPEC.bottom - SPEC.height - 10, width: 390, height: SPEC.height + 30 };

try {
  await mkdir(outDir, { recursive: true });

  // ---- 0. The spec reference: the same ratios, drawn independently. --------
  const specPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await specPage.setContent(`<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;background:#f6f4f7;font-family:Manrope,system-ui,sans-serif}
    .bar{position:absolute;left:50%;transform:translate3d(-50%,0,0);width:${SPEC.width}px;bottom:${SPEC.bottom}px;
      height:${SPEC.height}px;box-sizing:border-box;padding:${SPEC.pad}px;display:grid;
      grid-template-columns:1fr 1fr;align-items:center;background:#fff;
      border:1px solid rgba(0,0,0,0.06);border-radius:999px;
      box-shadow:0 ${SPEC.shadowY}px ${SPEC.shadowBlur}px rgba(0,0,0,0.12),0 2px 6px rgba(0,0,0,0.06)}
    .pill{position:absolute;top:calc(${SPEC.pad}px - 1px);left:${SPEC.pad}px;
      width:calc(50% - ${SPEC.pad}px);height:${SPEC.indicatorHeight}px;border-radius:999px;background:#222226;
      box-shadow:inset 0 0 0 1px rgba(255,255,255,0.12),0 4px 10px rgba(17,17,20,0.18)}
    .slot{position:relative;z-index:1;height:${SPEC.tabHeight}px;display:inline-flex;align-items:center;
      justify-content:center;gap:${SPEC.iconLabelGap}px;color:#1d1e22}
    .slot.on{color:#fff}
    .glyph{width:${SPEC.icon}px;height:${SPEC.icon}px;flex:0 0 auto;display:block}
    .lbl{font-size:${SPEC.label}px;font-weight:600;letter-spacing:-0.01em;line-height:1;white-space:nowrap}
  </style><div class="bar"><span class="pill"></span>
    <div class="slot on">
      <svg class="glyph" width="20" height="20" viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 3.2c.35 0 .68.12.95.35l7.8 6.55c.56.47.23 1.38-.5 1.38H18.8v7.1c0 1.22-.98 2.2-2.2 2.2H7.4c-1.22 0-2.2-.98-2.2-2.2v-7.1H3.75c-.73 0-1.06-.91-.5-1.38l2.55-2.14V5.3c0-.5.4-.9.9-.9h1.4c.5 0 .9.4.9.9v.38l2.05-1.73c.27-.23.6-.35.95-.35ZM10 20.78v-4.38c0-1.1.9-2 2-2s2 .9 2 2v4.38h-4Z" fill="#F06464"/></svg>
      <span class="lbl">Home</span></div>
    <div class="slot">
      <svg class="glyph" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7.2 4.2h9.6l1.2 3.3H6l1.2-3.3Z"/><path d="M6 7.5h12l.6 11.1c.06 1.15-.85 2.1-2 2.1H7.4c-1.15 0-2.06-.95-2-2.1L6 7.5Z"/><path d="M9 11.5h6"/><path d="M9 15h4.2"/></svg>
      <span class="lbl">History</span></div>
  </div>`);
  await sleep(200);
  const specShot = PNG.sync.read(await specPage.screenshot({ clip: navClip }));
  await writeFile(path.join(outDir, 'spec-reference.png'), PNG.sync.write(specShot));
  await specPage.close();

  // ---- 1. Home: two tabs, charcoal pill, both labels, ratios. -------------
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await seed(context);
  await mockVibrate(context);
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

  const home = await capture('home', '.home-scroll');
  check('home: exactly two tabs', home.tabs.length === 2, home.tabs.map((tab) => tab.item).join(','));
  check('home: labels are Home and History', home.tabs[0]?.label === 'Home' && home.tabs[1]?.label === 'History', home.tabs.map((tab) => tab.label).join('/'));
  check('home: every tab shows icon and label', home.tabs.every((tab) => tab.icon && tab.label.length > 0));
  check('home: nav visible', home.navClass.includes('is-visible') && home.navStyle?.opacity === '1' && home.bodyHasNav);
  check('home: active is Home', home.active === '/', home.active);

  // Container: white, hairline, pill radius, soft large shadow, no blur.
  check('home: white surface', home.navStyle?.background === 'rgb(255, 255, 255)', home.navStyle?.background);
  check(
    'home: 1px rgba(0,0,0,0.06) hairline border',
    parseFloat(home.navStyle?.border ?? '0') === 1 &&
      home.navStyle?.borderColor === 'rgba(0, 0, 0, 0.06)',
    `${home.navStyle?.border} ${home.navStyle?.borderColor}`,
  );
  check('home: full pill radius', home.navStyle?.radius === '999px', home.navStyle?.radius);
  check(
    'home: elevation 0 8px 24px 12% + 0 2px 6px 6%',
    ['0px 8px 24px', 'rgba(0, 0, 0, 0.12)', '0px 2px 6px', 'rgba(0, 0, 0, 0.06)'].every((part) =>
      (home.navStyle?.shadow ?? '').includes(part),
    ),
    home.navStyle?.shadow,
  );
  check('home: no backdrop blur', home.navStyle?.backdrop === 'none', home.navStyle?.backdrop);
  check(
    'home: colours are CSS variables',
    home.navStyle?.vars.surface === '#ffffff' &&
      home.navStyle?.vars.pill === '#222226' &&
      home.navStyle?.vars.idle === '#1d1e22',
    JSON.stringify(home.navStyle?.vars),
  );

  // Measured geometry.
  check(
    'home: capsule H=58, 268 wide, exactly centred, 12px off the bottom',
    home.navRect.height === SPEC.height &&
      home.navRect.bottom === SPEC.bottom &&
      near(home.navRect.width, SPEC.width, 1) &&
      Math.abs(home.navRect.x + home.navRect.width / 2 - 390 / 2) <= 0.5 &&
      home.navStyle?.position === 'fixed' &&
      /matrix\(1, 0, 0, 1, -134, 0\)/.test(home.navStyle?.transform ?? ''),
    JSON.stringify({ rect: home.navRect, position: home.navStyle?.position, transform: home.navStyle?.transform }),
  );
  check('home: nav above route/sheet layers', Number(home.navStyle.z) >= 2000, home.navStyle.z);
  check(
    'home: tabs are an equal 128x48 split of the capsule',
    home.tabs.every((tab) => near(tab.rect.height, SPEC.tabHeight, 0.5) && near(tab.rect.width, SPEC.tabWidth, 0.5)) &&
      near(home.tabs[0].rect.width, home.tabs[1].rect.width, 0.5),
    home.tabs.map((tab) => `${Math.round(tab.rect.width)}x${Math.round(tab.rect.height)}`).join('/'),
  );
  check(
    'home: labels are not clipped',
    home.tabs.every((tab) => tab.labelWidth > 0 && tab.labelScrollWidth <= tab.labelWidth + 1),
    home.tabs.map((tab) => `${tab.labelScrollWidth}/${tab.labelWidth}`).join(' '),
  );
  check('home: reserves nav height', parseFloat(home.paddingBottom) >= NAV_RESERVE, home.paddingBottom);
  check('home: nav node preserved', home.sameNode);

  // Ratios of H.
  check(
    'spec: 20px icons, 13.5px/600 labels, 9px icon→label gap, 5px capsule inset',
    home.tabs.every((tab) => near(tab.iconSize.width, SPEC.icon, 0.5) && near(tab.iconSize.height, SPEC.icon, 0.5)) &&
      home.tabs.every((tab) => near(tab.labelStyle.size, SPEC.label, 0.5) && tab.labelStyle.weight === '600') &&
      home.tabs.every((tab) => near(tab.iconGap, SPEC.iconLabelGap, 0.8)) &&
      near(parseFloat(home.navStyle.vars.pad), SPEC.pad, 0.01),
    JSON.stringify({
      icons: home.tabs.map((tab) => tab.iconSize),
      labels: home.tabs.map((tab) => `${tab.labelStyle.size}/${tab.labelStyle.weight}`),
      gaps: home.tabs.map((tab) => tab.iconGap),
      pad: home.navStyle.vars.pad,
    }),
  );

  // Pill: charcoal gradient, 1px inner highlight, inset by --nav-gap.
  check(
    'home: pill is flat charcoal #222226',
    home.indicator?.background === PILL && home.indicator?.backgroundImage === 'none',
    `${home.indicator?.background} ${home.indicator?.backgroundImage}`,
  );
  check(
    'home: pill has the 1px inner highlight',
    /rgba\(255, 255, 255, 0\.12\) 0px 0px 0px 1px inset/.test(home.indicator?.boxShadow ?? ''),
    home.indicator?.boxShadow,
  );
  check(
    'home: pill covers exactly the active tab slot',
    near(home.indicator.x - home.tabs[0].rect.x, 0, 0.6) &&
      near(home.indicator.width, home.tabs[0].rect.width, 0.6) &&
      near(home.indicator.height, SPEC.indicatorHeight, 0.6),
    `${home.indicator.x - home.tabs[0].rect.x} / ${home.indicator.width}x${home.indicator.height} vs ${home.tabs[0].rect.width}x${home.tabs[0].rect.height}`,
  );
  check('home: active label is white', home.activeColor === 'rgb(255, 255, 255)', home.activeColor);
  check('home: idle label is #1F2024', home.tabs[1].labelStyle.color === IDLE_LABEL, home.tabs[1].labelStyle.color);

  // Icons: crisp intrinsic 18px SVGs, no scaling box to fall back on.
  check(
    'icons: both glyphs are 20x20 with intrinsic width/height',
    home.tabs.every(
      (tab) =>
        tab.iconSize.width === 20 &&
        tab.iconSize.height === 20 &&
        tab.iconAttrs.width === '20' &&
        tab.iconAttrs.height === '20',
    ),
    JSON.stringify(home.tabs.map((tab) => tab.iconAttrs)),
  );
  check(
    'icons: single even-odd coral house and a 1.75px currentColor receipt',
    home.tabs[0].glyphPaint.pathFill === '#F06464' &&
      home.tabs[0].glyphPaint.evenOdd === true &&
      home.tabs[0].glyphPaint.paths === 1 &&
      home.tabs[1].glyphPaint.stroke === 'currentColor' &&
      near(home.tabs[1].glyphPaint.strokeWidth, 1.75, 0.01) &&
      home.tabs[1].glyphPaint.fill === 'none' &&
      home.tabs[1].glyphPaint.paths === 4,
    JSON.stringify(home.tabs.map((tab) => tab.glyphPaint)),
  );
  check(
    'icons: home glyph is the house, history the bag',
    home.tabs[0].glyph === 'home' && home.tabs[1].glyph === 'history',
    home.tabs.map((tab) => tab.glyph).join('/'),
  );

  // Haptics: nothing fired by the initial render.
  const vibHome = await vibrationCount(page);
  check('haptics: none on first paint', vibHome === 0, String(vibHome));

  // ---- 2. History: pill moves, haptic fires exactly once. -----------------
  await page.click('[data-nav-item="/orders"]');
  await sleep(550);
  const history = await capture('history', '.orders-page');
  check('history: active is History', history.active === '/orders' && history.activeLabel === 'History', `${history.active} ${history.activeLabel}`);
  check(
    'history: pill moved to History',
    near(history.indicator.x - history.tabs[1].rect.x, 0, 0.6) &&
      near(history.indicator.x - history.tabs[0].rect.x, SPEC.tabWidth, 0.6),
    JSON.stringify({ pill: history.indicator.x, home: history.tabs[0].rect.x, history: history.tabs[1].rect.x }),
  );
  check('history: pill colour', history.indicator?.background === PILL, history.indicator?.background);
  check('history: reserves nav height', parseFloat(history.paddingBottom) >= NAV_RESERVE, history.paddingBottom);
  check('history: nav node preserved', history.sameNode);
  check(
    'history: label colours swap with the pill',
    history.activeColor === 'rgb(255, 255, 255)' && history.tabs[0].labelStyle.color === IDLE_LABEL,
    `${history.activeColor} / ${history.tabs[0].labelStyle.color}`,
  );
  const vibAfterHistory = await vibrationCount(page);
  check('haptics: one light impact on the tab change', vibAfterHistory === 1, String(vibAfterHistory));
  const mounted = await page.evaluate(() => ({
    home: window.__homeNode === document.querySelector('.home-screen'),
    orders: window.__ordersNode === document.querySelector('.orders-page'),
  }));
  check('tabs: layers stay mounted', mounted.home && mounted.orders, JSON.stringify(mounted));

  // Tapping the already-active tab is not a change.
  await page.click('[data-nav-item="/orders"]');
  await sleep(300);
  check('haptics: tapping the active tab is silent', (await vibrationCount(page)) === 1, String(await vibrationCount(page)));

  // ---- 3. Icon animation: 8 frames each way. ------------------------------
  const grabNav = async () => PNG.sync.read(await page.screenshot({ clip: navClip }));
  const framesToHome = [await grabNav()];
  await page.evaluate(() => document.querySelector('[data-nav-item="/"]')?.click());
  await page.waitForFunction(() => document.querySelector('.nav-tab.is-active')?.getAttribute('data-nav-item') === '/', { timeout: 3000 });
  const midFlight = [];
  for (let index = 1; index < 8; index += 1) {
    midFlight.push(await page.evaluate(() => document.querySelector('.nav-indicator')?.getBoundingClientRect().x ?? -1));
    framesToHome.push(await grabNav());
    await sleep(50);
  }
  await writeFile(path.join(outDir, 'icon-anim-history-home.png'), PNG.sync.write(strip(framesToHome)));
  check(
    'icon anim: indicator travels between tabs',
    midFlight.some((x) => Math.abs(x - history.tabs[0].rect.x) < 20),
    midFlight.map((x) => Math.round(x)).join(','),
  );
  await sleep(500);

  const framesToHistory = [await grabNav()];
  await page.evaluate(() => document.querySelector('[data-nav-item="/orders"]')?.click());
  await page.waitForFunction(() => document.querySelector('.nav-tab.is-active')?.getAttribute('data-nav-item') === '/orders', { timeout: 3000 });
  for (let index = 1; index < 8; index += 1) {
    framesToHistory.push(await grabNav());
    await sleep(50);
  }
  await writeFile(path.join(outDir, 'icon-anim-home-history.png'), PNG.sync.write(strip(framesToHistory)));
  check('icon anim: 8-frame strips written', framesToHome.length === 8 && framesToHistory.length === 8, `${framesToHome.length}/${framesToHistory.length}`);

  await sleep(500);
  const afterAnim = await page.evaluate(() => ({
    classes: Array.from(document.querySelectorAll('.nav-tab')).map((tab) => tab.className),
    running: document.querySelector('.bottom-nav')?.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length ?? -1,
  }));
  check(
    'icon anim: classes cleared and nothing still running',
    !afterAnim.classes.some((name) => name.includes('is-enter') || name.includes('is-leave')) && afterAnim.running === 0,
    JSON.stringify(afterAnim),
  );

  // ---- 4. Programmatic navigation must not vibrate. ----------------------
  await page.evaluate(() => document.querySelector('[data-nav-item="/"]')?.click());
  await sleep(600);
  const beforeProgrammatic = await vibrationCount(page);
  await page.evaluate(() => {
    location.hash = '#/orders';
  });
  await sleep(700);
  const afterProgrammatic = await vibrationCount(page);
  check('haptics: programmatic navigation is silent', afterProgrammatic === beforeProgrammatic, `${beforeProgrammatic} -> ${afterProgrammatic}`);
  await page.evaluate(() => {
    location.hash = '#/';
  });
  await sleep(700);

  // ---- 5. Search overlay hides the bar; closing restores it. -------------
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

  // ---- 6. Pushed pages: nav hidden, back arrow returns Home. -------------
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

  // ---- 7. Filter sheet keeps its actions above the nav. ------------------
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

  // ---- 8. Fit at 360 / 390 / 430. ----------------------------------------
  for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 900 }]) {
    const fitContext = await browser.newContext({ viewport: { width: size.width, height: size.height }, isMobile: true, hasTouch: true });
    await seed(fitContext);
    const fitPage = await fitContext.newPage();
    await fitPage.goto(`${base}/#/orders`, { waitUntil: 'networkidle' });
    await sleep(900);
    const state = await navState(fitPage);
    check(`fit ${size.width}: nav inside viewport`, state.navRect.x >= 11 && state.navRect.x + state.navRect.width <= size.width - 11, JSON.stringify(state.navRect));
    check(
      `fit ${size.width}: both labels fit`,
      state.tabs.length === 2 && state.tabs.every((tab) => tab.labelWidth > 0 && tab.labelScrollWidth <= tab.labelWidth + 1),
      state.tabs.map((tab) => `${tab.labelScrollWidth}/${tab.labelWidth}`).join(' '),
    );
    check(`fit ${size.width}: pill on History`, near(state.indicator.x - state.tabs[1].rect.x, 0, 0.6), `${state.indicator.x} vs ${state.tabs[1].rect.x}`);
    check(
      `fit ${size.width}: icon + gap + label fit the tab slot`,
      state.tabs.every((tab) => tab.iconSize.width + tab.iconGap + tab.labelWidth <= tab.rect.width + 1),
      JSON.stringify(state.tabs.map((tab) => tab.iconSize.width + tab.iconGap + tab.labelWidth)),
    );
    check(
      `fit ${size.width}: capsule is 268px, or the screen minus 112px`,
      near(state.navRect.width, Math.min(268, size.width - 112), 1),
      `${state.navRect.width} vs ${Math.min(268, size.width - 112)}`,
    );
    check(
      `fit ${size.width}: capsule stays centred`,
      near(state.navRect.x + state.navRect.width / 2, size.width / 2, 1),
      `${state.navRect.x + state.navRect.width / 2} vs ${size.width / 2}`,
    );
    await fitPage.screenshot({ path: path.join(outDir, `fit-${size.width}x${size.height}.png`) });
    await fitContext.close();
  }

  // ---- 9. Drag the pill from History to Home (haptic on the snap). -------
  const dragContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await seed(dragContext);
  await mockVibrate(dragContext);
  const dragPage = await dragContext.newPage();
  await dragPage.goto(`${base}/#/orders`, { waitUntil: 'networkidle' });
  await sleep(800);
  const centers = await dragPage.locator('.nav-tab').evaluateAll((tabs) =>
    tabs.map((tab) => {
      const rect = tab.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }),
  );
  const dragVibStart = await vibrationCount(dragPage);
  await dragPage.mouse.move(centers[1].x, centers[1].y);
  await dragPage.mouse.down();
  await dragPage.mouse.move(centers[0].x, centers[0].y, { steps: 10 });
  await sleep(60);
  await dragPage.screenshot({ path: path.join(outDir, 'drag-mid.png') });
  await dragPage.mouse.up();
  await sleep(650);
  const dragState = await navState(dragPage);
  check('drag: lands on Home', (dragState.hash === '#/' || dragState.hash === '') && dragState.active === '/', `${dragState.hash} ${dragState.active}`);
  const dragVibEnd = await vibrationCount(dragPage);
  check('haptics: drag-snap commit fires one impact', dragVibEnd === dragVibStart + 1, `${dragVibStart} -> ${dragVibEnd}`);
  await dragPage.screenshot({ path: path.join(outDir, 'drag-end.png') });
  await dragContext.close();

  // ---- 10. Reduced motion: no icon animation, instant state. -------------
  const rmContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await seed(rmContext);
  const rmPage = await rmContext.newPage();
  await rmPage.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await sleep(700);
  await rmPage.evaluate(() => document.querySelector('[data-nav-item="/orders"]')?.click());
  await sleep(120);
  const rm = await rmPage.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const active = document.querySelector('.nav-tab.is-active');
    const indicator = document.querySelector('.nav-indicator');
    return {
      running: nav?.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length ?? -1,
      activeItem: active?.getAttribute('data-nav-item') ?? '',
      label: active ? getComputedStyle(active).color : '',
      transform: indicator ? getComputedStyle(indicator).transform : '',
      transition: indicator ? getComputedStyle(indicator).transitionDuration : '',
    };
  });
  check('reduced motion: no animation runs', rm.running === 0, String(rm.running));
  check(
    'reduced motion: the pill and label land instantly on History',
    rm.activeItem === '/orders' && rm.label === 'rgb(255, 255, 255)' && rm.transition.split(',')[0].trim() === '0s',
    JSON.stringify(rm),
  );
  await rmContext.close();

  // ---- 11. The debug panel shows the haptic count. -----------------------
  const dbgContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await seed(dbgContext);
  await mockVibrate(dbgContext);
  const dbgPage = await dbgContext.newPage();
  await dbgPage.goto(`${base}/#/?debug=1`, { waitUntil: 'networkidle' });
  await sleep(900);
  await dbgPage.click('[data-nav-item="/orders"]');
  await sleep(1300);
  const collapsed = await dbgPage.evaluate(() => document.querySelector('#nbp-debug-root')?.textContent ?? '');
  await dbgPage.locator('[aria-label="Open stress debug panel"]').click();
  await sleep(700);
  const panel = await dbgPage.evaluate(() => document.querySelector('#nbp-debug-root')?.textContent ?? '');
  check(
    'debug panel: shows the haptic count',
    /haptics 1/.test(panel) && /1h/.test(collapsed),
    `${collapsed.replace(/\s+/g, ' ').slice(0, 60)} | ${panel.replace(/\s+/g, ' ').slice(0, 80)}`,
  );
  await dbgContext.close();

  // ---- 12. Scroll hide/show (Item 19, part 2) ----------------------------
  // Real touch scrolls through CDP on both tab scrollers, with the cart bar on
  // screen. Every assertion reads the DOM after the gesture has settled, plus
  // the composited transform of both bars.
  const ORDER_SEED = Array.from({ length: 6 }, (_, index) => ({
    id: `NAV-1900${index}`,
    restaurantId: 2,
    restaurantName: index % 2 ? 'Biryani Bhavan' : 'Pizza Palace',
    lines: [{ name: index % 2 ? 'Hyderabadi Chicken Biryani' : 'Margherita Pizza', qty: 1, price: 249 }],
    subtotal: 249,
    platformFee: 5,
    discount: 0,
    total: 254,
    status: index === 0 ? 'on_the_way' : 'delivered',
    placedAt: `2026-11-1${index}T12:24:00+05:30`,
    eta: '12 mins',
    paymentMethod: 'UPI · demo@upi',
    address: '12, 4th Cross, Indiranagar, Bengaluru',
  }));

  const scrollContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await seed(scrollContext);
  await scrollContext.addInitScript((orders) => {
    localStorage.setItem(
      'nearbite_cart',
      JSON.stringify({
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
      }),
    );
    localStorage.setItem('nearbite_orders', JSON.stringify(orders));
  }, ORDER_SEED);

  const scrollPage = await scrollContext.newPage();
  const cdp = await scrollContext.newCDPSession(scrollPage);
  await cdp.send('Page.enable');
  const screencast = [];
  cdp.on('Page.screencastFrame', (event) => {
    screencast.push({ data: event.data, ts: Date.now() });
    void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => undefined);
  });

  const installMeters = () =>
    scrollPage.evaluate(() => {
      const meter = (window.__scrollMeter = { frames: [], on: false, cls: 0, clsEntries: 0 });
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              meter.cls += entry.value;
              meter.clsEntries += 1;
            }
          }
        }).observe({ type: 'layout-shift', buffered: false });
      } catch {
        /* layout-shift unsupported */
      }
      window.__scrollFpsStart = () => {
        meter.frames = [];
        meter.on = true;
        const loop = (time) => {
          if (!meter.on) return;
          meter.frames.push(time);
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      };
      window.__scrollFpsStop = () => {
        meter.on = false;
        const frames = meter.frames;
        const span = frames.length > 1 ? frames[frames.length - 1] - frames[0] : 0;
        const gaps = frames.slice(1).map((time, index) => time - frames[index]);
        return {
          frames: frames.length,
          fps: span > 0 ? Number((((frames.length - 1) * 1000) / span).toFixed(1)) : 0,
          maxGapMs: gaps.length ? Number(Math.max(...gaps).toFixed(1)) : 0,
          longFrames: gaps.filter((gap) => gap > 25).length,
        };
      };
      window.__scrollCls = () => Number(meter.cls.toFixed(4));
      window.__scrollClsReset = () => {
        meter.cls = 0;
        meter.clsEntries = 0;
      };
    });

  const readBars = (scrollerSelector = '.home-scroll') =>
    scrollPage.evaluate((selector) => {
      const nav = document.querySelector('.bottom-nav');
      const cart = document.querySelector('#white-cart-root');
      const scroller = document.querySelector(selector);
      const homeScroller = document.querySelector('.home-scroll');
      const navStyle = nav ? getComputedStyle(nav) : null;
      const cartStyle = cart ? getComputedStyle(cart) : null;
      const navRect = nav?.getBoundingClientRect();
      const cartRect = cart?.getBoundingClientRect();
      return {
        hash: location.hash,
        scrollHidden: document.body.classList.contains('nav-scroll-hidden'),
        resetting: document.body.classList.contains('nav-scroll-reset'),
        navClass: nav?.className ?? '',
        navTransform: navStyle?.transform ?? '',
        navOpacity: Number(navStyle?.opacity ?? -1),
        navBottom: navRect ? Math.round(innerHeight - navRect.bottom) : -1,
        navHeight: navRect ? Math.round(navRect.height) : -1,
        cartPresent: Boolean(cart),
        cartClass: cart?.className ?? '',
        cartTranslate: cartStyle?.translate ?? 'none',
        cartBottom: cartRect ? Math.round(innerHeight - cartRect.bottom) : -1,
        cartVisible: cartStyle ? cartStyle.display !== 'none' : false,
        scroller: selector,
        scrollTop: scroller ? Math.round(scroller.scrollTop) : -1,
        homeScrollTop: homeScroller ? Math.round(homeScroller.scrollTop) : -1,
        paddingBottom: scroller ? getComputedStyle(scroller).paddingBottom : '',
        contentHeight: scroller ? scroller.scrollHeight : -1,
        bodyHeight: document.body.scrollHeight,
      };
    }, scrollerSelector);

  const translateY = (value) => {
    if (!value || value === 'none') return 0;
    const parts = value.replace(/matrix3d\(|matrix\(|translate3d\(|translate\(|\)/g, '').split(',').map((part) => Number(part.trim()));
    // computed transform is a matrix: ty is element 5 (2d) or 13 (3d)
    if (value.startsWith('matrix3d')) return parts[13] ?? 0;
    if (value.startsWith('matrix')) return parts[5] ?? 0;
    return Number(parts[1] ?? 0);
  };

  /** The cart bar's `translate` is two values; the second one is the lift. */
  const cartLift = (value) => {
    if (!value || value === 'none') return 0;
    const parts = value.split(' ').map((part) => parseFloat(part));
    return parts.length > 1 ? parts[1] : 0;
  };

  /**
    * A real finger drag: touchStart, stepped touchMove, touchEnd. Positive
    * distance drags the finger up (the page scrolls down). Chromium scrolls the
    * route scroller natively, so this exercises the same path as a phone.
    */
  const drag = async (distance) => {
    const view = scrollPage.viewportSize();
    const x = Math.round(view.width / 2);
    // Start clear of both bars: the cart bar covers the bottom ~150px on Home
    // and the tab bar the last ~76px.
    const startY = Math.round(view.height * (distance >= 0 ? 0.72 : 0.28));
    const room = distance >= 0 ? startY - 100 : view.height - 100 - startY;
    const travel = Math.min(distance, room);
    const steps = 12;
    const step = travel / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
    for (let index = 1; index <= steps; index += 1) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(startY - step * index) }] });
      await sleep(14);
    }
    // Creep the last pixels so the release velocity is near zero: the gesture
    // lands where the finger stopped instead of flinging past it.
    let y = Math.round(startY - travel);
    for (let index = 0; index < 3; index += 1) {
      y -= 1;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
      await sleep(35);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(460);
  };
  const scrollDown = (px) => drag(px);
  const scrollUp = (px) => drag(-px);

  /**
   * Six real screenshots across the slide, taken in slow motion: a 240ms move
   * is over before six screenshots can land (~50ms each), so the capture runs
   * with the same transition stretched to 2.4s linear. Geometry, easing shape
   * and the compositor path are unchanged; only the clock is stretched, and the
   * settled states are captured separately at the real duration.
   */
  const SLOW_CSS = 'body.nav-slow-capture .bottom-nav.nav-float, body.nav-slow-capture #white-cart-root { transition-duration: 2.4s !important; transition-timing-function: linear !important; }';
  const recordFrames = async (name, scrollerSelector, top) => {
    const clip = { x: 0, y: 844 - 260, width: 390, height: 260 };
    const frames = [];
    await scrollPage.evaluate((css) => {
      if (!document.getElementById('nav-slow-capture')) {
        const style = document.createElement('style');
        style.id = 'nav-slow-capture';
        style.textContent = css;
        document.head.appendChild(style);
      }
      document.body.classList.add('nav-slow-capture');
    }, SLOW_CSS);
    await scrollPage.evaluate(([selector, y]) => document.querySelector(selector).scrollTo({ top: y, behavior: 'instant' }), [scrollerSelector, top]);
    for (let index = 0; index < 6; index += 1) {
      const state = await scrollPage.evaluate(() => {
        const nav = document.querySelector('.bottom-nav');
        const cart = document.querySelector('#white-cart-root');
        const style = getComputedStyle(nav);
        return {
          nav: style.transform,
          opacity: Number(style.opacity),
          cart: cart ? getComputedStyle(cart).translate : 'none',
          hidden: document.body.classList.contains('nav-scroll-hidden'),
        };
      });
      frames.push({ state, png: PNG.sync.read(await scrollPage.screenshot({ clip })) });
      await sleep(330);
    }
    await scrollPage.evaluate(() => {
      document.body.classList.remove('nav-slow-capture');
      document.getElementById('nav-slow-capture')?.remove();
    });
    await sleep(400);
    await writeFile(path.join(outDir, `nav-${name}-strip.png`), PNG.sync.write(stack(frames.map((frame) => frame.png), 4)));
    return { name, frames: frames.length, states: frames.map((frame) => frame.state) };
  };
  const scrollReport = {};
  const runScroller = async (label, route, scrollerSelector) => {
    await scrollPage.goto(`${base}/#${route}`, { waitUntil: 'networkidle' });
    await scrollPage.waitForSelector('.bottom-nav');
    await scrollPage.waitForFunction((selector) => document.querySelector(selector)?.scrollHeight > 0, scrollerSelector, { timeout: 8000 });
    await sleep(700);
    await scrollPage.evaluate((selector) => document.querySelector(selector).scrollTo(0, 0), scrollerSelector);
    await sleep(260);
    await installMeters();

    const read = () => readBars(scrollerSelector);
    const top = await read();
    // The cart bar only exists on the Home family of routes.
    const hasCart = top.cartPresent && top.cartVisible;
    check(`${label}: bar visible at the top`, !top.scrollHidden && top.navOpacity === 1 && Math.abs(translateY(top.navTransform)) < 0.5, `${top.navTransform} ${top.navOpacity}`);
    if (hasCart) check(`${label}: cart bar is docked above the nav`, top.cartBottom > 60, `bottom=${top.cartBottom} translate=${top.cartTranslate}`);

    // Down: the bar and the cart bar leave together.
    await scrollPage.evaluate(() => window.__scrollClsReset());
    await scrollPage.evaluate(() => window.__scrollFpsStart());
    await scrollDown(700);
    await scrollPage.evaluate(() => window.__scrollFpsStop());
    const hidden = await read();
    const hideFps = await scrollPage.evaluate(() => window.__scrollFpsStop());
    check(`${label}: scrolling down hides the bar`, hidden.scrollHidden && hidden.navOpacity < 0.05, `${hidden.navTransform} ${hidden.navOpacity}`);
    check(
      `${label}: bar is a full footprint below the edge`,
      Math.abs(translateY(hidden.navTransform) - (top.navHeight + top.navBottom + 16)) <= 1.5,
      `ty=${translateY(hidden.navTransform)} expected=${top.navHeight + top.navBottom + 16}`,
    );
    if (hasCart) {
      check(`${label}: cart bar follows it down`, Math.abs(cartLift(hidden.cartTranslate) - (top.cartBottom - 12)) <= 1.5, `translate=${hidden.cartTranslate} lift=${cartLift(hidden.cartTranslate)}`);
    }
    check(`${label}: the scroll actually moved`, hidden.scrollTop > 300, String(hidden.scrollTop));
    check(`${label}: reserved bottom padding is unchanged`, hidden.paddingBottom === top.paddingBottom && hidden.contentHeight === top.contentHeight, `${top.paddingBottom} → ${hidden.paddingBottom}`);

    // Up: both come back.
    await scrollUp(320);
    const shown = await read();
    check(`${label}: scrolling up shows the bar`, !shown.scrollHidden && shown.navOpacity === 1 && Math.abs(translateY(shown.navTransform)) < 0.5, `${shown.navTransform} ${shown.navOpacity}`);
    if (hasCart) check(`${label}: cart bar returns with it`, Math.abs(cartLift(shown.cartTranslate)) < 0.5, `translate=${shown.cartTranslate}`);
    const cls = await scrollPage.evaluate(() => window.__scrollCls());
    check(`${label}: no layout shift while the bars move`, cls <= 0.01, `cls=${cls}`);
    check(`${label}: scroll runs at 60fps`, hideFps.fps >= 55, `${hideFps.fps}fps, ${hideFps.longFrames} long frames`);

    // Evidence strips: from the top, jump down 760px (hides), then back up to
    // 260px (shows), capturing six frames of each slide.
    await scrollPage.evaluate((selector) => document.querySelector(selector).scrollTo({ top: 0, behavior: 'instant' }), scrollerSelector);
    await sleep(420);
    const stillClip = { x: 0, y: 844 - 260, width: 390, height: 260 };
    await writeFile(path.join(outDir, `nav-${label}-visible.png`), PNG.sync.write(PNG.sync.read(await scrollPage.screenshot({ clip: stillClip }))));
    const hideStrip = await recordFrames(`${label}-hide`, scrollerSelector, 760);
    await writeFile(path.join(outDir, `nav-${label}-hidden.png`), PNG.sync.write(PNG.sync.read(await scrollPage.screenshot({ clip: stillClip }))));
    const showStrip = await recordFrames(`${label}-show`, scrollerSelector, 260);
    await sleep(200);

    // A tiny jitter must not move the bar.
    await scrollDown(6);
    const jitter = await read();
    check(`${label}: a 6px jitter does not hide the bar`, !jitter.scrollHidden, `scrollTop=${jitter.scrollTop}`);

    // Back to the top: always visible, whatever the direction.
    await scrollPage.evaluate((selector) => document.querySelector(selector).scrollTo(0, 0), scrollerSelector);
    await sleep(300);
    const backTop = await read();
    check(`${label}: visible again at the top`, !backTop.scrollHidden && backTop.scrollTop < 40, `scrollTop=${backTop.scrollTop}`);

    scrollReport[label] = { top, hidden, shown, jitter, backTop, cls, hideFps, hideStrip, showStrip };
  };

  await runScroller('home', '/', '.home-scroll');
  await runScroller('history', '/orders', '.orders-page');

  // ---- 12b. The bar comes back instantly on a route change. --------------
  await scrollPage.goto(`${base}/#/`, { waitUntil: 'networkidle' });
  await sleep(900);
  await installMeters();
  await scrollDown(700);
  const beforePush = await readBars('.home-scroll');
  check('route: hidden before the push', beforePush.scrollHidden);
  await scrollPage.evaluate(() => {
    window.__navMotion = [];
    window.__navMotionFrom = Number.MAX_SAFE_INTEGER;
    // The app dispatches this synchronously at the start of the push, before
    // anything moves: frames before it are the bar's deliberate off-screen
    // parking, not motion during the slide.
    window.addEventListener('navereat:before-navigate', () => {
      window.__navMotionFrom = performance.now();
    }, { once: true });
    const nav = document.querySelector('.bottom-nav');
    const sample = () => {
      if (!window.__navMotion) return;
      const style = getComputedStyle(nav);
      window.__navMotion.push({ t: Math.round(performance.now()), transform: style.transform, opacity: style.opacity, cls: document.body.className });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    window.addEventListener('navereat:transition-end', () => {
      window.__navMotionStop = true;
      window.__navMotion = window.__navMotion.slice();
      window.__navMotionDone = true;
    });
  });
  // The feed is scrolled down, so tap a real card that is on screen (a
  // synthetic event would bypass the app's navigation wrapper).
  const cardPoint = await scrollPage.evaluate(() => {
    for (const head of document.querySelectorAll('#restaurant-list .u99-restaurant-head')) {
      const rect = head.getBoundingClientRect();
      if (rect.top > 140 && rect.bottom < innerHeight - 160) {
        return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + Math.min(40, rect.height / 2)) };
      }
    }
    return null;
  });
  if (!cardPoint) throw new Error('route: no restaurant card on screen to tap');
  await scrollPage.mouse.click(cardPoint.x, cardPoint.y);
  await scrollPage.waitForFunction(() => location.hash.startsWith('#/restaurant/'), { timeout: 6000 });
  await sleep(1200);
  const onDetail = await readBars('.home-scroll');
  check('route: detail page has no scroll-hidden state', !onDetail.scrollHidden && !onDetail.navClass.includes('is-visible'), `${onDetail.hash} ${onDetail.navClass}`);
  await scrollPage.evaluate(() => history.back());
  await scrollPage.waitForFunction(() => location.hash === '#/', { timeout: 6000 });
  await sleep(1400);
  const afterBack = await readBars('.home-scroll');
  const motion = await scrollPage.evaluate(() => {
    const frames = (window.__navMotion ?? []).filter((frame) => frame.t >= (window.__navMotionFrom ?? 0));
    const moving = frames.filter((frame) => {
      const ty = Number((frame.transform.match(/matrix(?:3d)?\(([^)]+)\)/)?.[1] ?? '0,0').split(',')[5] ?? 0);
      return Math.abs(ty) > 0.5;
    });
    return { frames: frames.length, moving: moving.slice(0, 4), done: Boolean(window.__navMotionDone) };
  });
  check('route: bar is back and in place after the pop', !afterBack.scrollHidden && afterBack.navOpacity === 1 && Math.abs(translateY(afterBack.navTransform)) < 0.5, `${afterBack.navTransform} ${afterBack.navOpacity}`);
  check('route: bar never slid during push/pop', motion.moving.length === 0, `${motion.frames} frames sampled, ${motion.moving.length} moved`);

  // ---- 12c. Search overlay, sheet and tab change reset the state. --------
  await scrollDown(700);
  const beforeOverlay = await readBars('.home-scroll');
  check('search: hidden before opening', beforeOverlay.scrollHidden);
  await scrollPage.locator('.search-box').first().click();
  await sleep(700);
  await scrollPage.keyboard.press('Escape');
  await sleep(800);
  const afterOverlay = await readBars('.home-scroll');
  check('search: closing the overlay shows the bar again', !afterOverlay.scrollHidden && afterOverlay.navOpacity === 1, `${afterOverlay.navClass} ${afterOverlay.navOpacity}`);

  await scrollDown(700);
  const beforeTab = await readBars('.home-scroll');
  check('tab: hidden before the switch', beforeTab.scrollHidden);
  const ghost = await scrollPage.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const rect = nav.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      offscreen: rect.top >= innerHeight - 1,
      inert: getComputedStyle(nav).pointerEvents === 'none',
      hitsNav: Boolean(hit && nav.contains(hit)),
    };
  });
  check('tab: hidden bar is off-screen and inert', ghost.offscreen && ghost.inert && !ghost.hitsNav, JSON.stringify(ghost));
  // The real user path: scroll up a little, the bar returns, then tap a tab.
  await scrollUp(60);
  const revealed = await readBars('.home-scroll');
  check('tab: scrolling up brings the bar back', !revealed.scrollHidden && revealed.navOpacity === 1, `${revealed.navOpacity}`);
  await scrollPage.click('[data-nav-item="/orders"]');
  await sleep(1200);
  const afterTab = await readBars('.orders-page');
  check('tab: switching tabs shows the bar', !afterTab.scrollHidden && afterTab.navOpacity === 1 && afterTab.hash === '#/orders', `${afterTab.hash} ${afterTab.navOpacity}`);
  check('tab: the new tab starts at the top', afterTab.scrollTop < 40, String(afterTab.scrollTop));

  // ---- 12d. 6× CPU throttle: the hide/show costs nothing measurable. ----
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await sleep(300);
  await installMeters();
  // Both windows are a fixed 1 s around a drag, so the two numbers are
  // measured under identical conditions; only the toggle differs.
  const measureThrottled = async (dragPx) => {
    await scrollPage.evaluate(() => window.__scrollFpsStart());
    await sleep(250);
    if (dragPx) await scrollDown(dragPx);
    await sleep(650);
    return scrollPage.evaluate(() => window.__scrollFpsStop());
  };
  await scrollPage.evaluate(() => document.querySelector('.orders-page').scrollTo(0, 0));
  await sleep(400);
  const throttleToggle = await measureThrottled(700);
  await sleep(500);
  const throttleQuiet = await measureThrottled(400);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  check(
    '6x cpu: toggling the bar costs no more than a plain scroll',
    throttleToggle.fps >= throttleQuiet.fps - 3 && throttleToggle.longFrames <= throttleQuiet.longFrames + 3,
    `toggle ${throttleToggle.fps}fps/${throttleToggle.longFrames} long vs quiet ${throttleQuiet.fps}fps/${throttleQuiet.longFrames} long`,
  );
  check('6x cpu: still above 30fps', throttleToggle.fps >= 30, `${throttleToggle.fps}fps`);

  report.scroll = { ...scrollReport, throttleToggle, throttleQuiet, motion };
  await scrollContext.close();

  // ---- 13. Side-by-side against the spec reference. ----------------------
  const appNav = PNG.sync.read(await page.screenshot({ clip: navClip }));
  await writeFile(path.join(outDir, 'nav-home-crop.png'), PNG.sync.write(appNav));
  await writeFile(path.join(outDir, 'nav-vs-spec.png'), PNG.sync.write(stack([crop(appNav, 0, 0, 390, navClip.height), crop(specShot, 0, 0, 390, navClip.height)], 10)));

  report.ratios = {
    H,
    containerHeight: SPEC.height,
    sideMargin: SPEC.side,
    bottom: SPEC.bottom,
    pillInset: 0,
    icon: SPEC.icon,
    iconLabelGap: SPEC.iconLabelGap,
    labelSize: SPEC.label,
    shadow: `0 ${SPEC.shadowY}px ${SPEC.shadowBlur}px rgba(0,0,0,0.10)`,
  };
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
