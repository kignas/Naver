/**
 * Demo implementation of `RestaurantApi`.
 *
 * Fixtures + simulated latency + scenario overrides. Money is never decided
 * here: the quote is `computeQuote` (the same engine the live endpoint will
 * replace) and the bill preview is `billFor` from the shared logic layer.
 */
import {
  DEMO_ADDRESS,
  demoOffersFor,
  demoOrders,
  demoUser,
  findRestaurant,
  coupons as demoCoupons,
  type Coupon,
  type DemoUser,
  type MenuItem,
  type Order,
  type Restaurant,
} from '../data/demo';
import { billFor, billFromQuote, cartRestaurantId, couponDiscount, type Bill, type Cart } from '../lib/cart';
import { computeQuote } from '../logic/pricingEngine';
import { paymentVerify } from '../logic/paymentVerify';
import type {
  Address,
  ApiFailure,
  CreateOrderInput,
  CreateOrderResult,
  PaymentIntent,
  PaymentVerifyResult,
  PlatformStatusLite,
  PreviewBillOptions,
  Quote,
  QuoteRequest,
  RestaurantApi,
} from './restaurantApi';
import { policyFor } from './pricingPolicies';
import { readScenarios, type DemoScenarios } from './scenarios';

const ADDRESS_KEY = 'nearbite_address';
const SELECTED_ADDRESS_KEY = 'nearbite_selected_address_id';
const ORDERS_KEY = 'nearbite_orders';
const PAYMENTS_KEY = 'navereat_payments';
const IDEMPOTENCY_KEY = 'navereat_orders_by_key';

const DEFAULT_ADDRESSES: Address[] = [
  {
    id: 'addr_home',
    tag: 'Home',
    house: '42 Demo Street',
    area: 'Demo City',
    landmark: 'Near the park',
    city: 'Demo City',
    pincode: '735101',
    receiverName: 'Demo Foodie',
    receiverPhone: '+91 98765 43210',
    latitude: 26.7271,
    longitude: 89.4344,
    isDefault: true,
  },
  {
    id: 'addr_work',
    tag: 'Work',
    house: '7 Sample Avenue',
    area: 'Demo City',
    landmark: 'Opposite the library',
    city: 'Demo City',
    pincode: '735102',
    receiverName: 'Demo Foodie',
    receiverPhone: '+91 98765 43210',
    latitude: 26.74,
    longitude: 89.45,
  },
];

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable */
  }
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const latency = (scenarios: DemoScenarios): Promise<void> => {
  if (scenarios.slow) return wait(1200 + Math.round(Math.random() * 600));
  return wait(200 + Math.round(Math.random() * 400));
};

const failure = (kind: ApiFailure['kind'], message: string, extra: Partial<ApiFailure> = {}): ApiFailure => ({
  kind,
  message,
  retryable: kind === 'network' || kind === 'timeout' || kind === 'http',
  ...extra,
});

const addressesNow = (scenarios: DemoScenarios): Address[] => {
  if (scenarios.address === 'missing') return [];
  const stored = read<Address[] | null>(ADDRESS_KEY, null);
  return stored ?? DEFAULT_ADDRESSES;
};

const selectedAddress = (scenarios: DemoScenarios): Address | null => {
  const list = addressesNow(scenarios);
  if (!list.length) return null;
  const id = (() => {
    try {
      return localStorage.getItem(SELECTED_ADDRESS_KEY);
    } catch {
      return null;
    }
  })();
  return list.find((address) => address.id === id) ?? list.find((address) => address.isDefault) ?? list[0];
};

const couponFor = (code: string): Coupon | undefined =>
  demoCoupons.find((entry) => entry.code === String(code || '').trim().toUpperCase());

const couponValueFor = (coupon: Coupon | undefined, subtotal: number): number =>
  coupon ? couponDiscount(coupon, subtotal) : 0;

const applyScenarioCoupon = (scenarios: DemoScenarios, coupon: Coupon | undefined): Coupon | undefined => {
  if (!coupon) return coupon;
  if (scenarios.coupon === 'invalid') return undefined;
  return coupon;
};

const distanceFor = (restaurant: Restaurant | undefined, fallback = 4): number =>
  Number(restaurant?.distanceKm ?? fallback) || fallback;

const restaurantOrThrow = (id: string | number | undefined): Restaurant => {
  const restaurant = findRestaurant(id);
  if (!restaurant) throw failure('http', 'Not found.', { status: 404, code: 'RESTAURANT_NOT_FOUND' });
  return restaurant;
};

const quoteFrom = (request: QuoteRequest, scenarios: DemoScenarios): Quote => {
  const restaurant = findRestaurant(request.restaurantId);
  const policy = policyFor(scenarios.zoneFees);
  const address = selectedAddress(scenarios);
  const distanceKm = request.distanceKm ?? distanceFor(restaurant);
  const subtotal = request.items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const coupon = applyScenarioCoupon(scenarios, couponFor(String(request.couponCode || '')));
  const quote = computeQuote(policy, {
    restaurantId: String(request.restaurantId),
    restaurantName: restaurant?.name,
    addressId: address?.id ?? null,
    distanceKm,
    items: request.items.map((item) => ({
      menuItem: item.menuItem,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
    paymentMethod: request.paymentMethod === 'cod' ? 'cod' : 'upi',
    couponCode: coupon ? coupon.code : request.couponCode || null,
    couponValue: request.couponValue ?? couponValueFor(coupon, subtotal),
    couponMinSubtotal: request.couponMinSubtotal ?? coupon?.minOrder ?? 0,
    tipAmount: request.tipAmount,
    isFirstOrder: request.isFirstOrder,
    rainSurge: false,
  });

  /* Free-delivery scenario: force the two reachable display states. */
  if (scenarios.freeDelivery === 'reached') {
    return {
      ...quote,
      freeDelivery: { ...quote.freeDelivery, unlocked: true, amountRemaining: 0, subsidised: true, effectiveDeliveryFee: 0, deliveryFee: 0 },
    };
  }
  if (scenarios.freeDelivery === 'not') {
    const fee = quote.freeDelivery.baseThreshold ? Math.max(1, quote.freeDelivery.deliveryFee || 29) : 0;
    return {
      ...quote,
      freeDelivery: {
        ...quote.freeDelivery,
        unlocked: false,
        subsidised: false,
        effectiveDeliveryFee: fee,
        amountRemaining: Math.max(1, quote.freeDelivery.threshold - quote.freeDelivery.eligibleSubtotal),
      },
    };
  }
  return quote;
};

const paymentStore = (): Record<string, PaymentIntent> => read<Record<string, PaymentIntent>>(PAYMENTS_KEY, {});
const savePayment = (intent: PaymentIntent): void => {
  const all = paymentStore();
  all[intent.paymentId] = intent;
  write(PAYMENTS_KEY, all);
};

const ordersNow = (): Order[] => read<Order[]>(ORDERS_KEY, demoOrders);

const orderFrom = (input: CreateOrderInput, paymentStatus: CreateOrderResult['paymentStatus'], scenarios: DemoScenarios): Order => {
  const payload = input.payload;
  const lines = payload.items.map((item) => ({
    name: item.name,
    qty: Number(item.quantity) || 1,
    price: Number(item.price) || 0,
  }));
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const restaurantId = Number(payload.restaurantId) || 1;
  const restaurantName = payload.restaurantName || findRestaurant(restaurantId)?.name || `Restaurant #${restaurantId}`;
  return {
    id: `NAV-${Math.floor(100000 + Math.random() * 900000)}`,
    restaurantId,
    restaurantName,
    lines,
    subtotal,
    platformFee: 0,
    discount: 0,
    total: subtotal + Number(payload.tipAmount || 0),
    status: 'confirmed',
    placedAt: new Date().toISOString(),
    eta: input.eta ?? '30–40 mins',
    paymentMethod: payload.paymentMethod === 'cod' ? 'Cash on Delivery' : 'UPI',
    address: input.address ? `${input.address.tag} · ${input.address.house}, ${input.address.city}` : DEMO_ADDRESS,
    paymentStatus,
    ...(scenarios.payment === 'pending' && payload.paymentMethod !== 'cod'
      ? { partialCodAdvanceAmount: undefined }
      : {}),
  } as Order;
};

export const demoApi: RestaurantApi = {
  mode: 'demo',

  restaurantSync: (id) => findRestaurant(id) ?? null,
  couponsSync: () => demoCoupons,
  offersSync: (subtotal) => demoOffersFor(subtotal),
  pricingPolicy: () => policyFor(readScenarios().zoneFees),

  async getRestaurant(id) {
    const scenarios = readScenarios();
    await latency(scenarios);
    if (scenarios.quoteError) throw failure('network', "Can't reach the server. Check your connection.");
    const restaurant = restaurantOrThrow(id);
    return scenarios.closed ? { ...restaurant, available: false } : restaurant;
  },

  async getMenu(id) {
    await latency(readScenarios());
    return restaurantOrThrow(id).menu;
  },

  async getCoupons() {
    await latency(readScenarios());
    return demoCoupons;
  },

  quoteSync(request) {
    return quoteFrom(request, readScenarios());
  },

  async getQuote(request) {
    const scenarios = readScenarios();
    await latency(scenarios);
    if (scenarios.quoteError) throw failure('network', "Can't reach the server. Check your connection.");
    return quoteFrom(request, scenarios);
  },

  async validateCoupon(input) {
    const scenarios = readScenarios();
    await latency(scenarios);
    const coupon = couponFor(input.code);
    if (scenarios.coupon === 'expired') {
      return { ok: false, code: 'COUPON_EXPIRED', message: 'This coupon has expired.' };
    }
    if (scenarios.coupon === 'invalid' || !coupon) {
      return { ok: false, code: 'COUPON_NOT_FOUND', message: 'Coupon is invalid or expired.' };
    }
    if (Number(input.subtotal) < coupon.minOrder) {
      return {
        ok: false,
        code: 'COUPON_MIN_SUBTOTAL',
        message: `Your order is below the minimum for this coupon.`,
        minOrder: coupon.minOrder,
      };
    }
    const value = couponDiscount(coupon, Number(input.subtotal));
    return {
      ok: true,
      code: coupon.code,
      discount: value,
      description: coupon.subtitle,
      minOrder: coupon.minOrder,
      offer: {
        code: coupon.code,
        title: coupon.title,
        description: coupon.subtitle,
        type: coupon.type === 'percent' ? 'percent' : 'fixed',
        value: coupon.value,
        discount: value,
        maxDiscount: coupon.maxDiscount ?? null,
        minSubtotal: coupon.minOrder,
        restaurantId: input.restaurantId ? String(input.restaurantId) : null,
        restaurantName: findRestaurant(input.restaurantId)?.name ?? '',
        image: null,
        paymentMethods: null,
        expiresAt: null,
        showPopup: true,
      },
    };
  },

  previewBill(cart: Cart, coupon?: Coupon | null, options: PreviewBillOptions = {}): Bill {
    const scenarios = readScenarios();
    const policy = policyFor(scenarios.zoneFees);
    const restaurant = findRestaurant(cartRestaurantId(cart) ?? undefined);
    const lines = Object.entries(cart).map(([name, line]) => ({
      menuItem: line.menuItem ?? name,
      name: line.name ?? name,
      price: line.price,
      quantity: line.quantity,
    }));
    if (lines.length === 0) return billFor(cart, coupon ?? null);
    const tip = Math.max(0, Math.min(1000, Math.round(Number(options.tip) || 0)));
    const subtotal = lines.reduce((sum, line) => sum + Number(line.price) * Number(line.quantity), 0);
    const applied = applyScenarioCoupon(scenarios, coupon ?? undefined) ?? null;
    const quote = computeQuote(policy, {
      restaurantId: String(restaurant?.id ?? cartRestaurantId(cart) ?? ''),
      restaurantName: restaurant?.name,
      addressId: selectedAddress(scenarios)?.id ?? null,
      distanceKm: distanceFor(restaurant),
      items: lines,
      paymentMethod: options.paymentMethod === 'cod' ? 'cod' : 'upi',
      couponCode: applied ? applied.code : null,
      couponValue: applied ? couponDiscount(applied, subtotal) : 0,
      couponMinSubtotal: applied?.minOrder ?? 0,
      isFirstOrder: false,
      rainSurge: false,
      tipAmount: tip,
    });
    return billFromQuote(cart, quote, policy, tip);
  },

  async createOrder(input) {
    const scenarios = readScenarios();
    await latency(scenarios);
    if (scenarios.quoteError) throw failure('network', "Can't reach the server. Check your connection.");

    const byKey = read<Record<string, string>>(IDEMPOTENCY_KEY, {});
    if (input.idempotencyKey && byKey[input.idempotencyKey]) {
      const existing = ordersNow().find((order) => order.id === byKey[input.idempotencyKey]);
      if (existing) {
        return {
          orderId: existing.id,
          total: existing.total,
          paymentStatus: ((existing as Order & { paymentStatus?: string }).paymentStatus as CreateOrderResult['paymentStatus']) ?? 'pending',
          paymentMethod: input.payload.paymentMethod,
          order: existing,
        };
      }
    }

    const cod = input.payload.paymentMethod === 'cod';
    const paymentStatus: CreateOrderResult['paymentStatus'] = cod
      ? 'cod_pending'
      : scenarios.payment === 'failure'
        ? 'failed'
        : scenarios.payment === 'pending'
          ? 'pending'
          : 'pending';
    const order = orderFrom(input, paymentStatus, scenarios);
    const orders = [order, ...ordersNow()];
    write(ORDERS_KEY, orders);
    if (input.idempotencyKey) write(IDEMPOTENCY_KEY, { ...byKey, [input.idempotencyKey]: order.id });
    return {
      orderId: order.id,
      total: order.total,
      paymentStatus,
      paymentMethod: input.payload.paymentMethod,
      order,
    };
  },

  async createPayment(input) {
    const scenarios = readScenarios();
    await latency(scenarios);
    const intent: PaymentIntent = {
      paymentId: `pay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      orderId: input.orderId,
      amount: input.amount,
      method: input.method,
      status: 'created',
    };
    savePayment(intent);
    return intent;
  },

  async getPaymentStatus(paymentId) {
    await latency(readScenarios());
    const intent = paymentStore()[paymentId];
    return { paymentId, status: intent?.status ?? 'pending' };
  },

  async verifyPayment(input) {
    const scenarios = readScenarios();
    const requested = input.outcome ?? scenarios.payment ?? 'success';
    const store = paymentStore();
    const intent = store[input.paymentId];
    const cod = intent?.method === 'cod';
    const terminal: PaymentIntent['status'] = cod
      ? 'pending'
      : requested === 'failure'
        ? 'failed'
        : requested === 'pending'
          ? 'pending'
          : 'paid';

    const settle = (status: PaymentIntent['status']) => {
      if (intent) {
        store[input.paymentId] = { ...intent, status };
        write(PAYMENTS_KEY, store);
      }
    };
    let polls = 0;
    const json = (status: number, body: unknown) =>
      ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      }) as unknown as Response;

    const demoFetch = (async (url: string) => {
      await latency(scenarios);
      if (String(url).endsWith('/payments/verify')) {
        if (requested === 'verifyFlaky') throw new TypeError('Failed to fetch');
        if (requested === 'verifySlow') return json(409, { success: false, code: 'CAPTURE_RACE', message: 'Capture in progress.' });
        if (requested === 'verifyTimeout') return json(202, { success: true, data: { paymentStatus: 'pending' } });
        if (terminal === 'failed') return json(200, { success: true, data: { paymentStatus: 'failed' } });
        if (terminal === 'pending') return json(200, { success: true, data: { paymentStatus: 'pending' } });
        settle('paid');
        return json(200, { success: true, data: { paymentStatus: 'paid' } });
      }
      polls += 1;
      if (requested === 'verifyTimeout') return json(200, { success: true, data: { paymentStatus: 'pending' } });
      if (requested === 'verifySlow' && polls < 3) return json(200, { success: true, data: { paymentStatus: 'pending' } });
      settle(terminal);
      return json(200, { success: true, data: { paymentStatus: terminal } });
    }) as unknown as typeof fetch;

    const run = await paymentVerify.run({
      orderId: input.orderId,
      verifyBody: { orderId: input.orderId, paymentId: input.paymentId, signature: input.signature ?? 'demo' },
      fetchImpl: demoFetch,
      // The window is 6 s in the demo so the pending screen is reachable
      // without waiting the production 22 s.
      maxMs: 6000,
    });

    const outcome: PaymentIntent['status'] =
      run.verdict === 'paid' ? 'paid' : run.verdict === 'failed' ? 'failed' : 'pending';
    settle(outcome);

    const orders = ordersNow();
    const index = orders.findIndex((order) => order.id === input.orderId);
    const order = index >= 0 ? orders[index] : null;
    const paymentStatus: PaymentVerifyResult['paymentStatus'] =
      outcome === 'paid' ? 'paid' : outcome === 'failed' ? 'failed' : cod ? 'cod_pending' : 'pending';
    if (order) {
      const next = { ...order, paymentStatus } as Order;
      orders[index] = next;
      write(ORDERS_KEY, orders);
      return {
        success: outcome !== 'failed',
        order: next,
        paymentStatus,
        source: run.source,
        ...(outcome === 'failed' ? { message: 'Your payment could not be completed.' } : {}),
      };
    }
    return {
      success: false,
      order: {
        id: input.orderId,
        restaurantId: 0,
        restaurantName: 'Order',
        lines: [],
        subtotal: 0,
        platformFee: 0,
        discount: 0,
        total: 0,
        status: 'confirmed',
        placedAt: new Date().toISOString(),
        eta: '',
        paymentMethod: 'UPI',
        address: DEMO_ADDRESS,
        paymentStatus,
      } as Order,
      paymentStatus,
      source: run.source,
    };
  },

  async getOrder(id) {
    await latency(readScenarios());
    return ordersNow().find((order) => order.id === id) ?? null;
  },

  async getProfile() {
    await latency(readScenarios());
    return demoUser;
  },

  async getAddresses() {
    await latency(readScenarios());
    return addressesNow(readScenarios());
  },

  async saveAddress(input) {
    const scenarios = readScenarios();
    await latency(scenarios);
    const list = addressesNow({ ...scenarios, address: null });
    const address: Address = { ...input, id: input.id ?? `addr_${Date.now().toString(36)}` };
    const index = list.findIndex((entry) => entry.id === address.id);
    if (index >= 0) list[index] = address;
    else list.push(address);
    write(ADDRESS_KEY, list);
    try {
      localStorage.setItem(SELECTED_ADDRESS_KEY, address.id);
    } catch {
      /* storage may be unavailable */
    }
    return address;
  },

  async deleteAddress(id) {
    await latency(readScenarios());
    const list = addressesNow({ ...readScenarios(), address: null }).filter((entry) => entry.id !== id);
    write(ADDRESS_KEY, list);
    try {
      if (localStorage.getItem(SELECTED_ADDRESS_KEY) === id) localStorage.removeItem(SELECTED_ADDRESS_KEY);
    } catch {
      /* storage may be unavailable */
    }
  },

  async getOrders() {
    await latency(readScenarios());
    return ordersNow();
  },

  async getPlatformStatus(): Promise<PlatformStatusLite> {
    await latency(readScenarios());
    const scenarios = readScenarios();
    const policy = policyFor(scenarios.zoneFees);
    const payment = {
      isCodEnabled: scenarios.cod !== 'off',
      isUpiEnabled: scenarios.upi !== 'off',
      isCodBlocked: scenarios.cod === 'blocked',
      maxCodOrderAmount: scenarios.cod === 'overcap' ? 1 : policy.codMaxOrderAmount,
      isUnderMaintenance: false,
      maintenanceMessage: '',
      isDeliveryPausedShortage: false,
    };
    if (scenarios.closed) {
      return {
        service: {
          state: 'closed_manual',
          canOrder: false,
          title: 'Restaurant closed',
          message: 'This restaurant is not accepting orders right now.',
        },
        ...payment,
      };
    }
    return {
      service: { state: 'open', canOrder: true, title: '', message: '' },
      ...payment,
    };
  },
};

export const demoScenarios = readScenarios;
export type { DemoUser, MenuItem };
