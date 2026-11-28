import { describe, expect, it } from 'vitest';
import { paymentVerify } from '../src/logic/paymentVerify';
import { oracle } from './helpers/oracles';

interface LegacyVerify {
  run: (opts: Record<string, unknown>) => Promise<unknown>;
  waitForStatus: (opts: Record<string, unknown>) => Promise<unknown>;
  codDecision: (opts: unknown) => unknown;
  isTerminal: (body: unknown) => boolean;
  isConfirmed: (body: unknown) => boolean;
  saysFailed: (body: unknown) => boolean;
}

// payment-verify.js delegates classification to window.EWPayment, so load it.
oracle<Record<string, unknown>>('payment-state', 'EWPayment');
const legacy = oracle<LegacyVerify>('payment-verify', 'EWPaymentVerify');

const respond = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response;

/** Fake fetch: each call pops the next responder; the last one repeats. */
const fakeFetch = (responders: Array<() => Promise<Response> | Response>) => {
  let index = 0;
  return (async () => {
    const responder = responders[Math.min(index, responders.length - 1)];
    index += 1;
    return responder();
  }) as unknown as typeof fetch;
};

/** Fake clock: `sleep` advances `now`, so the bounded window really ends. */
const clock = () => {
  let time = 0;
  return {
    now: () => time,
    sleep: async (ms: number) => {
      time += ms;
    },
  };
};

const verifyBody = { orderId: 'o1', razorpay_payment_id: 'p1', razorpay_signature: 's' };

const runBoth = async (responders: Array<() => Promise<Response> | Response>, maxMs = 22000) => {
  const want = await legacy.run({
    orderId: 'o1',
    verifyBody,
    fetchImpl: fakeFetch(responders),
    maxMs,
    ...clock(),
  });
  const got = await paymentVerify.run({
    orderId: 'o1',
    verifyBody,
    fetchImpl: fakeFetch(responders),
    maxMs,
    ...clock(),
  });
  return { want, got };
};

describe('payment verify matches payment-verify.js', () => {
  it('paid on the verify call', async () => {
    const { want, got } = await runBoth([() => respond(200, { success: true, data: { paymentStatus: 'paid' } })]);
    expect(got).toEqual(want);
    expect(got.verdict).toBe('paid');
    expect(got.source).toBe('verify');
  });

  it('polls after a 200 that is still pending', async () => {
    const { want, got } = await runBoth([
      () => respond(200, { success: true, data: { paymentStatus: 'pending' } }),
      () => respond(200, { success: true, data: { paymentStatus: 'paid' } }),
    ]);
    expect(got).toEqual(want);
    expect(got.verdict).toBe('paid');
    expect(got.source).toBe('status-after-200');
  });

  it('reconciles after a 409 capture race', async () => {
    const { want, got } = await runBoth([
      () => respond(409, { success: false, message: 'capture race' }),
      () => respond(200, { success: true, data: { paymentStatus: 'paid' } }),
    ]);
    expect(got).toEqual(want);
    expect(got.source).toBe('status-after-409');
  });

  it('treats a network error as unknown, not failed', async () => {
    const { want, got } = await runBoth([
      () => {
        throw new Error('offline');
      },
      () => respond(200, { success: true, data: { paymentStatus: 'paid' } }),
    ]);
    expect(got).toEqual(want);
    expect(got.verdict).toBe('paid');
    expect(got.source).toBe('status-after-network-error');
  });

  it('times out to pending when the server never settles', async () => {
    const { want, got } = await runBoth(
      [() => respond(503, { success: false }), () => respond(200, { success: true, data: { paymentStatus: 'pending' } })],
      6000,
    );
    expect(got).toEqual(want);
    expect(got.verdict).toBe('pending');
  });

  it('reports failed only on an explicit server failure', async () => {
    const { want, got } = await runBoth([() => respond(200, { success: true, data: { paymentStatus: 'failed' } })]);
    expect(got).toEqual(want);
    expect(got.verdict).toBe('failed');
  });

  it('agrees on codDecision', () => {
    const cases = [
      { data: {}, payment: null },
      { data: { partialCodAdvanceAmount: 50 }, payment: null },
      { data: { partialCodAdvanceAmount: 50 }, payment: { orderId: 'x', keyId: 'k' }, hasRazorpay: true },
      { data: {}, payment: { orderId: 'x' }, hasRazorpay: false },
    ];
    for (const entry of cases) {
      expect(paymentVerify.codDecision(entry)).toEqual(legacy.codDecision(entry));
    }
  });
});
