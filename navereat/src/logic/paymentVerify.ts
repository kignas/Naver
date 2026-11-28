/**
 * Port of `payment-verify.js`. Decision logic after the gateway hands control
 * back: an UNCONFIRMED outcome is never a FAILED outcome. Only the server
 * confirming (paid) or explicitly reporting failure (failed) is terminal;
 * everything else is `pending`.
 */
import { partialCod, state as paymentState } from './paymentState';

type Body = Record<string, unknown> | null;

export interface VerifyOptions {
  apiBase?: string;
  token?: string;
  orderId: string;
  verifyBody: unknown;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  maxMs?: number;
  onPollError?: (error: unknown) => void;
  onError?: (error: unknown) => void;
}

export type Verdict = 'paid' | 'failed' | 'pending';

export interface VerifyResult {
  verdict: Verdict;
  source: string;
  data: Record<string, unknown>;
  httpStatus?: number;
}

const norm = (v: unknown): string => String(v == null ? '' : v).trim().toLowerCase();

function payloadOf(body: unknown): Body {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (String(record.paymentStatus || '').trim()) return record;
  if (record.data && typeof record.data === 'object') return record.data as Record<string, unknown>;
  return record;
}

const isConfirmed = (body: unknown): boolean => {
  const data = payloadOf(body);
  return data ? paymentState(data).isPaid === true : false;
};

const saysFailed = (body: unknown): boolean => {
  const data = payloadOf(body);
  return data ? paymentState(data).isFailed === true : false;
};

const isTerminal = (body: unknown): boolean => {
  const data = payloadOf(body);
  if (!data) return false;
  const s = paymentState(data);
  if (s.isPaid || s.isFailed || s.isRefunded) return true;
  const ps = norm(data.paymentStatus);
  return ps === 'paid' || ps === 'failed' || ps === 'refunded';
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function readStatus(opts: VerifyOptions): Promise<Record<string, unknown>> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(
    `${opts.apiBase ?? ''}/payments/${encodeURIComponent(opts.orderId)}/status`,
    { headers: { Authorization: `Bearer ${opts.token ?? ''}` }, cache: 'no-store' } as RequestInit,
  );
  let body: Body = null;
  try {
    body = (await res.json()) as Body;
  } catch {
    body = null;
  }
  if (!res.ok || !body || !body.success) {
    const error = new Error(String((body && body.message) || `Payment status check failed (${res.status}).`)) as Error & {
      httpStatus?: number;
    };
    error.httpStatus = res.status;
    throw error;
  }
  return (body.data as Record<string, unknown>) || {};
}

async function waitForStatus(opts: VerifyOptions): Promise<Record<string, unknown> | null> {
  const maxMs = opts.maxMs != null ? opts.maxMs : 22000;
  const sleep = opts.sleep ?? defaultSleep;
  const now = opts.now ?? Date.now;
  const started = now();
  let delay = 1200;
  while (now() - started < maxMs) {
    try {
      const status = await readStatus(opts);
      if (isTerminal(status)) return status;
    } catch (error) {
      if (opts.onPollError) opts.onPollError(error);
    }
    await sleep(delay);
    delay = Math.min(3000, Math.round(delay * 1.35));
  }
  return null;
}

const decide = (status: Record<string, unknown> | null, source: string): VerifyResult => {
  if (status && isConfirmed(status)) return { verdict: 'paid', source, data: payloadOf(status) || {} };
  if (saysFailed(status)) return { verdict: 'failed', source, data: payloadOf(status) || {} };
  return { verdict: 'pending', source, data: payloadOf(status) || {} };
};

async function postVerify(
  opts: VerifyOptions,
): Promise<{ ok: boolean; status: number; body: Body }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(`${opts.apiBase ?? ''}/payments/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.token ?? ''}` },
    body: JSON.stringify(opts.verifyBody),
  } as RequestInit);
  let body: Body = null;
  try {
    body = (await res.json()) as Body;
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

async function run(opts: VerifyOptions): Promise<VerifyResult> {
  let verify: { ok: boolean; status: number; body: Body };
  try {
    verify = await postVerify(opts);
  } catch (networkError) {
    if (opts.onError) opts.onError(networkError);
    const netStatus = await waitForStatus(opts);
    return decide(netStatus, 'status-after-network-error');
  }

  if (verify.ok && verify.body && verify.body.success && isConfirmed(verify.body)) {
    return { verdict: 'paid', source: 'verify', data: payloadOf(verify.body) || {} };
  }

  if (verify.status === 409 || verify.status >= 500) {
    const s1 = await waitForStatus(opts);
    return decide(s1, `status-after-${verify.status}`);
  }

  if (saysFailed(verify.body)) {
    return { verdict: 'failed', source: 'verify', data: payloadOf(verify.body) || {}, httpStatus: verify.status };
  }

  const s2 = await waitForStatus(opts);
  return decide(s2, `status-after-${verify.status}`);
}

const codDecision = (opts: {
  data?: Record<string, unknown>;
  payment?: { orderId?: string; keyId?: string } | null;
  hasRazorpay?: boolean;
}) => {
  const o = opts || {};
  const data = o.data || {};
  const payment = o.payment || null;
  const pc = partialCod(data);
  const advanceRequired = Boolean((pc && pc.required) || (payment && payment.orderId));
  if (!advanceRequired) return { kind: 'complete' as const, partialCod: pc };
  const canStart = Boolean(payment && payment.orderId && payment.keyId && o.hasRazorpay);
  return { kind: canStart ? ('advance-open' as const) : ('advance-pending' as const), partialCod: pc };
};

export const paymentVerify = {
  run,
  readStatus,
  waitForStatus,
  codDecision,
  isConfirmed,
  saysFailed,
  isTerminal,
  payloadOf,
};
