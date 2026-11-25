# Restaurant → checkout push: smoothness

Measured on `#/restaurant/1` → tap the pink cart bar → `#/cart`, in the
production build (`vite preview`, 390×844, DPR 2, headless Chromium), with
CDP `Emulation.setCPUThrottlingRate` at 1× and 6×.

Recorded per run: frame gaps on every `requestAnimationFrame` while
`.route-stage.is-animating`, `PerformanceObserver('longtask')` durations,
`Performance.getMetrics()` deltas for `RecalcStyleCount`, `LayoutCount`,
`RecalcStyleDuration`, `LayoutDuration` and `TaskDuration`, and the number of
times the cart page rendered.

## Before / after

| metric | 1× before | 1× after | 6× before | 6× after |
| --- | --- | --- | --- | --- |
| tap → slide start | 130 ms | **108 ms** | 737 ms | 707 ms |
| slide duration | 297 ms | 286 ms | 554 ms | 523 ms |
| frames in slide | 17 | 18 | 11 | 12 |
| dropped frames (> 25 ms) | 1 | **0** | 5 | 5 |
| worst frame gap | 33.3 ms | **16.8 ms** | 100 ms | 83.4 ms |
| long tasks during the slide | 0 | **0** | 4 (60/80/176/52 ms) | 4 (55/84/145/54 ms) |
| cart page renders | 2 | **1** | 2 | 1 |
| style recalcs (count / ms) | 32 / 100 | 32 / 100 | 25 / 600 | 26 / 600 |
| layouts (count / ms) | 20 / 0 | 21 / 0 | 16 / 200 | 16 / 200 |
| total task time | 200 ms | 200 ms | 1400 ms | 1300 ms |

At 1× the slide now lands every frame with no long task while the page
travels. The two cart renders are gone: the saved note, delivery instructions
and tip are read during the first render instead of in an effect that ran when
the transition flag flipped, and the `preparing` flag is now subscribed by the
offer watcher (a leaf) instead of the page.

## Why the Cart layer is not pre-mounted — decision log

**Status: closed. The pre-mount is dropped (decision 2026-11-25).** Two
independent blockers, both measured; see
[`../CSS_SCOPE_AUDIT.md`](../CSS_SCOPE_AUDIT.md) for the stylesheet analysis
behind the first one.

### Attempt 1 — scoped cart stylesheet, three passes (rejected)

Goal: make `cart.bundle.css` safe to enable while another page is on screen, so
the cart could be built early with its own styles.

| pass | what changed | result |
| --- | --- | --- |
| 1 | every rule prefixed with a cart root (`.ct-scope` / `.ct-page` / `.ct-root`) | cart states vs the shipped page: items 12.75 %, empty 0 %, unavailable 16.54 %, scrolled 12.75 %, coupon 82.57 %, coupon-empty 82.56 %, bill 55.06 %, tip 55.06 %, pay 86.70 %, offers 12.75 %, hold 12.75 %, success 23.87 % |
| 2 | specificity patches (`!important` / `:where()`) to restore the old winners | worse: items 32.59 %, coupon 77.39 %, bill 55.28 %, pay 85.15 % |
| 3 | `.ct-root` + `.ct-page` two-root rewrite (the form kept in the stash) | one rule explains the divergence, see below |

Pass 3's failure is a specificity tie, not a parser bug. The sheet has

```
body.ct-page .ct-fees { … min-height:30px … }   /* (0,2,1) — wins today */
.ct-page .ct-fees     { … min-height:52px … }   /* (0,2,0) — loses today */
```

and the rewrite turns the first into `.ct-root .ct-fees` — (0,2,0), a tie with
the second, which sits later in the sheet, so source order hands it the win and
the pill grows 30 px → 52 px. The same demotion applies to all 1102
`body.ct-page …` rules at once. Exact repro and the full checklist for a future
pass: [`../CSS_SCOPE_AUDIT.md`](../CSS_SCOPE_AUDIT.md#the-ct-page-ct-fees--min-height-anomaly).

### Attempt 2 — pre-mount the cart React tree without its stylesheet (rejected)

Goal: build the destination's DOM and React tree at idle, adopt it on the tap,
and attach the cart sheet only in the commit the slide starts, so the visible
page is never restyled.

Implementation: `PrewarmContext` + `useCartWarmup()` (arms on
`requestIdleCallback`, gated on `fontsReady()`), a `warm` layer in
`PageTransition` rendered in the same keyed array as `layers` so the push
*adopts* the existing DOM node instead of mounting a second tree, and `Cart`
skipping its sheet and body class while `prewarm`.

It can be made pixel-clean, but it is not free:

* **Pixels — reachable, with two page-specific fixes.** The adopted cart came
  out pixel-identical to the shipped push flow (1.047 / 0.454 / 0.456 / 0.702 /
  0.143 % vs a cold deep link — exactly the numbers the unmodified build
  produces for the same flow), but only after (a) moving `cartStyle.attach()`
  to `useInsertionEffect`, because children measure their boxes in layout
  effects, and (b) re-running `CompleteYourMeal`'s indicator measurement when
  the tree is adopted. Without them the segmented pill keeps
  `left:0; width:65px` (correct: `4px/85px`) because **the warm tree measures
  unstyled DOM** — a 0.27–0.31 % visible defect.
* **The tap got slower, not faster.** `perf-check` max tap→first-painted-frame
  (budget 84 ms = 60 × 1.4):

  | build | max tap→frame | median tap→slide-start |
  | --- | --- | --- |
  | baseline (shipped) | **48.8 ms** | 90.5 ms |
  | idle + pointerdown | 93.3 ms | 79.3 ms |
  | idle + pointerdown + pill fix | 142.5 ms | 101.5 ms |
  | idle only | 129.2 ms | 98.0 ms |

  `requestIdleCallback(timeout: 1200)` fires right around the tap, so the mount
  lands in the tap frame; a `pointerdown` trigger puts the mount inside the tap
  task itself. Median tap→frame is unchanged (~38 ms) and 6× dropped frames
  sometimes improve (7 → 2), but the worst case — the number the gate exists to
  protect — more than doubles. The gate fails.

### The structural reason

Both routes are blocked by the same two properties of the current architecture:

1. **The sheet restyles the visible page.** Every route bundle embeds the same
   legacy global block (`body`, `*`, `main`, `.card`, `.price`, `.filter-pill`,
   `.bottom-nav`, `.skeleton`, …). Enabling the cart sheet early costs 9.49 % of
   the home screen, 5.72 % of the restaurant page and 22.17 % of the ₹99 store —
   against a 3 % parity budget. Worst case across all eight sheets is 56.15 %
   (restaurant sheet on the ₹99 store). Table and method:
   [`../CSS_SCOPE_AUDIT.md`](../CSS_SCOPE_AUDIT.md).
2. **The page measures itself at mount.** `CompleteYourMeal` reads
   `offsetLeft`/`offsetWidth` in a layout effect to place the segmented pill.
   A tree mounted without its stylesheet measures the unstyled box and keeps
   that answer, so a warm mount is only correct if the sheet is already applied
   — which property 1 forbids.

So: no early stylesheet → wrong measurements; early stylesheet → the visible
page moves. Neither can be done early, and doing only half of it trades a
marginal slide-start gain for a slower tap and page-specific repair code.

### Decision

Drop the pre-mount. The destination keeps mounting on the tap (the 6× cost in
the next section stays), and the smoothness work continues on the things that
do not need early styling. The CSS-rewrite work is preserved in a stash
(`STEP B WIP: scoped cart CSS`) for reference; it is not merged.

What would reopen this: a scoping pass that satisfies the checklist in
[`../CSS_SCOPE_AUDIT.md`](../CSS_SCOPE_AUDIT.md#what-a-scoping-pass-has-to-do-checklist)
and measures at or below the 3 % budget on every page — after that, pre-mount at
idle is a one-line change (`warm={…}` on `PageTransition`) and the expected
effect is the 6× tap→slide-start dropping from ~700 ms to ~100 ms, because
nothing of the destination would be built during the tap.

## What still costs time at 6×

* 384 ms of cart render before the slide starts (the page's own first paint on
  a 6×-throttled CPU, ≈ 64 ms at 1×).
* ~600 ms of style recalculation when the cart sheet is enabled, and ~200 ms of
  layout — both document-wide and unavoidable while the sheet is unscoped.
* ~145 ms at transition-end: the frozen-layout snapshot of the covered page is
  re-applied (96 nodes × 50 properties) — the price of the 12C guarantee that
  the covered page never moves.

## Gate

`npm run perf-check` now records this run at both rates and fails when:

* 1×: more than one dropped frame, a worst gap above 40 ms, any long task
  during the slide above 60 ms, more than 60 style recalcs, or more than one
  cart render.
* 6×: more than six dropped frames, or any long task above 450 ms.

The single frame allowed at 1× is the destination page's first paint, which can
only happen when the layer becomes visible as the slide starts.
