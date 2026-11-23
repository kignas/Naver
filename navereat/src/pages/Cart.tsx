import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { CompleteYourMeal } from '../components/CompleteYourMeal';
import { OfferPopup } from '../components/OfferPopup';
import { OrderSuccessSheet, type OrderSuccessHandle } from '../components/OrderSuccessSheet';
import { Sheet, type SheetHandle } from '../components/Sheet';
import {
  coupons,
  DEMO_ADDRESS,
  demoOffersFor,
  findRestaurant,
  type Coupon,
  type DemoOffer,
} from '../data/demo';
import { createRouteStyleSheet } from '../lib/routeStyles';
import { billFor, cartRestaurantId, type CartLine } from '../lib/cart';
import { formatMoney } from '../lib/money';
import { useAppNav } from '../lib/navigation';
import { useCustomize } from '../lib/customizeContext';
import { customTextFor, displayNameFor } from '../lib/customization';
import { useAppStore } from '../store/appStore';
import { toast } from '../store/toastStore';
import cartBundleCss from '../styles/original/cart.bundle.css?raw';
import '../styles/original/cart-popups.css';
import '../styles/pages/cart.css';

type Payment = 'upi' | 'cod';
const cartStyle = createRouteStyleSheet(cartBundleCss, 'navereatCart');

type SheetName = 'coupon' | 'bill' | 'pay' | 'note' | 'tip' | null;
const TIP_PRESETS = [10, 20, 30] as const;
const NOTE_MAX = 100;

interface Group {
  resId: number;
  name: string;
  lines: Array<{ name: string; line: CartLine }>;
  units: number;
  subtotal: number;
}

const addressText = DEMO_ADDRESS.includes('·')
  ? DEMO_ADDRESS.split('·').slice(1).join('·').trim()
  : DEMO_ADDRESS;

const chevron = (
  <svg aria-hidden="true" className="ct-oi-chev" fill="none" height="18" viewBox="0 0 24 24" width="18">
    <path d="m9 6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
  </svg>
);

const clockIcon = (
  <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
    <path d="M9.5 3.5h5M12 3.5V6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    <circle cx="12" cy="13.2" r="7.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 9.6v3.8l2.4 1.4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
  </svg>
);

const trashIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5.5 7h13M10 4.8h4M9.4 10.5v6M14.6 10.5v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M7 7h10l-.7 11.1A1.6 1.6 0 0 1 14.7 19.6H9.3a1.6 1.6 0 0 1-1.6-1.5L7 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

const DI_PRESETS = [
  {
    label: 'Directions to reach',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    label: 'Leave at the door',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" stroke="currentColor" strokeWidth="1.7" />
        <path d="M4 21h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="14" cy="13" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: 'Avoid calling',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6c0 8 6 14 14 14l-1-3.5-3.5-1-1.5 1.5c-2.6-1.3-4.7-3.4-6-6L11 9.5 10 6H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Avoid ringing',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6.5 16V11a5.5 5.5 0 0 1 11 0v5l1.5 2H5l1.5-2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Leave at gate',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 21V10l9-6 9 6v11" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
];

const cleanNote = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX);

function VegMark({ value }: { value?: boolean }) {
  if (value === undefined) return null;
  return (
    <span className={`nb-veg-mark ${value ? 'veg' : 'nonveg'}`} title={value ? 'Veg' : 'Non-veg'}>
      <span />
    </span>
  );
}


interface CartLineRowProps {
  name: string;
  line: CartLine;
  original: number;
  onQty: (name: string, qty: number) => void;
}

const CartLineRow = memo(
  function CartLineRow({ name, line, original, onQty }: CartLineRowProps) {
    const customText = customTextFor(line.customizations);
    const shownName = displayNameFor(name, customText);
    const hasDiscount = original > line.price;
    const discountPct = hasDiscount ? Math.round(((original - line.price) / original) * 100) : 0;
    const itemTotal = line.quantity * line.price;
    const itemSavings = hasDiscount ? line.quantity * (original - line.price) : 0;
    const last = line.quantity <= 1;
    return (
      <div className="ct-row" data-name={name}>
        <div className="ct-info">
          <div className="ct-name-row">
            <VegMark value={line.isVeg} />
            <span className="ct-name">{shownName}</span>
          </div>
          {customText && <div className="ct-custom">{customText}</div>}
          <div className="ct-price-line">
            <span className="ct-unit-price ct-num">₹{line.price}</span>
            {hasDiscount && (
              <>
                <span className="ct-was-price ct-num">₹{original}</span>
                <span className="ct-off-badge">{discountPct}% OFF</span>
              </>
            )}
          </div>
        </div>
        <div className="ct-right">
          <div>
            {hasDiscount && <div className="ct-item-was ct-num">₹{line.quantity * original}</div>}
            <div className="ct-item-total ct-num">₹{itemTotal}</div>
            {hasDiscount && <div className="ct-item-save ct-num">Save ₹{itemSavings.toFixed(0)}</div>}
          </div>
          <div className={`ct-stepper${last ? ' is-last' : ''}`} role="group" aria-label={`Quantity for ${name}`}>
            <button
              type="button"
              className="ct-step-down"
              aria-label={last ? `Remove ${name}` : 'Decrease quantity'}
              onClick={() => onQty(name, line.quantity - 1)}
            >
              {last ? trashIcon : <span className="ct-step-glyph" aria-hidden="true">−</span>}
            </button>
            <span className="ct-qty">{line.quantity}</span>
            <button
              type="button"
              className="ct-step-up"
              aria-label="Increase quantity"
              onClick={() => onQty(name, line.quantity + 1)}
            >
              <span className="ct-step-glyph" aria-hidden="true">+</span>
            </button>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.name === next.name &&
    prev.line === next.line &&
    prev.original === next.original &&
    prev.onQty === next.onQty,
);

export function Cart() {
  const nav = useAppNav();
  const cart = useAppStore((s) => s.cart);
  const coupon = useAppStore((s) => s.coupon);
  const user = useAppStore((s) => s.user);
  const setQty = useAppStore((s) => s.setQty);
  const addItem = useAppStore((s) => s.addItem);
  const applyCoupon = useAppStore((s) => s.applyCoupon);
  const removeCoupon = useAppStore((s) => s.removeCoupon);
  const clearCart = useAppStore((s) => s.clearCart);
  const placeOrder = useAppStore((s) => s.placeOrder);
  const { openCustomize } = useCustomize();

  const [sheet, setSheet] = useState<SheetName>(null);
  const sheetRef = useRef<SheetHandle>(null);
  const closeSheet = () => sheetRef.current?.close();
  const orderSuccessRef = useRef<OrderSuccessHandle>(null);
  const pendingOrderRef = useRef<ReturnType<typeof placeOrder>>(null);
  const [code, setCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [note, setNote] = useState('');
  const [noteWasSet, setNoteWasSet] = useState(false);
  const [tip, setTip] = useState(0);
  const [tipInput, setTipInput] = useState('');
  const [tipError, setTipError] = useState('');
  const [payment, setPayment] = useState<Payment>('upi');
  const [cutlery, setCutlery] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [offerPopup, setOfferPopup] = useState<DemoOffer[] | null>(null);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [diOpen, setDiOpen] = useState(false);

  useLayoutEffect(() => {
    const detach = cartStyle.attach();
    document.body.classList.add('ct-page');
    document.body.classList.remove('ct-loading-cart', 'ct-loading-delivery', 'ct-location-modal-open');
    return () => {
      detach();
      document.body.classList.remove('ct-page');
    };
  }, []);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<number, Group>();
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

  const hashParams = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const couponSheetEmpty = hashParams.get('coupons') === 'empty';
  const offerMode = hashParams.get('offers');
  const holdOrderPopup = hashParams.get('hold') === '1';
  const restaurant = findRestaurant(cartRestaurantId(cart) ?? undefined);
  const subtotal = groups[0]?.subtotal ?? 0;
  const offers = useMemo(() => (offerMode === 'none' ? [] : demoOffersFor(subtotal)), [offerMode, subtotal]);
  const bill = useMemo(() => billFor(cart, coupon, offers), [cart, coupon, offers]);
  const lines = Object.values(cart);
  const originalPriceFor = (line: CartLine): number => {
    const explicit = Number(line.originalPrice ?? 0);
    if (explicit > line.price) return explicit;
    const menuItem = restaurant?.menu.find((item) => item.id === line.menuItem);
    const fromMenu = Number(menuItem?.originalPrice ?? 0);
    return fromMenu > line.price ? fromMenu : 0;
  };
  const savings = lines.reduce(
    (sum, line) => sum + Math.max(0, originalPriceFor(line) - line.price) * line.quantity,
    0,
  );
  const totalSavings = savings + bill.offerDiscount;
  const unavailable = hashParams.get('unavailable') === '1' || restaurant?.available === false;
  const freeAbove = restaurant?.freeDeliveryAbove ?? 399;
  const freeDelivery = !unavailable && subtotal >= freeAbove;
  const restaurantName = groups.length > 1 ? `${groups.length} restaurants` : groups[0]?.name ?? restaurant?.name ?? 'Your cart';
  const eta = restaurant ? `${restaurant.deliveryMin}–${restaurant.deliveryMax} mins` : '30–40 mins';
  const displayName = user?.name ?? 'Demo Foodie';
  const phone = user?.phone ?? '+91 98765 43210';
  const payTotal = bill.total + tip;

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('nearbite_cart_extras') || '{}') as {
        restaurantNote?: string;
        deliveryInstructions?: string;
        tipAmount?: number;
      };
      const savedNote = cleanNote(String(raw.restaurantNote ?? ''));
      if (savedNote) {
        setNote(savedNote);
        setNoteWasSet(true);
      }
      const savedInstructions = String(raw.deliveryInstructions ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (savedInstructions.length) setInstructions(savedInstructions);
      const savedTip = Math.max(0, Math.min(1000, Math.round(Number(raw.tipAmount) || 0)));
      if (savedTip > 0) setTip(savedTip);
    } catch {
      /* no saved extras */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'nearbite_cart_extras',
        JSON.stringify({ restaurantNote: note, deliveryInstructions: instructions.join(', '), tipAmount: tip }),
      );
    } catch {
      /* storage may be unavailable */
    }
  }, [instructions, note, tip]);

  useEffect(() => {
    if (!offers.length || sheet !== null || placing || offerPopup || offerMode === 'none') return;
    const popupOffers = offerMode === 'single' ? offers.slice(0, 1) : offers;
    const key = `cart|${offers.map((offer) => offer.id).join('+')}|${subtotal}`;
    let seen: string[] = [];
    try {
      seen = JSON.parse(sessionStorage.getItem('ew_offers_seen_v1') || '[]') as string[];
    } catch {
      seen = [];
    }
    if (seen.includes(key)) return;
    const timer = window.setTimeout(() => {
      setOfferPopup(popupOffers);
      try {
        sessionStorage.setItem('ew_offers_seen_v1', JSON.stringify([...seen, key].slice(-60)));
      } catch {
        /* session storage may be unavailable */
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [offers, sheet, placing, offerPopup, subtotal, offerMode]);

  const handleApply = (value: string) => {
    const result = applyCoupon(value);
    if (result.ok) {
      setCouponError('');
      toast(result.message, 'success');
      setCode('');
      closeSheet();
    } else {
      setCouponError(result.message);
      toast(result.message, 'error');
    }
  };

  const openTipSheet = () => {
    setTipError('');
    setTipInput(tip > 0 && !TIP_PRESETS.includes(tip as (typeof TIP_PRESETS)[number]) ? String(tip) : '');
    setSheet('tip');
  };

  const saveTip = () => {
    const raw = tipInput.trim();
    if (!raw) {
      setTipError('Enter a tip amount, or choose Remove tip.');
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      setTipError('Enter a valid amount in rupees.');
      return;
    }
    if (!Number.isInteger(value)) {
      setTipError('Enter a whole rupee amount, with no paise.');
      return;
    }
    if (value < 1) {
      setTipError('The smallest tip is ₹1. Choose Remove tip if you would rather not tip.');
      return;
    }
    if (value > 1000) {
      setTipError('The largest tip you can add here is ₹1000.');
      return;
    }
    setTip(value);
    setTipError('');
    closeSheet();
    toast(`₹${value} tip added for your delivery partner`);
  };

  const removeTip = () => {
    setTip(0);
    closeSheet();
    toast('Tip removed');
  };

  const saveNote = () => {
    const value = cleanNote(note);
    setNote(value);
    closeSheet();
    if (value) {
      setNoteWasSet(true);
      toast('Cooking request saved');
    } else if (noteWasSet) {
      setNoteWasSet(false);
      toast('Cooking request removed');
    }
  };

  const removeNote = () => {
    setNote('');
    setNoteWasSet(false);
    closeSheet();
    toast('Cooking request removed');
  };

  const toggleInstruction = (label: string) => {
    setInstructions((current) =>
      current.includes(label) ? current.filter((entry) => entry !== label) : [...current, label],
    );
  };

  const handlePlace = () => {
    if (placing) return;
    if (unavailable) {
      toast('Delivery is unavailable for this restaurant', 'error');
      return;
    }
    const order = placeOrder(payment === 'cod' ? 'Cash on Delivery' : 'UPI', { keepCart: true, tip });
    if (!order) {
      toast('Your cart is empty', 'error');
      return;
    }
    pendingOrderRef.current = order;
    setPlacing(true);
    setSheet(null);
    orderSuccessRef.current?.processing();
  };

  const handleOrderContinue = () => {
    const order = pendingOrderRef.current;
    pendingOrderRef.current = null;
    clearCart();
    setPlacing(false);
    if (order) nav.push(`/track/${order.id}`);
    else nav.tab('/orders');
  };

  if (lines.length === 0) {
    return (
      <div className="page cart-page">
        <div className="ct-empty" id="empty-cart" style={{ display: 'block' }}>
          <svg aria-hidden="true" className="ct-empty-art" fill="none" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 32h52l-5 44a8 8 0 0 1-8 7H35a8 8 0 0 1-8-7L22 32Z" fill="#EFF2F4" stroke="#CBD3DA" strokeLinejoin="round" strokeWidth="3" />
            <path d="M36 32v-6a12 12 0 0 1 24 0v6" stroke="var(--hd-primary,#0b7a2a)" strokeLinecap="round" strokeWidth="3.5" />
            <circle cx="39" cy="55" fill="#CBD3DA" r="3" />
            <circle cx="57" cy="55" fill="#CBD3DA" r="3" />
            <path d="M39 68c4.5-4 13.5-4 18 0" stroke="#CBD3DA" strokeLinecap="round" strokeWidth="3" />
          </svg>
          <div className="ct-empty-title">Your cart is empty</div>
          <div className="ct-empty-sub">Pick a restaurant and add a few dishes — your order will show up here.</div>
          <button className="ct-empty-btn tap" type="button" onClick={() => nav.tab('/')}>
            Browse restaurants
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page cart-page">
      <div id="cart-has-items">
        <div className="ct-delivery-head" id="delivery-eta-card">
          <button aria-label="Go back" className="ct-dh-back tap" type="button" onClick={nav.back}>
            <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
              <path d="M15 5.5 8.5 12l6.5 6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
            </svg>
          </button>
          <div className="ct-dh-main">
            <span className="ct-dh-copy">
              <span className="ct-dh-restaurant" id="ct-dh-restaurant">
                {restaurantName}
              </span>
            </span>
          </div>
        </div>

        <div className="ct-fees" role="note">
          <svg aria-hidden="true" className="ct-fees-ic" fill="none" height="14" viewBox="0 0 24 24" width="14">
            <path d="M19.5 4.5c.6 6.9-2.8 11.5-8.4 11.5H8.6C8.2 10.3 12.6 5.7 19.5 4.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
            <path d="M5.2 19.5c.3-3.3 1.4-6 3.4-8.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          </svg>
          <span className="ct-fees-copy">
            <strong>₹0</strong> Packaging Fee
            <span aria-hidden="true" className="ct-fees-dot" />
            <strong>₹0</strong> Platform Fee
          </span>
        </div>

        <div className="ct-card ct-item-card">
          <div aria-live="polite" id="cart-items-list">
            {groups.map((group, groupIndex) => (
              <section className="ct-restaurant-group" data-restaurant-id={group.resId} key={group.resId}>
                <div className="ct-restaurant-head">
                  <div className="ct-restaurant-copy">
                    <div className="ct-restaurant-name">{group.name}</div>
                    <div className="ct-restaurant-meta">
                      {group.units} {group.units === 1 ? 'item' : 'items'} · ₹{group.subtotal}
                    </div>
                  </div>
                </div>
                <div className="ct-restaurant-items">
                  {group.lines.map(({ name, line }) => (
                    <CartLineRow
                      key={name}
                      name={name}
                      line={line}
                      original={originalPriceFor(line)}
                      onQty={setQty}
                    />
                  ))}
                </div>
                <div className="ct-item-actions ct-group-actions">
                  <button className="ct-pill-btn tap" type="button" onClick={() => nav.push(`/restaurant/${group.resId}`)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                    Add Items
                  </button>
                  <button className="ct-pill-btn tap" type="button" onClick={() => setSheet('note')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 19h14M7 15l9-9 2 2-9 9H7v-2z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="ct-note-btn-text">{note ? 'Request added' : 'Cooking requests'}</span>
                  </button>
                  {groupIndex === 0 && (
                    <label className="ct-pill-btn ct-cutlery-chip tap">
                      <input type="checkbox" checked={cutlery} onChange={(event) => setCutlery(event.target.checked)} />
                      <span className="ct-cutlery-box" aria-hidden="true" />
                      <span>Cutlery Needed</span>
                    </label>
                  )}
                </div>
                {note && <div className="ct-restaurant-note-preview">{note}</div>}
              </section>
            ))}
          </div>
        </div>

        {freeDelivery && (
          <div className="ct-strip" id="free-delivery-nudge" role="status">
            <Icon name="solid:motorcycle" size={18} />
            <span className="ct-strip-copy">
              <span id="nudge-text">Free delivery unlocked</span>
              <span className="ct-strip-sub" id="nudge-sub">
                No delivery charge on this order
              </span>
            </span>
          </div>
        )}

        <CompleteYourMeal
          restaurant={restaurant ?? null}
          cart={cart}
          onSeeAll={() => nav.push(`/restaurant/${restaurant?.id ?? 2}`)}
          onAdd={(item) => {
            if (!restaurant) return;
            addItem(item, restaurant.id);
            toast(`${item.name} added to your order`, 'success');
          }}
          onCustomize={(item) => {
            if (!restaurant) return;
            openCustomize(item, restaurant.id);
          }}
        />

        <section aria-labelledby="ct-sav-title" className="ct-card ct-savings" id="ct-payment-group">
          <h2 className="ct-sec-title" id="ct-sav-title">
            Savings corner
          </h2>
          <button className="ct-sav-row ct-sav-coupon" id="coupon-card" type="button" onClick={() => setSheet('coupon')}>
            <span aria-hidden="true" className="ct-sav-ic ct-sav-ic--offer">
              <Icon name="solid:tag" size={22} />
            </span>
            <span className="ct-sav-copy">
              <span className="ct-sav-title">{coupon ? coupon.code : 'Apply coupon code'}</span>
              {coupon ? (
                <span className="ct-sav-sub" id="coupon-card-sub">
                  {coupon.title}
                </span>
              ) : savings === 0 ? (
                <span className="ct-sav-sub" id="coupon-card-sub">
                  Save more on this order
                </span>
              ) : null}
            </span>
            {(coupon || savings > 0) && (
              <span className="ct-group-flag ct-sav-flag" id="coupon-applied-flag">
                <Icon name="solid:check" size={13} /> Applied
              </span>
            )}
            {chevron}
          </button>
          {savings > 0 && (
            <div className="ct-sav-row ct-sav-static" id="ct-sav-items">
              <span aria-hidden="true" className="ct-sav-ic ct-sav-ic--pct">
                <Icon name="solid:percent" size={22} />
              </span>
              <span className="ct-sav-copy">
                <span className="ct-sav-title">₹{savings} saved on item discounts</span>
              </span>
              <span className="ct-sav-flag is-static">
                <Icon name="solid:check" size={13} /> Applied
              </span>
            </div>
          )}
          {freeDelivery && (
            <div className="ct-sav-row ct-sav-static" id="ct-sav-delivery">
              <span aria-hidden="true" className="ct-sav-ic ct-sav-ic--ride">
                <Icon name="solid:motorcycle" size={22} />
              </span>
              <span className="ct-sav-copy">
                <span className="ct-sav-title" id="ct-sav-delivery-text">
                  Free delivery applied
                </span>
              </span>
              <span className="ct-sav-flag is-static">
                <Icon name="solid:check" size={13} /> Applied
              </span>
            </div>
          )}
          {bill.offerDiscount > 0 && (
            <div className="ct-sav-row ct-sav-static" id="ct-sav-discount">
              <span aria-hidden="true" className="ct-sav-ic ct-sav-ic--pct">
                <Icon name="solid:percent" size={22} />
              </span>
              <span className="ct-sav-copy">
                <span className="ct-sav-title" id="ct-sav-discount-text">
                  ₹{bill.offerDiscount} extra off
                </span>
              </span>
              <span className="ct-sav-flag is-static">
                <Icon name="solid:check" size={13} /> Applied
              </span>
            </div>
          )}
        </section>

        <section aria-label="Delivery and bill details" className="ct-oi-card" id="ct-order-info">
          <div className="ct-oi-row ct-oi-row--eta">
            <span aria-hidden="true" className="ct-oi-ic">
              {clockIcon}
            </span>
            <div className="ct-oi-copy">
              <span className="ct-oi-line">
                <span className="ct-oi-lead">Delivery in</span> <b>{eta}</b>
              </span>
              <button className="ctp-schedule-link" type="button" onClick={() => toast('Scheduling is not part of this demo')}>
                Want this later? Schedule it
              </button>
            </div>
          </div>
          <div className="ct-oi-row ct-oi-row--addr">
            <span aria-hidden="true" className="ct-oi-ic">
              <Icon name="solid:location-dot" size={22} />
            </span>
            <div className="ct-oi-copy">
              <button className="ct-oi-hit" type="button" onClick={() => toast('Address picker is not part of this demo')}>
                <span className="ct-oi-hit-copy">
                  <span className="ct-oi-line">
                    Delivery at <b>Home</b>
                  </span>
                  <span className="ct-oi-sub">{addressText}</span>
                </span>
                {chevron}
              </button>
              <button
                aria-controls="ct-oi-di-panel"
                aria-expanded={diOpen}
                className="ct-oi-dashlink"
                id="ct-oi-di-toggle"
                type="button"
                onClick={() => setDiOpen((open) => !open)}
              >
                {instructions.length ? 'Delivery instructions' : 'Add instructions for delivery partner'}
                {instructions.length > 0 && (
                  <span className="ct-oi-count" id="ct-di-count">
                    {instructions.length}
                  </span>
                )}
              </button>
            </div>
            {diOpen && (
              <div className="ct-oi-di" id="ct-oi-di-panel">
                <div aria-label="Delivery instructions" className="ct-di-pills" id="ct-di-pills" role="group">
                  {DI_PRESETS.map((preset) => (
                    <button
                      aria-pressed={instructions.includes(preset.label)}
                      className="ct-di-pill"
                      data-di={preset.label}
                      key={preset.label}
                      type="button"
                      onClick={() => toggleInstruction(preset.label)}
                    >
                      {preset.icon}
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className="ct-oi-row ct-oi-row--link" type="button" onClick={() => toast('Contact details are part of the demo')}>
            <span aria-hidden="true" className="ct-oi-ic">
              <Icon name="solid:phone" size={22} />
            </span>
            <div className="ct-oi-copy">
              <span className="ct-oi-line">
                <span>{displayName}</span>
                <span aria-hidden="true" className="ct-oi-comma">, </span>
                <b>{phone}</b>
              </span>
              <span className="ct-oi-sub">Your rider may call this number for delivery updates</span>
            </div>
            {chevron}
          </button>
          <button className="ct-oi-row ct-oi-row--link ct-oi-row--bill" type="button" onClick={() => setSheet('bill')}>
            <span aria-hidden="true" className="ct-oi-ic">
              <Icon name="solid:receipt" size={22} />
            </span>
            <div className="ct-oi-copy">
              <span className="ct-oi-line">
                Total Bill{' '}
                {unavailable ? (
                  <>
                    <s>₹{subtotal + savings}</s> <b>—</b>
                  </>
                ) : (
                  <b>{formatMoney(payTotal)}</b>
                )}
                {totalSavings > 0 && <span className="ct-oi-saved">You saved ₹{totalSavings}</span>}
              </span>
              <span className="ct-oi-sub">Incl. taxes and charges</span>
            </div>
            {chevron}
          </button>
        </section>

        <section className="ct-oi-policy" aria-labelledby="ct-oi-policy-title">
          <h2 className="ct-oi-policy-title" id="ct-oi-policy-title">
            Cancellation policy
          </h2>
          <p>Please double-check your order and address details. Orders are non-refundable once placed.</p>
        </section>

        <div className="ct-footer" id="checkout-footer">
          {totalSavings > 0 && (
            <button className="ct-footer-save ct-save-strip show" id="ct-footer-save" type="button" onClick={() => setSheet('bill')}>
              <span className="ct-save-text" id="ct-footer-save-text">
                ₹{totalSavings} saved on this order with Navereat!
              </span>
            </button>
          )}
          <div className="ct-paybar">
            <button className="ct-paybar-left tap" id="ct-view-bill" type="button" onClick={() => setSheet('bill')}>
              <span className="ct-paybar-amt">{unavailable ? '—' : formatMoney(payTotal)}</span>
              <span className="ct-paybar-link">View detailed bill</span>
            </button>
            {unavailable ? (
              <button className="ct-cta locked" type="button" aria-disabled="true" onClick={handlePlace}>
                <span className="ct-cta-text">
                  Delivery unavailable
                  <span className="ct-cta-sub">Change your address to continue</span>
                </span>
              </button>
            ) : (
              <button className="ct-cta" type="button" onClick={() => setSheet('pay')}>
                <span className="ct-cta-text">Proceed to Pay</span>
              </button>
            )}
          </div>
          <div className="ct-pay-note">
            <Icon name="solid:lock" size={12} />
            <span>Secure UPI payment · GPay, PhonePe &amp; more</span>
          </div>
        </div>
      </div>

      {sheet === 'coupon' && (
        <Sheet
          ref={sheetRef}
          id="ct-coupon-sheet"
          title="Apply coupon"
          onClose={() => setSheet(null)}
          floatingClose
          hideHeader
          footerClassName="is-single"
          footer={
            <button className="ct-btn ct-btn-ghost" type="button" onClick={closeSheet}>
              Close
            </button>
          }
        >
          {coupon && (
            <div className="ct-coupon-applied" id="coupon-applied-box">
              <span className="ct-coupon-applied-copy">
                <span className="ct-coupon-applied-label">Applied coupon</span>
                <strong id="coupon-applied-text">
                  {coupon.code} · {coupon.title}
                </strong>
              </span>
              <button
                className="ct-coupon-remove"
                id="coupon-remove"
                type="button"
                onClick={() => {
                  removeCoupon();
                  toast('Coupon removed');
                }}
              >
                Remove
              </button>
            </div>
          )}
          <label className="ct-field-label" htmlFor="coupon-input">
            Coupon code
          </label>
          <input
            autoCapitalize="characters"
            autoComplete="off"
            className="ct-input"
            id="coupon-input"
            placeholder="Enter coupon code"
            spellCheck={false}
            type="text"
            value={code}
            onChange={(event) => {
              setCode(event.target.value.toUpperCase());
              setCouponError('');
            }}
          />
          <p className="ct-sheet-err" id="coupon-error" role="alert" hidden={!couponError}>
            {couponError}
          </p>
          <button className="ct-btn ct-btn-primary" id="coupon-apply" type="button" onClick={() => handleApply(code)}>
            Apply coupon
          </button>
          {couponSheetEmpty || coupons.length === 0 ? (
            <div className="ct-empty-mini">
              <div aria-hidden="true" className="ct-empty-mini-ic">
                <Icon name="solid:ticket" size={18} />
              </div>
              <div className="ct-empty-mini-title">No coupons available</div>
              <p className="ct-empty-mini-sub">We don’t have any active coupons for this order right now.</p>
            </div>
          ) : (
            <div className="ct-coupon-list">
              {coupons.map((entry: Coupon) => (
                <button
                  key={entry.code}
                  type="button"
                  className={`ct-sav-row${coupon?.code === entry.code ? ' is-applied' : ''}`}
                  onClick={() => handleApply(entry.code)}
                >
                  <span aria-hidden="true" className="ct-sav-ic ct-sav-ic--offer">
                    <Icon name="solid:tag" size={22} />
                  </span>
                  <span className="ct-sav-copy">
                    <span className="ct-sav-title">
                      {entry.code} · {entry.title}
                    </span>
                    <span className="ct-sav-sub">{entry.subtitle}</span>
                  </span>
                  <span className="ct-sav-flag is-static">{coupon?.code === entry.code ? 'APPLIED' : 'APPLY'}</span>
                </button>
              ))}
            </div>
          )}
        </Sheet>
      )}

      {sheet === 'bill' && (
        <Sheet ref={sheetRef} title="Bill summary" onClose={() => setSheet(null)}>
          <div className="ct-bill">
            <div className="ct-bill-rows">
              <div className="ct-bill-row">
                <span className="ct-bill-label">Item total</span>
                <span className="ct-bill-val ct-bill-price-pair">
                  {savings > 0 && <s>₹{bill.subtotal + savings}</s>}
                  <span className="ct-now">{formatMoney(bill.subtotal)}</span>
                </span>
              </div>
              <div className="ct-bill-sep" />
              <div className="ct-bill-row">
                <span className="ct-bill-label is-dashed">Delivery Fee</span>
                <span className="ct-bill-val is-free">{bill.deliveryFee > 0 ? formatMoney(bill.deliveryFee) : 'FREE'}</span>
              </div>
              <div className="ct-bill-row">
                <span className="ct-bill-label">Platform fee</span>
                <span className="ct-bill-val is-free">{formatMoney(bill.platformFee)}</span>
              </div>
              <div className="ct-bill-row">
                <span className="ct-bill-label">Packaging fee</span>
                <span className="ct-bill-val is-free">₹0</span>
              </div>
              {bill.discount > 0 && (
                <div className="ct-bill-row">
                  <span className="ct-bill-label">Coupon discount</span>
                  <span className="ct-bill-val is-save">-{formatMoney(bill.discount)}</span>
                </div>
              )}
              {bill.offerDiscount > 0 && (
                <div className="ct-bill-row">
                  <span className="ct-bill-label">Extra discount for you</span>
                  <span className="ct-bill-val is-save">-{formatMoney(bill.offerDiscount)}</span>
                </div>
              )}
              {tip > 0 && (
                <div className="ct-bill-row">
                  <span className="ct-bill-label">Delivery partner tip</span>
                  <span className="ct-bill-val">{formatMoney(tip)}</span>
                </div>
              )}
            </div>
            <div className="ct-bill-band">THAT'S IT. No unnecessary fees. Ever!</div>
            <div className="ctp-label">Gratitude corner</div>
            <div className="ctp-card ctp-card--pad">
              <div className="ctp-chips">
                <button
                  type="button"
                  aria-pressed={tip === 0}
                  className={`ctp-chip${tip === 0 ? ' is-on' : ''}`}
                  onClick={() => setTip(0)}
                >
                  No tip
                </button>
                {TIP_PRESETS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    aria-pressed={tip === amount}
                    className={`ctp-chip${tip === amount ? ' is-on' : ''}`}
                    onClick={() => setTip(amount)}
                  >
                    ₹{amount}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={tip > 0 && !TIP_PRESETS.includes(tip as (typeof TIP_PRESETS)[number])}
                  className={`ctp-chip${tip > 0 && !TIP_PRESETS.includes(tip as (typeof TIP_PRESETS)[number]) ? ' is-on' : ''}`}
                  onClick={openTipSheet}
                >
                  {tip > 0 && !TIP_PRESETS.includes(tip as (typeof TIP_PRESETS)[number]) ? `₹${tip} · Edit` : 'Other'}
                </button>
              </div>
            </div>
            <div className="ct-bill-total">
              <span className="ct-total-label">To Pay</span>
              <span className="ct-total-val">{formatMoney(payTotal)}</span>
            </div>
          </div>
        </Sheet>
      )}

      {sheet === 'pay' && (
        <Sheet ref={sheetRef} title="Select payment method" onClose={() => setSheet(null)}>
          <div className="ct-pay-opts" role="radiogroup" aria-label="Payment method">
            {[
              { id: 'upi' as const, title: 'UPI / Online Payment', sub: 'GPay, PhonePe, Paytm and more', icon: 'solid:wallet' as const },
              { id: 'cod' as const, title: 'Cash on Delivery (COD)', sub: 'Pay when your order arrives', icon: 'solid:money-bill-transfer' as const },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={payment === option.id}
                className={`ct-pay-opt${payment === option.id ? ' is-selected' : ''}`}
                onClick={() => setPayment(option.id)}
              >
                <span className="ct-pay-ic" aria-hidden="true">
                  <Icon name={option.icon} size={18} />
                </span>
                <span className="ct-pay-copy">
                  <span className="ct-pay-title">{option.title}</span>
                  <span className="ct-pay-sub">{option.sub}</span>
                </span>
                <span className="ct-pay-radio" aria-hidden="true" />
              </button>
            ))}
          </div>
          <button className="ct-btn ct-btn-primary navereat-place-order" id="btn-checkout" type="button" onClick={handlePlace}>
            Place Order · {formatMoney(payTotal)}
          </button>
        </Sheet>
      )}

      {sheet === 'tip' && (
        <Sheet
          ref={sheetRef}
          id="ct-tip-sheet"
          title="Custom tip"
          onClose={() => setSheet(null)}
          footer={
            <>
              <button className="ct-btn ct-btn-ghost" type="button" onClick={closeSheet}>
                Cancel
              </button>
              <button className="ct-btn ct-btn-primary" id="tip-save" type="button" onClick={saveTip}>
                Save tip
              </button>
            </>
          }
        >
          <label className="ct-field-label" htmlFor="tip-input">
            Tip amount (₹)
          </label>
          <input
            aria-describedby="tip-help tip-error"
            className="ct-input"
            data-autofocus
            id="tip-input"
            inputMode="numeric"
            max={1000}
            min={1}
            step={1}
            type="number"
            value={tipInput}
            onChange={(event) => {
              setTipInput(event.target.value);
              setTipError('');
            }}
          />
          <div className="ct-field-foot">
            <span className="ct-field-help" id="tip-help">
              Whole rupees, between ₹1 and ₹1000.
            </span>
          </div>
          <p className="ct-sheet-err" id="tip-error" role="alert" hidden={!tipError}>
            {tipError}
          </p>
          {tip > 0 && (
            <button className="ct-btn-remove" id="tip-remove" type="button" onClick={removeTip}>
              Remove tip
            </button>
          )}
        </Sheet>
      )}

      {sheet === 'note' && (
        <Sheet
          ref={sheetRef}
          id="ct-note-sheet"
          rootClassName="is-cooking"
          title="Add cooking requests"
          onClose={() => setSheet(null)}
          floatingClose
          hideHeader
          footer={
            <>
              <button className="ct-btn ct-btn-ghost" type="button" onClick={closeSheet}>
                Cancel
              </button>
              <button
                className="ct-btn ct-btn-primary"
                id="note-save"
                type="button"
                disabled={!note.trim()}
                onClick={saveNote}
              >
                Add request
              </button>
            </>
          }
        >
          <label className="ct-field-label" id="note-field-label" htmlFor="note-input">
            Your cooking request or note
          </label>
          <textarea
            aria-describedby="note-help note-count"
            className="ct-textarea"
            data-autofocus
            id="note-input"
            maxLength={NOTE_MAX}
            placeholder="Add cooking requests"
            rows={1}
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, NOTE_MAX))}
          />
          <div className="ct-field-foot">
            <span className="ct-field-help" id="note-help">
              Restaurant will try their best to fulfil your requests, but refund requests in this regard will not be
              possible.
            </span>
            <span className="ct-count" id="note-count">
              {note.length}/{NOTE_MAX}
            </span>
          </div>
          <div className="ct-sug-row" id="note-suggestions">
            {['Less spicy', 'No onion', 'Extra napkins, please', 'Pack the sauces separately', 'Make it fresh'].map(
              (suggestion) => (
                <button
                  key={suggestion}
                  className="ct-sug"
                  data-suggest={suggestion}
                  type="button"
                  onClick={() => setNote(suggestion)}
                >
                  {suggestion}
                </button>
              ),
            )}
          </div>
          {note && (
            <button className="ct-btn-remove" id="note-remove" type="button" onClick={removeNote}>
              Remove
            </button>
          )}
        </Sheet>
      )}

      <OfferPopup offers={offerPopup} onClose={() => setOfferPopup(null)} />
      <OrderSuccessSheet ref={orderSuccessRef} onContinue={handleOrderContinue} autoMs={holdOrderPopup ? 0 : 2000} />
    </div>
  );
}
