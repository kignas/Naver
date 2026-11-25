# Route stylesheet scope audit

Why every route sheet is a document-wide stylesheet, what it would cost to
enable one early, and the one rule that broke the last scoping attempt.

This is the report behind the decision in
[`performance/PUSH_SMOOTHNESS.md`](performance/PUSH_SMOOTHNESS.md): the cart
layer cannot be pre-mounted, and the cart sheet cannot be enabled while another
page is on screen, until these sheets are scoped.

## How the sheets work today

Each page builds its own `<style>` element from raw CSS and keeps it at
`media="not all"` until the route mounts:

| sheet | built from | route |
| --- | --- | --- |
| home | `home-base.css` + `home.bundle.css` + `home-final.css` + `pages/home.css` | `/` |
| restaurant | `restaurant.bundle.css` + `restaurant-shell.css` | `/restaurant/:id` |
| under99 | `under99.bundle.css` + `pages/under99.css` | `/under99` |
| cart | `cart.bundle.css` | `/cart` |
| orders | `orders-shell.css` + `orders.bundle.css` | `/orders` |
| track | `track-order.bundle.css` | `/track/:id` |
| profile | `profile-shell.css` + `profile.bundle.css` | `/profile` |
| login | `login-shell.css` + `login.bundle.css` | `/login` |

`src/lib/routeStyles.ts` also appends `styles/tab-isolation.css` to every sheet,
and `syncRouteStyleSheets()` keeps a cached tab sheet off while another tab is
the active layer. `/category/:slug` has no sheet of its own; it borrows the
global ones.

## Inventory

Counts come from parsing each concatenated sheet with `postcss` and classifying
every selector as **scoped** (starts with one of the sheet's own roots, e.g.
`.ct-`, `#ct-`, `body.ct-` for cart) or **global** (anything else). `@keyframes`
bodies are excluded.

| sheet | kB | rules | scoped rules | % scoped | global selectors |
| --- | --- | --- | --- | --- | --- |
| cart | 237 | 2309 | 1755 | 76 % | 648 |
| restaurant | 276 | 2041 | 13 | **0.6 %** | 2368 |
| home | 117 | 1109 | 64 | 6 % | 1183 |
| profile | 80 | 771 | 7 | **0.9 %** | 927 |
| track | 65 | 652 | 21 | 3 % | 821 |
| under99 | 66 | 663 | 318 | 48 % | 395 |
| orders | 62 | 549 | 60 | 11 % | 648 |
| login | 49 | 405 | 88 | 22 % | 398 |

The cart sheet is the most scoped of the eight — it is the only page that was
written with a `body.ct-page` gate on its page-level rules. The other seven are
legacy sheets in which almost nothing is gated.

### The global block every sheet carries

All eight sheets embed a copy of the same legacy global layer. The selectors
below are present unscoped in **every** sheet (examples, not the full list):

* element and universal rules: `*`, `*::before`, `*::after`, `html`, `body`,
  `main`, `button`, `input`, `textarea`, `select`, `img`, `a`, `h1`–`h6`, `p`,
  `small`, `li`;
* `body { … }` rules that set page background, font, letter-spacing and
  `overflow-x` (1–1102 rules per sheet; cart has 1102, all but a handful gated);
* shared component classes: `.card`, `.price`, `.price-old`, `.rating`,
  `.amount`, `.total`, `.subtotal`, `.fee`, `.qty`, `.discount`, `.filter-pill`,
  `.bottom-nav`, `.nav-item`, `.veg-dot`, `.skeleton`, `.chip`, `.tap`,
  `.no-scrollbar`, `.section-title`, `.section-label`, `.muted`, `.secondary`,
  `.description`, `.animate-slide-up`, `.food-card-animate`, `.cat-ring`,
  `.image-wrap`, `.item-name`, `.add-btn`, `.search-box`, `.badge`, `.hero`;
* id selectors that belong to another page: `#cart-bar`, `#cart-bar.visible`
  (in restaurant, orders, track, profile, login), `#ct-bill.ew-quote-*`
  (in home and under99), `#es-availability-toast` (in home and profile).

That is the structural problem: `.price`, `.card`, `.filter-pill`, `.bottom-nav`
and the bare `body` rules mean "enable this sheet" is never a local change.

## Measured leak: what changes if a sheet is enabled early

Method — for each route, load it in the production build (`vite preview`,
390×844, DPR 2), settle 1.6 s, screenshot, inject the sheet's CSS with
`page.addStyleTag`, settle 0.42 s, screenshot again, and count pixels whose
channel delta is above 6. The same-page noise floor measured **0 %** on every
route (0.14 % on `/track/demo`), so these numbers are signal.

Percent of the 390×844 viewport changed. `—` = the sheet's own route.

| sheet ↓ / page → | home | restaurant | ₹99 | category | cart | orders | track | profile | login |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **restaurant** | 9.45 | — | **56.15** | 6.31 | 0.05 | 8.17 | 0.13 | 1.24 | 8.50 |
| **home** | — | 5.72 | 5.05 | 2.93 | 0.29 | 3.61 | 0.13 | **33.34** | 0.03 |
| **cart** | 9.49 | 5.72 | **22.17** | 4.73 | — | 0.02 | 0.13 | 0.00 | 8.50 |
| **orders** | 9.49 | **20.83** | **22.17** | 6.58 | 0.29 | — | 0.28 | 11.05 | 8.50 |
| **track** | 9.48 | **20.83** | **22.17** | 4.71 | 0.29 | 8.74 | — | 6.29 | 8.50 |
| **profile** | 9.39 | **20.55** | **20.87** | 6.24 | 0.00 | 10.35 | 0.13 | — | 8.28 |
| **login** | 9.36 | **20.55** | **22.17** | 4.57 | 0.00 | 0.13 | 0.30 | 3.06 | — |
| **under99** | 1.52 | 6.24 | — | 1.42 | 0.49 | 2.24 | **16.28** | 5.13 | 0.85 |

Sorted by worst case, worst first:

| rank | sheet | worst page | changed |
| --- | --- | --- | --- |
| 1 | restaurant | ₹99 store | 56.15 % |
| 2 | home | profile | 33.34 % |
| 3 | cart | ₹99 store | 22.17 % |
| 4 | orders | ₹99 store / restaurant | 22.17 / 20.83 % |
| 5 | track | ₹99 store / restaurant | 22.17 / 20.83 % |
| 6 | login | ₹99 store / restaurant | 22.17 / 20.55 % |
| 7 | profile | ₹99 store / restaurant | 20.87 / 20.55 % |
| 8 | under99 | track | 16.28 % |

Notes on the pattern:

* Several sheets produce the *same* figure on the same page (22.17 % on ₹99 for
  cart, orders, track and login; 20.83 % on restaurant for orders and track;
  9.48 % on home for cart, orders, track). That is the shared global block
  above: once the `body`/`main`/element rules land, the page has already moved
  by that much, and the sheet-specific rules add nothing on top.
* The cart sheet is the *best* behaved of the eight (0 % on profile and orders,
  0.13 % on track) and still costs 9.49 % on home and 22.17 % on the ₹99 store —
  three times the 3 % parity budget, so it still may not be enabled early.
* `/restaurant/1` with the cart sheet costs 5.72 % here; the earlier figure in
  `PUSH_SMOOTHNESS.md` was 4.77 %. Both were measured the same way; the
  difference is the seeded cart (this run has 2 items, so the pink cart bar is
  on screen and it is restyled by `.add-btn-wrap`, `.cart-*` and `.filter-pill`).

## The `.ct-page .ct-fees` / `min-height` anomaly

This is the rule that made the scoped-CSS attempt (2026-11-25) diverge, and it
is the exact trap any future scoping pass has to survive. It is a specificity
tie created *by* the rewrite, not a bug in the sheet.

The sheet defines the fees pill four times:

```
body.ct-page .ct-fees { margin:7px 14px 0; min-height:30px; padding:6px 11px; … }
body.ct-page .ct-fees { margin:4px 12px 0; min-height:0;    padding:0 4px;   … }
body.ct-page .ct-fees { margin:8px 12px 0; min-height:30px; padding:6px 11px; … }
.ct-page .ct-fees     { display:flex; …; min-height:52px; margin:8px 14px 12px; … }
```

* `body.ct-page .ct-fees` = (0 ids, 2 classes, 1 element) → **wins** over
  `.ct-page .ct-fees` = (0, 2, 0), so the live pill is `min-height: 30px`.
* The scoping transform rewrites `body.ct-page X` → `.ct-root X` (and drops the
  `body.ct-page` gate, because the root element now carries it). That makes the
  three rules (0, 2, 0) as well — a **tie** with the untouched
  `.ct-page .ct-fees { min-height: 52px }`, which sits *later* in the sheet.
  Source order wins the tie, so the pill becomes 52 px tall and everything below
  it moves 22 px down.

Exact repro (no build needed):

```bash
# 1. the four rules, in order
node -e '
const css = require("fs").readFileSync("src/styles/original/cart.bundle.css", "utf8");
const re = /([^{}]+)\{([^{}]*min-height[^{}]*)\}/g;
for (let m; (m = re.exec(css)); )
  if (/ct-fees/.test(m[1])) console.log(m[1].trim(), "=>", m[2].trim().slice(0, 90));
'

# 2. the rewritten form produced by the scoping pass (kept in the stash)
git show 'stash@{0}^3:navereat/src/styles/original/cart.scoped.css' |
  grep -o '\.ct-root \.ct-fees{[^}]*min-height:[^;}]*'

# 3. in the browser, on #/cart, before and after the rewrite
#    document.querySelector('.ct-fees') -> getComputedStyle().minHeight
#    original: 30px        rewritten: 52px
```

Why it matters beyond one pill: the rewrite moved 1102 `body.ct-page …` rules
from (0,2,1)-class specificity down to (0,2,0), so *every* pre-existing
`.ct-page …` rule in the sheet — and every rule that relied on the element
prefix to outrank a later class rule — changes winner. Measured on the cart
states after the rewrite: items 12.75 %, unavailable 16.54 %, coupon 82.57 %,
bill 55.06 %, pay 86.70 %, success 23.87 % (see
`PUSH_SMOOTHNESS.md`). Adding `!important`/`:where()` patches to force the old
winners made it worse (items 32.59 %, pay 85.15 %), because the sheet's own
later rules use `!important` too.

The generated sheet itself is well formed: a brace-depth scan of
`cart.scoped.css` ends at depth 0 with a minimum depth of 0, and the earlier
note about a "depth −1 `@media` context" was a bug in the throwaway scoping
script's own bookkeeping, not in the output. The divergence is entirely
specificity and source order.

## What a scoping pass has to do (checklist)

1. Keep the `body.ct-page` gate — do not remove the element from the compound.
   Prefix without rewriting: `body.ct-page .ct-fees` stays a two-class-plus-
   element selector, so its rank relative to `.ct-page .ct-fees` is preserved.
2. Handle the rules that are already `.ct-page`-prefixed and would become ties.
3. Rewrite the bare element rules (`body`, `main`, `button`, `h1`–`h6`, `*`)
   under the page root, and keep the page's `body`-level rules (background,
   `overflow-x`, `letter-spacing`) applying to `body` only while the page is up.
4. Namespace the shared block (`.card`, `.price`, `.filter-pill`, `.bottom-nav`,
   …) or prove per page that the page's own copy is byte-identical.
5. Rename `@keyframes` (`fadeIn`, `slideUp`, `shimmer`, … are declared by
   several sheets) so two sheets cannot share one animation name.
6. Leave `tab-isolation.css` appended last, as it is today.
7. Re-measure with the leak matrix above; the acceptance bar is the 3 % parity
   budget on every page, in every state, plus the 12C rule (the covered page
   never moves).

Until then: a route sheet may only be enabled by its own route, which is why the
cart layer is not pre-mounted and the push to `/cart` still pays for the
destination's first paint in the tap.
