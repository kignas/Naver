import { useEffect, useMemo, type MutableRefObject, type ReactNode } from 'react';
import { api, type Quote } from '../../api/restaurantApi';
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
import { resolveCta } from '../../logic/checkoutCta';
import { useCartQuote, type QuoteBody } from '../../hooks/useCartQuote';
import { CartTotalsContext, type CartGroup, type CartTotals } from './cartTotals';

/** `quote.message` is not on the engine type but the backend sends it; the
 * legacy block card prints it verbatim. */
const quoteMessage = (quote: Quote | null): string | null =>
  quote ? ((quote as Quote & { message?: string }).message ?? null) : null;

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
  /** `ctState.addressOk` / `ctState.loggedIn`: the two remaining CTA gates. */
  addressOk: boolean;
  /** The address the quote prices against; null falls back to the legacy path. */
  addressId: string | null;
  /** Hands the live quote to the page so `POST /orders` can carry its id. */
  quoteRef?: MutableRefObject<Quote | null>;
  loggedIn: boolean;
  children: ReactNode;
}

/**
 * Subscribes to the cart so the page shell does not: a quantity tap re-renders
 * this provider and the sections that read it, and React reuses the children
 * elements the shell created, so the static page stays untouched.
 */
export function CartTotalsProvider({
  restaurant,
  quoteRef,
  offerMode,
  unavailable,
  freeAbove,
  tip,
  payment,
  platform,
  addressOk,
  addressId,
  loggedIn,
  children,
}: CartTotalsProviderProps) {
  const cart = useAppStore((state) => state.cart);
  const coupon = useAppStore((state) => state.coupon);

  const groups = useMemo<CartGroup[]>(() => {
    const map = new Map<number, CartGroup>();
    Object.entries(cart).forEach(([name, line]) => {
      const group: CartGroup = map.get(line.resId) ?? {
        resId: line.resId,
        name: line.resName ?? api.restaurantSync(line.resId)?.name ?? 'Restaurant',
        lines: [],
        units: 0,
        subtotal: 0,
        minOrder: api.restaurantSync(line.resId)?.minimumOrder,
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

  // `basket()`: one restaurant, a saved address, at least one priced item.
  const quoteBody = useMemo<QuoteBody | null>(() => {
    if (groups.length !== 1 || !addressId) return null;
    const items = groups[0].lines
      .map(({ name, line }) => ({
        menuItem: line.menuItem as string | number,
        name,
        price: line.price,
        quantity: line.quantity,
      }))
      .filter((item) => item.menuItem != null && item.quantity > 0);
    if (!items.length) return null;
    const body: QuoteBody = {
      restaurantId: groups[0].resId,
      addressId,
      items,
      paymentMethod: payment,
      couponCode: coupon?.code ?? '',
    };
    if (tip > 0) body.tipAmount = tip;
    return body;
  }, [addressId, coupon?.code, groups, payment, tip]);
  const cartQuote = useCartQuote(quoteBody);
  useEffect(() => {
    if (quoteRef) quoteRef.current = cartQuote.quote;
  }, [cartQuote.quote, quoteRef]);
  // `renderBlocked()`: a quote the backend refuses to price (other than the
  // below-minimum case, which the CTA already states in rupees).
  const refused =
    cartQuote.status === 'ready' &&
    cartQuote.quote?.serviceable === false &&
    cartQuote.quote.reason !== 'BELOW_MINIMUM_ORDER';
  const quoteBlock: 'error' | 'service' | null =
    cartQuote.status === 'error' ? 'error' : refused ? 'service' : null;
  const quoteError = cartQuote.error?.message ?? (refused ? quoteMessage(cartQuote.quote) : null);

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

  const multiBelowMin = useMemo(
    () =>
      groups
        .filter((group) => (group.minOrder ?? 0) > 0 && group.subtotal < (group.minOrder ?? 0))
        .map((group) => ({ name: group.name, minOrder: group.minOrder ?? 0, subtotal: group.subtotal })),
    [groups],
  );
  const cta = useMemo(
    () =>
      resolveCta({
        units: groups.reduce((count, group) => count + group.units, 0),
        unavailable,
        quoteBlock,
        loggedIn,
        multiBelowMin,
        usesAuthoritativeQuote: groups.length === 1 && addressOk,
        minOrder: restaurant?.minimumOrder ?? 0,
        subtotal,
        addressOk,
        ctaMain: paymentOptions.ctaLabel,
      }),
    [addressOk, groups, loggedIn, multiBelowMin, paymentOptions.ctaLabel, quoteBlock, restaurant, subtotal, unavailable],
  );

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
      multiBelowMin,
      cta,
      quote: cartQuote.quote,
      quoteStatus: cartQuote.status,
      quoteError,
      quoteBlock,
      retryQuote: cartQuote.retry,
    }),
    [
      bill,
      cartQuote.quote,
      cartQuote.retry,
      cartQuote.status,
      quoteBlock,
      quoteError,
      cart,
      cta,
      freeDelivery,
      groups,
      multiBelowMin,
      offers,
      paymentOptions,
      restaurant,
      savings,
      subtotal,
      totalSavings,
    ],
  );

  return <CartTotalsContext.Provider value={value}>{children}</CartTotalsContext.Provider>;
}
