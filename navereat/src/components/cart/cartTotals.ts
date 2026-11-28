import { createContext, useContext } from 'react';
import type { DemoOffer, Restaurant } from '../../data/demo';
import type { Bill, Cart, CartLine } from '../../lib/cart';
import type { PaymentSettings, PaymentState } from '../../logic/paymentOptions';

export interface CartGroup {
  resId: number;
  name: string;
  lines: Array<{ name: string; line: CartLine }>;
  units: number;
  subtotal: number;
}

/** What the payment selector needs to render, derived once per cart state. */
export interface CartPaymentOptions {
  settings: PaymentSettings;
  cod: PaymentState;
  upi: PaymentState;
  /** More than one eligible method: the pay sheet opens instead of ordering. */
  choice: boolean;
  method: 'upi' | 'cod';
  ctaLabel: string;
  payNote: string;
  block: { label: string; sub: string } | null;
}

export interface CartTotals {
  cart: Cart;
  groups: CartGroup[];
  subtotal: number;
  offers: DemoOffer[];
  bill: Bill;
  savings: number;
  totalSavings: number;
  freeDelivery: boolean;
  restaurant: Restaurant | undefined;
  paymentOptions: CartPaymentOptions;
}

export const CartTotalsContext = createContext<CartTotals | null>(null);

export function useCartTotals(): CartTotals {
  const value = useContext(CartTotalsContext);
  if (!value) throw new Error('useCartTotals must be used inside CartTotalsProvider');
  return value;
}
