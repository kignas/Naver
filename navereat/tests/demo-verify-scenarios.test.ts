import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoApi } from '../src/api/demoApi';
import { clearScenarios, writeScenarios } from '../src/api/scenarios';

const verify = (outcome: 'success' | 'failure' | 'pending' | 'verifySlow' | 'verifyFlaky' | 'verifyTimeout') =>
  demoApi.verifyPayment({ paymentId: `pay_${outcome}`, orderId: `order_${outcome}`, outcome });

describe('demo verify scenarios reach every payment result', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    clearScenarios();
  });

  it('a verify* scenario outranks the mock sheet outcome (the cart passes `success`)', async () => {
    writeScenarios({ payment: 'verifyTimeout' });
    const pending = demoApi.verifyPayment({ paymentId: 'pay_cart', orderId: 'order_cart', outcome: 'success' });
    await vi.advanceTimersByTimeAsync(12000);
    expect((await pending).paymentStatus).toBe('pending');
  });

  it('success → paid without polling', async () => {
    const pending = verify('success');
    await vi.advanceTimersByTimeAsync(1000);
    const result = await pending;
    expect(result.paymentStatus).toBe('paid');
    expect(result.source).toBe('verify');
  });

  it('failure → failed from an explicit server verdict', async () => {
    const pending = verify('failure');
    await vi.advanceTimersByTimeAsync(1000);
    const result = await pending;
    expect(result.paymentStatus).toBe('failed');
  });

  it('pending → pending (never accused of failing)', async () => {
    const pending = verify('pending');
    await vi.advanceTimersByTimeAsync(12000);
    const result = await pending;
    expect(result.paymentStatus).toBe('pending');
  });

  it('verifySlow → 409 capture race reconciled by the status poll', async () => {
    const pending = verify('verifySlow');
    await vi.advanceTimersByTimeAsync(12000);
    const result = await pending;
    expect(result.paymentStatus).toBe('paid');
    expect(result.source).toBe('status-after-409');
  });

  it('verifyFlaky → network error on verify, paid by the poll', async () => {
    const pending = verify('verifyFlaky');
    await vi.advanceTimersByTimeAsync(12000);
    const result = await pending;
    expect(result.paymentStatus).toBe('paid');
    expect(result.source).toBe('status-after-network-error');
  });

  it('verifyTimeout → pending after the bounded window', async () => {
    const pending = verify('verifyTimeout');
    await vi.advanceTimersByTimeAsync(12000);
    const result = await pending;
    expect(result.paymentStatus).toBe('pending');
  });
});
