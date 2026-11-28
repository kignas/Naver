import { describe, expect, it } from 'vitest';
import { demoApi } from '../src/api/demoApi';
import { ZONE_POLICY } from '../src/api/pricingPolicies';
import { billFromQuote, cartSubtotal, type Cart } from '../src/lib/cart';
import { rowsFromQuote } from '../src/logic/bill';
import { computeQuote } from '../src/logic/pricingEngine';
import { oracle } from './helpers/oracles';

const legacy = oracle<{ rowsFromQuote: (q: unknown) => unknown }>('ew-bill');

const cart = (price: number, qty: number, resId = 1, menuItem = 'fd1'): Cart => ({
  Dosa: { quantity: qty, price, resId, menuItem, name: 'Dosa' },
});

const quoteFor = (price: number, qty: number, km: number, couponCode: string | null = null, couponValue = 0) =>
  computeQuote(ZONE_POLICY, {
    restaurantId: '1',
    distanceKm: km,
    items: [{ menuItem: 'fd1', name: 'Dosa', price, quantity: qty }],
    paymentMethod: 'upi',
    couponCode,
    couponValue,
    couponMinSubtotal: 0,
    rainSurge: false,
  });

describe('cart bill comes from the engine quote', () => {
  it('charges the zone delivery fee and 5% GST', () => {
    const quote = quoteFor(100, 2, 4.2);
    const bill = billFromQuote(cart(100, 2), quote, ZONE_POLICY);
    expect(bill.subtotal).toBe(200);
    expect(bill.deliveryFee).toBe(29);
    expect(bill.tax).toBe(10);
    expect(bill.total).toBe(239);
    expect(bill.grandTotal).toBe(239);
    expect(bill.packagingFee).toBe(0);
    expect(bill.platformFee).toBe(0);
  });

  it('raises the fee band with the distance', () => {
    expect(billFromQuote(cart(200, 1), quoteFor(200, 1, 2.5), ZONE_POLICY).deliveryFee).toBe(13);
    expect(billFromQuote(cart(200, 1), quoteFor(200, 1, 6.5), ZONE_POLICY).deliveryFee).toBe(50);
    expect(billFromQuote(cart(200, 1), quoteFor(200, 1, 9.5), ZONE_POLICY).deliveryFee).toBe(65);
  });

  it('subsidises delivery above the zone threshold', () => {
    const quote = quoteFor(400, 1, 2.5);
    const bill = billFromQuote(cart(400, 1), quote, ZONE_POLICY);
    expect(bill.deliveryFee).toBe(0);
    expect(bill.baseDeliveryFee).toBe(13);
    expect(bill.freeDelivery).toBe(true);
  });

  it('keeps totals consistent with the coupon', () => {
    const quote = quoteFor(300, 1, 4.2, 'WELCOME50', 50);
    const bill = billFromQuote(cart(300, 1), quote, ZONE_POLICY);
    expect(bill.discount).toBe(50);
    expect(bill.tax).toBe(12.5);
    expect(bill.total).toBe(300 - 50 + 29 + 12.5);
  });

  it('renders the same rows as the legacy bill mapper for the same quote', () => {
    const quote = quoteFor(150, 2, 4.2);
    expect(rowsFromQuote(quote)).toEqual(legacy.rowsFromQuote(quote));
    const keys = rowsFromQuote(quote).map((row) => row.key);
    expect(keys).toContain('deliveryFee');
    expect(keys).toContain('taxes');
    expect(keys).toContain('total');
  });
});

describe('demo previewBill uses the shared engine', () => {
  it('is not zero-fee', () => {
    const bill = demoApi.previewBill(cart(150, 2));
    expect(cartSubtotal(cart(150, 2))).toBe(300);
    expect(bill.deliveryFee).toBeGreaterThan(0);
    expect(bill.tax).toBeGreaterThan(0);
    expect(bill.total).toBe(bill.subtotal + bill.deliveryFee + bill.tax);
  });

  it('prices the tip into the bill exactly as the quote payload does', () => {
    const plain = demoApi.previewBill(cart(150, 2));
    const tipped = demoApi.previewBill(cart(150, 2), null, { tip: 20 });
    expect(tipped.tip).toBe(20);
    expect(tipped.grandTotal).toBe(plain.grandTotal + 20);
    expect(tipped.rows.map((row) => row.key)).toContain('tip');
    expect(tipped.rows[tipped.rows.length - 1].key).toBe('total');
  });

  it('adds the COD handling fee when cash on delivery is selected', () => {
    const cod = demoApi.previewBill(cart(150, 2), null, { paymentMethod: 'cod' });
    const upi = demoApi.previewBill(cart(150, 2));
    expect(cod.codFee).toBe(ZONE_POLICY.codFee);
    expect(cod.total).toBe(upi.total + ZONE_POLICY.codFee);
    expect(cod.rows.map((row) => row.key)).toContain('codFee');
  });

  it('renders the quote rows through the legacy mapper', () => {
    const quote = quoteFor(150, 2, 4.2);
    const bill = billFromQuote(cart(150, 2), quote, ZONE_POLICY, 15);
    expect(bill.rows).toEqual(legacy.rowsFromQuote(quote));
    expect(bill.rows.filter((row) => row.key !== 'total').map((row) => row.label)).toEqual(
      legacy
        .rowsFromQuote(quote)
        .filter((row) => row.key !== 'total')
        .map((row) => row.label),
    );
  });

  it('agrees with an explicit quote for the same inputs', () => {
    const preview = demoApi.previewBill(cart(150, 2));
    const quote = quoteFor(150, 2, 4);
    const direct = billFromQuote(cart(150, 2), quote, ZONE_POLICY);
    expect(preview.total).toBe(direct.total);
    expect(preview.tax).toBe(direct.tax);
  });
});
