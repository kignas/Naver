import { formatMoney } from '../lib/money';

/**
 * Port of the payment selector rules in `js/cart-checkout-upgrades.js`
 * (`codState`, `upiState`, `codVisible`, `paintPayNote`, `ctaLabel`,
 * `ctaBlock`, `revalidateBeforeOrder`). The platform settings come from
 * `GET /platform/status`; the backend verdict rides on every quote as
 * `data.payment`.
 */
export interface PaymentSettings {
  isCodEnabled?: boolean;
  isUpiEnabled?: boolean;
  isCodBlocked?: boolean;
  maxCodOrderAmount?: number;
  isUnderMaintenance?: boolean;
  maintenanceMessage?: string;
  isDeliveryPausedShortage?: boolean;
}

export interface PaymentVerdict {
  ok: boolean;
  code?: string;
}

export interface BackendPayment {
  cod?: PaymentVerdict | null;
  upi?: PaymentVerdict | null;
}

export interface PaymentState {
  ok: boolean;
  note: string;
}

export interface PaymentContext {
  /** Amount the customer would pay now; the COD cap is checked against it. */
  total: number;
  /** Restaurant groups in the cart. The legacy checkout only supports one. */
  groups: number;
  /** The restaurant's own COD switch, `null` until the delivery check answers. */
  restaurantCod?: boolean | null;
  /** `data.payment` from the latest quote. */
  backend?: BackendPayment | null;
}

const COD_DEFAULT_MAX = 1000;

/** Both methods on, COD capped at the legacy ₹1000 default, nothing blocked. */
export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  isCodEnabled: true,
  isUpiEnabled: true,
  isCodBlocked: false,
  maxCodOrderAmount: COD_DEFAULT_MAX,
  isUnderMaintenance: false,
  isDeliveryPausedShortage: false,
};

const money = (value: number): string => formatMoney(value);

export function codState(settings: PaymentSettings, context: PaymentContext): PaymentState {
  const backendCod = context.backend?.cod ?? null;
  if (backendCod) {
    if (backendCod.ok === true) return { ok: true, note: 'Pay Cash or UPI at Doorstep' };
    switch (backendCod.code) {
      case 'COD_PLATFORM_OFF':
        return { ok: false, note: 'Unavailable' };
      case 'COD_CUSTOMER_BLOCKED':
        return { ok: false, note: 'Please use UPI for this order' };
      case 'COD_MULTI_RESTAURANT':
        return { ok: false, note: 'Single-restaurant orders only' };
      case 'COD_OVER_CAP':
        return { ok: false, note: `Available for orders up to ${money(maxCod(settings))}` };
      default:
        return { ok: false, note: 'Not available for this restaurant' };
    }
  }
  const max = maxCod(settings);
  if (settings.isCodEnabled !== true) return { ok: false, note: 'Unavailable' };
  if (settings.isCodBlocked === true) return { ok: false, note: 'Please use UPI for this order' };
  if (context.groups > 1) return { ok: false, note: 'Single-restaurant orders only' };
  if (context.restaurantCod === false) return { ok: false, note: 'Not available for this restaurant' };
  if (context.total > max) return { ok: false, note: `Available for orders up to ${money(max)}` };
  return { ok: true, note: 'Pay Cash or UPI at Doorstep' };
}

export function upiState(settings: PaymentSettings): PaymentState {
  return settings.isUpiEnabled === false
    ? { ok: false, note: 'Unavailable' }
    : { ok: true, note: 'Instant & Contactless' };
}

/** COD is offered by the platform, or by the backend's own gate check. */
export function codVisible(settings: PaymentSettings, backend?: BackendPayment | null): boolean {
  const backendCod = backend?.cod ?? null;
  if (backendCod) {
    return backendCod.ok === true || (backendCod.code !== 'COD_PLATFORM_OFF' && settings.isCodEnabled === true);
  }
  return settings.isCodEnabled === true;
}

/** Both methods stay available even when one is ineligible, so the sheet is never empty. */
export function visibleMethods(
  settings: PaymentSettings,
  backend?: BackendPayment | null,
): Array<'upi' | 'cod'> {
  const showCod = codVisible(settings, backend);
  const showUpi = settings.isUpiEnabled !== false || !showCod;
  return [...(showUpi ? (['upi'] as const) : []), ...(showCod ? (['cod'] as const) : [])];
}

export function hasChoice(settings: PaymentSettings, context: PaymentContext): boolean {
  const methods = visibleMethods(settings, context.backend);
  if (methods.length <= 1) return false;
  return methods.filter((method) => methodState(method, settings, context).ok).length > 1;
}

export function methodState(
  method: 'upi' | 'cod',
  settings: PaymentSettings,
  context: PaymentContext,
): PaymentState {
  return method === 'cod' ? codState(settings, context) : upiState(settings);
}

/** The effective method after eligibility is applied, exactly as `getPaymentMethod()`. */
export function effectiveMethod(
  preferred: 'upi' | 'cod',
  settings: PaymentSettings,
  context: PaymentContext,
): 'upi' | 'cod' {
  if (preferred === 'cod' && !codState(settings, context).ok) return 'upi';
  if (preferred === 'upi' && !upiState(settings).ok && codState(settings, context).ok) return 'cod';
  return preferred;
}

export function payNoteText(choice: boolean, method: 'upi' | 'cod'): string {
  if (choice) return 'Pay with UPI or Cash on Delivery';
  return method === 'cod'
    ? 'Cash on Delivery · keep the exact amount ready'
    : 'Secure UPI payment · GPay, PhonePe & more';
}

export function ctaLabel(choice: boolean, method: 'upi' | 'cod'): string {
  return !choice && method === 'cod' ? 'Place Order (COD)' : 'Proceed to Pay';
}

export function ctaBlock(settings: PaymentSettings): { label: string; sub: string } | null {
  if (settings.isUnderMaintenance === true) {
    return { label: 'Under Maintenance', sub: 'Ordering is paused for now' };
  }
  if (settings.isDeliveryPausedShortage === true) {
    return { label: 'Temporarily Unavailable — Rider Shortage', sub: 'Ordering will resume shortly' };
  }
  return null;
}

/**
 * The last gate before `POST /orders`. Returns the message the customer must
 * see, or `null` when the order may be attempted; also reports the method the
 * caller has to persist because the stored one is no longer eligible.
 */
export function revalidateBeforeOrder(
  settings: PaymentSettings,
  stored: 'upi' | 'cod',
  context: PaymentContext,
): { message: string | null; method: 'upi' | 'cod' } {
  if (settings.isUnderMaintenance === true) {
    return {
      message: settings.maintenanceMessage || 'Ordering is paused for maintenance. Please try again shortly.',
      method: stored,
    };
  }
  if (settings.isDeliveryPausedShortage === true) {
    return {
      message: 'High demand: Delivery partners are currently busy. Ordering will resume shortly.',
      method: stored,
    };
  }
  if (stored === 'cod' && !codState(settings, context).ok) {
    if (!upiState(settings).ok) {
      return {
        message:
          'Cash on delivery is unavailable for this order and online payment is currently disabled. Please try again later.',
        method: 'upi',
      };
    }
    return {
      message: 'Cash on delivery is no longer available for this order. Please pay online to continue.',
      method: 'upi',
    };
  }
  if (stored === 'upi' && !upiState(settings).ok) {
    if (codState(settings, context).ok) return { message: null, method: 'cod' };
    return { message: 'Online payment is currently unavailable. Please try again later.', method: 'upi' };
  }
  return { message: null, method: stored };
}

function maxCod(settings: PaymentSettings): number {
  const configured = Number(settings.maxCodOrderAmount);
  return Number.isFinite(configured) && configured > 0 ? configured : COD_DEFAULT_MAX;
}
