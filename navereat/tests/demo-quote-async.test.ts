import { afterEach, describe, expect, it } from 'vitest';
import { demoApi } from '../src/api/demoApi';
import { clearScenarios, parseDemoFlag, writeScenarios } from '../src/api/scenarios';

const body = {
  restaurantId: 1,
  addressId: 'addr_home',
  items: [{ menuItem: 'fd1', name: 'Filter Coffee', price: 49, quantity: 2 }],
  paymentMethod: 'upi' as const,
};

afterEach(() => clearScenarios());

describe('every demo adapter call is asynchronous', () => {
  it('returns a promise from each network-shaped method', () => {
    const calls = [
      demoApi.getRestaurant(1),
      demoApi.getMenu(1),
      demoApi.getCoupons(),
      demoApi.getQuote(body),
      demoApi.validateCoupon({ code: 'WELCOME50', subtotal: 200 }),
      demoApi.createOrder({ payload: {} as never, idempotencyKey: 'k' }),
      demoApi.createPayment({ orderId: 'o', amount: 100, method: 'upi' }),
      demoApi.getPaymentStatus('p'),
      demoApi.verifyPayment({ paymentId: 'p', orderId: 'o' }),
      demoApi.getProfile(),
      demoApi.getAddresses(),
      demoApi.getOrders(),
      demoApi.getPlatformStatus(),
    ];
    // Some calls reject (the empty payload); swallow so the run stays clean.
    for (const call of calls) {
      expect(call).toBeInstanceOf(Promise);
      call.catch(() => undefined);
    }
  });

  it('has no synchronous quote shortcut on the interface', () => {
    expect('quoteSync' in demoApi).toBe(false);
  });

  it('prices the quote through the shared engine, not the fixture', async () => {
    const quote = await demoApi.getQuote({ ...body, tipAmount: 20 });
    const plain = await demoApi.getQuote(body);
    expect(quote.bill.tipAmount).toBe(20);
    expect(quote.bill.grandTotal).toBe(plain.bill.grandTotal + 20);
    expect(quote.quoteId).toMatch(/^q_/);
  });
});

describe('quote failure scenario', () => {
  it('rejects a retryable network failure under ?demo=quote-error', async () => {
    expect(parseDemoFlag('quote-error').quoteError).toBe(true);
    expect(parseDemoFlag('quoteError').quoteError).toBe(true);
    writeScenarios({ quoteError: true });
    await expect(demoApi.getQuote(body)).rejects.toMatchObject({
      kind: 'network',
      retryable: true,
      message: "Can't reach the server. Check your connection.",
    });
  });

  it('recovers when the flag is cleared, so Try again succeeds', async () => {
    writeScenarios({ quoteError: true });
    await expect(demoApi.getQuote(body)).rejects.toBeTruthy();
    clearScenarios();
    const quote = await demoApi.getQuote({ ...body, items: [{ menuItem: 'fd9', price: 300, quantity: 1 }] });
    expect(quote.success).toBe(true);
    expect(quote.serviceable).toBe(true);
  });
});

describe('demo flag parsing', () => {
  it('accepts the camelCase verify verdicts in a lower-casing parser', () => {
    expect(parseDemoFlag('payment=verifySlow').payment).toBe('verifySlow');
    expect(parseDemoFlag('payment=verifyFlaky').payment).toBe('verifyFlaky');
    expect(parseDemoFlag('payment=verifyTimeout').payment).toBe('verifyTimeout');
    expect(parseDemoFlag('payment=success').payment).toBe('success');
    expect(parseDemoFlag('payment=bogus').payment).toBeNull();
  });
});
