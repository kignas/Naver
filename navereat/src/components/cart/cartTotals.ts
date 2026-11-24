import { createContext, useContext } from 'react';
import type { DemoOffer, Restaurant } from '../../data/demo';
import type { Bill, Cart, CartLine } from '../../lib/cart';

export interface CartGroup {
  resId: number;
  name: string;
  lines: Array<{ name: string; line: CartLine }>;
  units: number;
  subtotal: number;
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
}

export const CartTotalsContext = createContext<CartTotals | null>(null);

export function useCartTotals(): CartTotals {
  const value = useContext(CartTotalsContext);
  if (!value) throw new Error('useCartTotals must be used inside CartTotalsProvider');
  return value;
}
