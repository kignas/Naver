/**
 * Port of `checkout-key.js`: one checkout idempotency key bound to a
 * fingerprint of the checkout payload.
 *
 *   unchanged retry  -> same fingerprint -> same key  -> same order
 *   changed checkout -> new fingerprint  -> new key   -> new order
 */
export const KEY = 'nearbite_checkout_key';
export const FP = 'nearbite_checkout_fp';
export const FP_TS = 'nearbite_checkout_fp_ts';
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const read = (name: string): string => {
  try {
    return localStorage.getItem(name) || '';
  } catch {
    return '';
  }
};
const write = (name: string, value: string): void => {
  try {
    localStorage.setItem(name, value);
  } catch {
    /* storage unavailable */
  }
};
const drop = (name: string): void => {
  try {
    localStorage.removeItem(name);
  } catch {
    /* ignore */
  }
};

/** Deterministic serialisation: object key order must never change the hash. */
export function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value === undefined ? null : value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stable).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stable(record[k])}`).join(',')}}`;
}

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function utf8Bytes(str: string): number[] {
  const s = String(str);
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const c2 = s.charCodeAt(i + 1);
      if (c2 >= 0xdc00 && c2 <= 0xdfff) {
        const cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
        i += 1;
      } else {
        out.push(0xef, 0xbf, 0xbd);
      }
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      out.push(0xef, 0xbf, 0xbd);
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return out;
}

export function sha256(str: string): string {
  const bytes = utf8Bytes(str);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
  bytes.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const w = new Array<number>(64);

  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] =
        (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
    h5 = (h5 + f) | 0;
    h6 = (h6 + g) | 0;
    h7 = (h7 + h) | 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((n) => (`00000000${(n >>> 0).toString(16)}`).slice(-8)).join('');
}

interface AddressLike {
  line1?: string;
  addressLine1?: string;
  line2?: string;
  addressLine2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  postalCode?: string;
  zip?: string;
  lat?: number | string;
  lng?: number | string;
  label?: string;
  tag?: string;
}

export interface CheckoutPayload {
  items?: Array<Record<string, unknown>>;
  restaurantId?: string | number | null;
  addressId?: string | number | null;
  deliveryAddress?: AddressLike | string | null;
  paymentMethod?: string;
  tipAmount?: number | string;
  couponCode?: string;
  restaurantNote?: string;
  restaurantNotes?: Record<string, unknown>;
  deliveryInstructions?: string;
}

function addressPart(p: CheckoutPayload): Record<string, unknown> | string {
  const a = p.deliveryAddress;
  if (a && typeof a === 'object') {
    return {
      line1: String(a.line1 || a.addressLine1 || ''),
      line2: String(a.line2 || a.addressLine2 || ''),
      landmark: String(a.landmark || ''),
      city: String(a.city || ''),
      state: String(a.state || ''),
      pincode: String(a.pincode || a.postalCode || a.zip || ''),
      lat: a.lat != null ? Number(a.lat) : null,
      lng: a.lng != null ? Number(a.lng) : null,
      label: String(a.label || a.tag || ''),
    };
  }
  return typeof a === 'string' ? a : '';
}

const itemSortKey = (it: Record<string, unknown>): string =>
  [it.menuItem, it.name, it.price, it.quantity, stable(it.customizations)].join('\u0001');

/** The fields that change what the backend will actually charge and deliver. */
export function material(payload: CheckoutPayload | null | undefined): Record<string, unknown> {
  const p = payload || {};
  const items = Array.isArray(p.items)
    ? p.items.map((raw) => {
        const item = raw || {};
        return {
          menuItem: item.menuItem ? String(item.menuItem) : null,
          name: String(item.name || ''),
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 0,
          customizations: item.customizations || {},
        };
      })
    : [];
  items.sort((a, b) => {
    const ka = itemSortKey(a as Record<string, unknown>);
    const kb = itemSortKey(b as Record<string, unknown>);
    if (ka === kb) return 0;
    return ka < kb ? -1 : 1;
  });
  return {
    items,
    restaurantId: p.restaurantId ? String(p.restaurantId) : null,
    addressId: p.addressId ? String(p.addressId) : null,
    deliveryAddress: addressPart(p),
    paymentMethod: String(p.paymentMethod || '').toLowerCase(),
    tipAmount: Number(p.tipAmount) || 0,
    couponCode: String(p.couponCode || '').toUpperCase(),
    restaurantNote: String(p.restaurantNote || ''),
    restaurantNotes: p.restaurantNotes || {},
    deliveryInstructions: String(p.deliveryInstructions || ''),
  };
}

export const fingerprint = (payload: CheckoutPayload | null | undefined): string => sha256(stable(material(payload)));

export function newKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `ck_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function isExpired(): boolean {
  const ts = parseInt(read(FP_TS), 10);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  return Date.now() - ts > MAX_AGE_MS;
}

/** Returns the key to send, reusing it only when the payload is materially
 *  identical to the attempt that created it and that attempt is not stale. */
export function ensureKey(payload: CheckoutPayload): string {
  const fp = fingerprint(payload);
  let key = read(KEY);
  if (!key || read(FP) !== fp || isExpired()) {
    key = newKey();
    write(KEY, key);
    write(FP, fp);
    write(FP_TS, String(Date.now()));
  }
  return key;
}

export function clearKey(): void {
  drop(KEY);
  drop(FP);
  drop(FP_TS);
}

export const checkoutKey = {
  KEY,
  FP,
  FP_TS,
  MAX_AGE_MS,
  sha256,
  stable,
  material,
  fingerprint,
  ensureKey,
  clearKey,
  newKey,
};
