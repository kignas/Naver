import { useMemo, type ReactNode } from 'react';
import { demoOffersFor, findRestaurant, type Restaurant } from '../../data/demo';
import { billFor } from '../../lib/cart';
import { useAppStore } from '../../store/appStore';
import { cartLineOriginalPrice } from './cartPricing';
import { CartTotalsContext, type CartGroup, type CartTotals } from './cartTotals';

interface CartTotalsProviderProps {
  restaurant: Restaurant | undefined;
  offerMode: string | null;
  unavailable: boolean;
  freeAbove: number;
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
  children,
}: CartTotalsProviderProps) {
  const cart = useAppStore((state) => state.cart);
  const coupon = useAppStore((state) => state.coupon);

  const groups = useMemo<CartGroup[]>(() => {
    const map = new Map<number, CartGroup>();
    Object.entries(cart).forEach(([name, line]) => {
      const group = map.get(line.resId) ?? {
        resId: line.resId,
        name: line.resName ?? findRestaurant(line.resId)?.name ?? 'Restaurant',
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
  const offers = useMemo(() => (offerMode === 'none' ? [] : demoOffersFor(subtotal)), [offerMode, subtotal]);
  const bill = useMemo(() => billFor(cart, coupon, offers), [cart, coupon, offers]);
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

  const value = useMemo<CartTotals>(
    () => ({ cart, groups, subtotal, offers, bill, savings, totalSavings, freeDelivery, restaurant }),
    [bill, cart, freeDelivery, groups, offers, restaurant, savings, subtotal, totalSavings],
  );

  return <CartTotalsContext.Provider value={value}>{children}</CartTotalsContext.Provider>;
}
