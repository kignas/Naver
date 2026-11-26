import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { preview } from 'vite';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const outDir = path.join(repoRoot, 'verify', 'item19');
const base = 'http://127.0.0.1:4177';
/** --nav-h (64) + --nav-bottom (12) + 12 */
const NAV_RESERVE = 88;
/** Measured spec, ratios of the 64dp container. */
const H = 64;
const SPEC = {
  height: H,
  side: 14,
  bottom: 12,
  gap: Number((0.067 * H).toFixed(2)),
  icon: Number((0.34 * H).toFixed(2)),
  iconLabelGap: Number((0.19 * H).toFixed(2)),
  label: Number((0.205 * H).toFixed(2)),
  shadowY: Number((0.1 * H).toFixed(2)),
  shadowBlur: Number((0.35 * H).toFixed(2)),
};
const PILL_TOP = 'rgb(42, 42, 46)';
const PILL_BOTTOM = 'rgb(30, 30, 34)';
const IDLE_LABEL = 'rgb(28, 28, 40)';
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
              gap: style.getPropertyValue('--nav-gap').trim(),
              icon: style.getPropertyValue('--nav-icon-size').trim(),
              iconLabelGap: style.getPropertyValue('--nav-icon-label-gap').trim(),
              labelSize: style.getPropertyValue('--nav-label-size').trim(),
            },
          }
        : null,
      tabs: tabs.map((tab) => {
        const tabLabel = tab.querySelector('.nav-label');
        const glyph = tab.querySelector('.nav-glyph');
        const activeLayer = tab.querySelector('.nav-glyph__active');
        const outlineLayer = tab.querySelector('.nav-glyph__outline');
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
          iconGap: iconBox && labelBox ? Math.round((labelBox.top - iconBox.bottom) * 10) / 10 : null,
          labelStyle: labelStyle
            ? { size: parseFloat(labelStyle.fontSize), weight: labelStyle.fontWeight, color: labelStyle.color }
            : null,
          layers: {
            active: activeLayer ? Number(getComputedStyle(activeLayer).opacity) : -1,
            outline: outlineLayer ? Number(getComputedStyle(outlineLayer).opacity) : -1,
          },
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
    .bar{position:absolute;left:${SPEC.side}px;right:${SPEC.side}px;bottom:${SPEC.bottom}px;height:${SPEC.height}px;
      background:#fff;border:1px solid rgba(196,196,214,0.6);border-radius:999px;
      box-shadow:0 ${SPEC.shadowY}px ${SPEC.shadowBlur}px rgba(0,0,0,0.1);display:flex}
    .slot{position:relative;flex:1 1 0;display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:${SPEC.iconLabelGap}px;color:#1C1C28}
    .slot.on{color:#fff}
    .pill{position:absolute;inset:${SPEC.gap}px;border-radius:999px;
      background:linear-gradient(180deg,#2A2A2E 0%,#1E1E22 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.18)}
    .glyph{width:${SPEC.icon}px;height:${SPEC.icon}px;position:relative;z-index:1}
    .lbl{font-size:${SPEC.label}px;font-weight:500;line-height:1;position:relative;z-index:1}
  </style><div class="bar">
    <div class="slot on"><span class="pill"></span>
      <svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3.15 12.15 11.3 3.95a1 1 0 0 1 1.4 0l8.15 8.2"/><path d="M5.6 11.4v7.05a2.15 2.15 0 0 0 2.15 2.15h8.5a2.15 2.15 0 0 0 2.15-2.15V11.4"/></svg>
      <span class="lbl">Home</span></div>
    <div class="slot"><svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4.3" y="8.8" width="15.4" height="12" rx="2"/><path d="M8.9 9.2V7.7a3.1 3.1 0 0 1 6.2 0v1.5"/></svg>
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
    'home: hairline border',
    near(parseFloat(home.navStyle?.border), 1, 0.01) && /^rgba?\(196, 196, 214/.test(home.navStyle?.borderColor ?? ''),
    `${home.navStyle?.border} ${home.navStyle?.borderColor}`,
  );
  check('home: full pill radius', home.navStyle?.radius === '999px', home.navStyle?.radius);
  check(
    'home: shadow 0.10H / 0.35H, 10% black',
    ['6.4px', '22.4px', 'rgba(0, 0, 0, 0.1)'].every((part) => (home.navStyle?.shadow ?? '').includes(part)),
    home.navStyle?.shadow,
  );
  check('home: no backdrop blur', home.navStyle?.backdrop === 'none', home.navStyle?.backdrop);
  check(
    'home: colours are CSS variables',
    home.navStyle?.vars.surface === '#ffffff' &&
      home.navStyle?.vars.pillTop === '#2a2a2e' &&
      home.navStyle?.vars.pillBottom === '#1e1e22' &&
      home.navStyle?.vars.idle === '#1c1c28',
    JSON.stringify(home.navStyle?.vars),
  );

  // Measured geometry.
  check(
    'home: floating geometry H=64, 14px sides, 12px bottom',
    home.navRect.height === 64 && home.navRect.bottom === 12 && home.navRect.x === 14,
    JSON.stringify(home.navRect),
  );
  check('home: nav above route/sheet layers', Number(home.navStyle.z) >= 2000, home.navStyle.z);
  check('home: tab touch targets >= 44px', home.tabs.every((tab) => tab.rect.height >= 44), home.tabs.map((tab) => tab.rect.height).join('/'));
  check(
    'home: labels are not clipped',
    home.tabs.every((tab) => tab.labelWidth > 0 && tab.labelScrollWidth <= tab.labelWidth + 1),
    home.tabs.map((tab) => `${tab.labelScrollWidth}/${tab.labelWidth}`).join(' '),
  );
  check('home: reserves nav height', parseFloat(home.paddingBottom) >= NAV_RESERVE, home.paddingBottom);
  check('home: nav node preserved', home.sameNode);

  // Ratios of H.
  check(
    'ratios: icon 0.34H=22, label 0.205H=13 @500, gap 0.19H=12, pill inset 0.067H=4.3',
    // Ratios are rounded to whole dp/sp in CSS, so allow half a unit.
    home.tabs.every((tab) => near(tab.iconSize.width, SPEC.icon, 0.5) && near(tab.iconSize.height, SPEC.icon, 0.5)) &&
      home.tabs.every((tab) => near(tab.labelStyle.size, SPEC.label, 0.5) && tab.labelStyle.weight === '500') &&
      home.tabs.every((tab) => near(tab.iconGap, SPEC.iconLabelGap, 0.6)) &&
      near(parseFloat(home.navStyle.vars.gap), SPEC.gap, 0.01),
    JSON.stringify({
      icons: home.tabs.map((tab) => tab.iconSize),
      labels: home.tabs.map((tab) => `${tab.labelStyle.size}/${tab.labelStyle.weight}`),
      gaps: home.tabs.map((tab) => tab.iconGap),
      pill: home.navStyle.vars.gap,
    }),
  );

  // Pill: charcoal gradient, 1px inner highlight, inset by --nav-gap.
  check(
    'home: pill is a charcoal vertical gradient',
    home.indicator?.backgroundImage.includes('linear-gradient') &&
      home.indicator.backgroundImage.includes(PILL_TOP) &&
      home.indicator.backgroundImage.includes(PILL_BOTTOM),
    home.indicator?.backgroundImage,
  );
  check(
    'home: pill has the 1px inner highlight',
    /rgba\(255, 255, 255, 0\.18\) 0px 0px 0px 1px inset/.test(home.indicator?.boxShadow ?? ''),
    home.indicator?.boxShadow,
  );
  check(
    'home: pill inset by 0.067H inside the slot',
    near(home.indicator.x - home.tabs[0].rect.x, SPEC.gap, 0.6) && near(home.indicator.width, home.tabs[0].rect.width - 2 * SPEC.gap, 0.6),
    `${home.indicator.x - home.tabs[0].rect.x} / ${home.indicator.width} vs ${home.tabs[0].rect.width}`,
  );
  check('home: active label is white', home.activeColor === 'rgb(255, 255, 255)', home.activeColor);
  check('home: idle label is #1C1C28', home.tabs[1].labelStyle.color === IDLE_LABEL, home.tabs[1].labelStyle.color);

  // Icon states.
  check(
    'icons: active shows the gradient layer, idle shows the outline',
    home.tabs[0].layers.active === 1 &&
      home.tabs[0].layers.outline === 0 &&
      home.tabs[1].layers.active === 0 &&
      home.tabs[1].layers.outline === 1,
    JSON.stringify(home.tabs.map((tab) => tab.layers)),
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
  check('history: pill moved to History', near(history.indicator.x - history.tabs[1].rect.x, SPEC.gap, 0.6), JSON.stringify({ pill: history.indicator.x, tab: history.tabs[1].rect.x }));
  check('history: pill colour', history.indicator?.backgroundImage.includes(PILL_TOP), history.indicator?.backgroundImage);
  check('history: reserves nav height', parseFloat(history.paddingBottom) >= NAV_RESERVE, history.paddingBottom);
  check('history: nav node preserved', history.sameNode);
  check('history: icon states swapped', history.tabs[0].layers.active === 0 && history.tabs[1].layers.active === 1, JSON.stringify(history.tabs.map((tab) => tab.layers)));
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
    midFlight.some((x) => Math.abs(x - (history.tabs[0].rect.x + SPEC.gap)) < 20),
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
    check(`fit ${size.width}: pill on History`, near(state.indicator.x - state.tabs[1].rect.x, SPEC.gap, 0.6), `${state.indicator.x} vs ${state.tabs[1].rect.x}`);
    check(
      `fit ${size.width}: icon + label stack fits the pill`,
      state.tabs.every((tab) => tab.iconSize.height + tab.iconGap + tab.labelStyle.size <= 64 - 2 * SPEC.gap - 2),
      JSON.stringify(state.tabs.map((tab) => tab.iconSize.height + tab.iconGap + tab.labelStyle.size)),
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
  const rm = await rmPage.evaluate(() => ({
    running: document.querySelector('.bottom-nav')?.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length ?? -1,
    layers: Array.from(document.querySelectorAll('.nav-tab')).map((tab) => ({
      active: Number(getComputedStyle(tab.querySelector('.nav-glyph__active')).opacity),
      outline: Number(getComputedStyle(tab.querySelector('.nav-glyph__outline')).opacity),
    })),
  }));
  check('reduced motion: no animation runs', rm.running === 0, String(rm.running));
  check('reduced motion: icon state is instant', rm.layers[0].active === 0 && rm.layers[1].active === 1, JSON.stringify(rm.layers));
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

  // ---- 12. Side-by-side against the spec reference. ----------------------
  const appNav = PNG.sync.read(await page.screenshot({ clip: navClip }));
  await writeFile(path.join(outDir, 'nav-home-crop.png'), PNG.sync.write(appNav));
  await writeFile(path.join(outDir, 'nav-vs-spec.png'), PNG.sync.write(stack([crop(appNav, 0, 0, 390, navClip.height), crop(specShot, 0, 0, 390, navClip.height)], 10)));

  report.ratios = {
    H,
    containerHeight: SPEC.height,
    sideMargin: SPEC.side,
    bottom: SPEC.bottom,
    pillInset: SPEC.gap,
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
