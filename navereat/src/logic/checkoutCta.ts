/**
 * The checkout CTA label, ported from `cart-page.js` `updateCheckoutCta()`
 * (lines 1179-1258). The gates run in the legacy order and the labels are
 * byte-identical, including the `₹` amounts formatted with `toLocaleString`
 * and rounded up with `Math.ceil`.
 *
 * `eyebrow`/`sub` are the legacy `<span class="ct-cta-sub">`; `arrow` is the
 * `CT_ICON_ARROW` that only the unlocked label renders.
 */

export type QuoteBlockReason = 'coupon' | 'error' | 'service';

export interface BelowMinGroup {
  name: string;
  minOrder: number;
  subtotal: number;
}

export interface CtaInput {
  units: number;
  /** `ctState.unavailable`: outside the radius or a missing location. */
  unavailable: boolean;
  /** `EWCartQuoteUI.blockReason()`, null when the quote is usable. */
  quoteBlock: QuoteBlockReason | null;
  loggedIn: boolean;
  /** `ctState.multiBelowMin`, one entry per restaurant under its minimum. */
  multiBelowMin: BelowMinGroup[];
  /** `ctUsesAuthoritativePricingQuote()`: the quote owns the minimum check. */
  usesAuthoritativeQuote: boolean;
  minOrder: number;
  subtotal: number;
  addressOk: boolean;
  /** `CtX.ctaLabel()`: 'Proceed to Pay' / 'Place Order (COD)'. */
  ctaMain: string;
}

export interface CtaView {
  locked: boolean;
  label: string;
  sub: string;
  arrow: boolean;
}

const rupees = (value: number): string => `₹${value.toLocaleString('en-IN')}`;

export function resolveCta(input: CtaInput): CtaView {
  const plural = input.units === 1 ? 'item' : 'items';
  const sub = `${input.units} ${plural}`;

  if (input.unavailable) {
    return { locked: true, label: 'Delivery unavailable', sub: 'Change your address to continue', arrow: false };
  }
  if (input.quoteBlock) {
    const label =
      input.quoteBlock === 'coupon'
        ? 'Coupon not applied'
        : input.quoteBlock === 'error'
          ? 'Price unavailable'
          : 'Delivery unavailable';
    const reason =
      input.quoteBlock === 'coupon'
        ? 'See the message in your bill'
        : input.quoteBlock === 'error'
          ? 'Tap Try again in your bill'
          : 'See the message in your bill';
    return { locked: true, label, sub: reason, arrow: false };
  }
  if (!input.loggedIn) {
    return { locked: false, label: 'Log in to order', sub, arrow: false };
  }
  const below = input.multiBelowMin[0];
  if (below) {
    const remaining = Math.ceil(below.minOrder - below.subtotal);
    return {
      locked: true,
      label: `Add ${rupees(remaining)} more`,
      sub: `${below.name} · min ${rupees(below.minOrder)}`,
      arrow: false,
    };
  }
  if (!input.usesAuthoritativeQuote && input.minOrder > 0 && input.subtotal < input.minOrder) {
    const remaining = Math.ceil(input.minOrder - input.subtotal);
    return { locked: true, label: `Add ${rupees(remaining)} more`, sub: `Minimum order ${rupees(input.minOrder)}`, arrow: false };
  }
  if (!input.addressOk) {
    return { locked: true, label: 'Add address', sub: 'Needed before you can order', arrow: false };
  }
  return { locked: false, label: input.ctaMain, sub, arrow: true };
}

/** Legacy toasts for the same gates, fired when a locked CTA is tapped. */
export function ctaBlockedToast(input: CtaInput): string | null {
  if (input.unavailable) return 'This restaurant does not deliver to your address';
  const below = input.multiBelowMin[0];
  if (below) {
    const remaining = Math.ceil(below.minOrder - below.subtotal);
    return `${below.name}: add ${rupees(remaining)} to continue.`;
  }
  if (!input.usesAuthoritativeQuote && input.minOrder > 0 && input.subtotal < input.minOrder) {
    return `Add ${rupees(Math.ceil(input.minOrder - input.subtotal))} more to reach the minimum order.`;
  }
  return null;
}
