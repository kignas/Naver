/**
 * Demo pricing engine.
 *
 * This is the only place money is computed in the demo. The demo
 * `POST /pricing/quote` handler calls `computeQuote`, and the cart renders
 * the returned bill through the same `rowsFromQuote` mapping the legacy page
 * used — so replacing the demo handler with the real endpoint changes no UI
 * code and no maths.
 *
 * Money is carried as integer paise internally and converted once at the
 * boundary, mirroring the backend's `toPaise` / `fromPaise` contract.
 */
export interface Band {
  /** Inclusive upper bound in km. */
  maxKm: number;
  fee: number;
}

export interface MinOrderBand {
  maxKm: number;
  min: number;
}

export interface FreeDeliveryBand {
  maxKm: number;
  threshold: number;
}

export interface PricingPolicy {
  deliveryFeeBands: Band[];
  distanceFeePerKm: number | null;
  minimumOrderByDistance: MinOrderBand[];
  freeDeliveryThresholdByDistance: FreeDeliveryBand[];
  smallOrderFeeEnabled: boolean;
  smallOrderFee: number;
  taxPercent: number;
  packagingPerItem: number;
  platformFee: number;
  codFee: number;
  codMaxOrderAmount: number;
  firstOrderFreeDelivery: boolean;
  rainSurgeFee: number;
}

export interface BasketLine {
  menuItem: string | number;
  name?: string;
  price: number;
  quantity: number;
}

export interface QuoteInput {
  restaurantId: string;
  restaurantName?: string;
  addressId?: string | null;
  distanceKm: number;
  items: BasketLine[];
  paymentMethod: 'upi' | 'cod';
  couponCode?: string | null;
  /** Rupee discount the coupon is worth before the engine's funding test. */
  couponValue?: number;
  couponMinSubtotal?: number;
  tipAmount?: number;
  isFirstOrder?: boolean;
  rainSurge?: boolean;
  now?: number;
}

export interface FreeDeliveryQuote {
  available: boolean;
  enabled: boolean;
  threshold: number;
  baseThreshold: number;
  raised: boolean;
  eligibleSubtotal: number;
  amountRemaining: number;
  unlocked: boolean;
  reachedThreshold: boolean;
  subsidised: boolean;
  deliveryFee: number;
  effectiveDeliveryFee: number;
  reason: string;
  firstOrderFreeDelivery?: boolean;
}

export interface BillQuote {
  baseFoodSubtotal: number;
  foodUplift: number;
  customerFoodSubtotal: number;
  discount: number;
  couponDiscount: number;
  autoDiscount: number;
  foodPayable: number;
  deliveryFee: number;
  baseDeliveryFee: number;
  deliverySubsidy: number;
  smallOrderFee: number;
  codFee: number;
  tipAmount: number;
  taxAmount: number;
  total: number;
  grandTotal: number;
}

export interface Quote {
  success: true;
  serviceable: boolean;
  decision: 'PROFITABLE' | 'REPRICING_REQUIRED' | 'NOT_ECONOMICALLY_SERVICEABLE';
  reason: string;
  selfDeliveryAvailable: boolean;
  distance: { restaurantToCustomerKm: number };
  bill: BillQuote;
  freeDelivery: FreeDeliveryQuote;
  discount: number;
  contribution: { promotionFundingSource: string };
  quoteId: string;
  quoteIssuedAt: string;
  quoteExpiresAt: string;
  isFirstOrder: boolean;
  isCod: boolean;
  paymentMethod: 'upi' | 'cod';
  minimumOrder: number;
  couponApplied: boolean;
  couponRejectedCode?: string;
}

const toPaise = (rupees: number): number => Math.round((Number(rupees) || 0) * 100);
const fromPaise = (paise: number): number => Math.round(paise) / 100;

const bandFor = <T extends { maxKm: number }>(bands: T[], km: number): T | null => {
  const sorted = [...bands].sort((a, b) => a.maxKm - b.maxKm);
  for (const band of sorted) if (km <= band.maxKm) return band;
  return sorted.length ? sorted[sorted.length - 1] : null;
};

export const deliveryFeeFor = (policy: PricingPolicy, km: number): number => {
  if (policy.distanceFeePerKm !== null) return Math.max(0, Math.round(km * policy.distanceFeePerKm));
  return bandFor(policy.deliveryFeeBands, km)?.fee ?? 0;
};

export const minimumOrderFor = (policy: PricingPolicy, km: number): number =>
  bandFor(policy.minimumOrderByDistance, km)?.min ?? 0;

export const freeDeliveryThresholdFor = (policy: PricingPolicy, km: number): number =>
  bandFor(policy.freeDeliveryThresholdByDistance, km)?.threshold ?? 0;

export const QUOTE_TTL_MS = 10 * 60 * 1000;

/** The single quote calculation shared by the demo adapter and the tests. */
export function computeQuote(policy: PricingPolicy, input: QuoteInput): Quote {
  const now = input.now ?? Date.now();
  const km = Math.max(0, Number(input.distanceKm) || 0);

  const lines = (input.items || []).filter((line) => Number(line.quantity) > 0 && Number(line.price) >= 0);
  const units = lines.reduce((sum, line) => sum + Math.max(0, Math.round(Number(line.quantity))), 0);

  const foodPaise = lines.reduce(
    (sum, line) => sum + toPaise(line.price) * Math.max(0, Math.round(Number(line.quantity))),
    0,
  );
  const baseDeliveryPaise = toPaise(deliveryFeeFor(policy, km));
  const minimumOrder = minimumOrderFor(policy, km);
  const threshold = freeDeliveryThresholdFor(policy, km);

  /* Coupon economics: the engine only funds a coupon it can pay for out of the
     delivery subsidy budget or the platform fee; otherwise it rejects it, which
     is what the real backend does with COUPON_NOT_ECONOMICALLY_SERVICEABLE. */
  const couponRequested = Boolean(input.couponCode);
  const couponValuePaise = Math.max(0, toPaise(Number(input.couponValue) || 0));
  const couponMinPaise = toPaise(Number(input.couponMinSubtotal) || 0);
  const couponFits = couponRequested && foodPaise >= couponMinPaise && couponValuePaise > 0;
  const fundingBudget = baseDeliveryPaise + toPaise(policy.platformFee);
  const couponFundable = couponFits && (couponValuePaise <= fundingBudget || foodPaise >= toPaise(1000));
  const couponPaise = couponFundable ? Math.min(couponValuePaise, foodPaise) : 0;

  const firstOrder = input.isFirstOrder === true && policy.firstOrderFreeDelivery;
  const reachedThreshold = threshold > 0 && foodPaise >= toPaise(threshold);
  const unlocked = firstOrder || reachedThreshold;
  const deliverySubsidyPaise = unlocked ? baseDeliveryPaise : 0;
  const effectiveDeliveryPaise = Math.max(0, baseDeliveryPaise - deliverySubsidyPaise);
  const amountRemaining = unlocked ? 0 : Math.max(0, threshold - fromPaise(foodPaise));

  const smallOrderPaise =
    policy.smallOrderFeeEnabled && foodPaise > 0 && foodPaise < toPaise(minimumOrder) ? toPaise(policy.smallOrderFee) : 0;
  const codPaise = input.paymentMethod === 'cod' ? toPaise(policy.codFee) : 0;
  const rainPaise = input.rainSurge === true ? toPaise(policy.rainSurgeFee) : 0;
  const platformPaise = toPaise(policy.platformFee);
  const packagingPaise = toPaise(policy.packagingPerItem) * units;

  const foodPayablePaise = Math.max(0, foodPaise - couponPaise);
  const taxablePaise = foodPayablePaise + packagingPaise;
  const taxPaise = Math.round((taxablePaise * policy.taxPercent) / 100);

  const tipPaise = Math.max(0, toPaise(Number(input.tipAmount) || 0));

  const totalBeforeTipPaise =
    foodPayablePaise +
    effectiveDeliveryPaise +
    smallOrderPaise +
    codPaise +
    rainPaise +
    platformPaise +
    packagingPaise +
    taxPaise;

  const grandPaise = totalBeforeTipPaise + tipPaise;

  const serviceable = units > 0 && foodPaise >= toPaise(minimumOrder);

  const quote: Quote = {
    success: true,
    serviceable,
    decision: serviceable ? 'PROFITABLE' : 'NOT_ECONOMICALLY_SERVICEABLE',
    reason: serviceable ? '' : 'BELOW_MINIMUM_ORDER',
    selfDeliveryAvailable: false,
    distance: { restaurantToCustomerKm: km },
    bill: {
      baseFoodSubtotal: fromPaise(foodPaise),
      foodUplift: 0,
      customerFoodSubtotal: fromPaise(foodPaise),
      discount: fromPaise(couponPaise),
      couponDiscount: fromPaise(couponPaise),
      autoDiscount: 0,
      foodPayable: fromPaise(foodPayablePaise),
      deliveryFee: fromPaise(effectiveDeliveryPaise),
      baseDeliveryFee: fromPaise(baseDeliveryPaise),
      deliverySubsidy: fromPaise(deliverySubsidyPaise),
      smallOrderFee: fromPaise(smallOrderPaise),
      codFee: fromPaise(codPaise),
      tipAmount: fromPaise(tipPaise),
      taxAmount: fromPaise(taxPaise),
      total: fromPaise(totalBeforeTipPaise),
      grandTotal: fromPaise(grandPaise),
    },
    freeDelivery: {
      available: baseDeliveryPaise > 0,
      enabled: baseDeliveryPaise > 0,
      threshold,
      baseThreshold: threshold,
      raised: false,
      eligibleSubtotal: fromPaise(foodPaise),
      amountRemaining,
      unlocked,
      reachedThreshold,
      subsidised: deliverySubsidyPaise > 0,
      deliveryFee: fromPaise(baseDeliveryPaise),
      effectiveDeliveryFee: fromPaise(effectiveDeliveryPaise),
      reason: unlocked ? (firstOrder ? 'FIRST_ORDER' : 'THRESHOLD_MET') : baseDeliveryPaise > 0 ? 'BELOW_THRESHOLD' : 'FREE',
      ...(firstOrder ? { firstOrderFreeDelivery: true } : {}),
    },
    discount: fromPaise(couponPaise),
    contribution: { promotionFundingSource: couponPaise > 0 ? 'platform' : 'none' },
    quoteId: `q_${Math.floor(now / 1000).toString(36)}_${Math.abs(hash(JSON.stringify(input.items) + input.restaurantId)).toString(36)}`,
    quoteIssuedAt: new Date(now).toISOString(),
    quoteExpiresAt: new Date(now + QUOTE_TTL_MS).toISOString(),
    isFirstOrder: input.isFirstOrder === true,
    isCod: input.paymentMethod === 'cod',
    paymentMethod: input.paymentMethod,
    minimumOrder,
    couponApplied: couponPaise > 0,
    ...(couponRequested && !couponPaise ? { couponRejectedCode: 'COUPON_NOT_ECONOMICALLY_SERVICEABLE' } : {}),
  };

  return quote;
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export const pricingEngine = { computeQuote, deliveryFeeFor, minimumOrderFor, freeDeliveryThresholdFor, QUOTE_TTL_MS };
