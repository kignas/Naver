import { useMemo, type ReactNode } from 'react';
import { api } from '../../api/restaurantApi';
import type { Restaurant } from '../../data/demo';
import { useAppStore } from '../../store/appStore';
import { cartLineOriginalPrice } from './cartPricing';
import {
  codState,
  ctaBlock,
  ctaLabel,
  effectiveMethod,
  hasChoice,
  payNoteText,
  upiState,
  type PaymentContext,
  type PaymentSettings,
} from '../../logic/paymentOptions';
import { CartTotalsContext, type CartGroup, type CartTotals } from './cartTotals';

interface CartTotalsProviderProps {
  restaurant: Restaurant | undefined;
  offerMode: string | null;
  unavailable: boolean;
  freeAbove: number;
  /** Tip and method the bill is priced with, the same fields the quote payload carries. */
  tip: number;
  payment: 'upi' | 'cod';
  /** `GET /platform/status` switches that gate COD and block the CTA. */
  platform: PaymentSettings;
  children: ReactNode;
}

/**
 * Subscribes to the cart so the page shell does not: a quantity tap re-renders
 * this provider and the sections that read it, and React reuses the children
 * elements the shell created, so the static page stays untouched.
 */
export function CartTotalsProvider({
  restaurant,
  offerMode,
  unavailable,
  freeAbove,
  tip,
  payment,
  platform,
  children,
}: CartTotalsProviderProps) {
  const cart = useAppStore((state) => state.cart);
  const coupon = useAppStore((state) => state.coupon);

  const groups = useMemo<CartGroup[]>(() => {
    const map = new Map<number, CartGroup>();
    Object.entries(cart).forEach(([name, line]) => {
      const group = map.get(line.resId) ?? {
        resId: line.resId,
        name: line.resName ?? api.restaurantSync(line.resId)?.name ?? 'Restaurant',
        lines: [],
        units: 0,
        subtotal: 0,
      };
      group.lines.push({ name, line });
      group.units += line.quantity;
      group.subtotal += line.price * line.quantity;
      map.set(line.resId, group);
    });
    return [...map.values()];
  }, [cart]);

  const subtotal = groups[0]?.subtotal ?? 0;
  const offers = useMemo(() => (offerMode === 'none' ? [] : api.offersSync(subtotal)), [offerMode, subtotal]);
  const bill = useMemo(
    () => api.previewBill(cart, coupon, { tip, paymentMethod: payment }),
    [cart, coupon, tip, payment],
  );
  const savings = useMemo(
    () =>
      Object.values(cart).reduce(
        (sum, line) => sum + Math.max(0, cartLineOriginalPrice(restaurant, line) - line.price) * line.quantity,
        0,
      ),
    [cart, restaurant],
  );
  const totalSavings = savings + bill.offerDiscount;
  const freeDelivery = !unavailable && subtotal >= freeAbove;

  const paymentOptions = useMemo(() => {
    const context: PaymentContext = {
      total: bill.grandTotal || bill.total + bill.tip,
      groups: groups.length,
      restaurantCod: null,
      backend: null,
    };
    const choice = hasChoice(platform, context);
    const method = effectiveMethod(payment, platform, context);
    return {
      settings: platform,
      cod: codState(platform, context),
      upi: upiState(platform),
      choice,
      method,
      ctaLabel: ctaLabel(choice, method),
      payNote: payNoteText(choice, method),
      block: ctaBlock(platform),
    };
  }, [bill.grandTotal, bill.tip, bill.total, groups.length, payment, platform]);

  const value = useMemo<CartTotals>(
    () => ({
      cart,
      groups,
      subtotal,
      offers,
      bill,
      savings,
      totalSavings,
      freeDelivery,
      restaurant,
      paymentOptions,
    }),
    [bill, cart, freeDelivery, groups, offers, paymentOptions, restaurant, savings, subtotal, totalSavings],
  );

  return <CartTotalsContext.Provider value={value}>{children}</CartTotalsContext.Provider>;
}
