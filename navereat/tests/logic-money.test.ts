import { describe, expect, it } from 'vitest';
import * as ts from '../src/logic/money';
import { oracle } from './helpers/oracles';

interface LegacyMoney {
  paiseToRupees: (v: unknown) => number;
  rupeesToPaise: (v: unknown) => number;
  isNum: (v: unknown) => boolean;
  format: (v: unknown) => string;
  formatInt: (v: unknown) => string;
}

const legacy = oracle<LegacyMoney>('ew-money');

const VALUES: unknown[] = [
  0,
  1,
  5,
  25,
  99,
  100,
  149,
  999,
  1000,
  1234,
  12345,
  123456,
  1234567,
  12345678,
  0.5,
  12.34,
  99.99,
  1234.5,
  -1,
  -99.5,
  null,
  undefined,
  '',
  'abc',
  '149',
  '149.5',
  NaN,
  Infinity,
];

describe('money parity with ew-money.js', () => {
  it.each(VALUES)('format(%o)', (value) => {
    expect(ts.format(value)).toBe(legacy.format(value));
  });

  it.each(VALUES)('formatInt(%o)', (value) => {
    expect(ts.formatInt(value)).toBe(legacy.formatInt(value));
  });

  it.each(VALUES)('paiseToRupees(%o)', (value) => {
    expect(ts.paiseToRupees(value)).toBe(legacy.paiseToRupees(value));
  });

  it.each(VALUES)('rupeesToPaise(%o)', (value) => {
    expect(ts.rupeesToPaise(value)).toBe(legacy.rupeesToPaise(value));
  });

  it.each(VALUES)('isNum(%o)', (value) => {
    expect(ts.isNum(value)).toBe(legacy.isNum(value));
  });

  it('formats Indian grouping', () => {
    expect(ts.format(123456.78)).toBe('₹1,23,456.78');
    expect(ts.formatInt(1234567)).toBe('₹12,34,567');
  });
});
