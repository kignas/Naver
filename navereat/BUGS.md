# BUGS — menu + checkout port (demo mode)

Found while running the Phase 4 journeys (old zip vs. new app) and the
scenario sweep. Every entry lists the symptom, the cause, and the fix.

## Fixed

### 1. Payment pages collapsed the whole app to 0 px wide
`css/payment.bundle.css` styles `body` as a centred flex card
(`display:flex; padding:clamp(18px,4vw,32px)`). Importing the bundle unchanged
applied those rules to the app's own `<body>`, so `#root` became a zero-width
flex item and every route rendered inside a 0 px shell.
**Fix:** the bundle's `body{…}` block is now scoped to `.payment-page`, and the
route mounts `div.payment-page` (absolute, `inset:0`, own scroll) around the
legacy `<main class="ew-result">` markup. Verified: `#root` = 390 px.

### 2. `/address` rendered an empty screen
`address.bundle.css` hides `#selectView` unless
`html[data-address-view="select"]` is set (the legacy `address.js` sets it).
**Fix:** the page sets `document.documentElement.dataset.addressView = 'select'`
on mount and removes it on unmount.

### 3. Address rows truncated to "Ho…", "42", "Dem…"
The legacy list item is a three-column grid (`icon | copy | more`); the port had
only the middle column. **Fix:** rows now render `.ls-ico`, `.ls-item-main` and
`.ls-more` with the legacy icon set, so the grid and truncation rules match.

### 4. Placing an order never reached the data layer
`Cart.tsx` still built orders from the store. **Fix:** `place` → `api.createOrder`
(idempotency key from `logic/checkoutKey`) → `api.createPayment` →
`api.verifyPayment` → `recordOrder`, then `/payment/{success|failed|pending}`.

### 5. Coupon apply ignored the coupon service
`handleApply` called the local matcher only. **Fix:** it now calls
`api.validateCoupon` (same endpoint shape as `POST /coupons/validate`), then
applies the code locally; invalid/expired produce the legacy failure toast and
inline error.

### 6. The `ctp` sheet root lost its id
`Sheet` rendered the `ctp` variant root without the `id`, so `#ct-bill-sheet`
(and the other popup ids in `cart.html`) did not exist. Anything keyed on the
root id — the legacy CSS, the demo scripts, `document.getElementById` checks —
silently found nothing. **Fix:** the root carries `id={id}` again, the body
keeps `${id}-body`, as `cart-popups.js` `sheetShell()` builds it.

### 7. `ctp-root` lost the cascade to the shared sheet root
Legacy injected `cart-popups.js`' CSS after the page bundle, so its
`.ctp-root{flex-direction:column;align-items:center;justify-content:flex-end}`
beat `.ct-sheet-root{align-items:flex-end;justify-content:center}`. Here the
route bundle is attached later, so the flex row settings won: the close button
sat at the top-right of the viewport instead of centred above the panel and the
panel lost its bottom alignment. **Fix:** the copy scopes the rule to
`.ct-sheet-root.ctp-root` so it wins regardless of load order. Verified against
the 393 px viewport: root is `column / center / flex-end`, the 44 px close
button sits 12 px above the panel.

### 7. The checkout CTA skipped four of the legacy gates
`updateCheckoutCta()` has six gates (unavailable, quote block, logged out,
restaurant minimum, minimum order, address). The port only painted the
unavailable/quote ones and toasts, so a logged-out or address-less customer saw
a live-looking "Proceed to Pay", the restaurant minimum was never enforced, and
the address gate was a toast instead of the location dialog.
**Fix:** `src/logic/checkoutCta.ts` ports the gates in the legacy order with the
exact labels (17 tests); `CartTotalsProvider` derives the view from the cart,
the footer paints it, and `handlePlace` runs `ctaBlockedToast` + the shake and
opens `#ct-location-modal` for a missing address, as `placeOrder()` did.

### 8. A guest could not open the cart at all
`App.tsx` sent every route except `/login` to the login wall, so the legacy
guest path (fill a cart, see "Log in to order", log in and come back) was
unreachable and the return flow could never be exercised.
**Fix:** `/cart` and `/restaurant/*` are now open to guests, matching the legacy
policy (browsing and the cart are anonymous; the wall arrives at Order). The tab
routes keep the demo's startup wall.

### 9. Login return landed on Home instead of the cart
`login()` re-renders synchronously through the external store, so the shell's
"token while on /login -> go Home" effect fired before Login's own
`nav.reset('/cart')` and replaced it. The cart was restored but the customer
ended up on Home with the cart pill only.
**Fix:** Login marks its target with `markLoginNavigation()` before `login()`;
the shell consumes the mark and backs off. Verified end to end: guest cart ->
pay sheet -> confirm -> `/login` (`nearbite_after_login = /cart`) -> OTP ->
`#/cart` with the cart intact and the CTA on "Add ₹100 more".

### 10. The cart never actually called `POST /pricing/quote`
`demoApi` exposed a synchronous `quoteSync()` twin of `getQuote()`, and nothing
in the cart called either: the bill painted the client estimate, so the legacy
pending note, the quote rows, the blocked card and `Try again` were all
unreachable code. A real backend cannot answer synchronously, so the port kept
a path that could never run in production.
**Fix:** `quoteSync` deleted from the interface, `demoApi` and `liveApi`.
`hooks/useCartQuote.ts` re-quotes 200 ms after any basket / address / method
change (legacy `schedule()`), drops stale answers, and drives the sheet:
`Calculating your bill…` while pending, `rowsFromQuote()` rows when ready, and
the `ew-qb-blocked` card (`We couldn’t price your order` + `Try again`) on
failure, with the CTA locked to `Price unavailable` / `Tap Try again in your
bill`. The latest `quoteId` now travels in `POST /orders`. Verified:
`?demo=quote-error` → locked CTA + card + retry, clearing the flag → CTA back
on `Proceed to Pay`, zero console errors.

### 11. `?demo=payment=verifySlow` (and Flaky/Timeout) did nothing
Two defects stacked: the flag parser lower-cased every value, so the camelCase
`verifySlow` / `verifyFlaky` / `verifyTimeout` never matched; and the cart
always passed an explicit `outcome` from the mock sheet, which outranked the
scenario inside `verifyPayment`. The polling loop existed but could not be
reached.
**Fix:** the payment values are mapped through a table (lower-case key →
canonical verdict), and a `verify*` scenario now outranks the mock outcome.
Verified in a browser: `verifySlow` reconciles through a 409 capture race and
ends on the placed order, `verifyTimeout` lands on `/payment/pending`.

### 12. The performance gate was red on `main` because its fixture could not pay
`scripts/perf-check.mjs` seeds a cart of 1 × Masala Dosa (₹99) for restaurant 1,
whose minimum is ₹149. Once the six checkout gates landed the CTA rendered
`Add ₹50 more` with `aria-disabled="true"`, so the gate's
`locator('.ct-cta').first().click()` waited 30 s and the whole
`Navereat performance gate` workflow failed on every push since. Nobody noticed
because only the APK workflow was being watched.
**Fix:** the seeded basket is 2 × Masala Dosa (₹198), which clears the
minimum, so the measured push → cart → pay → track journey runs again. The gate
now completes locally; its two marginal FPS numbers (53.7 fps against a 55 fps
budget on this container) are machine noise — the same numbers appear with the
quote code reverted.


## Open / by design

- The `ct-item-actions` chip row scrolls horizontally at 390 px and the third
  chip is clipped at rest. This is the legacy behaviour
  (`.ct-page .ct-item-actions{flex-wrap:nowrap;overflow-x:auto}`); reproduced,
  not fixed (rule: do not modernise UX).
- "Use my current location" shows the demo-unavailable toast instead of asking
  for geolocation (demo mode).
