/**
 * Port of `payment-state.js`: one reader for the backend's real payment
 * outcomes. Pure functions, no storage, no network.
 *
 *   paymentStatus          : paid | pending | failed | cod_pending | refunded
 *   paymentMethod          : upi | cod
 *   partialCodAdvanceAmount: server-computed online advance (INR)
 *   partialCodCashDue      : server-computed cash still due (INR)
 *   partialCodAdvanceStatus: pending | paid | failed
 */
export const norm = (v: unknown): string => String(v == null ? '' : v).trim().toLowerCase();

export function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function money(v: unknown): string {
  const n = numOrNull(v);
  if (n === null) return '';
  const rounded = Math.round(n * 100) / 100;
  return `₹${rounded.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export interface PaymentOrder {
  paymentStatus?: string;
  paymentMethod?: string;
  partialCodAdvanceAmount?: number | string | null;
  partialCodCashDue?: number | string | null;
  partialCodAdvanceStatus?: string;
  refund?: { status?: string; amount?: number | string | null } | null;
  refundStatus?: string;
  refundedAmount?: number | string | null;
  total?: number | string | null;
  amount?: number | string | null;
  finalTotal?: number | string | null;
}

const ADVANCE_STATUSES = ['pending', 'paid', 'failed'];

export interface PartialCod {
  required: boolean;
  advanceAmount: number | null;
  cashDue: number | null;
  status: string;
}

export function partialCod(order: PaymentOrder | null | undefined): PartialCod {
  const o = order || {};
  const advance = numOrNull(o.partialCodAdvanceAmount);
  const cashDue = numOrNull(o.partialCodCashDue);
  const status = norm(o.partialCodAdvanceStatus);
  const required = (advance !== null && advance > 0) || ADVANCE_STATUSES.indexOf(status) > -1;
  return { required, advanceAmount: advance, cashDue, status };
}

export interface RefundState {
  isRefunded: boolean;
  isPartial: boolean;
  amount: number | null;
  total: number | null;
}

export function refundState(order: PaymentOrder | null | undefined): RefundState {
  const o = order || {};
  const r = o.refund && typeof o.refund === 'object' ? o.refund : {};
  const status = norm(r.status || o.refundStatus);
  const amount = numOrNull(r.amount != null ? r.amount : o.refundedAmount != null ? o.refundedAmount : null);
  const total = numOrNull(o.total != null ? o.total : o.amount != null ? o.amount : null);
  let isRefunded = status === 'completed' || status === 'refunded' || norm(o.paymentStatus) === 'refunded';
  let partial = false;
  if (isRefunded && amount !== null && total !== null && amount > 0 && amount < total) {
    partial = true;
  }
  if (!isRefunded && (status === 'partial' || status === 'partially_refunded')) {
    isRefunded = true;
    partial = true;
  }
  return { isRefunded, isPartial: partial, amount, total };
}

export interface PaymentState {
  raw: string;
  method: string;
  isCod: boolean;
  isPaid: boolean;
  isFailed: boolean;
  isPending: boolean;
  isRefunded: boolean;
  isPartialRefund: boolean;
  refundAmount: number | null;
  partialCod: PartialCod;
  paidAmount: number | null;
  cashDue: number | null;
  label: string;
  advanceSettled?: boolean;
  awaitingCash?: boolean;
}

/** The single classification the checkout and payment pages use. */
export function state(order: PaymentOrder | null | undefined): PaymentState {
  const o = order || {};
  const ps = norm(o.paymentStatus);
  const method = norm(o.paymentMethod);
  const pc = partialCod(o);
  const advancePaid = pc.status === 'paid';
  const refund = refundState(o);
  const refunded = refund.isRefunded;

  const out: PaymentState = {
    raw: ps,
    method,
    isCod: method === 'cod',
    isPaid: false,
    isFailed: false,
    isPending: false,
    isRefunded: refunded,
    isPartialRefund: refund.isPartial,
    refundAmount: refund.amount,
    partialCod: pc,
    paidAmount: null,
    cashDue: null,
    label: '',
  };

  if (refunded) {
    out.label = refund.isPartial ? 'Partially refunded' : 'Refunded';
    return out;
  }

  if (method === 'cod') {
    if (pc.required && advancePaid) {
      out.isPaid = true;
      out.advanceSettled = true;
      out.paidAmount = pc.advanceAmount;
      out.cashDue = pc.cashDue;
      out.label = 'Advance paid · cash due on delivery';
      return out;
    }
    if (pc.required && pc.status === 'failed') {
      out.isFailed = true;
      out.label = 'Advance payment failed';
      return out;
    }
    if (pc.required && (pc.status === 'pending' || !pc.status)) {
      out.isPending = true;
      out.label = 'Advance payment pending';
      return out;
    }
    if (ps === 'paid') {
      out.isPaid = true;
      out.label = 'Paid · cash on delivery';
      return out;
    }
    if (ps === 'cod_pending') {
      out.isPending = false;
      out.isPaid = false;
      out.awaitingCash = true;
      out.cashDue = numOrNull(o.total);
      out.label = 'Pay on delivery';
      return out;
    }
    out.awaitingCash = true;
    out.cashDue = numOrNull(o.total);
    out.label = 'Pay on delivery';
    return out;
  }

  if (ps === 'paid') {
    out.isPaid = true;
    out.label = 'Paid';
    return out;
  }
  if (ps === 'failed') {
    out.isFailed = true;
    out.label = 'Payment failed';
    return out;
  }
  out.isPending = true;
  out.label = 'Payment pending';
  return out;
}

/** The backend's authoritative total for a created order, in priority order. */
export const authoritativeTotal = (order: PaymentOrder | null | undefined): number | null => {
  const o = order || {};
  return numOrNull(o.total != null ? o.total : o.amount != null ? o.amount : o.finalTotal != null ? o.finalTotal : null);
};

export const paymentState = { norm, money, numOrNull, partialCod, refundState, state, authoritativeTotal };
