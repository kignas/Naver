import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuoteController, type QuoteResult } from '../src/logic/pricingController';
import { computeQuote, type PricingPolicy } from '../src/logic/pricingEngine';
import { buildPayload } from '../src/logic/quote';

const POLICY: PricingPolicy = {
  deliveryFeeBands: [
    { maxKm: 3, fee: 13 },
    { maxKm: 5, fee: 29 },
    { maxKm: 7, fee: 35 },
  ],
  distanceFeePerKm: null,
  minimumOrderByDistance: [
    { maxKm: 3, min: 99 },
    { maxKm: 5, min: 149 },
  ],
  freeDeliveryThresholdByDistance: [
    { maxKm: 3, threshold: 349 },
    { maxKm: 5, threshold: 399 },
  ],
  smallOrderFeeEnabled: false,
  smallOrderFee: 20,
  taxPercent: 5,
  packagingPerItem: 0,
  platformFee: 0,
  codFee: 15,
  codMaxOrderAmount: 2000,
  firstOrderFreeDelivery: false,
  rainSurgeFee: 0,
};

const basket = (price: number, quantity = 1) => [
  { menuItem: 'm1', name: 'Dish', price, quantity },
];

const quoteFor = (price: number, extra: Record<string, unknown> = {}) =>
  computeQuote(POLICY, {
    restaurantId: '12',
    distanceKm: 4,
    items: basket(price),
    paymentMethod: 'upi',
    now: 1_700_000_000_000,
    ...extra,
  });

describe('QuoteController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid requests and only delivers the newest', async () => {
    const seen: number[] = [];
    const controller = new QuoteController<ReturnType<typeof quoteFor>>({
      debounceMs: 300,
      fetch: async (body) => {
        const price = Number(body.items[0].quantity) * 100;
        return { ok: true, status: 200, quote: quoteFor(price) } as QuoteResult<ReturnType<typeof quoteFor>>;
      },
      onQuote: (quote) => seen.push(Number(quote.bill.customerFoodSubtotal)),
    });

    const first = controller.request(buildPayload({ restaurantId: '12', items: [{ menuItem: 'm1', quantity: 1 }] })!);
    const second = controller.request(buildPayload({ restaurantId: '12', items: [{ menuItem: 'm1', quantity: 3 }] })!);
    await vi.advanceTimersByTimeAsync(299);
    expect(seen).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);

    const firstResult = await first;
    const secondResult = await second;
    expect(firstResult.stale).toBe(true);
    expect(secondResult.ok).toBe(true);
    expect(seen).toEqual([300]);
    expect(controller.total()).toBe(300 + 29 + 15);
  });

  it('requires confirmation when the total changes, and resets on demand', async () => {
    let price = 400;
    const controller = new QuoteController<ReturnType<typeof quoteFor>>({
      debounceMs: 0,
      fetch: async () => ({ ok: true, status: 200, quote: quoteFor(price) }) as QuoteResult<ReturnType<typeof quoteFor>>,
    });

    await controller.requestNow(buildPayload({ restaurantId: '12', items: [{ menuItem: 'm1', quantity: 1 }] })!);
    expect(controller.needsConfirmation()).toBe(false);

    price = 500;
    await controller.requestNow(buildPayload({ restaurantId: '12', items: [{ menuItem: 'm1', quantity: 1 }] })!);
    expect(controller.needsConfirmation()).toBe(true);

    controller.confirm();
    expect(controller.needsConfirmation()).toBe(false);
    expect(controller.confirmedTotalValue()).toBe(500 + 25);

    controller.resetBaseline();
    expect(controller.confirmedTotalValue()).toBeNull();
  });

  it('drops the quote when the basket becomes unserviceable', async () => {
    const controller = new QuoteController<ReturnType<typeof quoteFor>>({
      debounceMs: 0,
      fetch: async () => ({
        ok: false,
        status: 409,
        quote: null,
        code: 'NOT_ECONOMICALLY_SERVICEABLE',
        message: 'Too far',
      }) as QuoteResult<ReturnType<typeof quoteFor>>,
    });
    const result = await controller.requestNow(buildPayload({ restaurantId: '12', items: [{ menuItem: 'm1', quantity: 1 }] })!);
    expect(result.ok).toBe(false);
    expect(controller.quote()).toBeNull();
    expect(controller.quoteId()).toBe('');
  });

  it('re-quotes once when the backend answers with an expired quote', async () => {
    let calls = 0;
    const controller = new QuoteController<ReturnType<typeof quoteFor>>({
      debounceMs: 0,
      fetch: async () => {
        calls += 1;
        if (calls === 1) return { ok: false, status: 409, quote: null, code: 'QUOTE_EXPIRED' } as QuoteResult<ReturnType<typeof quoteFor>>;
        return { ok: true, status: 200, quote: quoteFor(400) } as QuoteResult<ReturnType<typeof quoteFor>>;
      },
    });
    await controller.requestNow(buildPayload({ restaurantId: '12', items: [{ menuItem: 'm1', quantity: 1 }] })!);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(2);
    expect(controller.total()).toBe(400 + 20);
  });

  it('re-quotes automatically a second after expiry', async () => {
    let calls = 0;
    const now = Date.now();
    const controller = new QuoteController<ReturnType<typeof quoteFor>>({
      debounceMs: 0,
      fetch: async () => {
        calls += 1;
        return { ok: true, status: 200, quote: quoteFor(400, { now: now + calls * 1000 }) } as QuoteResult<ReturnType<typeof quoteFor>>;
      },
    });
    await controller.requestNow(buildPayload({ restaurantId: '12', items: [{ menuItem: 'm1', quantity: 1 }] })!);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(11 * 60 * 1000);
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});

describe('pricing engine', () => {
  it('prices a small basket below the free-delivery threshold', () => {
    const quote = quoteFor(250);
    expect(quote.bill.customerFoodSubtotal).toBe(250);
    expect(quote.bill.deliveryFee).toBe(29);
    expect(quote.freeDelivery.amountRemaining).toBe(149);
    expect(quote.freeDelivery.unlocked).toBe(false);
    expect(quote.bill.taxAmount).toBe(12.5);
    expect(quote.bill.grandTotal).toBe(291.5);
  });

  it('unlocks free delivery at the zone threshold', () => {
    const quote = quoteFor(399);
    expect(quote.freeDelivery.unlocked).toBe(true);
    expect(quote.bill.deliverySubsidy).toBe(29);
    expect(quote.bill.deliveryFee).toBe(0);
  });

  it('funds a coupon from the delivery budget and rejects one it cannot fund', () => {
    const funded = quoteFor(400, { couponCode: 'SAVE20', couponValue: 20 });
    expect(funded.bill.couponDiscount).toBe(20);
    expect(funded.couponApplied).toBe(true);

    const rejected = quoteFor(250, { couponCode: 'SAVE200', couponValue: 200 });
    expect(rejected.bill.couponDiscount).toBe(0);
    expect(rejected.couponRejectedCode).toBe('COUPON_NOT_ECONOMICALLY_SERVICEABLE');
  });

  it('marks a basket below the zone minimum as unserviceable', () => {
    const quote = quoteFor(80);
    expect(quote.serviceable).toBe(false);
    expect(quote.decision).toBe('NOT_ECONOMICALLY_SERVICEABLE');
  });

  it('adds the COD fee only for COD', () => {
    expect(quoteFor(400, { paymentMethod: 'cod' }).bill.codFee).toBe(15);
    expect(quoteFor(400, { paymentMethod: 'upi' }).bill.codFee).toBe(0);
  });

  it('includes the tip in grandTotal only', () => {
    const quote = quoteFor(400, { tipAmount: 20 });
    expect(quote.bill.tipAmount).toBe(20);
    expect(quote.bill.grandTotal).toBe(quote.bill.total + 20);
  });
});
