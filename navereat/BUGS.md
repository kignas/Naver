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

## Open / by design

- The `ct-item-actions` chip row scrolls horizontally at 390 px and the third
  chip is clipped at rest. This is the legacy behaviour
  (`.ct-page .ct-item-actions{flex-wrap:nowrap;overflow-x:auto}`); reproduced,
  not fixed (rule: do not modernise UX).
- `CtBill` delivery/tax/packaging rows are ₹0 in the demo restaurant
  (`PLATFORM_FEE = 0`, zero zone fees). The engine supports them; see
  PARITY.md §9.
- "Use my current location" shows the demo-unavailable toast instead of asking
  for geolocation (demo mode).
