/* Captures 60 ms transition frames and first/second restaurant-open evidence. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const BASE = process.env.NAVEREAT_URL || 'http://127.0.0.1:4181';
const OUT = process.env.TRANSITION_OUT || path.resolve(__dirname, '../../verify/item4-after');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(() => {
    localStorage.setItem('nearbite_token', 'demo-token');
    localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Sagnik', phone: '+91 98765 43210', email: 'demo@navereat.app' }));
    localStorage.removeItem('nearbite_cart');
    localStorage.removeItem('nearbite_orders');
  });

  const page = await context.newPage();
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.u99-restaurant-head', { timeout: 20000 });
  await sleep(900);

  const state = () => page.evaluate(() => ({
    hash: window.location.hash,
    layers: [...document.querySelectorAll('.route-layer')].map((layer) => {
      const style = getComputedStyle(layer);
      const rect = layer.getBoundingClientRect();
      return { x: Math.round(rect.x), opacity: Number(style.opacity).toFixed(2) };
    }),
    home: Boolean(document.querySelector('.home-screen')),
    restaurant: Boolean(document.querySelector('.rest-page')),
    homeScroll: document.querySelector('.home-scroll')?.scrollTop ?? null,
    restaurantScroll: document.querySelector('.rest-scroll')?.scrollTop ?? null,
    homeSkeletons: document.querySelectorAll('.home-screen .skeleton, .home-screen .rs-skeleton').length,
    restaurantSkeletons: document.querySelectorAll('.rest-page .skeleton').length,
    menuDisplay: document.querySelector('#menu-container') ? getComputedStyle(document.querySelector('#menu-container')).display : null,
    ratingFilter: document.querySelector('.filter-pill[aria-pressed="true"]')?.textContent?.trim() ?? '',
  }));

  const frames = [];
  await page.evaluate(() => {
    const scroller = document.querySelector('.home-scroll');
    if (scroller) scroller.scrollTop = 520;
  });
  await page.locator('.filter-pill').filter({ hasText: 'Rating 4.0+' }).click();
  await sleep(250);
  frames.push({ label: 'home-before-push', ...(await state()) });
  await page.screenshot({ path: path.join(OUT, 'push-00-before.png') });

  await page.locator('.u99-restaurant-head').first().click();
  for (let index = 1; index <= 12; index += 1) {
    await sleep(60);
    await page.screenshot({ path: path.join(OUT, `push-${String(index).padStart(2, '0')}.png`) });
    frames.push({ label: `push-${index * 60}ms`, ...(await state()) });
  }
  await sleep(500);
  frames.push({ label: 'push-settled', ...(await state()) });
  await page.screenshot({ path: path.join(OUT, 'push-settled.png') });

  await page.evaluate(() => {
    const scroller = document.querySelector('.rest-scroll');
    if (scroller) scroller.scrollTop = 700;
  });
  await sleep(200);
  frames.push({ label: 'restaurant-before-pop', ...(await state()) });

  await page.locator('.ew-hd-back').first().click();
  for (let index = 1; index <= 12; index += 1) {
    await sleep(60);
    await page.screenshot({ path: path.join(OUT, `pop-${String(index).padStart(2, '0')}.png`) });
    frames.push({ label: `pop-${index * 60}ms`, ...(await state()) });
  }
  await sleep(500);
  frames.push({ label: 'pop-settled', ...(await state()) });
  await page.screenshot({ path: path.join(OUT, 'pop-settled.png') });

  await sleep(300);
  frames.push({ label: 'second-open-before', ...(await state()) });
  await page.locator('.u99-restaurant-head').first().click();
  for (let index = 1; index <= 8; index += 1) {
    await sleep(60);
    await page.screenshot({ path: path.join(OUT, `second-${String(index).padStart(2, '0')}.png`) });
    frames.push({ label: `second-${index * 60}ms`, ...(await state()) });
  }
  await sleep(700);
  frames.push({ label: 'second-settled', ...(await state()) });
  await page.screenshot({ path: path.join(OUT, 'second-settled.png') });

  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(frames, null, 2));
  console.log(JSON.stringify(frames, null, 2));
  await browser.close();
})();
