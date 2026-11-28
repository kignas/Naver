/**
 * Port of `ew-freedelivery.js`: turns the backend's `freeDelivery` object into
 * the exact copy the spec requires. Never computes a threshold or a fee.
 */
import { format, formatInt } from './money';

export interface FreeDeliveryInput {
  available?: boolean;
  enabled?: boolean;
  threshold?: number;
  baseThreshold?: number;
  raised?: boolean;
  eligibleSubtotal?: number;
  amountRemaining?: number;
  unlocked?: boolean;
  reachedThreshold?: boolean;
  subsidised?: boolean;
  deliveryFee?: number;
  effectiveDeliveryFee?: number;
  reason?: string;
  firstOrderFreeDelivery?: boolean;
}

export type FreeDeliveryStatus = 'none' | 'unlocked' | 'unavailable' | 'locked' | 'fee';

export interface FreeDeliveryState {
  status: FreeDeliveryStatus;
  text: string;
  deliveryFeeText: string;
  firstOrder?: boolean;
  amountRemaining?: number | null;
}

const num = (v: unknown): number | null => (Number.isFinite(Number(v)) ? Number(v) : null);

const money = (v: unknown): string => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return format(n);
};

const moneyInt = (v: unknown): string => {
  const n = Number(v);
  return Number.isFinite(n) ? formatInt(n) : '';
};

export function state(freeDelivery: FreeDeliveryInput | null | undefined, fallbackFee?: unknown): FreeDeliveryState {
  const fd = freeDelivery && typeof freeDelivery === 'object' ? freeDelivery : null;
  if (!fd) {
    const fb = num(fallbackFee);
    return { status: 'none', text: '', deliveryFeeText: fb !== null ? `${moneyInt(fb)} delivery` : '' };
  }

  const unlocked = fd.unlocked === true || fd.firstOrderFreeDelivery === true;
  const amountRemaining = num(fd.amountRemaining);
  let fee = num(fd.effectiveDeliveryFee);
  if (fee === null) fee = num(fd.deliveryFee);
  if (fee === null) fee = num(fallbackFee);

  if (unlocked) {
    return {
      status: 'unlocked',
      text: 'Free delivery unlocked!',
      firstOrder: fd.firstOrderFreeDelivery === true,
      amountRemaining: 0,
      deliveryFeeText: 'Free delivery',
    };
  }

  if (fd.available === false) {
    return {
      status: 'unavailable',
      text: '',
      amountRemaining: null,
      deliveryFeeText: fee !== null ? `${moneyInt(fee)} delivery` : '',
    };
  }

  if (amountRemaining !== null && amountRemaining > 0) {
    return {
      status: 'locked',
      text: `Add ${moneyInt(amountRemaining)} more to unlock free delivery`,
      amountRemaining,
      deliveryFeeText: fee !== null ? `${moneyInt(fee)} delivery` : '',
    };
  }

  return {
    status: 'fee',
    text: '',
    amountRemaining,
    deliveryFeeText: fee !== null ? `${moneyInt(fee)} delivery` : '',
  };
}

export const text = (freeDelivery: FreeDeliveryInput | null | undefined, fallbackFee?: unknown): string =>
  state(freeDelivery, fallbackFee).text;

/** The single line a card/banner shows: unlock/locked copy, else the fee. */
export const line = (freeDelivery: FreeDeliveryInput | null | undefined, fallbackFee?: unknown): string => {
  const s = state(freeDelivery, fallbackFee);
  if (s.text) return s.text;
  if (s.deliveryFeeText) return s.deliveryFeeText;
  return '';
};

export const isUnlocked = (freeDelivery: FreeDeliveryInput | null | undefined): boolean => {
  const fd = freeDelivery && typeof freeDelivery === 'object' ? freeDelivery : null;
  if (!fd) return false;
  return fd.unlocked === true || fd.firstOrderFreeDelivery === true;
};

export const money$ = money;
