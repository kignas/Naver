import { describe, expect, it } from 'vitest';
import * as ts from '../src/logic/quote';
import { oracle } from './helpers/oracles';

interface LegacyQuote {
  buildPayload: (o: unknown) => unknown;
  quoteTotal: (q: unknown) => number | null;
  secondsRemaining: (q: unknown, now?: number) => number | null;
  isExpired: (q: unknown, now?: number) => boolean;
  isQuoteCode: (c: unknown) => boolean;
}

interface LegacyPricing {
  normalise: (status: number, body: unknown) => unknown;
}

const legacy = oracle<LegacyQuote>('ew-quote');
const legacyPricing = oracle<LegacyPricing>('ew-pricing');

const PAYLOAD_CASES: unknown[] = [
  { restaurantId: 12, items: [{ menuItem: 'a', quantity: 2 }] },
  { restaurantId: '12', addressId: 'addr_1', items: [{ id: 'a', quantity: 1 }], paymentMethod: 'COD' },
  { restaurantId: 12, items: [{ menuItem: 'a', quantity: 0 }, { menuItem: 'b', quantity: 3 }], paymentMethod: 'upi', tipAmount: 20 },
  { restaurantId: 12, items: [{ menuItem: 'a', quantity: 1 }], couponCode: 'SAVE10', tipAmount: 0 },
  { restaurantId: 12, items: [{ menuItem: 'a', quantity: 1 }], tipAmount: -5 },
  { restaurantId: 12, items: [] },
  { items: [{ menuItem: 'a', quantity: 1 }] },
  {},
  null,
];

describe('quote payload parity with ew-quote.js', () => {
  it.each(PAYLOAD_CASES)('buildPayload(%#)', (input) => {
    expect(ts.buildPayload(input as never)).toEqual(legacy.buildPayload(input));
  });

  it.each([
    [{ bill: { grandTotal: 501.5 } }],
    [{ bill: { total: 300 } }],
    [{ bill: { grandTotal: null, total: 99 } }],
    [{ bill: {} }],
    [null],
  ])('quoteTotal(%#)', (quote) => {
    expect(ts.quoteTotal(quote as never)).toBe(legacy.quoteTotal(quote));
  });

  const now = Date.parse('2026-11-28T10:00:00.000Z');
  it.each([
    [{ quoteExpiresAt: '2026-11-28T10:10:00.000Z' }, now],
    [{ quoteExpiresAt: '2026-11-28T09:59:00.000Z' }, now],
    [{ quoteExpiresAt: 'not-a-date' }, now],
    [{}, now],
  ])('secondsRemaining(%#)', (quote, at) => {
    expect(ts.secondsRemaining(quote as never, at as number)).toBe(legacy.secondsRemaining(quote, at as number));
    expect(ts.isExpired(quote as never, at as number)).toBe(legacy.isExpired(quote, at as number));
  });

  it.each(['QUOTE_EXPIRED', 'QUOTE_PRICE_CHANGED', 'QUOTE_MISMATCH', 'OTHER', '', null])('isQuoteCode(%s)', (code) => {
    expect(ts.isQuoteCode(code)).toBe(legacy.isQuoteCode(code));
  });

  it.each([
    [200, { success: true, data: { bill: { grandTotal: 100 } } }],
    [200, { success: true, data: [] }],
    [409, { success: false, code: 'NOT_ECONOMICALLY_SERVICEABLE', message: 'nope', data: { decision: 'X' } }],
    [500, null],
  ])('normaliseResult(%#)', (status, body) => {
    expect(ts.normaliseResult(status as number, body as never)).toEqual(legacyPricing.normalise(status as number, body));
  });
});
