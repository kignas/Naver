/* Real-touch check for the cart's pay path.
 *
 * The payment sheet's confirm button lands exactly where the cart's pay bar
 * was, so the button can only be judged with touch events, not with
 * elementFromPoint alone: a second tap at the same spot must not place the
 * order before the customer has seen the payment options.
 *
 * Taps are dispatched through CDP Input.dispatchTouchEvent, so the browser runs
 * its own hit testing, touch-action handling and click synthesis.
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.TAP_CHECK_PORT || 4189);
const BASE = `http://127.0.0.1:${PORT}`;

const server = spawn(
  'node_modules/.bin/vite',
  ['preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForServer = async () => {
  for (let i = 0; i < 120; i += 1) {
    try {
      const response = await fetch(BASE);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(150);
  }
  throw new Error(`preview server did not start on ${PORT}`);
};

const failures = [];
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
};

const seed = () => {
  localStorage.setItem('nearbite_token', 'demo-token');
  localStorage.setItem('nearbite_user', JSON.stringify({ name: 'Sagnik', phone: '+91 98765 43210' }));
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
  localStorage.setItem('nearbite_orders', '[]');
};

await waitForServer();
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(seed);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  const tap = async (x, y) => {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1, radiusX: 12, radiusY: 12, force: 1 }],
    });
    await sleep(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };

  const centreOf = (selector) =>
    page.evaluate((sel) => {
      const node = document.querySelector(sel);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
    }, selector);

  await page.goto(`${BASE}/#/cart?offers=none`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#btn-checkout', { timeout: 20000 });
  await page.waitForTimeout(700);

  const bar = await centreOf('#btn-checkout');
  check(!!bar, 'cart pay bar is on screen', bar ? `${bar.x},${bar.y}` : 'missing');

  await tap(bar.x, bar.y);
  await page.waitForSelector('#ct-pay-sheet.is-open', { timeout: 5000 });
  check(true, 'touch on the pay bar opens the payment sheet');

  const covered = await page.evaluate(() => {
    const bar = document.getElementById('btn-checkout');
    const rect = bar.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      insideSheet: !!hit?.closest('#ct-pay-sheet'),
      hit: hit ? `${hit.tagName}#${hit.id}` : null,
      hitText: hit?.textContent?.trim().slice(0, 24) ?? null,
    };
  });
  check(covered.insideSheet, 'the pay bar is covered by the sheet', `hit ${covered.hit} "${covered.hitText}"`);

  // Second tap in the same place: the guard must swallow it.
  await tap(bar.x, bar.y);
  await page.waitForTimeout(700);
  const afterDouble = await page.evaluate(() => ({
    success: !!document.querySelector('.ew-os.is-open'),
    sheet: !!document.querySelector('#ct-pay-sheet.is-open'),
    orders: JSON.parse(localStorage.getItem('nearbite_orders') || '[]').length,
  }));
  check(!afterDouble.success && afterDouble.orders === 0, 'double tap does not place the order', `orders ${afterDouble.orders}`);
  check(afterDouble.sheet, 'the sheet is still open after the double tap');

  // Now a deliberate tap on the confirm button, after the guard window.
  await page.waitForTimeout(450);
  const confirm = await centreOf('#ct-pay-confirm-btn');
  check(!!confirm, 'confirm button is on screen', confirm ? `${confirm.x},${confirm.y}` : 'missing');
  await tap(confirm.x, confirm.y);
  await page.waitForSelector('.ew-os.is-open', { timeout: 8000 });
  const placed = await page.evaluate(() => ({
    success: !!document.querySelector('.ew-os.is-open'),
    orders: JSON.parse(localStorage.getItem('nearbite_orders') || '[]').length,
  }));
  check(placed.success && placed.orders === 1, 'a deliberate tap on the confirm button places the order', `orders ${placed.orders}`);

  await context.close();
} finally {
  await browser.close();
  server.kill('SIGTERM');
}

if (failures.length) {
  console.error(`\n${failures.length} pay-tap check(s) failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nAll pay-tap checks passed.');
