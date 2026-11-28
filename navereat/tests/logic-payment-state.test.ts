import { describe, expect, it } from 'vitest';
import * as ts from '../src/logic/paymentState';
import { oracle } from './helpers/oracles';

interface LegacyPayment {
  norm: (v: unknown) => string;
  money: (v: unknown) => string;
  numOrNull: (v: unknown) => number | null;
  partialCod: (o: unknown) => unknown;
  refundState: (o: unknown) => unknown;
  state: (o: unknown) => unknown;
  authoritativeTotal: (o: unknown) => number | null;
}

const loadLegacy = (): LegacyPayment => oracle<LegacyPayment>('payment-state', 'EWPayment');

const ORDERS: unknown[] = [
  { paymentStatus: 'paid', paymentMethod: 'upi', total: 500 },
  { paymentStatus: 'failed', paymentMethod: 'upi', total: 500 },
  { paymentStatus: 'pending', paymentMethod: 'upi', total: 500 },
  { paymentStatus: 'cod_pending', paymentMethod: 'cod', total: 500 },
  { paymentStatus: 'paid', paymentMethod: 'cod', total: 500 },
  { paymentMethod: 'cod', total: 500 },
  { paymentStatus: 'paid', paymentMethod: 'cod', partialCodAdvanceAmount: 100, partialCodCashDue: 400, partialCodAdvanceStatus: 'paid', total: 500 },
  { paymentStatus: 'pending', paymentMethod: 'cod', partialCodAdvanceAmount: 100, partialCodCashDue: 400, partialCodAdvanceStatus: 'pending', total: 500 },
  { paymentStatus: 'failed', paymentMethod: 'cod', partialCodAdvanceAmount: 100, partialCodCashDue: 400, partialCodAdvanceStatus: 'failed', total: 500 },
  { paymentStatus: 'paid', paymentMethod: 'cod', partialCodAdvanceAmount: 0, partialCodAdvanceStatus: 'not_required', total: 500 },
  { paymentStatus: 'refunded', paymentMethod: 'upi', total: 500, refund: { status: 'completed', amount: 200 } },
  { paymentStatus: 'paid', paymentMethod: 'upi', total: 500, refund: { status: 'partial', amount: 200 } },
  { paymentStatus: 'paid', paymentMethod: 'upi', total: 500, refundStatus: 'completed', refundedAmount: 500 },
  {},
  null,
];

describe('payment state parity with payment-state.js', () => {
  it.each([0, 1, 99.5, '149', '', null, undefined, 'abc', NaN])('numOrNull(%o)', (v) => {
    expect(ts.numOrNull(v)).toBe(loadLegacy().numOrNull(v));
  });

  it.each([0, 1, 99.5, 1234.56, '149', '', null, 'abc'])('money(%o)', (v) => {
    expect(ts.money(v)).toBe(loadLegacy().money(v));
  });

  it.each(ORDERS)('partialCod(%#)', (order) => {
    expect(ts.partialCod(order as never)).toEqual(loadLegacy().partialCod(order));
  });

  it.each(ORDERS)('refundState(%#)', (order) => {
    expect(ts.refundState(order as never)).toEqual(loadLegacy().refundState(order));
  });

  it.each(ORDERS)('state(%#)', (order) => {
    expect(ts.state(order as never)).toEqual(loadLegacy().state(order));
  });

  it.each(ORDERS)('authoritativeTotal(%#)', (order) => {
    expect(ts.authoritativeTotal(order as never)).toBe(loadLegacy().authoritativeTotal(order));
  });
});
