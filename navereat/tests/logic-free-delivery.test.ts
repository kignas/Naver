import { describe, expect, it } from 'vitest';
import * as ts from '../src/logic/freeDelivery';
import { oracle } from './helpers/oracles';

interface LegacyFreeDelivery {
  state: (fd: unknown, fallback?: unknown) => unknown;
  text: (fd: unknown, fallback?: unknown) => string;
  line: (fd: unknown, fallback?: unknown) => string;
  isUnlocked: (fd: unknown) => boolean;
}

const legacy = oracle<LegacyFreeDelivery>('ew-freedelivery');

const CASES: Array<[unknown, unknown]> = [
  [null, 29],
  [null, null],
  [{ available: true, enabled: true, threshold: 399, amountRemaining: 149, deliveryFee: 29, effectiveDeliveryFee: 29, unlocked: false }, 29],
  [{ available: true, unlocked: true, threshold: 399, amountRemaining: 0, deliveryFee: 29, effectiveDeliveryFee: 0 }, 29],
  [{ available: true, firstOrderFreeDelivery: true, deliveryFee: 29, effectiveDeliveryFee: 0 }, 29],
  [{ available: false, deliveryFee: 55, effectiveDeliveryFee: 55 }, 29],
  [{ available: true, amountRemaining: 0, deliveryFee: 35, effectiveDeliveryFee: 35 }, 29],
  [{ available: true, amountRemaining: '149', deliveryFee: '29' }, 29],
  [{ available: true, amountRemaining: 100 }, 55],
  [{ available: true, amountRemaining: 100 }, null],
  [{}, 29],
];

describe('free-delivery parity with ew-freedelivery.js', () => {
  it.each(CASES)('state(%#)', (fd, fallback) => {
    expect(ts.state(fd as never, fallback)).toEqual(legacy.state(fd, fallback));
  });

  it.each(CASES)('text(%#)', (fd, fallback) => {
    expect(ts.text(fd as never, fallback)).toBe(legacy.text(fd, fallback));
  });

  it.each(CASES)('line(%#)', (fd, fallback) => {
    expect(ts.line(fd as never, fallback)).toBe(legacy.line(fd, fallback));
  });

  it.each(CASES)('isUnlocked(%#)', (fd) => {
    expect(ts.isUnlocked(fd as never)).toBe(legacy.isUnlocked(fd));
  });
});
