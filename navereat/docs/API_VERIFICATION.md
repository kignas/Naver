# STEP 2 — read-only pass against the live API

Date: 2026-11-25. Mode: **read-only**. Harness:
`npx vite-node scripts/api-readonly.ts` (add `--fixtures` to re-record).

No order, profile, address, ticket or rating was created. The only `POST`s are
`/pricing/quote` and `/coupons/validate`, which only compute an answer.

Test credentials were **not** present in the environment
(`NAVEREAT_TEST_EMAIL` / `NAVEREAT_TEST_PASSWORD`), so the logged-in flows were
skipped and are listed as such. Nothing was written to the account.

## Results

| flow | expected | app | match |
| --- | --- | --- | --- |
| Home feed | paged `{success,page,pages,total,data}` → cards with name, image, rating, eta, minOrder | 1 restaurant: "Foodie Dosa Restaurant", rating 4.0, eta "30-40 mins", min ₹1, `image` empty → local placeholder | yes |
| Categories | `GET /categories` → active rows with name + image | 10 categories, first "Pizaa" | yes |
| Banners | `GET /home-banners` → active, priority-sorted, mobile image | 1 banner "Welcome to eatswada", placement `home` | yes |
| Closed restaurant state | `isOpen:false` → closed state, ordering disabled | the only restaurant is `isOpen:false` → `available:false` | yes |
| Cards with/without images | empty image → local placeholder; Cloudinary → `f_auto,q_auto,w_480` | 1 restaurant, image absent → placeholder (no broken `<img>`) | yes |
| Search "dosa" / "masala" / "paneer" | `data.menuItems[]` for `scope=home` | **0 results for every scope**, although "Masala Dosa" is on the menu | partial (backend) |
| Restaurant menu | `{category: items[]}` → flat items with price, isVeg, customisations | 22 items in 5 categories, 8 customisation groups, 0 unavailable; first "Masala Dosa" ₹92 veg | yes |
| Customisation groups | title, required, min/max, options[label, extraPrice, isVeg] | "Choose Your Topping" required, max 1, 4 options (Regular +₹0 … Panner and Cheese +₹58) | yes |
| Platform state | `serviceStatus{state,canOrder}`; `closed_manual` + `canOrder:false` locks ordering | `state: closed_manual`, `canOrder: false`, title "That's a wrap for today" | yes |
| Payment options | UPI when `isUpiEnabled`; COD only when `isCodEnabled` | UPI on, **COD off** ("Cash on Delivery — Free"), max COD ₹1000 | partial (backend state) |
| Quote | `bill` in rupees, `itemTotal == Σ price·qty` | **401 `Not authorised — no token provided.`** | blocked (needs a token) |
| Coupon error path | a code such as `COUPON_INVALID` + message | **401 `Not authorised — no token provided.`** | blocked (needs a token) |
| Login / profile / addresses / orders | token + user, then the authed reads | skipped: credentials not set | skipped |

### What the pass changed in the app

* `Restaurant` header: "₹X for two" is hidden when the API does not send
  `priceForTwo` (the field does not exist on the restaurant payload). Demo data
  still shows it, so the demo screens are unchanged.
* Everything else the pass verified needed no change: the mappers already
  handle `{category: items[]}`, `inStock`, the Cloudinary shape and the
  `serviceStatus` block.

## §6 resolutions

| # | unknown | resolution |
| --- | --- | --- |
| 1 | menu payload shape | **settled** — `{success,count,data:{category:[items]}}`; the app also accepts a flat array and `{items:[]}` |
| 2 | customisation group shape | **settled** — `{title,required,minSelect,maxSelect,pricingMode:'extra',options:[{label,extraPrice,isVeg}]}` |
| 3 | item availability flags | **settled** — `inStock` (plus `manualAvailability`, `trackStock`, `stockQuantity`, `pausedUntil`, `isActive`, `approvalStatus`). No `available`/`isAvailable`/`stock` |
| 4 | restaurant card fields | **settled** — `estimatedDeliveryMin/Max` **and** `time:"30-40 mins"`, `minOrder`, `deliveryFee`, `freeDeliveryAbove`, `offer` (object or `null`), `rating`, `ratingCount`, `isOpen`, `image`, `images[]`, `distance`, `distanceMeters`. **No `priceForTwo`, no `discount`, no `badges`** |
| 5 | public-status keys / states | **settled** — `serviceStatus.state` returns `closed_manual` with `canOrder:false`; `isCodEnabled:false`, `maxCodOrderAmount`, `codDisplayLabel` present |
| 6 | quote bill keys + units | **blocked** — `/pricing/quote` answers 401 without a token, so no bill can be inspected |
| 7 | quote needs auth? | **settled — yes.** `POST /pricing/quote` → `401 {"success":false,"message":"Not authorised — no token provided."}` |
| 8 | `POST /orders` required fields | **pending** the order test |
| 9 | order list payload | **blocked** — needs credentials |
| 10 | coupon error vocabulary | **blocked** — `/coupons/validate` is auth-gated (401), so no code can be observed publicly |
| 11 | address payload | **blocked** — needs credentials |
| 12 | review payload | **blocked** — needs credentials + a delivered order |
| 13 | support ticket fields | **blocked** — needs credentials |
| 14 | `success:false` inside HTTP 200 | **observed: no.** The two `success:false` answers came with HTTP 401. The client still unwraps both forms |
| 15 | Cloudinary URL shape | **settled** — `https://res.cloudinary.com/<cloud>/image/upload/v<ts>/<path>.jpg`, **no transformation segment**, so the app may insert `f_auto,q_auto,w_<n>` |
| 16 | JWT lifetime, 401 vs 403 split | **blocked** — needs a token |

New finding not in the list: **search is empty on the live backend** — `GET
/restaurants/search?q=masala` answers `{success:true,count:0,data:{menuItems:[]}}`
for `scope=home`, `scope=restaurant` (with `restaurantId`) and `scope=under99`,
while the same dish is on the menu. The app therefore shows the original empty
state; nothing to fix on the client.

## Fixtures (offline api mode)

`scripts/api-readonly.ts --fixtures` writes the seven scrubbed payloads to
`src/data/api/fixtures.json` (no phone, licence number, creator ids or tokens).
With `VITE_DATA_SOURCE=api VITE_API_FIXTURES=1` the transport serves those
responses instead of the network, so the api-mode gates run offline:

```bash
VITE_DATA_SOURCE=api VITE_API_FIXTURES=1 npm run build
npm run perf-check && npm run stress-walk
```

## Still needed to finish §6

1. `NAVEREAT_TEST_EMAIL` + `NAVEREAT_TEST_PASSWORD` in the environment → unblocks
   #6, #9, #10, #11, #12, #13, #16.
2. The explicit **"run order test"** → unblocks #8.

## Gates (demo build, this tree)

| gate | result | note |
| --- | --- | --- |
| `check` (tsc + eslint) | pass | |
| `build` | pass | entry 148.09 kB gzip (budget 150 kB); `apiDataSource` and `demoDataSource` are separate chunks |
| `scroll-check` | pass | "All scroll checks passed." |
| `nav-check` | pass | |
| `sticky-check` | pass | "All sticky-bar checks passed." |
| `statusbar-check` | pass | |
| `route-motion-check` | pass | incoming page opaque, full-width slide, pop stays still |
| `parity` | pass with `ORIGINAL_DIR=/tmp/Nearbite` | without the variable it stops at "Original frontend not found" (environment, not the app) |
| `visual` | see below | same `ORIGINAL_DIR` requirement |
| `perf-check` | pass | `"pass": true`, push/pop 60 fps, CLS 0 |
| `perf-transitions` | **fails at baseline too** | Playwright cannot click `#ct-pay-confirm-btn` after Home → Restaurant → Cart: the click is "intercepted" inside `#ct-pay-sheet`. Reproduced on a clean `acba509` worktree (`BASE_PT_EXIT:1`), so it is pre-existing and unrelated to the data source |
| `stress-walk` | pass | |

The `perf-transitions` failure is the only red gate, and it reproduces on the
untouched baseline: it is a harness/route-state problem with the cart payment
sheet, not a regression from this work.

## Api mode with fixtures (offline)

`VITE_DATA_SOURCE=api VITE_API_FIXTURES=1 npm run build` emits
`apiDataSource-*.js` (5.3 kB gzip) and `fixtures-*.js` (6.0 kB gzip); the entry
bundle is unchanged at 148.1 kB gzip.

Verified in headless Chromium at 390×844, **zero requests to
`api.eatswada.com`**:

| check | result |
| --- | --- |
| Home feed | renders the API restaurant "Foodie Dosa Restaurant" |
| Category strip | renders the API categories ("Pizaa", "Biriyani", "Chowmin" …) |
| Ordering gate | the recorded status was `closed_manual`, and the app showed the original's sticky banner + "That's a wrap for today" overlay with a "Browse Menu Anyway" button; the fixtures now record `open` so the harnesses can order (the live backend still answers `closed_manual` today, and the app shows the gate again when it does) |
| Dismiss | the overlay goes away and `sessionStorage.eg_overlay_closed = '1'` |
| Console | no errors |

`perf-check` and `stress-walk` now run in api mode too (see below); the api
path is also covered by the fixture smoke and by `scripts/api-readonly.ts`.

Two fixture fields are edited on purpose after recording, because the backend
was serving a closed service at record time and the harnesses need an
orderable state: `/platform/public-status` → `serviceStatus`
`{state:"open",canOrder:true}`, and `/restaurants/<id>` → `availability`
`{isOpen:true,status:"open"}`. See `src/data/api/fixtures.README.md`.

## Harnesses in api mode (fixtures, offline)

`VITE_DATA_SOURCE=api VITE_API_FIXTURES=1 npm run build`, then the normal
`npm run perf-check` / `npm run stress-walk` / `npm run tap-pay-check`.
Latest run, 390×844 headless Chromium:

| harness | demo | api + fixtures |
| --- | --- | --- |
| perf-check | pass (5/5 gates) | pass, CLS 0, push/pop 56 fps, bundle inside budget |
| stress-walk | 118 pass / 0 fail | 118 pass / 0 fail |
| tap-pay-check | pass | pass |

Four harness steps were data-dependent and are now data-agnostic:

| step | was | now |
| --- | --- | --- |
| stepper micro-measure | assumed a seeded demo dish (`resId 1`) | seeds the first dish the loaded feed shows; **skipped and logged** when the feed carries no dish rows at all |
| pay sheet | clicked `.ct-cta` then waited for `#ct-pay-confirm-btn` | opens the sheet only if it is not already open |
| card head / back button | hit-tested click | `dispatchEvent('click')` — the floating cart bar or the closed banner can sit over them; the harness measures render cost, not hit-testing |
| debug-panel add | hit-tested click | `dispatchEvent('click')` — the debug overlay is fixed bottom-right over the first add button |

The api path exposed one real layout bug, fixed here: the **category strip
painted its tiles only after the feed request landed**, so the strip grew from
one heading line to a full row and pushed `#restaurants-section` and
`#filter-bar` down (`covered CLS 0.1741`, reproducible). In api mode the strip
now renders three placeholder tiles while loading (same `.cat-item` geometry),
which holds the row height: the same scenario measures `0.0029`.

## Search returns zero results (backend, not params)

`GET /restaurants/search` answers `count: 0` for every query, including queries
whose dishes are in that restaurant's own menu. Recorded 2026-11-25:

| probe | result |
| --- | --- |
| `/restaurants/6ac8f958…/menu` | 22 items, including "Masala Dosa", "Sada Dosa", "Mysore Masala Dosa" |
| `/restaurants/search?q=dosa&scope=home` | `count: 0` |
| `…?q=dosa&scope=restaurant&restaurantId=6ac8f958…` | `count: 0` |
| `…?q=paneer&scope=home` (recorded fixture) | `count: 0` |
| `…?q=a&scope=home` | `query must be at least 2 characters` (validation works) |
| `…?q=dosa&scope=all` | `Invalid search scope` (only `home` and `restaurant` exist) |
| `…?q=dosa&scope=home&lat=…&lng=…` | `count: 0` (coordinates are not the difference) |

The app sends exactly what the original sends (`q`, `scope`, plus
`restaurantId` for restaurant scope) and reads `data.menuItems`, so the empty
result is the server's answer. Navereat shows the original's empty state
("No dishes found for …"); a failed request shows the original's
"Search is temporarily unavailable" state instead of pretending it was empty.
