/**
 * Port of `ew-bill.js`: pure mapping from a backend quote (or a stored order
 * bill) to the itemised rows the UI renders. No arithmetic beyond reading.
 */
import { format } from './money';

export interface QuoteBill {
  baseFoodSubtotal?: number;
  foodUplift?: number;
  customerFoodSubtotal?: number;
  discount?: number;
  couponDiscount?: number;
  autoDiscount?: number;
  foodPayable?: number;
  deliveryFee?: number;
  baseDeliveryFee?: number;
  deliverySubsidy?: number;
  smallOrderFee?: number;
  codFee?: number;
  tipAmount?: number;
  taxAmount?: number;
  total?: number;
  grandTotal?: number;
}

export interface QuoteLike {
  bill?: QuoteBill;
  decision?: string;
  message?: string;
  selfDeliveryAvailable?: boolean;
  distance?: { restaurantToCustomerKm?: number };
  contribution?: { promotionFundingSource?: string };
}

export interface StoredBill {
  customerFoodSubtotal?: number;
  itemSubtotal?: number;
  packagingCharge?: number;
  deliveryFee?: number;
  baseDeliveryFee?: number;
  isFreeDeliveryApplied?: boolean;
  deliverySubsidy?: number;
  platformHandlingFee?: number;
  smallCartFee?: number;
  rainSurgeFee?: number;
  codFee?: number;
  discountAmount?: number;
  taxAmount?: number;
  tipAmount?: number;
  grandTotal?: number;
}

export interface BillRow {
  key: string;
  label: string;
  value: number;
  display: string;
  kind: string;
  note: string;
}

const money = (v: unknown): string => {
  const n = Number(v);
  return Number.isFinite(n) ? format(n) : '';
};
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const has = (v: unknown): boolean => v !== null && v !== undefined && v !== '';

/** Itemised rows from a QUOTE. Only non-zero lines are returned, except the
 *  food subtotal and the total, which are always shown. */
export function rowsFromQuote(quote: QuoteLike | null | undefined): BillRow[] {
  const q = quote || {};
  const b = q.bill || {};
  const rows: BillRow[] = [];

  const push = (key: string, label: string, value: unknown, kind?: string, note?: string): void => {
    if (!has(value)) return;
    if (num(value) === 0 && key !== 'foodSubtotal' && key !== 'total') return;
    rows.push({ key, label, value: num(value), display: money(value), kind: kind || '', note: note || '' });
  };

  const couponOn = num(b.couponDiscount) > 0;
  push(
    'foodSubtotal',
    'Item total',
    couponOn && has(b.customerFoodSubtotal)
      ? b.customerFoodSubtotal
      : has(b.foodPayable)
        ? b.foodPayable
        : b.customerFoodSubtotal,
    'food',
    '',
  );

  const funded = q.contribution && q.contribution.promotionFundingSource;
  const fundNote = funded && funded !== 'none' ? `Funded by ${String(funded).replace(/_/g, ' ')}` : '';
  const explained = couponOn && Math.abs(num(b.discount) - num(b.couponDiscount) - num(b.autoDiscount)) < 0.005;
  if (!explained) push('discount', 'Discount', b.discount, 'discount', fundNote);
  if (num(b.couponDiscount) > 0) push('couponDiscount', 'Coupon', b.couponDiscount, 'discount', fundNote);
  if (num(b.autoDiscount) > 0) push('autoDiscount', 'Offer discount', b.autoDiscount, 'discount', fundNote);

  const km = q.distance && Number(q.distance.restaurantToCustomerKm);
  const kmText = Number.isFinite(km) && Number(km) > 0 ? ` | ${Number(km).toFixed(1)} kms` : '';
  push(
    'deliveryFee',
    `${num(b.deliverySubsidy) > 0 ? 'Delivery (free)' : 'Delivery fee'}${kmText}`,
    num(b.deliverySubsidy) > 0 ? 0 : b.deliveryFee,
    'delivery',
    num(b.deliverySubsidy) > 0 ? `You save ${money(b.deliverySubsidy)}` : '',
  );
  push(
    'smallOrderFee',
    'Small order fee',
    b.smallOrderFee,
    'fee',
    num(b.smallOrderFee) > 0 ? 'Helps keep smaller baskets serviceable' : '',
  );
  push('codFee', 'COD handling fee', b.codFee, 'fee');
  push('taxes', 'Taxes', b.taxAmount, 'tax');
  push('tip', 'Delivery partner tip', b.tipAmount, 'tip');
  push('total', 'To pay', has(b.grandTotal) ? b.grandTotal : b.total, 'total');
  return rows;
}

/** Itemised rows from a STORED order bill. Never recomputed. */
export function rowsFromStoredBill(order: (Record<string, unknown> & { bill?: StoredBill }) | null | undefined): BillRow[] {
  const o = order || {};
  const b = o.bill && typeof o.bill === 'object' ? o.bill : null;
  if (!b) {
    const legacy: BillRow[] = [];
    if (has(o.subtotal))
      legacy.push({ key: 'foodSubtotal', label: 'Item total', value: num(o.subtotal), display: money(o.subtotal), kind: 'food', note: '' });
    if (has(o.deliveryFee))
      legacy.push({ key: 'deliveryFee', label: 'Delivery fee', value: num(o.deliveryFee), display: money(o.deliveryFee), kind: 'delivery', note: '' });
    if (has(o.discount) && num(o.discount) > 0)
      legacy.push({ key: 'discount', label: 'Discount', value: num(o.discount), display: money(o.discount), kind: 'discount', note: '' });
    const tot = has(o.grandTotal) ? o.grandTotal : o.total;
    if (has(tot)) legacy.push({ key: 'total', label: 'Total', value: num(tot), display: money(tot), kind: 'total', note: '' });
    return legacy;
  }

  const rows: BillRow[] = [];
  const push = (key: string, label: string, value: unknown, kind?: string, note?: string): void => {
    if (!has(value) || num(value) === 0) return;
    rows.push({ key, label, value: num(value), display: money(value), kind: kind || '', note: note || '' });
  };
  const food = has(b.customerFoodSubtotal) && num(b.customerFoodSubtotal) > 0 ? b.customerFoodSubtotal : b.itemSubtotal;
  push('foodSubtotal', 'Item total', food, 'food', '');
  push('packagingCharge', 'Packaging', b.packagingCharge, 'fee');
  if (b.isFreeDeliveryApplied === true || num(b.deliverySubsidy) > 0) {
    rows.push({
      key: 'deliveryFee',
      label: 'Delivery',
      value: 0,
      display: 'FREE',
      kind: 'delivery',
      note: num(b.deliverySubsidy) > 0 ? `You save ${money(b.deliverySubsidy)}` : '',
    });
  } else {
    push('deliveryFee', 'Delivery fee', b.deliveryFee, 'delivery');
  }
  push('platformHandlingFee', 'Platform fee', b.platformHandlingFee, 'fee');
  push('smallCartFee', 'Small order fee', b.smallCartFee, 'fee', num(b.smallCartFee) > 0 ? 'Helps keep smaller baskets serviceable' : '');
  push('rainSurgeFee', 'Rain surge fee', b.rainSurgeFee, 'fee');
  push('codFee', 'COD handling fee', b.codFee, 'fee');
  push('discountAmount', 'Discount', b.discountAmount, 'discount');
  push('taxAmount', 'Taxes', b.taxAmount, 'tax');
  push('tipAmount', 'Delivery partner tip', b.tipAmount, 'tip');
  const total = has(b.grandTotal) && num(b.grandTotal) > 0 ? b.grandTotal : has(o.grandTotal) ? o.grandTotal : o.total;
  if (has(total)) rows.push({ key: 'total', label: 'Total', value: num(total), display: money(total), kind: 'total', note: '' });
  return rows;
}

export interface Decision {
  code: string;
  blocksCheckout: boolean;
  offerSelfDelivery: boolean;
  title: string;
  message: string;
}

/** The backend's three-way decision, expressed for the UI. */
export function decision(quote: QuoteLike | null | undefined): Decision {
  const q = quote || {};
  const code = String(q.decision || 'PROFITABLE');
  if (code === 'NOT_ECONOMICALLY_SERVICEABLE') {
    return {
      code,
      blocksCheckout: true,
      offerSelfDelivery: q.selfDeliveryAvailable === true,
      title: 'Delivery unavailable',
      message:
        q.message ||
        'This delivery is not available right now. Please try a closer restaurant or a larger order.',
    };
  }
  if (code === 'REPRICING_REQUIRED') {
    return {
      code,
      blocksCheckout: false,
      offerSelfDelivery: false,
      title: 'Price updated',
      message: 'Your bill has been updated. Please review the new total before paying.',
    };
  }
  return { code: 'PROFITABLE', blocksCheckout: false, offerSelfDelivery: false, title: '', message: '' };
}

export interface BillChange {
  key: string;
  label: string;
  from: number;
  to: number;
  display: string;
  fromDisplay?: string;
}

/** Compare two quote bills and return what materially changed. */
export function diffBills(prev: QuoteLike | null | undefined, next: QuoteLike | null | undefined): BillChange[] {
  const a = rowsFromQuote(prev);
  const b = rowsFromQuote(next);
  const mapA = new Map(a.map((row) => [row.key, row]));
  const changes: BillChange[] = [];
  b.forEach((row) => {
    const old = mapA.get(row.key);
    if (!old) {
      if (num(row.value) !== 0) changes.push({ key: row.key, label: row.label, from: 0, to: num(row.value), display: row.display });
      return;
    }
    if (Math.abs(num(old.value) - num(row.value)) > 0.004) {
      changes.push({ key: row.key, label: row.label, from: num(old.value), to: num(row.value), display: row.display, fromDisplay: old.display });
    }
  });
  return changes;
}

export const money$ = money;
