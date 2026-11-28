import { describe, expect, it } from 'vitest';
import {
  codState,
  ctaBlock,
  ctaLabel,
  hasChoice,
  revalidateBeforeOrder,
  upiState,
  type PaymentContext,
  type PaymentSettings,
} from '../src/logic/paymentOptions';
import { oracle } from './helpers/oracles';

interface CtX {
  codState: () => { ok: boolean; note: string };
  upiState: () => { ok: boolean; note: string };
  hasChoice: () => boolean;
  ctaLabel: () => string;
  getPaymentMethod: () => 'upi' | 'cod';
  ctaBlock: () => { label: string; sub: string } | null;
  revalidateBeforeOrder: () => string | null;
  resetMethod: () => void;
  refreshPayment: (restaurantCodEnabled?: boolean) => void;
  storedMethod: () => 'upi' | 'cod';
  setBackendPayment: (payment: unknown) => void;
}

const globals = globalThis as unknown as Record<string, unknown>;

const store = (() => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => (data.has(key) ? (data.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
  };
})();

/** Points the legacy module at the same platform settings the port is given. */
function loadLegacy(
  settings: PaymentSettings & Record<string, unknown>,
  context: PaymentContext,
  stored: 'upi' | 'cod',
): CtX {
  globals.localStorage = store;
  globals.EWPlatform = { current: () => settings, onChange: () => undefined };
  // `pricing()` builds its total from ctState: subtotal + 29 delivery + 0 tax.
  globals.ctState = {
    subtotal: Math.max(0, context.total - 29),
    deliveryFee: 29,
    tipAmount: 0,
    units: 2,
    couponDiscount: 0,
    unavailable: false,
    deliveryReady: true,
  };
  globals.ctProfile = { isFirstOrder: false };
  globals.ctCartGroups = () => Array.from({ length: Math.max(1, context.groups) }, () => ({}));
  const ctx = oracle<CtX>('cart-checkout-upgrades', 'CtX');
  store.clear();
  store.setItem('nearbite_payment_method', stored);
  ctx.resetMethod();
  store.setItem('nearbite_payment_method', stored);
  ctx.setBackendPayment(context.backend ?? null);
  if (context.restaurantCod === false) ctx.refreshPayment(false);
  if (context.restaurantCod === true) ctx.refreshPayment(true);
  return ctx;
}

const settings = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  isCodEnabled: true,
  isUpiEnabled: true,
  isCodBlocked: false,
  maxCodOrderAmount: 1000,
  isUnderMaintenance: false,
  isDeliveryPausedShortage: false,
  taxPercent: 0,
  ...overrides,
});

const context = (overrides: Partial<PaymentContext> = {}): PaymentContext => ({
  total: 300,
  groups: 1,
  restaurantCod: null,
  backend: null,
  ...overrides,
});

describe('payment eligibility matches the legacy checkout', () => {
  const cases: Array<[string, Record<string, unknown>, Partial<PaymentContext>]> = [
    ['both methods available', settings(), {}],
    ['COD switched off by the platform', settings({ isCodEnabled: false }), {}],
    ['UPI switched off, COD available', settings({ isUpiEnabled: false }), {}],
    ['customer blocked from COD', settings({ isCodBlocked: true }), {}],
    ['cart over the COD cap', settings(), { total: 1500 }],
    ['custom COD cap', settings({ maxCodOrderAmount: 500 }), { total: 600 }],
    ['multi-restaurant cart', settings(), { groups: 2 }],
    ['restaurant refuses COD', settings(), { restaurantCod: false }],
    [
      'backend says COD is fine',
      settings({ isCodEnabled: false }),
      { backend: { cod: { ok: true } } },
    ],
    ['backend says COD is off', settings(), { backend: { cod: { ok: false, code: 'COD_PLATFORM_OFF' } } }],
    [
      'backend blocks the customer',
      settings(),
      { backend: { cod: { ok: false, code: 'COD_CUSTOMER_BLOCKED' } } },
    ],
    [
      'backend reports a multi-restaurant cart',
      settings(),
      { backend: { cod: { ok: false, code: 'COD_MULTI_RESTAURANT' } } },
    ],
    ['backend reports the cap', settings(), { backend: { cod: { ok: false, code: 'COD_OVER_CAP' } } }],
    [
      'backend reports an unknown code',
      settings(),
      { backend: { cod: { ok: false, code: 'SOMETHING_ELSE' } } },
    ],
  ];

  for (const [name, raw, ctxOverrides] of cases) {
    it(name, () => {
      const ctx = context(ctxOverrides);
      const legacy = loadLegacy(raw, ctx, 'upi');
      const typed = raw as PaymentSettings;

      expect(codState(typed, ctx)).toEqual(legacy.codState());
      expect(upiState(typed)).toEqual(legacy.upiState());
      expect(hasChoice(typed, ctx)).toBe(legacy.hasChoice());
      // `ctaLabel()` reads the method after eligibility is applied, so compare
      // with the method the legacy selector actually settles on.
      const legacyLabel = legacy.ctaLabel();
      expect(ctaLabel(legacy.hasChoice(), legacy.getPaymentMethod())).toBe(legacyLabel);
    });
  }

  it('blocks the CTA for maintenance and rider shortage', () => {
    for (const raw of [
      settings({ isUnderMaintenance: true }),
      settings({ isDeliveryPausedShortage: true }),
      settings(),
    ]) {
      const ctx = context();
      const legacy = loadLegacy(raw, ctx, 'upi');
      expect(ctaBlock(raw as PaymentSettings)).toEqual(legacy.ctaBlock());
    }
  });

  it('revalidates a stale COD choice exactly like the legacy pre-order check', () => {
    for (const raw of [
      settings({ isCodEnabled: false }),
      settings({ isUpiEnabled: false }),
      settings({ isCodBlocked: true }),
      settings({ isDeliveryPausedShortage: true }),
      settings({ isUnderMaintenance: true, maintenanceMessage: 'Back at 9 pm' }),
    ]) {
      for (const stored of ['cod', 'upi'] as const) {
        const ctx = context();
        const legacy = loadLegacy(raw, ctx, stored);
        const message = legacy.revalidateBeforeOrder();
        const typed = revalidateBeforeOrder(raw as PaymentSettings, stored, ctx);
        expect({ message, method: legacy.storedMethod() }).toEqual({
          message: typed.message,
          method: typed.method,
        });
      }
    }
  });
});
