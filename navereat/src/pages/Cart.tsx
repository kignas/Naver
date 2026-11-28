import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { OfferPopup } from '../components/OfferPopup';
import { OrderSuccessSheet, type OrderSuccessHandle } from '../components/OrderSuccessSheet';
import { Sheet, type SheetHandle } from '../components/Sheet';
import { CartBillSheet } from '../components/cart/CartBillSheet';
import { CartCheckoutFooter } from '../components/cart/CartCheckoutFooter';
import { CartFreeDeliveryStrip } from '../components/cart/CartFreeDeliveryStrip';
import { CartItems } from '../components/cart/CartItems';
import { CartSkeleton } from '../components/cart/CartSkeleton';
import { CartOfferWatcher } from '../components/cart/CartOfferWatcher';
import { CartLocationModal } from '../components/cart/CartLocationModal';
import { CartOrderInfoCard } from '../components/cart/CartOrderInfoCard';
import { CartPaySheet } from '../components/cart/CartPaySheet';
import { CartSavingsCorner } from '../components/cart/CartSavingsCorner';
import { CartTotalsProvider } from '../components/cart/CartTotalsProvider';
import { CartUpsell } from '../components/cart/CartUpsell';
import { NOTE_MAX, TIP_PRESETS } from '../components/cart/cartConstants';
import { Icon } from '../components/Icon';
import { SlideReveal } from '../components/reveal/SlideReveal';
import { api, isApiFailure } from '../api/restaurantApi';
import type { Coupon, DemoOffer, Order } from '../data/demo';
import { cartRestaurantId, cartSubtotal } from '../lib/cart';
import { ensureKey } from '../logic/checkoutKey';
import { rememberCartForAuth } from '../lib/loginReturn';
import { build as buildOrderPayload } from '../logic/orderPayload';
import { MockPaymentSheet, type MockPaymentOutcome } from '../components/MockPaymentSheet';
import { tapHaptic } from '../lib/haptics';
import { createRouteStyleSheet } from '../lib/routeStyles';
import {
  clearPaymentMethod,
  readPaymentMethod,
  writePaymentMethod,
} from '../lib/checkoutPaymentMethod';
import {
  ADDRESS_CHANGED_EVENT,
  addressHasCoords,
  addressIdOf,
  formatAddressLine,
  selectedAddress,
  type SavedAddress,
} from '../lib/checkoutAddress';
import { useAppNav } from '../lib/navigation';
import { useAppStore } from '../store/appStore';
import { toast } from '../store/toastStore';
import cartBundleCss from '../styles/original/cart.bundle.css?raw';
import '../styles/original/cart-popups.css';
import '../styles/pages/cart.css';

type Payment = 'upi' | 'cod';
const cartStyle = createRouteStyleSheet(cartBundleCss, 'navereatCart');

type SheetName = 'coupon' | 'bill' | 'pay' | 'note' | 'tip' | null;

const cleanNote = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX);

interface CartExtras {
  note: string;
  instructions: string[];
  tip: number;
}

/** The note, instructions and tip the customer already set for this cart. */
function readCartExtras(): CartExtras {
  try {
    const raw = JSON.parse(localStorage.getItem('nearbite_cart_extras') || '{}') as {
      restaurantNote?: string;
      deliveryInstructions?: string;
      tipAmount?: number;
    };
    return {
      note: cleanNote(String(raw.restaurantNote ?? '')),
      instructions: String(raw.deliveryInstructions ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      tip: Math.max(0, Math.min(1000, Math.round(Number(raw.tipAmount) || 0))),
    };
  } catch {
    return { note: '', instructions: [], tip: 0 };
  }
}

/** Cart headline name; a primitive selector so a quantity tap cannot re-render the page. */
const cartHeadline = (cart: ReturnType<typeof useAppStore.getState>['cart']): string => {
  const names = new Map<number, string>();
  Object.values(cart).forEach((line) => {
    if (names.has(line.resId)) return;
    names.set(line.resId, line.resName ?? api.restaurantSync(line.resId)?.name ?? 'Restaurant');
  });
  if (names.size > 1) return `${names.size} restaurants`;
  const first = names.values().next();
  if (!first.done) return first.value;
  return api.restaurantSync(cartRestaurantId(cart) ?? undefined)?.name ?? 'Your cart';
};

export function Cart() {
  const perfWindow = window as Window & { __cartRenders?: number };
  perfWindow.__cartRenders = (perfWindow.__cartRenders ?? 0) + 1;
  const nav = useAppNav();
  const coupon = useAppStore((s) => s.coupon);
  const user = useAppStore((s) => s.user);
  const applyCoupon = useAppStore((s) => s.applyCoupon);
  const removeCoupon = useAppStore((s) => s.removeCoupon);
  const clearCart = useAppStore((s) => s.clearCart);
  const empty = useAppStore((s) => Object.keys(s.cart).length === 0);
  const restaurantId = useAppStore((s) => cartRestaurantId(s.cart));
  const headline = useAppStore((s) => cartHeadline(s.cart));

  const [sheet, setSheet] = useState<SheetName>(null);
  const [mockPay, setMockPay] = useState<{ orderId: string; amount: number } | null>(null);
  const sheetRef = useRef<SheetHandle>(null);
  const closeSheet = () => sheetRef.current?.close();
  const orderSuccessRef = useRef<OrderSuccessHandle>(null);
  const pendingOrderRef = useRef<Order | null>(null);
  // The saved note, instructions and tip are read during the first render, so
  // the page the slide reveals is already complete and nothing has to re-render
  // (and re-layout the whole cart) while it travels.
  const savedExtrasRef = useRef<CartExtras | null>(null);
  savedExtrasRef.current ??= readCartExtras();
  const savedExtras = savedExtrasRef.current;

  const [code, setCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [note, setNote] = useState(() => savedExtras.note);
  const [noteWasSet, setNoteWasSet] = useState(() => Boolean(savedExtras.note));
  const [tip, setTip] = useState(() => savedExtras.tip);
  const [tipInput, setTipInput] = useState('');
  const [tipError, setTipError] = useState('');
  const [payment, setPayment] = useState<Payment>(() => readPaymentMethod());
  const [cutlery, setCutlery] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [offerPopup, setOfferPopup] = useState<DemoOffer[] | null>(null);
  const [instructions, setInstructions] = useState<string[]>(() => savedExtras.instructions);
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

  const hashParams = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const couponSheetEmpty = hashParams.get('coupons') === 'empty';
  const offerMode = hashParams.get('offers');
  const holdOrderPopup = hashParams.get('hold') === '1';
  const restaurant = api.restaurantSync(restaurantId ?? undefined);
  const couponList = api.couponsSync();
  const unavailable = hashParams.get('unavailable') === '1' || restaurant?.available === false;
  const freeAbove = restaurant?.freeDeliveryAbove ?? 399;
  const eta = restaurant ? `${restaurant.deliveryMin}–${restaurant.deliveryMax} mins` : '30–40 mins';
  const displayName = user?.name ?? 'Demo Foodie';
  const phone = user?.phone ?? '+91 98765 43210';
  const [address, setAddress] = useState<SavedAddress | null>(() => selectedAddress());
  const [locationPrompt, setLocationPrompt] = useState(false);
  useEffect(() => {
    const sync = () => setAddress(selectedAddress());
    window.addEventListener(ADDRESS_CHANGED_EVENT, sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener(ADDRESS_CHANGED_EVENT, sync);
      window.removeEventListener('focus', sync);
    };
  }, []);
  // cart-page.js shows the location modal when the chosen address has no
  // precise coordinates (a guest sees the "log in to order" prompt instead).
  useEffect(() => {
    setLocationPrompt(!addressHasCoords(address));
  }, [address]);
  const offerBlocked = sheet !== null || placing || offerPopup !== null || locationPrompt;

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

  const handleApply = async (value: string) => {
    const state = useAppStore.getState();
    const check = await api.validateCoupon({
      code: value,
      subtotal: cartSubtotal(state.cart),
      restaurantId: restaurantId ?? undefined,
      paymentMethod: payment,
    });
    if (!check.ok) {
      const message = check.message ?? 'Coupon is invalid or expired.';
      setCouponError(message);
      toast(message, 'error');
      return;
    }
    const result = applyCoupon(check.code ?? value);
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

  const toggleInstruction = useCallback((label: string) => {
    setInstructions((current) =>
      current.includes(label) ? current.filter((entry) => entry !== label) : [...current, label],
    );
  }, []);

  const leaveCart = (target: string) => {
    nav.push(target);
    // Keep the outgoing cart intact for the slide; clearing it now would
    // resize the page while it is still visible.
    let cleared = false;
    const clearAfterSlide = () => {
      if (cleared) return;
      cleared = true;
      window.removeEventListener('navereat:transition-end', clearAfterSlide);
      clearCart();
      clearPaymentMethod();
    };
    window.addEventListener('navereat:transition-end', clearAfterSlide, { once: true });
    window.setTimeout(clearAfterSlide, 900);
  };

  const handlePlace = async () => {
    if (placing) return;
    if (unavailable) {
      toast('Delivery is unavailable for this restaurant', 'error');
      return;
    }
    const state = useAppStore.getState();
    if (Object.keys(state.cart).length === 0) {
      toast('Your cart is empty', 'error');
      return;
    }
    const token = localStorage.getItem('nearbite_token') || localStorage.getItem('token');
    if (!token) {
      rememberCartForAuth();
      nav.push('/login');
      return;
    }
    const currentAddress = selectedAddress();
    if (!currentAddress) {
      const button = document.getElementById('btn-checkout');
      if (button) {
        button.classList.remove('ct-shake');
        void (button as HTMLElement).offsetWidth;
        button.classList.add('ct-shake');
        window.setTimeout(() => button.classList.remove('ct-shake'), 450);
      }
      toast('Add a delivery address first', 'error');
      return;
    }
    const payload = buildOrderPayload(state.cart, {
      paymentMethod: payment === 'cod' ? 'cod' : 'upi',
      tipAmount: tip,
      restaurantNote: note,
      deliveryInstructions: instructions.join(', '),
      couponCode: coupon?.code ?? '',
      deliveryAddress: currentAddress,
      addressId: addressIdOf(currentAddress) || null,
    });
    const idempotencyKey = ensureKey(payload as unknown as Parameters<typeof ensureKey>[0]);
    setPlacing(true);
    setSheet(null);
    orderSuccessRef.current?.processing({ message: 'Placing your order' });
    try {
      const created = await api.createOrder({
        payload,
        idempotencyKey,
        restaurantName: restaurant?.name,
        eta: restaurant?.time,
      });
      state.recordOrder(created.order, { keepCart: true });
      pendingOrderRef.current = created.order;
      tapHaptic(12);
      if (payment === 'cod') {
        orderSuccessRef.current?.show();
      } else {
        orderSuccessRef.current?.stop();
        setMockPay({ orderId: created.orderId, amount: created.total });
      }
    } catch (error) {
      orderSuccessRef.current?.stop();
      setPlacing(false);
      toast(isApiFailure(error) ? error.message : 'Could not place the order. Try again.', 'error');
    }
  };

  const handleMockResult = async (outcome: MockPaymentOutcome) => {
    const pending = mockPay;
    if (!pending) return;
    setMockPay(null);
    setPlacing(true);
    orderSuccessRef.current?.processing({ message: 'Confirming your payment' });
    try {
      const intent = await api.createPayment({ orderId: pending.orderId, amount: pending.amount, method: 'upi' });
      const verified = await api.verifyPayment({
        paymentId: intent.paymentId,
        orderId: pending.orderId,
        outcome,
      });
      useAppStore.getState().recordOrder(verified.order, { keepCart: true });
      if (verified.paymentStatus === 'paid') {
        pendingOrderRef.current = verified.order;
        orderSuccessRef.current?.show();
        return;
      }
      orderSuccessRef.current?.stop();
      leaveCart(`/payment/${verified.paymentStatus === 'failed' ? 'failed' : 'pending'}?order=${pending.orderId}`);
    } catch (error) {
      orderSuccessRef.current?.stop();
      setPlacing(false);
      toast(isApiFailure(error) ? error.message : 'Payment could not be completed.', 'error');
    }
  };

  const handleOrderContinue = () => {
    const order = pendingOrderRef.current;
    pendingOrderRef.current = null;
    setPlacing(false);
    clearCart();
    if (order) {
      leaveCart(`/track/${order.id}`);
    } else {
      nav.tab('/orders');
    }
  };

  const openCouponSheet = useCallback(() => setSheet('coupon'), []);
  const openBillSheet = useCallback(() => setSheet('bill'), []);
  const openNoteSheet = useCallback(() => setSheet('note'), []);
  const openPaySheet = useCallback(() => setSheet('pay'), []);
  const toggleDi = useCallback(() => setDiOpen((open) => !open), []);

  if (empty) {
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
      <CartTotalsProvider
        restaurant={restaurant ?? undefined}
        offerMode={offerMode}
        unavailable={unavailable}
        freeAbove={freeAbove}
      >
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
                  {headline}
                </span>
              </span>
            </div>
          </div>

          <SlideReveal dataReady maxBlocks={1} skeleton={<CartSkeleton />}>
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

          <CartItems note={note} cutlery={cutlery} onCutleryChange={setCutlery} onOpenNote={openNoteSheet} />

          <CartFreeDeliveryStrip />

          <CartUpsell />

          <CartSavingsCorner onOpenCoupon={openCouponSheet} />

          <CartOrderInfoCard
            eta={eta}
            displayName={displayName}
            phone={phone}
            instructions={instructions}
            diOpen={diOpen}
            onToggleDi={toggleDi}
            onToggleInstruction={toggleInstruction}
            tip={tip}
            unavailable={unavailable}
            onOpenBill={openBillSheet}
            addressTag={address?.tag ?? 'Home'}
            addressLine={formatAddressLine(address)}
            addressOk={Boolean(address && addressHasCoords(address))}
            loggedIn={Boolean(localStorage.getItem('nearbite_token') || localStorage.getItem('token'))}
            onChangeAddress={() => nav.push('/address?return=cart')}
          />

          <section className="ct-oi-policy" aria-labelledby="ct-oi-policy-title">
            <h2 className="ct-oi-policy-title" id="ct-oi-policy-title">
              Cancellation policy
            </h2>
            <p>Please double-check your order and address details. Orders are non-refundable once placed.</p>
          </section>

          <CartCheckoutFooter
            tip={tip}
            unavailable={unavailable}
            onOpenBill={openBillSheet}
            onProceed={openPaySheet}
            onPlace={handlePlace}
          />

          <CartOfferWatcher offerMode={offerMode} blocked={offerBlocked} onShow={setOfferPopup} />
          </SlideReveal>
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
            {couponSheetEmpty || couponList.length === 0 ? (
              <div className="ct-empty-mini">
                <div aria-hidden="true" className="ct-empty-mini-ic">
                  <Icon name="solid:ticket" size={18} />
                </div>
                <div className="ct-empty-mini-title">No coupons available</div>
                <p className="ct-empty-mini-sub">We don’t have any active coupons for this order right now.</p>
              </div>
            ) : (
              <div className="ct-coupon-list">
                {couponList.map((entry: Coupon) => (
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
          <CartBillSheet
            sheetRef={sheetRef}
            onClose={() => setSheet(null)}
            tip={tip}
            onTip={setTip}
            onOpenTipSheet={openTipSheet}
          />
        )}

        {locationPrompt && <CartLocationModal />}

        {sheet === 'pay' && (
          <CartPaySheet
            sheetRef={sheetRef}
            onClose={() => setSheet(null)}
            payment={payment}
            onPayment={(method) => {
              setPayment(method);
              writePaymentMethod(method);
            }}
            onPlace={handlePlace}
          />
        )}

        {mockPay && (
          <MockPaymentSheet
            orderId={mockPay.orderId}
            amount={mockPay.amount}
            onResult={handleMockResult}
            onClose={() => {
              setMockPay(null);
              setPlacing(false);
            }}
          />
        )}

        {sheet === 'tip' && (
          <Sheet
            ref={sheetRef}
            id="ct-tip-sheet"
            titleId="tip-sheet-title"
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
            titleId="note-sheet-title"
            title="Add cooking requests"
            onClose={() => setSheet(null)}
            floatingClose
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
      </CartTotalsProvider>
    </div>
  );
}
