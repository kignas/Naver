import { describe, expect, it } from 'vitest';
import * as ts from '../src/logic/coupon';
import { oracle } from './helpers/oracles';

interface LegacyCoupon {
  FALLBACK_MESSAGES: Record<string, string>;
  messageFor: (code: unknown, message?: unknown) => string;
  buildOffer: (body: unknown) => unknown;
  interpret: (status: number, body: unknown) => unknown;
  paymentLabel: (methods: unknown) => string;
  paymentOnlyPhrase: (methods: unknown) => string;
  normalizeCode: (c: unknown) => string;
}

const legacy = oracle<LegacyCoupon>('ew-coupon');

const BODIES: unknown[] = [
  { success: true, data: { code: 'save10', discount: 50, type: 'percent' }, offer: { code: 'SAVE10', title: '10% off', description: 'On ₹299+', type: 'percent', value: 10, discount: 50, maxDiscount: 100, minSubtotal: 299, paymentMethods: ['upi'], expiresAt: '2027-01-01T00:00:00.000Z', showPopup: true } },
  { success: true, data: { code: 'FLAT50', discount: 50, type: 'fixed' } },
  { success: true, data: {} },
  { success: true, offer: { code: 'X', showPopup: false } },
  { success: false, code: 'COUPON_EXPIRED' },
  { success: false, code: 'COUPON_MIN_SUBTOTAL', message: 'Add ₹50 more' },
  null,
];

describe('coupon parity with ew-coupon.js', () => {
  it('normalizes coupon codes', () => {
    expect(ts.normalizeCode('save10')).toBe('SAVE10');
    expect(ts.normalizeCode(' SAVE10 ')).toBe('SAVE10');
    expect(ts.normalizeCode(null)).toBe('');
  });

  it.each(['COUPON_EXPIRED', 'COUPON_MIN_SUBTOTAL', 'UNKNOWN', ''])('messageFor(%s)', (code) => {
    expect(ts.messageFor(code)).toBe(legacy.messageFor(code));
  });

  it.each([
    ['COUPON_EXPIRED', 'Custom backend copy'],
    ['COUPON_EXPIRED', ''],
  ])('messageFor(%s, %s)', (code, message) => {
    expect(ts.messageFor(code, message)).toBe(legacy.messageFor(code, message));
  });

  it.each(BODIES)('buildOffer(%#)', (body) => {
    expect(ts.buildOffer(body as never)).toEqual(legacy.buildOffer(body));
  });

  it.each(BODIES)('interpret(%#)', (body) => {
    for (const status of [200, 400, 401, 409, 500]) {
      expect(ts.interpret(status, body as never)).toEqual(legacy.interpret(status, body));
    }
  });

  it.each([[['upi']], [['cod']], [['upi', 'cod']], [['wallet', 'upi']], [[]], [null]])('paymentLabel(%#)', (methods) => {
    expect(ts.paymentLabel(methods as never)).toBe(legacy.paymentLabel(methods));
  });

  it('paymentOnlyPhrase wording', () => {
    expect(ts.paymentOnlyPhrase(['cod'])).toBe('Cash on Delivery');
    expect(ts.paymentOnlyPhrase(['upi'])).toBe('UPI');
    expect(ts.paymentOnlyPhrase(['upi', 'cod'])).toBe('the selected payment method');
    expect(ts.paymentOnlyPhrase(null)).toBe('the selected payment method');
  });
});
