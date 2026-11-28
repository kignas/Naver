# Menu + Checkout port — parity inventory

Source of truth: **`kignas/Nearbite`**, `main` @ `0cca76b` (clone at `/tmp/Nearbite`).
Target: **`navereat/`** in this repo (React 18 + TypeScript + Vite, hash routes).

**Mode: DEMO.** Every screen reads through `src/api/restaurantApi.ts`. The
default implementation is `demoApi` (bundled fixtures, simulated latency,
scenario overrides). `liveApi` is a typed stub that throws
`live mode not enabled`; it is selected only by `VITE_DATA_MODE=live` and reads
`import.meta.env.VITE_API_BASE_URL`. No real URL, key or token exists anywhere in
this repo.

Status legend: **DONE** = ported and verified; **PARTIAL** = ported but missing
a sub-behaviour listed in the notes; **TODO** = not ported yet; **N/A** =
deliberately not ported (demo mode / branding rule).

---

## 1. Menu page — `restaurant-shell.html` (3,622 lines)

### 1.1 Files and bundle recipe

| Source | Role | Target | Status |
| --- | --- | --- | --- |
| `restaurant-shell.html:1-247` | head, header, tab strip, filter bar, search row | `src/pages/Restaurant.tsx` | DONE |
| `restaurant-shell.html:248` | `rmf-dis` dish-of-the-day strip | `src/components/menu/MenuSection.tsx` | DONE |
| `restaurant-shell.html:1020-1075` | info hero, address, services, reviews | `src/pages/Restaurant.tsx` (info tab) | PARTIAL — reviews list static |
| `restaurant-shell.html:2474-2520` | search-overlay sections (recent / popular / bestsellers / browse) | `src/components/SearchOverlay.tsx` | DONE |
| `restaurant-shell.html:2741` | dish-details sheet shell (`.ds-sheet`) | `src/components/CustomizeSheet.tsx` | DONE |
| `restaurant-info.html` + `js/restaurant-info.js` | info tab content | `Restaurant.tsx` info tab | PARTIAL |
| `restaurant-details.html` | redirect shim to `/restaurant?id=` | hash route `/restaurant/:id` | N/A (no shim needed) |
| `api/restaurant-seo.js` | SEO head + shell injection | N/A — SPA | N/A |
| `tools/css-bundles.json` → `restaurant` (32 sheets, `css/restaurant.bundle.css`) | page CSS | `src/styles/original/restaurant.bundle.css` (scoped `navereatRestaurant`) | DONE |

### 1.2 JS modules

| Source | Behaviour | Target | Status |
| --- | --- | --- | --- |
| `api.js:1-265` | base URL, timeout, one error shape, session cache | `src/api/liveApi.ts` (typed stub) + `src/data/api/http.ts` | PARTIAL — demo path has no network |
| `cart-bar.js` | floating cart bar + qty sync | `src/components/CartBar.tsx` | DONE |
| `js/ew-availability.js:1-163` | availability class/labels/badges | `src/logic/availability.ts` | DONE (1:1, 37 parity tests) |
| `js/ew-bill.js:1-174` | quote → itemised rows | `src/logic/bill.ts` | DONE (21 parity tests) |
| `js/ew-freedelivery.js:1-114` | free-delivery copy/state | `src/logic/freeDelivery.ts` | DONE (44 parity tests) |
| `js/ew-image-guard.js` | image error → placeholder | `src/components/RestaurantMenuItem.tsx` `onError` | DONE |
| `js/ew-menu-cache.js` | menu cache + TTL | `src/data/demoDataSource.ts` (in-memory cache) | PARTIAL |
| `js/ew-money.js:1-101` | Indian money formatting | `src/logic/money.ts` | DONE (141 parity tests) |
| `js/ew-offer-popup.js` | queued offer popup, coupon card | `src/components/OfferPopup.tsx` | DONE |
| `js/ew-pricing.js:1-197` | debounced stale-safe quote controller | `src/logic/pricingController.ts` | DONE (11 tests) |
| `js/ew-tracking.js` | menu view events | N/A — no analytics in demo | N/A |
| `js/ew-customize-sheet.js` | variant/add-on sheet | `src/components/CustomizeSheet.tsx` | DONE |
| `js/menu-jump.js` | category jump nav + scroll spy | `src/components/menu/MenuCatNav.tsx` | DONE |
| `js/pairing-suggestions.js` | "goes well with" rail | `src/components/CompleteYourMeal.tsx` | DONE |
| `search-overlay.js` + `search-overlay.css` | search overlay, recent searches | `src/components/SearchOverlay.tsx`, `src/styles/search-overlay.css` | DONE |
| `location-gate.js` | location permission gate | `src/components/reveal/RevealGate.tsx` | PARTIAL — no real geolocation |
| `service-closed-gate.js` + `service-closed-gate.css` | closed screen + countdown | `src/components/ServiceClosedGate.tsx` | DONE |
| `safe-html.js` | HTML escaping helper | React escaping / `src/lib/*` | N/A |
| `navigation.js` | back-nav parent map | `src/lib/navigation.ts` | DONE |
| `address-store.js` | address persistence | `src/api/demoApi.ts` (users/addresses) | DONE |

### 1.3 Menu-page UI states

| State | Source | Target | Status |
| --- | --- | --- | --- |
| Skeleton while menu loads | `restaurant-shell.html` skeleton blocks | `src/components/menu/MenuSkeleton.tsx` | DONE |
| Veg / non-veg toggle | `filter-bar.css` + `restaurant-shell.html` | `src/components/menu/MenuFilterBar.tsx` | DONE |
| Bestseller / filters | `css/filters.css` | `MenuFilterBar` + `MenuFiltersProvider` | DONE |
| Out-of-stock item | `ew-menu-card.css` `.is-sold-out` | `RestaurantMenuItem` (`soldOut`) | DONE |
| Closed / unavailable restaurant | `service-closed-gate.js` | `ServiceClosedGate` | DONE |
| Free-delivery strip | `ew-freedelivery.js` | `src/components/menu/MenuFreeDeliveryStrip.tsx` | DONE |
| Offer popup (auto) | `ew-offer-popup.js` | `OfferPopup` + `CartOfferWatcher` | DONE |
| Pairing suggestions | `pairing-suggestions.js` | `CompleteYourMeal` | DONE |
| Cart bar | `cart-bar.js` | `CartBar` | DONE |
| Search overlay | `search-overlay.js` | `SearchOverlay` | DONE |

---

## 2. Checkout page — `cart.html` (474 lines) + `js/cart-page.js` (3,745 lines)

### 2.1 Bundle recipe

`tools/css-bundles.json` → `cart` (26 sheets → `css/cart.bundle.css`), ported as
`src/styles/original/cart.bundle.css` and attached only under
`body.ct-page` / `.cart-page` via `createRouteStyleSheet` (`src/lib/routeStyles.ts`).

### 2.2 DOM / features

| Source | Behaviour | Target | Status |
| --- | --- | --- | --- |
| `cart.html:40` | `#cart-has-items` shell | `Cart.tsx` | DONE |
| `cart.html:42-56` | delivery ETA header | `Cart.tsx` | DONE |
| `cart.html:69` | `#cart-items-list` (aria-live) | `CartItems.tsx` | DONE |
| `cart.html:87-96` | free-delivery nudge strip | `CartFreeDeliveryStrip.tsx` | DONE |
| `cart.html:100-118` | "Complete your meal" upsell | `CartUpsell.tsx` | DONE |
| `cart.html:121-155` | Savings corner (coupon + offer rows) | `CartSavingsCorner.tsx` | DONE |
| `cart.html:160-250` | order-info card, bill, policy | `CartOrderInfoCard.tsx` | DONE |
| `cart.html:254` | empty cart | `Cart.tsx` empty branch | DONE |
| `cart.html:266-267` | `#addr-toast` | `src/store/toastStore.ts` | DONE |
| `cart.html:271-286` | location modal | `Cart.tsx` | TODO |
| `cart.html:288-320` | checkout footer + pay bar | `CartCheckoutFooter.tsx` | DONE |
| `cart.html:326-350` | note sheet | `Cart.tsx` (`sheet === 'note'`) | DONE |
| `cart.html:351-372` | tip sheet | `Cart.tsx` (`sheet === 'tip'`) | DONE |
| `cart.html:374-384` | payment-method sheet | `CartPaySheet.tsx` | DONE |
| `cart.html:385-400+` | coupon sheet | `Cart.tsx` (`sheet === 'coupon'`) | DONE |
| `js/cart-page.js:723-844` | item rows, steppers | `CartItems.tsx`, `CartLineRow.tsx` | DONE |
| `js/cart-page.js:845-900` | bill paint | `CartBillSheet.tsx` | PARTIAL — delivery/tax/packaging rows fixed at ₹0 |
| `js/cart-page.js:104-110` | distance → delivery fee | `src/logic/pricingEngine.ts` | DONE (logic only) |
| `js/cart-page.js:598-644` | note / tip / instruction persistence (`nearbite_cart_extras`) | `Cart.tsx` `readCartExtras` | DONE |
| `js/cart-page.js:1179-1302` | checkout CTA gating | `CartCheckoutFooter.tsx` | PARTIAL — no address gate |
| `js/cart-page.js:1445-1457` | toast | `toastStore` + `ToastHost` | DONE |
| `js/cart-page.js:1563-1770` | order success / COD / failed / pending | `OrderSuccessSheet.tsx` + `src/pages/PaymentResult.tsx` (`/payment/:result`) | DONE |
| `js/cart-page.js:1773-2274` | Razorpay checkout | **mock payment sheet** (`?demo=payment=…`) | N/A (demo) |
| `js/cart-page.js:2316-2386` | sheet open/close, focus trap, Esc, scrim | `src/components/Sheet.tsx` | DONE |
| `js/cart-page.js:2387-2465` | restaurant note card/pill | `Cart.tsx` note sheet | DONE |
| `js/cart-page.js:2466-2501` | delivery-instruction pills | `CartOrderInfoCard.tsx` | DONE |
| `js/cart-page.js:2502-3151` | complete-your-meal track/tabs | `CartUpsell.tsx` | DONE |
| `js/cart-page.js:3152-3200` | savings hero/corner | `CartSavingsCorner.tsx` | DONE |
| `js/cart-page.js:3299-3380` | tip chips + validation | `Cart.tsx` + `cartConstants.ts` | DONE |
| `js/cart-page.js:3380-3520` | delivery summary, instructions | `CartOrderInfoCard.tsx` | PARTIAL — address row is read-only |
| `js/cart-page.js:3661-3672` | location prompt | `Cart.tsx` | TODO |

### 2.3 Checkout JS modules

| Source | Behaviour | Target | Status |
| --- | --- | --- | --- |
| `cart-popups.js` | sheet plumbing | `src/components/Sheet.tsx` | DONE |
| `cart-quote-ui.js` | quote wiring into the bill | `CartTotalsProvider.tsx` | PARTIAL — bill is local, not quote-driven |
| `cart-checkout-upgrades.js` | CTA upgrades | `CartCheckoutFooter.tsx` | DONE |
| `cart-order-card.js` | order card | `CartOrderInfoCard.tsx` | DONE |
| `js/ew-coupon.js:1-663` | validate → quote authority, wording | `src/logic/coupon.ts` | DONE (28 parity tests) |
| `js/ew-quote.js:1-310` | payload, totals, expiry, controller | `src/logic/quote.ts`, `pricingController.ts` | DONE |
| `js/ew-pricing.js` | quote fetch controller | `pricingController.ts` | DONE |
| `js/ew-promo.js` | promo strip | `CartFreeDeliveryStrip.tsx` | DONE |
| `js/ew-bill.js` | bill rows | `src/logic/bill.ts` | DONE |
| `js/checkout-key.js:1-269` | idempotency key + payload fingerprint | `src/logic/checkoutKey.ts` | DONE (15 parity tests) |
| `js/order-payload.js:1-117` | POST /orders body | `src/logic/orderPayload.ts` | DONE (8 parity tests) |
| `js/payment-state.js:1-185` | payment outcome classification | `src/logic/paymentState.ts` | DONE (77 parity tests) |
| `js/payment-verify.js` | `/payments/verify` polling | `demoApi.verifyPayment` | PARTIAL — no polling loop |
| `js/order-success-sheet.js` | success sheet + confetti | `OrderSuccessSheet.tsx` | DONE |
| `platform-status.js` | `/platform/public-status` | `src/data/dataSource.ts` | DONE |
| `js/auth-token.js` | token reader | `src/store/appStore.ts` | DONE |

---

## 3. Connected pages

| Source | Target | Status |
| --- | --- | --- |
| `index.html` restaurant cards → menu | `src/pages/Home.tsx` → `/restaurant/:id` | DONE |
| `under99.html` items → same cart | `src/pages/Under99.tsx` | DONE |
| `search.html` | `SearchOverlay` + `/category/:type` | DONE |
| `login.html` (return-to flow) | `src/pages/Login.tsx` | PARTIAL — no `nearbite_after_login` return path |
| `address.html` / `address-new.html` (+`address-api/-model/-new/-sheet/-store.js`, `address-flow.css`, `address-v3.css`) | `src/pages/Address.tsx` + `/address` route | TODO |
| `payment-success.html` / `payment-failed.html` / `payment-pending.html` | `/payment/:state` route | TODO |
| `track-order.html` + `track-map.js` | `src/pages/Track.tsx` (`/track/:id`) | DONE (static map) |
| `orders.html` | `src/pages/Orders.tsx` | DONE |
| `profile.html` / `complete-profile.html` | `src/pages/Profile.tsx` | PARTIAL — no complete-profile |
| `support.html` | — | TODO |
| `location-onboarding.html` | `RevealGate` | PARTIAL |
| `category.html` | `src/pages/Category.tsx` | DONE |

---

## 4. Popups, sheets, modals, toasts, states

| Surface | Source | Target | Status |
| --- | --- | --- | --- |
| Cart note sheet | `cart.html:326` | `Cart.tsx` | DONE |
| Cart tip sheet | `cart.html:351` | `Cart.tsx` | DONE |
| Cart payment-method sheet | `cart.html:374` | `CartPaySheet.tsx` | DONE |
| Cart coupon sheet | `cart.html:385` | `Cart.tsx` | DONE |
| Cart bill sheet | `cart-page.js:192` | `CartBillSheet.tsx` | DONE |
| Cart location modal | `cart.html:271` | — | TODO |
| Cart address toast | `cart.html:266` | `toastStore` | DONE |
| Menu offer popup | `ew-offer-popup.js` | `OfferPopup.tsx` | DONE |
| Menu customize sheet | `ew-customize-sheet.js` | `CustomizeSheet.tsx` | DONE |
| Menu search overlay | `search-overlay.js` | `SearchOverlay.tsx` | DONE |
| Service-closed screen | `service-closed-gate.js` | `ServiceClosedGate.tsx` | DONE |
| Order-success sheet | `order-success-sheet.js` | `OrderSuccessSheet.tsx` | DONE |
| Payment result pages | `payment-*.html` | — | TODO |
| Skeletons | menu / cart / home | `MenuSkeleton`, `CartSkeleton`, `RevealGate` | DONE |
| Empty / error states | menu, cart, orders | `Cart.tsx`, `Orders.tsx`, `RouteErrorScreen.tsx` | DONE |

Animations: sheet scrim/slide, stepper, offer popup and toast durations come
from `css/ew-sheet-motion.css` and `cart.bundle.css`, which are loaded
unmodified (see `src/styles/original/ew-sheet-motion.css`).

Keyboard / back: `Sheet.tsx` implements Esc, scrim click, focus trap and
`aria-modal`; `useBackButton` closes the top sheet before the route pops
(`src/lib/sheetStack.ts`).

---

## 5. Storage keys (byte-compatible)

All keys keep the legacy `nearbite_` prefix. No rename was applied, because the
brief allows the prefix to be kept when the app already uses it (it does — see
`src/store/appStore.ts` `STORAGE_KEYS`).

| Key | Written by | Target | Status |
| --- | --- | --- | --- |
| `nearbite_cart` | `cart-page.js:645` | `appStore` | DONE |
| `nearbite_cart_before_auth` | login return | — | TODO |
| `nearbite_checkout_key` | `checkout-key.js:35` | `logic/checkoutKey.ts` | DONE |
| `nearbite_checkout_fp` | `checkout-key.js:36` | `logic/checkoutKey.ts` | DONE |
| `nearbite_checkout_fp_ts` | `checkout-key.js:37` | `logic/checkoutKey.ts` | DONE |
| `nearbite_payment_method` | `cart-page.js:63` | `Cart.tsx` state | PARTIAL — not persisted |
| `nearbite_address` | `address-store.js` | `demoApi` addresses | DONE |
| `nearbite_selected_address_id` | `address-store.js` | `demoApi` addresses | DONE |
| `nearbite_token` | `auth-token.js` | `appStore` | DONE |
| `nearbite_user` | `api.js` session | `appStore` | DONE |
| `nearbite_after_login` | login return | — | TODO |
| `token` | legacy auth | `appStore` (reads `nearbite_token`) | PARTIAL |
| `eatswada_theme` | `eatswada-theme.js` | `navereat` has no theme switch | N/A |
| `eatswada_header_theme` | `eatswada-header-theme.js` | `scrollHeaderMotion` | N/A |
| `es_image_dict` | `ew-image-guard.js` | image `onError` | N/A |
| `nearbite_cart_extras` | `cart-page.js:609` | `Cart.tsx` | DONE |
| `nearbite_orders` | `cart-page.js` | `appStore` | DONE |
| `ew_just_placed` | `cart-page.js` | — | TODO |
| `nearbite_onboarding_location` | `location-onboarding.html` | — | N/A |
| `nearbite_payment_method` | see above | see above | PARTIAL |

---

## 6. API surface (same shapes as `api.js` / `cart-page.js`)

Everything is behind `src/api/restaurantApi.ts`. Paths are kept verbatim so the
live adapter can be switched on without touching UI code.

| Method | Endpoint | Request | Response used | Status |
| --- | --- | --- | --- | --- |
| `getRestaurant` | `GET /restaurants/:id` | id | restaurant + menu | DONE (demo) |
| `getMenu` | `GET /restaurants/:id/menu` | id | menu items | DONE (demo) |
| `getQuote` | `POST /pricing/quote` | `{restaurantId,addressId,items,paymentMethod,couponCode?,tipAmount?}` | quote `{bill,freeDelivery,distance,quoteId,…}` | DONE (demo calls `computeQuote`) |
| `validateCoupon` | `POST /coupons/validate` | `{code,subtotal,restaurantId,paymentMethod}` | `{success,data,offer}` | DONE (demo) |
| `createOrder` | `POST /orders` | `orderPayload.build()` | `{orderId,paymentStatus,total,…}` | DONE (demo, idempotent) |
| `createPayment` | `POST /payments/create` | `{orderId,amount,method}` | `{paymentId,status}` | DONE (mock) |
| `getPaymentStatus` | `GET /payments/:id` | id | `{status}` | DONE (mock) |
| `verifyPayment` | `POST /payments/verify` | `{paymentId,orderId,signature?}` | `{success,order}` | DONE (mock) |
| `getProfile` | `GET /users/profile` | — | user | DONE (demo) |
| `getAddresses` | `GET /users/addresses` | — | address[] | DONE (demo) |
| `saveAddress` | `POST /users/addresses` | address | address | DONE (demo) |
| `deleteAddress` | `DELETE /users/addresses/:id` | id | `{success}` | DONE (demo) |
| `getPlatformStatus` | `GET /platform/public-status` | — | status | DONE (demo) |

Error contract: `ApiFailure { kind: 'network'|'timeout'|'parse'|'shape'|'http'|'auth', status?, code?, message, retryable }`
with the original user-facing strings (`api.js:38-47`).

---

## 7. Phase 1 logic parity (verified)

| Legacy file | TS module | Parity tests |
| --- | --- | --- |
| `js/ew-money.js` | `src/logic/money.ts` | 141 |
| `js/ew-bill.js` | `src/logic/bill.ts` | 21 |
| `js/ew-freedelivery.js` | `src/logic/freeDelivery.ts` | 44 |
| `js/ew-quote.js` + `js/ew-pricing.js` | `src/logic/quote.ts` | 28 |
| `js/ew-pricing.js` QuoteController | `src/logic/pricingController.ts` | 11 |
| `js/ew-coupon.js` | `src/logic/coupon.ts` | 28 |
| `js/checkout-key.js` | `src/logic/checkoutKey.ts` | 15 |
| `js/order-payload.js` | `src/logic/orderPayload.ts` | 8 |
| `js/payment-state.js` | `src/logic/paymentState.ts` | 77 |
| `js/ew-availability.js` | `src/logic/availability.ts` | 37 |
| — (new) | `src/logic/pricingEngine.ts` | 6 |

Total: **410** assertions, run with `npm test`. The oracle files are verbatim
copies in `tests/original/`; the only edits are the neutralised pricing base URL
in `ew-pricing.cjs` (never exercised by the tests) and no other change.

---

## 8. Known original defects reproduced / recorded

1. `ew-bill.js` `rowsFromQuote` always emits the food subtotal even when it is
   zero, and labels it "Item total" — reproduced.
2. `ew-freedelivery.js` treats `available === false` as "show the fee" but still
   returns `status: 'unavailable'`; the copy is empty — reproduced.
3. `checkout-key.js` `stable()` serialises `undefined` as `null`; reproduced.
4. `ew-coupon.js` `buildOffer` defaults `showPopup` to `true` when the flag is
   absent — reproduced.
5. `cart-page.js` `paintBill` shows `Delivery Fee` with a skeleton until the
   quote resolves; reproduced with `CartSkeleton`/`SlideReveal`.

No behaviour was "fixed" beyond the branding rule.

---

## 9. Deviations

| Requirement | Deviation | Reason |
| --- | --- | --- |
| Razorpay | Mock payment sheet with success / failure / pending | Demo mode; no gateway script is loaded |
| Firebase push / VAPID | Not ported | Demo mode; no Firebase config copied |
| Real geolocation | Saved-address distance only | No device permission in demo |
| Branding | Neutral "Navereat" copy, no Eatswada logo/domain/support text | Branding rule |
| `api.js` base URL | Not copied | Branding rule; live adapter reads `VITE_API_BASE_URL` |
| Cart bill delivery/tax/packaging rows | Fixed at ₹0 in the rendered bill | The engine computes them, but the current cart layout is the zero-fee demo shell; tracked as TODO in §2.2 |


---

## 10. Delivery status (demo mode)

| Area | Status | Notes |
| --- | --- | --- |
| Logic port (Phase 1) | DONE | 410 parity assertions, original JS loaded as an oracle |
| CSS bundles (Phase 2) | DONE | `src/styles/original/{restaurant,cart,payment,address}.bundle.css`, rebuilt from the source lists |
| `/restaurant/:id` | DONE | menu, filters, veg toggle, customize sheet, offer popup, pairing, menu jump, cart bar, closed states |
| `/cart` | DONE | items + stepper, upsells, coupon/tip/note/pay sheets, bill, address row, place order |
| `/payment/:result` | DONE | success / failed / pending, ported from the three legacy pages with the same markup |
| `/address` | PARTIAL | select view, saved list, add form, delete, `?return=cart`. The map picker and geocoding UI are omitted (demo) |
| `/track/:id`, `/orders`, `/profile` | DONE (pre-existing) | reached from the new flows |
| `/login` | DONE (pre-existing) | return flow unchanged |
| Data adapter | DONE | `src/api/restaurantApi.ts` + `demoApi` / `liveApi` stub |
| Demo scenarios | DONE | `?demo=` panel: closed, out of stock, quote error, slow, empty cart, zone fees, offer, coupon, free delivery, address, payment result |
| Payment gateway | MOCK | `MockPaymentSheet` returns success / failure / pending; no Razorpay script |
| Push / VAPID / Firebase | NOT PORTED | no config copied (branding rule) |
