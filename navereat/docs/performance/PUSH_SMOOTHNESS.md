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

## Why the Cart layer is not pre-mounted

Pre-mounting the cart while the restaurant page is on screen would remove the
destination's first paint from the tap path entirely — the remaining 6× cost.
It cannot be done with the current stylesheet architecture:

`cart.bundle.css` is one unscoped sheet (`body { … }`, `* { … }`,
`.filter-pill`, `.bottom-nav`, `.card`, `.price`, …), and the cart page enables
it at mount. Switching that sheet on while another page is visible changes it
visibly. Measured by enabling the sheet on a settled page and diffing
screenshots (DPR 2, 390×844, pixel threshold 6):

| page | nodes | changed pixels | % of screen |
| --- | --- | --- | --- |
| restaurant | 1613 | 62 771 | **4.77 %** |
| home | 1244 | 111 277 | **8.45 %** |
| ₹99 store | 1638 | 63 162 | **4.80 %** |

All three are far above the 3 % parity budget, so the sheet may not be enabled
early, and a warm mount without it would lay out in the wrong styles and
re-layout the whole page when it is promoted.

**Follow-up (needs its own item):** scope `cart.bundle.css` under the cart page
root (`.cart-page`, replacing the `body.ct-page` prefix and the handful of
global element rules), verify parity, then pre-mount the cart layer at idle
from the restaurant route and promote it on push. Expected effect: the 6×
tap→slide-start drops from ~700 ms to ~100 ms and the in-slide long tasks
disappear, because nothing of the destination is built during the tap.

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
