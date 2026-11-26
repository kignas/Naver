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

`verify/` is git-ignored, so screenshots stay local. 35 states are captured:
login, home (0, scrolled, collapsed header, filter sheet, cart-bar clear/empty),
search (idle, typing, results, empty), ₹99 Store, Category, Restaurant (top,
filters, scrolled, customization open/selected/scrolled/error), Cart (items,
scrolled, coupon list, cooking sheet, tip sheet, payment sheet, empty), offer
popup, order processing, order placed, Orders, Tracking, Profile, and
`home-below-header` (the region under the hero sheet, cropped per page).

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
| orders | 2.72 % | demo data |
| home-scrolled | 4.74 % | cart-bar offset only |
| tracking | 9.53 % | live map block |
| home-below-header | 9.65 % | section-title copy + chrome (see below) |
| home-searchrow-style | 13.36 % | intended compaction |
| cart-coupon-list | 15.97 % | demo data |
| home-cartbar-clear | 23.61 % | header + hero banner (intentional) |
| home | 23.65 % | header + hero banner (intentional) |
| home-cartbar-empty | 23.66 % | header + hero banner |
| home-header-collapsed | 60.13 % | original has no pinned bar |

The `home*` rows were re-measured on 2026-11-26 against the original frontend
(cloned read-only into `/workspace/reference/Nearbite-main`). They moved because
the Home header is the tactile oxblood header and the hero banner is an animated
200 px sheet, both deliberate (see “Intentional differences”). Restoring the
oxblood/gold palette (see “The Home theme”) took `home` from 44.84 % to 23.65 %
and `home-header-collapsed` from 90.21 % to 60.13 %; fixing the category and chip
regressions took `home-below-header` from 12.80 % to 9.65 %.

`home-below-header` is the guard for everything under the hero sheet. It used to
crop at `.hero-sheet` on both pages, a selector only this app has; on the
original the crop silently started at y = 0, so the state compared the
original's header against this app's feed and its number meant nothing. The
harness now takes a per-page landmark (`.ew-strip` / `#hero-banner-region` for
the original, `.hero-sheet` here) and the two crops start at the same content
point.

### Home below the header, region by region (measured)

The harness now also splits the crop into 20 px bands, names each band from this
app's own landmarks and reports the share of differing pixels in it
(`bands` in `verify/parity/report.json`, printed as `[parity] bands …`). That is
how the 9.65 % is attributed:

| region | app y | diff in band | cause | status |
| --- | --- | --- | --- | --- |
| section title row | 345–365 | 0 % | — | parity |
| category rail, row 1 (Pizza … Sweets) | 365–465 | 0 % | icons were drawn at 86 px, the original at 103 px (`scale(1.2)`) | **fixed** |
| category labels | 465–505 | 0 % | 14 px/700, `#2a2f3a` both | parity |
| category rail, row 2 (Chowmein … Ice cream) | 505–585 | 0 % | same fix | **fixed** |
| gap above the chips | 585–625 | 0 % | — | parity |
| filter chips | 625–645 | 16.6 % | chip 1 matches exactly (91 px); chips 2–5 sit 2 px right because “Near & Fast” is 125 px vs 123 px (the bolt glyph's advance differs from the original's icon-font glyph) | residual 2 px |
| section title copy | 665–685 | 12.3 % | “Restaurants near you” (177 px) vs “Recommended with deals” (209 px) | intentional |
| first card, top edge | 685–705 | 1.7 % | card border lands 1 px off after the title | residual |
| cards 1–2 | 705–844 | 17–59 % | the floating cart bar (y694–756) and the tab bar (y768–832) are painted over the cards; the original's fixed bar sits at y770 | intentional chrome (masked out of the 9.65 %) |

Two regressions were found and fixed here (see “The Home theme” and
`docs/DESIGN_PARITY_AUDIT.md` history in commit `f6c1a10`):

1. **Category icons were 20 % too small.** The original draws them at
   `transform: scale(1.2)` inside the ring (`css/home.bundle.css`), this app had
   `transform: none`. Now `scale(1.2)` (and `scale(1.24)` when selected, as the
   original does).
2. **Chip icon + label spacing was doubled.** `src/styles/global.css` had
   `.filter-pill .icon { margin-right: 6px }` on top of the ported rule's
   `gap: 6px`, so every icon chip was 6 px wide and the label 6 px late. The
   margin is gone; chip 1 is now 91 px, exactly the original's.

Also fixed: the chip icons were 11 px against the original's 14 px (they are
`<Icon size={14}>` now).

The 14 px offset between the two pages is **not** a content inset: the crops
start at each page's own hero bottom (`y331` original, `y345` here), and every
feed landmark sits at the same distance from it (`#restaurants-title` 322 px in
both, `.cat-item` 38 px, `.filter-pill` 274 px, `.u99-card-host` 356 px). The
best-alignment shift the harness finds is therefore 0 px, and the number is
made of real differences, not displacement.

## Cross-cutting defects (each explains several rows)

C1, C2, C3 and C4 below were found on 2026-11-25 and are **closed** — the
measurements in their tables are the historical ones, kept so the fix can be
re-checked. The current values are in the closing paragraph of each entry.

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

**Closed.** Every landmark now starts where the original's does: `.u99-card-host`
`x16 w358` in both, `#restaurants-title x18`, `.cat-name x31`,
`.filter-pill x18`. The feed sits 14 px lower in absolute terms only because the
header block above it is 14 px taller (banner 200 px vs the original's 190.23 px
plus strip), not because of an inset.

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

**Closed.** `under99` is 0.52 % — the hero copy is white in both.

### C3. Home restaurant card title is grey instead of ink
`.u99-restaurant-name` is `#101828` in the original and `#7B8190` in this app —
the restaurant names read as disabled text.

**Closed.** Both pages report `rgb(16, 24, 40)` / 18 px / 800.

### C4. Home filter chips are 2 px smaller
`.filter-pill` font-size `14px` (original) vs `12px` (app); same padding, radius
and shadow. Makes the Home chip row visually lighter.

**Closed.** Both are 14 px/600 with `padding: 9px 14px`, radius 14 px, shadow.
The chip row's remaining 16.6 % band is the 2 px accumulated offset described in
“Home below the header, region by region”.

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
* Hero banner (Item 18): the static slide was replaced by a 5 s animated banner
  (`src/components/home/HeroBanner.tsx`, `#hero-banner-region`) that swaps two
  headline/food states. The banner is 200 px tall over the same 34 px offer
  strip, so the header block ends at `y345` against the original's `y331` (the
  original's `.banner-wrap` is `aspect-ratio: 2.05/1` → 190.23 px at 390 wide).
  This is an intentional content change, so `home` / `home-scrolled` still differ
  here; everything **below** the hero sheet keeps the original's rhythm and is
  tracked by `home-below-header`.
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
amounts, restaurant sections), header collapse/pinned search row (the original
scrolls its header away, so `home-header-collapsed` = 90 % is expected), the
search-row 0.94 compaction (18 % element diff), the 5th filter rail label, the
royal-blue Home header, the animated hero banner, and the two-tab nav.

### The tab bar (Item 19)

The original has no tab bar; this app's two-tab floating pill is chrome, not a
port, so every Home state that includes it carries the nav's pixels. Its
measured geometry, its original SVG glyphs and its haptics are described in the
README (“Tab bar: the measured look, the glyphs, the haptics”). `nav-check`
asserts the ratios, the two-tone icon states, the haptic call counts and the
reduced-motion behaviour, and writes its evidence to `verify/item19/`.

### The status bar follows the header

The Android status bar is non-overlay, so it must match the top edge of the
route header. When Home's header became royal blue (`#004AAD`) the theme mapping
in `src/lib/statusBarTheme.ts` still returned the old burgundy `#5D0D18`, and
`statusbar-check` failed on the two Home viewports (`pageTop #004AAD`). The
mapping now returns the header's own colour, so the bar blends into the header
again. Login (yellow), ₹99 Store (`#B73950`) and the white app bars are
unchanged.

### The animated hero banner is a header-only change

The banner is the only place where this app deliberately departs from the
original's Home header. To keep that honest, the harness captures
`home-below-header`: each page is cropped at its own hero-sheet bottom (the
original's `.ew-strip` / `#hero-banner-region`, this app's `.hero-sheet`) and
diffed, so a header change cannot hide a change in the feed. The crop used to
assume both pages had `.hero-sheet`; the original never did, so it was measuring
nothing — see “Headline numbers” for the corrected 9.65 % and its causes.

The same comparison runs locally against any two builds:

```bash
node scripts/scroll0-diff.mjs after before   # captures, then diffs below the header
```

It reports two things per viewport: the geometry of the feed landmarks
(`#restaurants-title`, `.cat-item`, `.filter-pill`, `.u99-card-host`,
`.u99-restaurant-name`, `.u99-meta`) in content coordinates, and a pixel diff
of the region between `.home-main` and the fixed chrome. The geometry check is
exact (every landmark within 0.5 px). The pixel number carries a subpixel
residue when the header height changes, because the sheet paints the feed at a
fractional offset; the parity state `home-below-header` is the same measurement
across builds and is now cropped at matching landmarks on both pages.

## The Home theme is oxblood + gold (restored 2026-11-26)

The original frontend's `index.html` overrides the raspberry default with

```css
--hd-primary:#5D0D18; --hd-accent:#EBCB8B; --hd-on-light:#5D0D18;
--hd-cta-bg:#EBCB8B; --hd-cta-ink:#3E0710;   /* "Premium oxblood + gold theme" */
```

and this app shipped exactly that until commit **`bc025bd`** (“Home:
spring-animated hero banner and tactile header”, released as v1.0.64) rewrote
the same block in `src/styles/original/home-final.css` as a
“Royal blue + golden yellow theme”: `--hd-primary #004AAD`,
`--hd-accent #FFD100`, `--hd-accent-ink #0B2A5B`, `--hd-on-light #0044A8`,
`--hd-cta-bg #FFD100`, `--hd-cta-ink #0B2A5B`, the location pin chip from white
to `#FFD100`, `.store-top` from `#7A5A60` to `#64748B`, the CTA chevron tint to
`rgba(11,42,91,.14)`, the active banner dot to `#FFD100` and the section accent
bar (`.sec-title::before`) from `#5D0D18` to `#004AAD`. `HeroBanner.css`
followed with a `#0a57c8 → #004aad → #003d8f` shell and gold-on-navy ink, and
`statusBarTheme.ts` asked for `#004AAD`. `git log -S 004AAD` finds no earlier
commit: blue entered in `bc025bd` and nowhere else.

Blue is not in the original at all (`grep -r 004AAD /workspace/reference/Nearbite-main` → nothing), so it was reverted on 2026-11-26: the theme block, the
banner shell (`#6b1520 → #5d0d18 → #44070e`, gold accents on `#EBCB8B`), the
strip (`#44070e` on gold) and the status bar (`#5D0D18`) are oxblood + gold
again, with the banner's choreography untouched (same keyframes, same timings,
colour-only change). `statusbar-check` asserts the bar equals the header colour
and passes on `#5D0D18` at both viewports.

The palette lives in `src/styles/tokens.css` as `--theme-burgundy #5d0d18`,
`--theme-gold #ebcb8b`, `--theme-gold-ink #3e0710`, `--theme-cream #fff9eb`.

## Remaining work (all intentional or demo data)

* `home-header-collapsed` 60.13 % and `home-searchrow-style` 13.36 % — the app
  pins a compact search row and collapses the header; the original scrolls it
  away. Documented as intentional in the 12C work. The number is large because
  at that scroll offset the two screenshots show different content at the top of
  the frame, not because anything is misplaced.
* `cart-coupon-list` 15.93 % — demo coupons vs the mock's empty list.
* `tracking` 9.52 % — the app shows a live map block the original lacks.
* `home` / cart-bar states 23.6 % — the oxblood tactile header and the animated
  hero banner are deliberate; `home-scrolled` (4.74 %) is the cart bar lifted by
  the floating nav.
* `home-below-header` 9.65 % — the feed guard; the residual is the fixed chrome
  painted in the crop and the section-title copy. Region by region in “Home
  below the header, region by region”; two real regressions (category icon
  scale, chip icon margin) were found and fixed on the way.

Closed on 2026-11-25: payment sheet (24.48 % → 0.12 %), search overlay
(4.61 % → 1.1 %), offer popup (58.42 % → 2.21 %), ₹99 Store (14.52 % → 0.52 %).
