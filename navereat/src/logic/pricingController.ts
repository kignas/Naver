/**
 * Port of `ew-pricing.js` QuoteController + `ew-quote.js` Controller.
 *
 * Debounced and stale-safe: each request bumps a sequence number and only the
 * newest response is delivered. Superseded debounced calls resolve as
 * `{ stale: true }` instead of hanging. A changed total requires explicit
 * confirmation, and an expired quote re-quotes itself.
 */
import type { QuoteRequestBody } from './quote';
import { isQuoteCode, quoteTotal, secondsRemaining } from './quote';

export interface QuoteResult<TQuote = unknown> {
  ok: boolean;
  status: number;
  quote: TQuote | null;
  code?: string;
  message?: string;
  stale?: boolean;
  seq?: number;
  requestCoupon?: string;
}

export type QuoteFetcher = (body: QuoteRequestBody) => Promise<QuoteResult>;

export const DEFAULT_DEBOUNCE_MS = 300;

interface ControllerOptions<
  TQuote extends { quoteExpiresAt?: string | null; bill?: { grandTotal?: number | null; total?: number | null } | null },
> {
  debounceMs?: number;
  fetch: QuoteFetcher;
  onQuote?: (quote: TQuote, result: QuoteResult<TQuote>, controller: QuoteController<TQuote>) => void;
  onError?: (result: QuoteResult<TQuote>, controller: QuoteController<TQuote>) => void;
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (id: unknown) => void;
}

export class QuoteController<
  TQuote extends { quoteExpiresAt?: string | null; bill?: { grandTotal?: number | null; total?: number | null } | null } = Record<string, unknown>,
> {
  private readonly debounceMs: number;
  private readonly fetchQuote: QuoteFetcher;
  private readonly onQuote?: ControllerOptions<TQuote>['onQuote'];
  private readonly onError?: ControllerOptions<TQuote>['onError'];
  private readonly setTimeoutFn: (fn: () => void, ms: number) => unknown;
  private readonly clearTimeoutFn: (id: unknown) => void;

  private seq = 0;
  private timer: unknown = null;
  private expiryTimer: unknown = null;
  private pendingResolve: ((value: QuoteResult<TQuote>) => void) | null = null;

  private quoteValue: TQuote | null = null;
  private lastResult: QuoteResult<TQuote> | null = null;
  private confirmedTotal: number | null = null;
  private needsConfirmationFlag = false;
  private lastPayloadKey = '';

  constructor(options: ControllerOptions<TQuote>) {
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.fetchQuote = options.fetch;
    this.onQuote = options.onQuote;
    this.onError = options.onError;
    this.setTimeoutFn = options.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimeoutFn = options.clearTimeoutFn ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  }

  private cancelTimer(): void {
    if (this.timer) {
      this.clearTimeoutFn(this.timer);
      this.timer = null;
    }
  }

  private settlePendingAsStale(): void {
    if (this.pendingResolve) {
      const resolve = this.pendingResolve;
      this.pendingResolve = null;
      resolve({ ok: false, status: 0, quote: null, stale: true });
    }
  }

  private clearExpiry(): void {
    if (this.expiryTimer) {
      this.clearTimeoutFn(this.expiryTimer);
      this.expiryTimer = null;
    }
  }

  private armExpiry(body: QuoteRequestBody): void {
    this.clearExpiry();
    const remaining = secondsRemaining(this.quoteValue);
    if (remaining === null) return;
    this.expiryTimer = this.setTimeoutFn(() => {
      this.expiryTimer = null;
      void this.requestNow(body);
    }, Math.max(0, remaining) * 1000 + 1000);
  }

  private handleResult(result: QuoteResult<TQuote>, body: QuoteRequestBody): QuoteResult<TQuote> {
    const tagged = { ...result, requestCoupon: String(body.couponCode || '') };
    this.lastResult = tagged;
    if (tagged.stale) return tagged;

    if (!tagged.ok && isQuoteCode(tagged.code)) {
      void this.requestNow(body);
      return tagged;
    }

    const engineOff = !tagged.ok && tagged.code === 'PRICING_ENGINE_DISABLED';
    const quote = !engineOff && tagged.quote ? tagged.quote : null;
    if (quote && (quote as { serviceable?: boolean }).serviceable !== false) {
      const total = quoteTotal(quote);
      this.quoteValue = quote;
      if (total !== null) {
        if (this.confirmedTotal === null) {
          this.confirmedTotal = total;
          this.needsConfirmationFlag = false;
        } else if (Math.abs(this.confirmedTotal - total) > 0.004) {
          this.needsConfirmationFlag = true;
        }
      }
      this.armExpiry(body);
      this.onQuote?.(quote, tagged, this);
    } else if (!tagged.ok) {
      this.quoteValue = null;
      this.clearExpiry();
      this.onError?.(tagged, this);
    }
    return tagged;
  }

  private run(body: QuoteRequestBody): Promise<QuoteResult<TQuote>> {
    this.seq += 1;
    const mySeq = this.seq;
    this.lastPayloadKey = JSON.stringify(body);
    const key = this.lastPayloadKey;
    return this.fetchQuote(body).then((result) => {
      if (mySeq !== this.seq || key !== this.lastPayloadKey) return { ok: false, status: 0, quote: null, stale: true } as QuoteResult<TQuote>;
      const handled = this.handleResult(result as QuoteResult<TQuote>, body);
      handled.seq = mySeq;
      return handled;
    });
  }

  /** Debounced request. Resolves with the winning result or `{ stale: true }`. */
  request(body: QuoteRequestBody): Promise<QuoteResult<TQuote>> {
    this.cancelTimer();
    this.settlePendingAsStale();
    return new Promise((resolve) => {
      this.pendingResolve = resolve;
      this.timer = this.setTimeoutFn(() => {
        this.timer = null;
        this.pendingResolve = null;
        resolve(this.run(body));
      }, this.debounceMs);
    });
  }

  /** No debounce, still stale-safe. */
  requestNow(body: QuoteRequestBody): Promise<QuoteResult<TQuote>> {
    this.cancelTimer();
    this.settlePendingAsStale();
    return this.run(body);
  }

  cancel(): void {
    this.cancelTimer();
    this.settlePendingAsStale();
    this.seq += 1;
  }

  confirm(): void {
    const total = quoteTotal(this.quoteValue);
    if (total !== null) this.confirmedTotal = total;
    this.needsConfirmationFlag = false;
  }

  resetBaseline(): void {
    this.confirmedTotal = null;
    this.needsConfirmationFlag = false;
  }

  quote(): TQuote | null {
    return this.quoteValue;
  }

  result(): QuoteResult<TQuote> | null {
    return this.lastResult;
  }

  quoteId(): string {
    return (this.quoteValue as { quoteId?: string } | null)?.quoteId || '';
  }

  total(): number | null {
    return quoteTotal(this.quoteValue);
  }

  needsConfirmation(): boolean {
    return this.needsConfirmationFlag === true;
  }

  confirmedTotalValue(): number | null {
    return this.confirmedTotal;
  }

  secondsRemaining(nowMs?: number): number | null {
    return secondsRemaining(this.quoteValue, nowMs);
  }

  isExpired(nowMs?: number): boolean {
    const s = this.secondsRemaining(nowMs);
    return s !== null && s <= 0;
  }

  seqValue(): number {
    return this.seq;
  }
}
