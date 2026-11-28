import { describe, expect, it } from 'vitest';
import * as ts from '../src/logic/orderPayload';
import { oracle } from './helpers/oracles';

interface LegacyOrderPayload {
  build: (cart: unknown, opts: unknown) => unknown;
  buildItems: (cart: unknown) => unknown;
  previewSubtotal: (items: unknown) => number;
  restaurantIdFrom: (cart: unknown) => unknown;
  restaurantNameFrom: (cart: unknown) => string;
}

const loadLegacy = (): LegacyOrderPayload => oracle<LegacyOrderPayload>('order-payload', 'EWOrderPayload');

const CART = {
  'Paneer Pizza (Medium)': {
    menuItem: 'm1',
    price: 349,
    quantity: 2,
    resId: 12,
    resName: 'Pizza Hub',
    customizations: [{ title: 'Size', label: 'Medium', extraPrice: 50 }],
  },
  'Coke': { menuItem: 'm2', price: 60, quantity: 1, resId: 12 },
  'Legacy line': { price: 100, quantity: 1, resId: 'undefined' },
};

const OPTS = [
  { paymentMethod: 'upi' },
  { paymentMethod: 'COD', tipAmount: 20, couponCode: 'SAVE10', deliveryFee: 29 },
  { paymentMethod: 'upi', restaurantNote: 'Less spicy', deliveryInstructions: 'Ring bell', restaurantNotes: { 12: 'note' } },
  { paymentMethod: 'upi', items: [{ menuItem: 'm1', name: 'X', price: 100, quantity: 3, customizations: {} }], subtotal: 300, quoteId: 'q_1' },
  {},
];

describe('order payload parity with order-payload.js', () => {
  it('buildItems', () => {
    expect(ts.buildItems(CART as never)).toEqual(loadLegacy().buildItems(CART));
  });

  it('previewSubtotal', () => {
    const legacy = loadLegacy();
    const items = legacy.buildItems(CART) as never;
    expect(ts.previewSubtotal(items)).toBe(legacy.previewSubtotal(items));
  });

  it('restaurant id/name readers', () => {
    const legacy = loadLegacy();
    expect(ts.restaurantIdFrom(CART as never)).toBe(legacy.restaurantIdFrom(CART));
    expect(ts.restaurantNameFrom(CART as never)).toBe(legacy.restaurantNameFrom(CART));
  });

  it.each(OPTS)('build(%#)', (opts) => {
    expect(ts.build(CART as never, opts as never)).toEqual(loadLegacy().build(CART, opts));
  });
});
