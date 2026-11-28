import { describe, expect, it, beforeEach } from 'vitest';
import * as ts from '../src/logic/checkoutKey';
import { oracle } from './helpers/oracles';

interface LegacyCheckout {
  KEY: string;
  FP: string;
  FP_TS: string;
  sha256: (s: string) => string;
  stable: (v: unknown) => string;
  material: (p: unknown) => unknown;
  fingerprint: (p: unknown) => string;
  ensureKey: (p: unknown) => string;
  clearKey: () => void;
  newKey: () => string;
}

const loadLegacy = (): LegacyCheckout => oracle<LegacyCheckout>('checkout-key', 'EWCheckout');

const PAYLOADS = [
  {
    items: [
      { menuItem: 'm1', name: 'Paneer Pizza', price: 299, quantity: 1, customizations: { size: 'Medium' } },
      { menuItem: 'm2', name: 'Coke', price: 60, quantity: 2, customizations: {} },
    ],
    restaurantId: 12,
    addressId: 'addr_1',
    deliveryAddress: { line1: '12 MG Road', city: 'Pune', pincode: '411001', lat: 18.5, lng: 73.8, label: 'Home' },
    paymentMethod: 'UPI',
    tipAmount: 20,
    couponCode: 'save10',
    restaurantNote: 'Less spicy',
    deliveryInstructions: 'Ring the bell',
  },
  { items: [], restaurantId: null, paymentMethod: 'cod' },
  { items: [{ menuItem: 'm2', name: 'Coke', price: 60, quantity: 2, customizations: {} }, { menuItem: 'm1', name: 'Paneer Pizza', price: 299, quantity: 1, customizations: { size: 'Medium' } }], restaurantId: 12, paymentMethod: 'upi' },
];

describe('checkout key parity with checkout-key.js', () => {
  let legacy: LegacyCheckout;
  beforeEach(() => {
    legacy = loadLegacy();
  });

  it.each(['', 'abc', '₹149', '{"a":1}', '😀 unicode'])('sha256(%s)', (value) => {
    expect(ts.sha256(value)).toBe(legacy.sha256(value));
  });

  it.each([{}, { b: 1, a: 2 }, [3, 1, 2], { z: [1, { y: 2, x: 3 }] }, null])('stable(%#)', (value) => {
    expect(ts.stable(value)).toBe(legacy.stable(value));
  });

  it.each(PAYLOADS)('material(%#)', (payload) => {
    expect(ts.material(payload as never)).toEqual(legacy.material(payload));
    expect(ts.fingerprint(payload as never)).toBe(legacy.fingerprint(payload));
  });

  it('reuses the key only for an unchanged payload', () => {
    localStorage.clear();
    legacy.clearKey();
    ts.ensureKey(PAYLOADS[0] as never);
    legacy.ensureKey(PAYLOADS[0]);
    expect(localStorage.getItem(ts.KEY)).toBe(localStorage.getItem(legacy.KEY));
    expect(localStorage.getItem(ts.FP)).toBe(localStorage.getItem(legacy.FP));

    localStorage.clear();
    ts.clearKey();
    legacy.clearKey();
    const a = ts.ensureKey(PAYLOADS[0] as never);
    const b = ts.ensureKey({ ...(PAYLOADS[0] as object), tipAmount: 50 } as never);
    expect(b).not.toBe(a);

    localStorage.clear();
    const c = legacy.ensureKey(PAYLOADS[0]);
    const d = legacy.ensureKey({ ...(PAYLOADS[0] as object), tipAmount: 50 });
    expect(d).not.toBe(c);

    // Same payload, same key across both implementations.
    localStorage.clear();
    ts.clearKey();
    const tsKey = ts.ensureKey(PAYLOADS[1] as never);
    const legacyKey = legacy.ensureKey(PAYLOADS[1]);
    expect(tsKey).toBe(legacyKey);
  });

  it('clearKey removes all three entries', () => {
    ts.ensureKey(PAYLOADS[0] as never);
    ts.clearKey();
    expect(localStorage.getItem(ts.KEY)).toBeNull();
    expect(localStorage.getItem(ts.FP)).toBeNull();
    expect(localStorage.getItem(ts.FP_TS)).toBeNull();
  });
});
