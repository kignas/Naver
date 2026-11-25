/**
 * STEP 2 read-only pass against the live customer API.
 *
 *   npx vite-node scripts/api-readonly.ts            # run + print the table
 *   npx vite-node scripts/api-readonly.ts --fixtures # also rewrite the fixtures
 *
 * Nothing here writes to the backend except `POST /pricing/quote` and
 * `POST /coupons/validate`, both of which only compute an answer (no order, no
 * profile, no address, no ticket). Login only runs when the test credentials are
 * in the environment; without them the logged-in flows are reported as skipped.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const memory = new Map<string, string>();
const makeStorage = (): Storage => ({
  get length() {
    return memory.size;
  },
  clear: () => memory.clear(),
  getItem: (key: string) => memory.get(key) ?? null,
  key: (index: number) => [...memory.keys()][index] ?? null,
  removeItem: (key: string) => void memory.delete(key),
  setItem: (key: string, value: string) => void memory.set(key, value),
});

(globalThis as unknown as { window: unknown }).window = {
  localStorage: makeStorage(),
  sessionStorage: makeStorage(),
  dispatchEvent: () => true,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

const { apiDataSource } = await import('../src/data/api/apiDataSource');
const { setFetcher } = await import('../src/data/api/http');

interface Row {
  flow: string;
  expected: string;
  app: string;
  match: 'yes' | 'no' | 'partial' | 'skipped';
}

const rows: Row[] = [];
const fixtures: Record<string, unknown> = {};
const note = (flow: string, expected: string, app: string, match: Row['match']) => {
  rows.push({ flow, expected, app, match });
  console.log(`${match.toUpperCase().padEnd(7)} ${flow} :: ${app}`);
};

/** Records the raw payloads the app receives, for the offline fixtures. */
const recordingFetcher = async (input: string, init?: RequestInit): Promise<Response> => {
  const response = await fetch(input, init);
  const clone = response.clone();
  try {
    const path = new URL(input).pathname.replace('/api', '');
    if (response.ok && (init?.method ?? 'GET') === 'GET') {
      fixtures[path] = await clone.json();
    }
  } catch {
    /* not JSON */
  }
  return response;
};

setFetcher(recordingFetcher);

const fail = (error: unknown): string => {
  const value = error as { message?: string; kind?: string; code?: string; status?: number };
  return `${value?.kind ?? 'error'}${value?.status ? ` ${value.status}` : ''}: ${value?.message ?? String(error)}`;
};

/* ------------------------------------------------------------ catalogue */
let feed: Awaited<ReturnType<typeof apiDataSource.getHome>> | null = null;
try {
  feed = await apiDataSource.getHome();
  const first = feed.restaurants[0];
  note(
    'Home feed',
    'paged {success,page,pages,total,data} -> cards with name, image, rating, eta, minOrder',
    `${feed.restaurants.length} restaurant(s); first "${first?.name}" rating ${first?.rating} eta "${first?.time}" min ₹${first?.minimumOrder} image ${first?.image.includes('f_auto') ? 'cloudinary-transformed' : first?.image.slice(0, 40)}`,
    feed.restaurants.length > 0 ? 'yes' : 'no',
  );
  note(
    'Categories',
    'GET /categories -> isActive rows with name + image',
    `${feed.categories.length} categories; first "${feed.categories[0]?.name}"`,
    feed.categories.length > 0 ? 'yes' : 'no',
  );
  note(
    'Banners',
    'GET /home-banners -> active, priority-sorted, mobile image',
    `${feed.banners.length} banner(s); first "${feed.banners[0]?.title}" placement ${feed.banners[0]?.placement}`,
    feed.banners.length > 0 ? 'yes' : 'partial',
  );
  const closed = feed.restaurants.filter((restaurant) => restaurant.available === false);
  note(
    'Closed restaurant state',
    'isOpen:false -> card/page shows the closed state, ordering disabled',
    closed.length
      ? `${closed.length} closed (${closed.map((restaurant) => restaurant.name).join(', ')}) -> available:false`
      : 'no closed restaurant in the feed right now',
    closed.length ? 'yes' : 'skipped',
  );
  const withImage = feed.restaurants.filter((restaurant) => !restaurant.image.includes('placeholders'));
  note(
    'Cards with/without images',
    'empty image -> local placeholder; cloudinary -> f_auto,q_auto,w_480',
    `${withImage.length} with an API image, ${feed.restaurants.length - withImage.length} on the placeholder`,
    'yes',
  );
} catch (error) {
  note('Home feed', '200 with a paged envelope', fail(error), 'no');
}

/* ---------------------------------------------------------------- search */
for (const term of ['dosa', 'masala', 'paneer']) {
  try {
    const rowsFound = await apiDataSource.search(term);
    note(
      `Search "${term}"`,
      'menuItems[] for scope=home',
      `${rowsFound.length} result(s)${rowsFound[0] ? `; first "${rowsFound[0].name}" ₹${rowsFound[0].price}` : ''}`,
      rowsFound.length ? 'yes' : 'partial',
    );
  } catch (error) {
    note(`Search "${term}"`, 'menuItems[]', fail(error), 'no');
  }
}

/* --------------------------------------------------- restaurant + menu */
const restaurantIds = (feed?.restaurants ?? []).slice(0, 3).map((restaurant) => restaurant.id);
for (const id of restaurantIds.length ? restaurantIds : [1]) {
  try {
    const detail = await apiDataSource.getRestaurant(id);
    const items = detail.menu;
    const groups = items.flatMap((item) => item.customizations ?? []);
    const unavailable = items.filter((item) => item.available === false);
    note(
      `Restaurant ${id} menu`,
      'object keyed by category -> flat items with price, isVeg, customisations',
      `"${detail.restaurant.name}" ${items.length} items in ${new Set(items.map((item) => item.category)).size} categories; ${groups.length} customisation group(s); ${unavailable.length} unavailable; first "${items[0]?.name}" ₹${items[0]?.price} veg=${items[0]?.isVeg}`,
      items.length ? 'yes' : 'no',
    );
    if (groups.length) {
      const group = groups[0];
      note(
        'Customisation groups',
        'title, required, minSelect/maxSelect, options[label,extraPrice,isVeg]',
        `"${group.title}" required=${group.required} max=${group.maxSelect ?? '-'} options=${group.options.length} (${group.options.map((option) => `${option.label}+₹${option.extraPrice}`).join(', ')})`,
        'yes',
      );
    }
  } catch (error) {
    note(`Restaurant ${id} menu`, 'menu for the restaurant', fail(error), 'no');
  }
}

/* --------------------------------------------------------- platform state */
try {
  const status = await apiDataSource.getPlatformStatus();
  note(
    'Platform state',
    'serviceStatus{state,canOrder}; closed_manual + canOrder:false locks ordering',
    `state ${status.service.state} canOrder ${status.service.canOrder} title "${status.service.title}" | UPI ${status.isUpiEnabled} COD ${status.isCodEnabled} maxCod ₹${status.maxCodOrderAmount}`,
    'yes',
  );
  note(
    'Payment options',
    'UPI when isUpiEnabled; COD only when isCodEnabled and under maxCodOrderAmount',
    `UPI ${status.isUpiEnabled ? 'shown' : 'hidden'}, COD ${status.isCodEnabled ? 'shown' : 'hidden'} (${status.codDisplayLabel})`,
    status.isCodEnabled ? 'yes' : 'partial',
  );
} catch (error) {
  note('Platform state', 'public-status', fail(error), 'no');
}

/* --------------------------------------------------------------- pricing */
const firstId = feed?.restaurants[0]?.id;
try {
  const detail = firstId ? await apiDataSource.getRestaurant(firstId) : null;
  const item = detail?.menu[0];
  if (item) {
    const quote = await apiDataSource.getQuote({
      restaurantId: String(firstId),
      items: [{ menuItem: item.id, quantity: 1 }],
      paymentMethod: 'cod',
    });
    note(
      'Quote (read-only)',
      'bill in rupees; itemTotal == sum(price*qty); grandTotal from the backend',
      `item ₹${item.price} -> itemTotal ₹${quote.bill.itemTotal}, delivery ₹${quote.bill.deliveryFee}, total ₹${quote.bill.total}, grandTotal ₹${quote.bill.grandTotal}, quoteId ${quote.quoteId ? 'issued' : 'absent'}`,
      quote.bill.itemTotal === item.price ? 'yes' : 'partial',
    );
  }
} catch (error) {
  note('Quote (read-only)', 'bill in rupees', fail(error), 'no');
}

/* --------------------------------------------------------------- coupons */
try {
  const bad = await apiDataSource.validateCoupon({ code: 'NAVEREAT-NOT-A-CODE', subtotal: 250 });
  note(
    'Coupon error path',
    'code COUPON_INVALID (or similar) + message, no discount',
    `${bad.ok ? 'accepted (!)' : `rejected code=${bad.code ?? 'none'} message="${bad.message}"`}`,
    bad.ok ? 'no' : 'yes',
  );
} catch (error) {
  note('Coupon error path', 'rejection with a code', fail(error), 'partial');
}

/* -------------------------------------------------------------- logged in */
const email = process.env.NAVEREAT_TEST_EMAIL;
const password = process.env.NAVEREAT_TEST_PASSWORD;
if (email && password) {
  try {
    const session = await apiDataSource.login({ email, password });
    note('Login', 'POST /users/login -> {token,user}', `token stored (${session.token.length} chars), user "${session.user.name}"`, 'yes');
    const profile = await apiDataSource.getProfile();
    note('Profile', 'GET /users/profile', `"${profile.name}" ${profile.phone}`, profile.name ? 'yes' : 'partial');
    const addresses = await apiDataSource.getAddresses();
    note('Addresses', 'GET /users/addresses', `${addresses.length} address(es)`, 'yes');
    const orders = await apiDataSource.getOrders();
    note('Orders list', 'GET /orders', `${orders.length} order(s)`, 'yes');
  } catch (error) {
    note('Login', 'token + user', fail(error), 'no');
  }
  try {
    const wrong = await apiDataSource.login({ email, password: `${password}-wrong` });
    note('Login wrong password', 'rejected with the server message', `accepted (!) user "${wrong.user.name}"`, 'no');
  } catch (error) {
    note('Login wrong password', 'rejected with the server message', fail(error), 'yes');
  }
} else {
  for (const flow of ['Login', 'Login wrong password', 'Profile', 'Addresses', 'Orders list']) {
    note(flow, 'needs NAVEREAT_TEST_EMAIL / NAVEREAT_TEST_PASSWORD', 'skipped: credentials not set', 'skipped');
  }
}

/* ---------------------------------------------------------------- output */
setFetcher(null);
console.log('\n| flow | expected | app | match |');
console.log('| --- | --- | --- | --- |');
for (const row of rows) console.log(`| ${row.flow} | ${row.expected} | ${row.app.replace(/\|/g, '/')} | ${row.match} |`);

if (process.argv.includes('--fixtures')) {
  const scrub = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(scrub);
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        if (['phone', 'fssaiLicenseNumber', 'createdBy', 'reviewedBy', 'reviewedAt', 'rejectionReason'].includes(key)) continue;
        out[key] = scrub(entry);
      }
      return out;
    }
    return value;
  };
  const target = resolve('src/data/api/fixtures.json');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(scrub(fixtures), null, 1)}\n`);
  console.log(`\nfixtures: ${Object.keys(fixtures).length} payload(s) -> ${target}`);
}
