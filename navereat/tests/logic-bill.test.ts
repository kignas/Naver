import { describe, expect, it } from 'vitest';
import * as ts from '../src/logic/bill';
import { oracle } from './helpers/oracles';

interface LegacyBill {
  rowsFromQuote: (q: unknown) => unknown;
  rowsFromStoredBill: (o: unknown) => unknown;
  decision: (q: unknown) => unknown;
  diffBills: (a: unknown, b: unknown) => unknown;
}

const legacy = oracle<LegacyBill>('ew-bill');

const QUOTES = [
  {
    bill: {
      customerFoodSubtotal: 450,
      foodPayable: 450,
      deliveryFee: 29,
      deliverySubsidy: 0,
      smallOrderFee: 0,
      codFee: 0,
      taxAmount: 22.5,
      tipAmount: 0,
      total: 501.5,
      grandTotal: 501.5,
      discount: 0,
      couponDiscount: 0,
      autoDiscount: 0,
    },
    distance: { restaurantToCustomerKm: 4.2 },
    contribution: { promotionFundingSource: 'none' },
  },
  {
    bill: {
      customerFoodSubtotal: 600,
      foodPayable: 520,
      deliveryFee: 0,
      deliverySubsidy: 35,
      smallOrderFee: 0,
      codFee: 15,
      taxAmount: 26,
      tipAmount: 20,
      total: 561,
      grandTotal: 581,
      discount: 80,
      couponDiscount: 80,
      autoDiscount: 0,
    },
    contribution: { promotionFundingSource: 'platform_promo' },
    distance: { restaurantToCustomerKm: 0 },
  },
  {
    bill: {
      customerFoodSubtotal: 149,
      foodPayable: 149,
      deliveryFee: 50,
      deliverySubsidy: 0,
      smallOrderFee: 20,
      codFee: 0,
      taxAmount: 7.45,
      tipAmount: 0,
      total: 226.45,
      grandTotal: 226.45,
      discount: 0,
      couponDiscount: 0,
      autoDiscount: 0,
    },
  },
  { bill: {} },
  {},
  null,
];

const STORED = [
  {
    bill: {
      customerFoodSubtotal: 450,
      itemSubtotal: 450,
      packagingCharge: 15,
      deliveryFee: 29,
      isFreeDeliveryApplied: false,
      platformHandlingFee: 5,
      smallCartFee: 0,
      rainSurgeFee: 10,
      codFee: 0,
      discountAmount: 50,
      taxAmount: 22.5,
      tipAmount: 0,
      grandTotal: 481.5,
    },
  },
  {
    bill: {
      customerFoodSubtotal: 600,
      packagingCharge: 20,
      deliveryFee: 35,
      isFreeDeliveryApplied: true,
      deliverySubsidy: 35,
      platformHandlingFee: 5,
      grandTotal: 645,
    },
  },
  { subtotal: 300, deliveryFee: 29, discount: 20, total: 309 },
  { bill: {} },
  null,
];

describe('bill parity with ew-bill.js', () => {
  it.each(QUOTES)('rowsFromQuote(%#)', (quote) => {
    expect(ts.rowsFromQuote(quote as never)).toEqual(legacy.rowsFromQuote(quote));
  });

  it.each(STORED)('rowsFromStoredBill(%#)', (order) => {
    expect(ts.rowsFromStoredBill(order as never)).toEqual(legacy.rowsFromStoredBill(order));
  });

  it.each([
    { decision: 'PROFITABLE' },
    { decision: 'REPRICING_REQUIRED' },
    { decision: 'NOT_ECONOMICALLY_SERVICEABLE', message: 'Too far' },
    { decision: 'NOT_ECONOMICALLY_SERVICEABLE', selfDeliveryAvailable: true },
    {},
    null,
  ])('decision(%#)', (quote) => {
    expect(ts.decision(quote as never)).toEqual(legacy.decision(quote));
  });

  it.each([
    [QUOTES[0], QUOTES[1]],
    [QUOTES[1], QUOTES[2]],
    [QUOTES[0], QUOTES[0]],
    [null, QUOTES[0]],
  ])('diffBills(%#)', (a, b) => {
    expect(ts.diffBills(a as never, b as never)).toEqual(legacy.diffBills(a, b));
  });
});
