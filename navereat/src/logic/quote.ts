/**
 * Port of the pure parts of `ew-quote.js`: payload building, total reading,
 * expiry maths and the backend decision codes.
 */

export const DECISION = {
  PROFITABLE: 'PROFITABLE',
  REPRICING_REQUIRED: 'REPRICING_REQUIRED',
  NOT_ECONOMICALLY_SERVICEABLE: 'NOT_ECONOMICALLY_SERVICEABLE',
} as const;

export const QUOTE_ERROR_CODES: Record<string, true> = {
  QUOTE_EXPIRED: true,
  QUOTE_PRICE_CHANGED: true,
  QUOTE_MISMATCH: true,
};

const num = (v: unknown): number | null => (Number.isFinite(Number(v)) ? Number(v) : null);

export interface QuoteItemInput {
  menuItem?: string | number | null;
  menuId?: string | number | null;
  _id?: string | number | null;
  id?: string | number | null;
  quantity?: number | string;
}

export interface QuoteRequestInput {
  restaurantId?: string | number | null;
  addressId?: string | number | null;
  items?: QuoteItemInput[];
  paymentMethod?: string;
  couponCode?: string;
  tipAmount?: number | string;
}

export interface QuoteRequestBody {
  restaurantId: string;
  addressId: string | null;
  items: Array<{ menuItem: string | number; quantity: number }>;
  paymentMethod: 'upi' | 'cod';
  couponCode?: string;
  tipAmount?: number;
}

/** Read the payable total from a quote (grandTotal, else total). */
export function quoteTotal(
  quote: { bill?: { grandTotal?: number | null; total?: number | null } | null } | null | undefined,
): number | null {
  const b = quote && quote.bill ? quote.bill : {};
  if (b.grandTotal != null) return num(b.grandTotal);
  if (b.total != null) return num(b.total);
  return null;
}

export const isQuoteCode = (code: unknown): boolean => QUOTE_ERROR_CODES[String(code || '')] === true;

/** Build the quote request body from an explicit basket. Only ids and
 *  quantities are sent — never a price, a fee or a distance. */
export function buildPayload(opts: QuoteRequestInput | null | undefined): QuoteRequestBody | null {
  const o = opts || {};
  const items = (o.items || [])
    .map((it) => ({
      menuItem: (it && (it.menuItem || it.menuId || it._id || it.id)) || null,
      quantity: Number(it && it.quantity) || 0,
    }))
    .filter((it): it is { menuItem: string | number; quantity: number } => Boolean(it.menuItem) && it.quantity > 0);
  if (!o.restaurantId || !items.length) return null;
  const body: QuoteRequestBody = {
    restaurantId: String(o.restaurantId),
    addressId: o.addressId ? String(o.addressId) : null,
    items,
    paymentMethod: String(o.paymentMethod || 'upi').toLowerCase() === 'cod' ? 'cod' : 'upi',
  };
  if (o.couponCode) body.couponCode = String(o.couponCode);
  const tip = Number(o.tipAmount);
  if (Number.isFinite(tip) && tip > 0) body.tipAmount = tip;
  return body;
}

/** Remaining validity in seconds (>=0), from the backend's quoteExpiresAt. */
export function secondsRemaining(quote: { quoteExpiresAt?: string | null } | null | undefined, nowMs?: number): number | null {
  const iso = quote && quote.quoteExpiresAt;
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const now = nowMs != null ? nowMs : Date.now();
  return Math.max(0, Math.round((t - now) / 1000));
}

export const isExpired = (quote: { quoteExpiresAt?: string | null } | null | undefined, nowMs?: number): boolean => {
  const s = secondsRemaining(quote, nowMs);
  return s !== null && s <= 0;
};

/** Normalise a pricing response body into one predictable result (port of
 *  `EWPricing.normalise`, including its array fallback). */
export function normaliseResult(status: number, body: Record<string, unknown> | null): {
  ok: boolean;
  status: number;
  data: unknown;
  quote: unknown;
  code: string;
  message: string;
} {
  const ok = status >= 200 && status < 300 && Boolean(body) && body!.success === true;
  const data = (body && body.data) || null;
  const out = {
    ok,
    status,
    data,
    quote:
      body && body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : (null as unknown),
    code: (body && (body.code as string)) || '',
    message: (body && (body.message as string)) || '',
  };
  if (!out.quote && body && body.data) out.quote = body.data;
  return out;
}
