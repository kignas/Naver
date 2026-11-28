import { describe, expect, it } from 'vitest';
import { ctaBlockedToast, resolveCta, type CtaInput } from '../src/logic/checkoutCta';

/**
 * Expectations transcribed from `cart-page.js` `updateCheckoutCta()`
 * (1179-1258) and `startPayment()` (1885-1935). That function is page scope,
 * not a UMD module, so it cannot be loaded as an oracle the way the `js/*.js`
 * helpers are; each case quotes the legacy branch it pins.
 */

const base: CtaInput = {
  units: 2,
  unavailable: false,
  quoteBlock: null,
  loggedIn: true,
  multiBelowMin: [],
  usesAuthoritativeQuote: true,
  minOrder: 0,
  subtotal: 98,
  addressOk: true,
  ctaMain: 'Proceed to Pay',
};

describe('updateCheckoutCta parity', () => {
  it('unavailable: "Delivery unavailable" / "Change your address to continue"', () => {
    expect(resolveCta({ ...base, unavailable: true })).toEqual({
      locked: true,
      label: 'Delivery unavailable',
      sub: 'Change your address to continue',
      arrow: false,
    });
  });

  it('coupon block: "Coupon not applied" / "See the message in your bill"', () => {
    expect(resolveCta({ ...base, quoteBlock: 'coupon' })).toMatchObject({
      locked: true,
      label: 'Coupon not applied',
      sub: 'See the message in your bill',
    });
  });

  it('quote error: "Price unavailable" / "Tap Try again in your bill"', () => {
    expect(resolveCta({ ...base, quoteBlock: 'error' })).toMatchObject({
      locked: true,
      label: 'Price unavailable',
      sub: 'Tap Try again in your bill',
    });
  });

  it('serviceability block: "Delivery unavailable" / "See the message in your bill"', () => {
    expect(resolveCta({ ...base, quoteBlock: 'service' })).toMatchObject({
      locked: true,
      label: 'Delivery unavailable',
      sub: 'See the message in your bill',
    });
  });

  it('logged out: "Log in to order" with the item count, unlocked', () => {
    expect(resolveCta({ ...base, loggedIn: false })).toEqual({
      locked: false,
      label: 'Log in to order',
      sub: '2 items',
      arrow: false,
    });
  });

  it('singular item count', () => {
    expect(resolveCta({ ...base, units: 1, loggedIn: false }).sub).toBe('1 item');
  });

  it('below a restaurant minimum: adds the rounded-up gap and names the restaurant', () => {
    expect(resolveCta({ ...base, multiBelowMin: [{ name: 'Foodie Dosa', minOrder: 199, subtotal: 98.4 }] })).toEqual({
      locked: true,
      label: 'Add ₹101 more',
      sub: 'Foodie Dosa · min ₹199',
      arrow: false,
    });
  });

  it('the restaurant minimum wins over the generic one', () => {
    const view = resolveCta({
      ...base,
      multiBelowMin: [{ name: 'A', minOrder: 199, subtotal: 10 }],
      usesAuthoritativeQuote: false,
      minOrder: 300,
    });
    expect(view.sub).toBe('A · min ₹199');
  });

  it('legacy minimum order gate applies only without an authoritative quote', () => {
    expect(
      resolveCta({ ...base, usesAuthoritativeQuote: false, minOrder: 149, subtotal: 98 }).sub,
    ).toBe('Minimum order ₹149');
    expect(resolveCta({ ...base, usesAuthoritativeQuote: true, minOrder: 149, subtotal: 98 }).label).toBe(
      'Proceed to Pay',
    );
  });

  it('missing address: "Add address" / "Needed before you can order"', () => {
    expect(resolveCta({ ...base, addressOk: false })).toEqual({
      locked: true,
      label: 'Add address',
      sub: 'Needed before you can order',
      arrow: false,
    });
  });

  it('clears every gate: CtX label, item count and the arrow', () => {
    expect(resolveCta(base)).toEqual({ locked: false, label: 'Proceed to Pay', sub: '2 items', arrow: true });
  });

  it('COD-only carts keep the CtX label', () => {
    expect(resolveCta({ ...base, ctaMain: 'Place Order (COD)' }).label).toBe('Place Order (COD)');
  });

  it('Indian digit grouping for large minima', () => {
    expect(
      resolveCta({ ...base, multiBelowMin: [{ name: 'A', minOrder: 125000, subtotal: 999 }] }).sub,
    ).toBe('A · min ₹1,25,000');
  });
});

describe('startPayment toasts', () => {
  it('outside the radius', () => {
    expect(ctaBlockedToast({ ...base, unavailable: true })).toBe(
      'This restaurant does not deliver to your address',
    );
  });

  it('below the restaurant minimum', () => {
    expect(ctaBlockedToast({ ...base, multiBelowMin: [{ name: 'Foodie Dosa', minOrder: 199, subtotal: 98 }] })).toBe(
      'Foodie Dosa: add ₹101 to continue.',
    );
  });

  it('below the legacy minimum', () => {
    expect(ctaBlockedToast({ ...base, usesAuthoritativeQuote: false, minOrder: 149, subtotal: 98 })).toBe(
      'Add ₹51 more to reach the minimum order.',
    );
  });

  it('no toast when the CTA is free to proceed', () => {
    expect(ctaBlockedToast(base)).toBeNull();
  });
});
