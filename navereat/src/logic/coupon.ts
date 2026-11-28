/**
 * Port of the pure parts of `ew-coupon.js`: response interpretation, offer
 * normalisation, fallback wording and payment wording.
 *
 * Authoritative rule kept: the rupee amount shown is the quote's
 * `bill.couponDiscount`; `/coupons/validate` only tells us the coupon exists.
 */
export const FALLBACK_MESSAGES: Record<string, string> = {
  COUPON_NOT_FOUND: 'Coupon is invalid or expired.',
  COUPON_INVALID: 'Coupon is invalid or expired.',
  COUPON_INACTIVE: 'This coupon is not currently active.',
  COUPON_NOT_STARTED: 'This coupon is not active yet.',
  COUPON_EXPIRED: 'This coupon has expired.',
  COUPON_EXHAUSTED: 'Coupon usage limit has been reached.',
  COUPON_WRONG_RESTAURANT: 'This coupon is not valid for this checkout.',
  COUPON_RESTAURANT_INELIGIBLE: 'This coupon is not available for this restaurant right now.',
  COUPON_MIN_SUBTOTAL: 'Your order is below the minimum for this coupon.',
  COUPON_PER_USER_LIMIT: 'You have already used this coupon.',
  COUPON_FIRST_ORDER_ONLY: 'This coupon is for first orders only.',
  COUPON_PAYMENT_METHOD: 'This coupon is not valid for the selected payment method.',
  COUPON_NOT_ECONOMICALLY_SERVICEABLE:
    'This coupon cannot be applied to this order right now. Try a larger order or another coupon.',
};

export const NETWORK_MESSAGE = 'We couldn’t reach the server. Check your connection and try again.';
export const SERVER_MESSAGE = 'Something went wrong while checking the coupon. Please try again.';
export const LOGIN_MESSAGE = 'Please log in to apply a coupon.';

const num = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const isNum = (v: unknown): boolean => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
export const normalizeCode = (c: unknown): string => String(c || '').trim().toUpperCase();

export interface CouponOffer {
  code: string;
  title: string;
  description: string;
  type: 'percent' | 'fixed' | null;
  value: number | null;
  discount: number;
  maxDiscount: number | null;
  minSubtotal: number;
  restaurantId: string | null;
  restaurantName: string;
  image: string | null;
  paymentMethods: string[] | null;
  expiresAt: string | null;
  showPopup: boolean;
}

interface RawOffer {
  code?: unknown;
  title?: unknown;
  description?: unknown;
  type?: unknown;
  value?: unknown;
  discount?: unknown;
  maxDiscount?: unknown;
  minSubtotal?: unknown;
  restaurantId?: unknown;
  restaurantName?: unknown;
  image?: unknown;
  imageUrl?: unknown;
  imageURL?: unknown;
  promoImage?: unknown;
  promotionalImage?: unknown;
  promotionalImageUrl?: unknown;
  bannerImage?: unknown;
  banner?: unknown;
  thumbnail?: unknown;
  paymentMethods?: unknown;
  expiresAt?: unknown;
  showPopup?: unknown;
  imageSource?: string;
}

const normalizeImage = (v: unknown, apiBase: string): string | null => {
  if (typeof v !== 'string' || !v.trim()) return null;
  const value = v.trim();
  if (/^https:\/\//i.test(value)) return value;
  if (/^http:\/\//i.test(value)) return `https://${value.slice(7)}`;
  if (value.charAt(0) === '/') {
    try {
      return new URL(value, apiBase || 'http://localhost').href.replace(/^http:/i, 'https:');
    } catch {
      return null;
    }
  }
  return null;
};

const IMG_KEYS = [
  'image',
  'imageUrl',
  'imageURL',
  'promoImage',
  'promotionalImage',
  'promotionalImageUrl',
  'bannerImage',
  'banner',
  'thumbnail',
] as const;

export function buildOffer(body: Record<string, unknown> | null | undefined, apiBase = ''): CouponOffer | null {
  const o = body && body.offer && typeof body.offer === 'object' ? (body.offer as RawOffer) : null;
  const d = body && body.data && typeof body.data === 'object' ? (body.data as RawOffer) : null;
  if (!o && !d) return null;
  const src: RawOffer = o || {};
  const code = normalizeCode(src.code || (d && d.code));
  if (!code) return null;
  const discount = isNum(src.discount) ? Number(src.discount) : d && isNum(d.discount) ? Number(d.discount) : 0;
  const type = src.type || (d && d.type) || null;
  const methods = Array.isArray(src.paymentMethods)
    ? src.paymentMethods.map((m) => String(m || '').toLowerCase()).filter((m) => m === 'upi' || m === 'cod')
    : null;
  let rawImage: string | null = null;
  [src, d || {}].forEach((obj) => {
    IMG_KEYS.forEach((k) => {
      const value = (obj as RawOffer)[k];
      if (!rawImage && typeof value === 'string' && value.trim()) rawImage = value;
    });
  });
  const image = src.imageSource === 'restaurant' ? null : normalizeImage(rawImage, apiBase);
  return {
    code,
    title: src.title ? String(src.title) : '',
    description: src.description ? String(src.description) : '',
    type: type === 'percent' || type === 'fixed' ? type : null,
    value: isNum(src.value) ? Number(src.value) : null,
    discount,
    maxDiscount: isNum(src.maxDiscount) ? Number(src.maxDiscount) : null,
    minSubtotal: isNum(src.minSubtotal) ? Number(src.minSubtotal) : 0,
    restaurantId: src.restaurantId ? String(src.restaurantId) : null,
    restaurantName: src.restaurantName ? String(src.restaurantName) : '',
    image,
    paymentMethods: methods && methods.length ? methods : null,
    expiresAt: (src.expiresAt as string) || null,
    showPopup: src.showPopup === false ? false : true,
  };
}

export function messageFor(code: unknown, backendMessage?: unknown): string {
  const m = String(backendMessage || '').trim();
  if (m) return m;
  return FALLBACK_MESSAGES[String(code || '')] || 'Coupon could not be applied.';
}

export interface CouponValidationResult {
  ok: boolean;
  code?: string;
  message?: string;
  offer?: CouponOffer;
  discount?: number;
}

/** Turns an HTTP status + parsed body into { ok, code, message, offer }. */
export function interpret(status: number, body: Record<string, unknown> | null, apiBase = ''): CouponValidationResult {
  if (status >= 200 && status < 300 && body && body.success) {
    const offer = buildOffer(body, apiBase);
    if (offer) return { ok: true, offer, discount: offer.discount };
    return { ok: false, code: 'BAD_RESPONSE', message: SERVER_MESSAGE };
  }
  if (status === 401) return { ok: false, code: 'AUTH', message: LOGIN_MESSAGE };
  const code = body && body.code ? String(body.code) : '';
  if (status >= 500 || !body) return { ok: false, code: code || 'SERVER', message: (body && (body.message as string)) || SERVER_MESSAGE };
  return { ok: false, code: code || 'COUPON_INVALID', message: messageFor(code, body && body.message) };
}

export function paymentLabel(methods: string[] | null | undefined): string {
  if (!Array.isArray(methods) || !methods.length) return '';
  const hasU = methods.indexOf('upi') !== -1;
  const hasC = methods.indexOf('cod') !== -1;
  if (hasU && hasC) return 'UPI & Cash on Delivery';
  return hasU ? 'UPI only' : 'Cash on Delivery only';
}

export function paymentOnlyPhrase(methods: string[] | null | undefined): string {
  if (!Array.isArray(methods) || methods.length !== 1) return 'the selected payment method';
  return methods[0] === 'cod' ? 'Cash on Delivery' : 'UPI';
}

export interface DetailRow {
  label: string;
  value: string;
}

export function detailRows(o: CouponOffer): DetailRow[] {
  const rows: DetailRow[] = [];
  if (o.restaurantName) rows.push({ label: 'Restaurant', value: o.restaurantName });
  if (o.minSubtotal > 0) rows.push({ label: 'Minimum order', value: money(o.minSubtotal) });
  if (o.maxDiscount !== null && o.maxDiscount > 0) rows.push({ label: 'Maximum discount', value: money(o.maxDiscount) });
  const pay = paymentLabel(o.paymentMethods);
  if (pay) rows.push({ label: 'Payment', value: pay });
  if (o.expiresAt) {
    const d = new Date(o.expiresAt);
    if (!Number.isNaN(d.getTime()))
      rows.push({ label: 'Valid till', value: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) });
  }
  return rows;
}

const money = (v: unknown): string => {
  const x = Math.round(num(v) * 100) / 100;
  return `₹${x % 1 ? x.toFixed(2) : String(x)}`;
};

export const coupon = {
  FALLBACK_MESSAGES,
  NETWORK_MESSAGE,
  SERVER_MESSAGE,
  LOGIN_MESSAGE,
  messageFor,
  buildOffer,
  interpret,
  paymentLabel,
  paymentOnlyPhrase,
  detailRows,
  normalizeCode,
};
