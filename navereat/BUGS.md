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

## Open / by design

- The `ct-item-actions` chip row scrolls horizontally at 390 px and the third
  chip is clipped at rest. This is the legacy behaviour
  (`.ct-page .ct-item-actions{flex-wrap:nowrap;overflow-x:auto}`); reproduced,
  not fixed (rule: do not modernise UX).
- "Use my current location" shows the demo-unavailable toast instead of asking
  for geolocation (demo mode).
