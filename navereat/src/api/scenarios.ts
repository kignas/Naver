/**
 * Demo-only scenario switches. They are read from `?demo=` in the hash or the
 * query string (and can be pinned in localStorage by the hidden panel), so every
 * state the port must cover is reachable without a backend.
 *
 * Example: `#/cart?demo=coupon=expired,payment=failure,slow`
 */
export type PaymentScenario =
  | 'success'
  | 'failure'
  | 'pending'
  | 'cod'
  /** Verify hits a capture race, then the status poll confirms. */
  | 'verifySlow'
  /** Verify request dies on the network, then the poll confirms. */
  | 'verifyFlaky'
  /** Status never settles inside the window: the customer must see `pending`. */
  | 'verifyTimeout';
export type CouponScenario = 'valid' | 'invalid' | 'expired';
/** COD states the payment sheet has to be able to show. */
export type CodScenario = 'off' | 'blocked' | 'overcap';

export interface DemoScenarios {
  /** Restaurant reports temporarily closed. */
  closed: boolean;
  /** One dish is out of stock. */
  outOfStock: boolean;
  /** `off` suppresses the automatic offer popup. */
  offer: 'on' | 'off' | null;
  coupon: CouponScenario | null;
  /** `reached` forces free delivery, `not` forces it below the threshold. */
  freeDelivery: 'reached' | 'not' | null;
  address: 'missing' | 'saved' | null;
  payment: PaymentScenario | null;
  /** Pay sheet COD states: switched off, customer blocked, over the COD cap. */
  cod: CodScenario | null;
  /** `off` hides online payment, leaving COD alone (legacy `isUpiEnabled`). */
  upi: 'off' | null;
  /** `/pricing/quote` fails with a retryable network error. */
  quoteError: boolean;
  /** Adds 1.2-1.8 s to every call. */
  slow: boolean;
  /** Start with an empty cart regardless of storage. */
  emptyCart: boolean;
  /** Realistic zone fees, taxes and packaging instead of the zero-fee demo. */
  zoneFees: boolean;
}

export const DEMO_SCENARIOS_KEY = 'navereat_demo_scenarios';

export const EMPTY_SCENARIOS: DemoScenarios = {
  closed: false,
  outOfStock: false,
  offer: null,
  coupon: null,
  freeDelivery: null,
  address: null,
  payment: null,
  cod: null,
  upi: null,
  quoteError: false,
  slow: false,
  emptyCart: false,
  zoneFees: true,
};

const BOOLEAN_FLAGS = ['closed', 'outOfStock', 'quoteError', 'slow', 'emptyCart', 'zoneFees'] as const;

const parseFlag = (raw: string): DemoScenarios => {
  const next: DemoScenarios = { ...EMPTY_SCENARIOS };
  raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const [rawKey, rawValue] = part.split('=');
      const key = rawKey.trim();
      const value = (rawValue ?? '').trim().toLowerCase();
      if ((BOOLEAN_FLAGS as readonly string[]).includes(key)) {
        next[key as (typeof BOOLEAN_FLAGS)[number]] = value === '' || value === '1' || value === 'on' || value === 'true';
        return;
      }
      switch (key) {
        case 'offer':
          next.offer = value === 'off' ? 'off' : value === 'on' ? 'on' : null;
          break;
        case 'coupon':
          next.coupon = value === 'invalid' || value === 'expired' || value === 'valid' ? value : null;
          break;
        case 'freedelivery':
        case 'freeDelivery':
          next.freeDelivery = value === 'reached' ? 'reached' : value === 'not' ? 'not' : null;
          break;
        case 'address':
          next.address = value === 'missing' || value === 'saved' ? value : null;
          break;
        case 'upi':
          next.upi = value === 'off' ? 'off' : null;
          break;
        case 'cod':
          next.cod = value === 'off' || value === 'blocked' || value === 'overcap' ? value : null;
          break;
        case 'payment':
          next.payment =
            value === 'success' ||
            value === 'failure' ||
            value === 'pending' ||
            value === 'cod' ||
            value === 'verifySlow' ||
            value === 'verifyFlaky' ||
            value === 'verifyTimeout'
              ? value
              : null;
          break;
        default:
          break;
      }
    });
  return next;
};

const rawFlag = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    const search = new URLSearchParams(window.location.search).get('demo');
    const hash = window.location.hash;
    const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    const fromHash = new URLSearchParams(query).get('demo');
    return fromHash ?? search ?? '';
  } catch {
    return '';
  }
};

export function readScenarios(): DemoScenarios {
  const flag = rawFlag();
  if (flag !== '') return parseFlag(flag);
  try {
    const stored = localStorage.getItem(DEMO_SCENARIOS_KEY);
    if (stored) return { ...EMPTY_SCENARIOS, ...(JSON.parse(stored) as Partial<DemoScenarios>) };
  } catch {
    /* storage may be unavailable */
  }
  return { ...EMPTY_SCENARIOS };
}

export function writeScenarios(next: Partial<DemoScenarios>): void {
  try {
    localStorage.setItem(DEMO_SCENARIOS_KEY, JSON.stringify({ ...readScenarios(), ...next }));
  } catch {
    /* storage may be unavailable */
  }
}

export function clearScenarios(): void {
  try {
    localStorage.removeItem(DEMO_SCENARIOS_KEY);
  } catch {
    /* storage may be unavailable */
  }
}

/** The hidden panel is only offered when a `?demo=` flag is present. */
export const scenarioPanelEnabled = (): boolean => rawFlag() !== '';
