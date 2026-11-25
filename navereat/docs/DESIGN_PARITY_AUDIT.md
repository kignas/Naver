# Design-parity audit — Navereat vs the current Eatswada frontend (STEP 1)

Status: **design-parity batches 1–4 complete; the three residual states
(cart payment sheet, search overlay, offer popup) closed on 2026-11-25.**
Reference: `kignas/Nearbite` (read-only copy at `$ORIGINAL_DIR`; not inside this
repo). The numbers below are from the 2026-11-25 run.

## How to reproduce

```bash
ORIGINAL_DIR=/workspace/reference/Nearbite-main npx vite-node scripts/design-parity.ts
```

The harness serves the original static site (port 4183) and this app
(`vite preview`, port 4184) side by side, drives both with the same mocked API
and the same seeded `localStorage`, and writes:

| path | content |
| --- | --- |
| `verify/parity/original/<state>.png` | original frontend |
| `verify/parity/navereat/<state>.png` | this app |
| `verify/parity/diff/<state>.png` | pixel diff (`pixelmatch`, threshold 0.12) |
| `verify/parity/side/<state>.png` | original ǀ navereat strip |
| `verify/parity/report.json` | diff % + computed-style/geometry probes |

`verify/` is git-ignored, so screenshots stay local. 34 states are captured:
login, home (0, scrolled, collapsed header, filter sheet, cart-bar clear/empty),
search (idle, typing, results, empty), ₹99 Store, Category, Restaurant (top,
filters, scrolled, customization open/selected/scrolled/error), Cart (items,
scrolled, coupon list, cooking sheet, tip sheet, payment sheet, empty), offer
popup, order processing, order placed, Orders, Tracking, Profile.

## Headline numbers

Diff % = fraction of differing pixels over the 390×844 viewport (device scale 2).
Anything above ~3 % is visible without a magnifier. Numbers are stable across
runs (a blank-frame screenshot is retried up to 4×).

| screen / state | diff | verdict |
| --- | --- | --- |
| cart-empty | 0 % | parity |
| search-idle | 0 % | parity |
| customization-open | 0.03 % | parity |
| customization-selected | 0.03 % | parity |
| customization-scrolled | 0.03 % | parity |
| cart-payment-sheet | 0.12 % | parity — was 24.48 % |
| profile | 0.13 % | parity |
| cart-cooking-sheet | 0.22 % | parity |
| login | 0.26 % | parity |
| cart-tip-sheet | 0.28 % | parity |
| order-placed | 0.46 % | parity |
| under99 | 0.52 % | parity — was 14.52 % |
| order-processing | 0.66 % | parity |
| cart-scrolled | 0.67 % | parity |
| home-filter-sheet | 0.71 % | 1 rail label (original prints "true") |
| cart-items | 0.72 % | parity |
| search-typing / search-results | 1.1 % | parity — was 4.61 % |
| customization-error | 1.19 % | behaviour note |
| restaurant-filters | 1.19 % | parity |
| restaurant-top | 1.67 % | parity |
| restaurant-scrolled | 1.67 % | parity |
| offer-popup | 2.21 % | content only — was 58.42 % |
| search-empty | 2.37 % | parity |
| category | 2.49 % | parity |
| orders | 2.90 % | demo data |
| home | 3.44 % | demo data + cart-bar offset |
| home-cartbar-empty | 3.44 % | cart-bar offset only |
| home-cartbar-clear | 3.46 % | cart-bar offset only |
| home-scrolled | 4.68 % | cart-bar offset only |
| tracking | 9.52 % | map block (intentional) |
| home-searchrow-style | 14.13 % | intended compaction |
| cart-coupon-list | 15.93 % | demo data |
| home-header-collapsed | 39.60 % | original has no pinned bar |

## Cross-cutting defects (each explains several rows)

### C1. Body content is inset 16 px too far on every content page
`main` in this app adds `padding: 18px 16px 24px` on top of the page's own
`16px` side padding, so content sits at **32 px** instead of the original's
**16 px**.

| element | original | app |
| --- | --- | --- |
| `main` padding | `4px 0 0` | `18px 16px 24px` |
| `#restaurant-list > .u99-card-host` | `x16 w358` | `x32 w326` |
| `#restaurants-title` | `x18` | `x34` |
| `.cat-name` (category label) | `x31` | `x47` |
| `.filter-pill` | `x18` | `x34` |
| `.u99-product-card` (₹99) | `x18 w170` | `x34 w154` |
| `.u99-products-title` (₹99) | `x18` | `x34` |

Consequence: restaurant cards are 32 px narrower, 2-up ₹99 cards are 16 px
narrower and 10 px shorter, and 4th category icons / chips get clipped.
Fix once in the shared page wrapper → removes most of Home, ₹99 and Category.

### C2. ₹99 Store hero copy is dark instead of white
`.u99-hero-copy` inherits `color: #fff` in the original, but the child rules win
in this app:

| element | original | app |
| --- | --- | --- |
| `.u99-hero-copy h1` ("₹99") | `#FFFFFF` | `#1C2024` |
| `.u99-hero-copy strong` ("Meals under") | `#FFFFFF` | `#1C2024` |
| `.u99-sub` ("Great food. Lower prices. Everyday.") | `#FFFFFF` | `#697077` |

Also `.u99-hero` starts at `y0` in the original and `y4` here (a 4 px wrapper
offset on the ₹99 page).

### C3. Home restaurant card title is grey instead of ink
`.u99-restaurant-name` is `#101828` in the original and `#7B8190` in this app —
the restaurant names read as disabled text.

### C4. Home filter chips are 2 px smaller
`.filter-pill` font-size `14px` (original) vs `12px` (app); same padding, radius
and shadow. Makes the Home chip row visually lighter.

### C5. Missing ids used by the original markup
The design is close but these hooks are **classes** here instead of the
original's ids (they are also what the original CSS/JS targets):

`#ct-bill` → `.ct-bill`, `#status-title` → `.status-title`,
`#note-sheet-title`, `#tip-sheet-title`, `#ct-pay-sheet`, `#pay-sheet-title`,
`#ct-pay-sheet-opts`, `#wc-clear-cancel`.

### C6. Root type scale
Container text resolves to `16px` in the original and `15px` here (the app sets
a 15 px base). Only elements that use `em`/inherit are affected, but it is what
produces most of the `fs16px → fs15px` probe noise.

## Per-screen findings

### Home (`home` 8.61 %, `home-scrolled` 13.85 %)
* C1 (16 px inset), C3 (grey names), C4 (12 px chips).
* Section title copy: original **"Recommended with deals"**, app
  **"Restaurants near you"** (w209 vs w177 px).
* Cart bar sits 74 px higher (`y770` → `y696`) — a direct consequence of the
  floating bottom nav (intentional), see “Intentional differences”.
* Hero art: the dish is ~4–6 px right and ~3 % larger than the original; the
  copy (`Good Food / Closer to Home.`), CTA and banner colours match exactly
  (`banner-title` identical at `x38 y136 w163 h47`, 23 px/900).
* Header (location row + search + VEG) matches at scrollTop 0.
* Collapsed header: intended, the original scrolls its header away (see below).

### Home filter sheet (`home-filter-sheet` 7.09 %)
Design is at parity except the 5th rail item: the original renders the literal
label **"true"** (an upstream bug) with a slider icon; this app renders
**"Offers"** with a gift icon. Everything else (rail, sort list, "Clear all",
"Show results", sheet geometry) matches.

### ₹99 Store (`under99` 14.52 %)
* C2 (hero copy colour) — the single most visible defect on this screen.
* C1 (16 px inset) — product grid and section title.
* `.u99-hero` +4 px (C2 note).
* `.u99-products-title` / `.u99-product-name` ink `#20232D` in the original vs
  `#1C2024` here (minor token mismatch).
* Cart-bar / nav offsets as on Home.

### Category (`category` 5.28 %)
* **Result card**: original is a tinted card with a shadow
  (`x16 w358 h121`), this app is flat white without a shadow
  (`x20 w350 h112`).
* **Result title**: original `20px/800`, app `16px/900`; cuisine/meta line
  original `11px/600 #697077`, app `12px/500 #9CA3AF`.
* **Filter row**: original `Top rated first · Ratings 4.0+ · Pure Veg` (radius
  999 px pills); app `Filter · Sort By · Ratings 4.0+ · Pure Veg` (radius 14 px)
  — two extra controls, one original control dropped.
* Missing "Add ₹399 more to unlock free delivery" line in the app's result card.
* Markup uses a `.cat-*` namespace instead of the original
  `.res-card / .res-name / .res-cuisine`.

### Restaurant (`restaurant-top` 14.69 %, `restaurant-filters` 1.28 %, `restaurant-scrolled` 15.36 %)
* Header, rating pill, distance row, free-delivery banner, tabs, quick filters
  and menu rows are at parity (filter bar element diff 1.28 %, chip widths
  91→93 px, ±3 px positions).
* The 14–15 % full-screen numbers come from the cart bar / order-review bar
  being 74 px higher (floating nav) plus the 16 px inset on menu rows.
* Customization sheet: open 1.22 %, selected 1.31 %, scrolled 1.08 % — parity.
* Validation: original keeps the add button enabled and shows the inline error
  (2.27 %); this app disables the button ("Select required options"). Behaviour
  and visual differ.

### Cart (`cart-items` 0.72 %, `cart-coupon-list` 15.93 %, `cart-payment-sheet` 0.12 %)
* Items, unavailable item, cooking sheet, tip sheet, empty cart, processing and
  placed sheets: **parity** (≤ 1 % except 2.27 % error state).
* Coupon sheet: chrome matches; content differs because this app ships demo
  coupons (WELCOME50 / FLAT75 / TASTY40) while the original gets `[]` from the
  mocked API → demo data, not design.
* **Payment sheet closed (24.48 % → 0.12 %)**: `#ct-pay-sheet` now mirrors the
  original's method list (no in-sheet CTA, no drag handle, plain rows), and the
  footer `#btn-checkout` is the only place-order control — it opens the sheet,
  the sheet's `#ct-pay-confirm-btn` confirms. The remaining 0.12 % is the
  original's close button sitting outside the captured crop.

### Orders (`orders` 2.90 %)
* Card `y179`→`y173`, height `310`→`308` (minor).
* **"Rate" button missing** on past orders in this app (original has
  `Rate` next to `Order again`).
* Contact icons next to "Track live" are bounded in a circle in the original,
  bare icons here.

### Tracking (`tracking` 9.52 %)
* This app opens with a **live map block** (route, "Re-center" chip,
  "Rahul Das is 1.2 km away · arriving in 12 mins"); the original tracking page
  has no map block and starts with the status card. Everything after that is
  pushed down 209 px (`#status-title` `y93` → `y302`).
* All cards below (status, item list, PIN, rider, progress) match.

### Profile (`profile` 0.13 %)
* Cumulative vertical drift: each section starts ~2–3 px lower than the
  original (`y287` → `y308` by the third card). Rows have slightly more
  height/padding.
* "About Eatswada" → "About Navereat" (intentional rename).

### Login (`login` 0.26 %) and offer popup (`offer-popup` 2.21 %)
* Login is pixel-near-identical (hero art, title lockup, both buttons); the only
  differences are the location line ("around Maynaguri" vs "around Demo City")
  and a ~2 px vertical shift of the button block.
* Offer popup: identical card/mascot/CTA; only the demo amounts differ
  ("above ₹199 / saved ₹26" vs "above ₹399 / saved ₹30"). The earlier 58.42 %
  reading was the sheet auto-closing (5.2 s timer) mid-capture; the harness now
  neutralises long timers on that page, so the state is stable at 2.21 %.

### Search (`search-idle` 0 %, typing/results 1.1 %, empty 2.37 %)
* Closed. The app's search now runs **dishes only** (the original's
  `search-overlay.js` reads `data.menuItems`, never categories) and the result
  rows use the original `.ew-search-result` markup.
* Font: the original's `index.html` sets no body font, so its overlay inherits
  Arial while `under99.html`/`restaurant.html` set Manrope. The app mirrors that
  per context (`#ew-search-root[data-context='home']`), which is what brought
  typing/results from 4.61 % to 1.1 %.
* `search-empty` 2.37 % is the app's own empty-state copy (no original state to
  compare against on the home overlay).

## Already at parity (do not touch)

Cart items, cooking/tip sheets, empty cart, payment sheet, order
processing/placed sheets, customization sheet (all states), restaurant top and
quick filters, login lockup, search overlay (idle/typing/results), offer popup,
home filter sheet (apart from one label).

## Intentional differences (must not be “fixed”)

Floating bottom nav (hence the cart bar sitting 74 px higher), brand rename
(Eatswada → Navereat), demo data (coupon list, thresholds, addresses, offer
amounts, restaurant sections), header collapse/pinned search row + hero parallax
(the original scrolls its header away, so `home-header-collapsed` = 39 % is
expected), the search-row 0.94 compaction (14.4 % element diff), the 5th filter
rail label.

## Remaining work (all intentional or demo data)

* `home-header-collapsed` 39.60 % and `home-searchrow-style` 14.13 % — the app
  pins a compact search row and collapses the header; the original scrolls it
  away. Documented as intentional in the 12C work.
* `cart-coupon-list` 15.93 % — demo coupons vs the mock's empty list.
* `tracking` 9.52 % — the app shows a live map block the original lacks.
* `home` / cart-bar states 3.44–4.68 % — the floating nav lifts the cart bar.

Closed on 2026-11-25: payment sheet (24.48 % → 0.12 %), search overlay
(4.61 % → 1.1 %), offer popup (58.42 % → 2.21 %), ₹99 Store (14.52 % → 0.52 %).
