import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isTabPath, useAppNav } from '../lib/navigation';
import { useSearchStore } from '../store/searchStore';
import { lightImpact } from '../lib/haptics';
import { navScrollHide } from '../lib/navScrollHide';
import { sheetCount, subscribeSheetCount } from '../lib/sheetStack';
import { NavGlyph, NavGlyphOutline, type NavGlyphName } from './NavGlyph';
import '../styles/bottom-nav.css';

interface NavEntry {
  to: string;
  label: string;
  glyph: NavGlyphName;
}

const ITEMS: NavEntry[] = [
  { to: '/', label: 'Home', glyph: 'home' },
  { to: '/orders', label: 'History', glyph: 'history' },
];

const DRAG_THRESHOLD = 6;
/**
 * The full tap sequence: 100ms outline fade, 260ms pill slide, 300ms glyph
 * pop. The state classes are dropped just after it so a later re-render
 * cannot replay the animations.
 */
const SEQUENCE_MS = 720;

function activeIndexFor(pathname: string): number {
  if (pathname === '/orders') return 1;
  return 0;
}

export function BottomNav() {
  const { pathname } = useLocation();
  const nav = useAppNav();
  const closeSearch = useSearchStore((state) => state.closeSearch);
  const searchOpen = useSearchStore((state) => state.isOpen);
  const activeIndex = activeIndexFor(pathname);
  // A full-screen search hides the bar; the two tabs are the only tab routes.
  const onTabRoute = isTabPath(pathname) && !searchOpen;
  // The bar never moves. A detail route is opaque and paints over it, so it is
  // taken away only after that page has finished covering it, and it is put
  // back the moment the pop slide starts so the departing page reveals it.
  const detailRoute = !isTabPath(pathname);
  // A deep link (login, a shared restaurant link) never gets a transition, so
  // the bar must start hidden instead of waiting for one.
  const [hidden, setHidden] = useState(() => !isTabPath(pathname));

  useEffect(() => {
    if (searchOpen) {
      setHidden(true);
      return;
    }
    if (!detailRoute) {
      setHidden(false);
      return;
    }
    const onEnd = () => setHidden(true);
    window.addEventListener('navereat:transition-end', onEnd, { once: true });
    // A deep link straight to a detail route never gets an end event.
    const fallback = window.setTimeout(onEnd, 1400);
    return () => {
      window.removeEventListener('navereat:transition-end', onEnd);
      window.clearTimeout(fallback);
    };
  }, [detailRoute, searchOpen]);

  // Show synchronously on the render that leaves a detail route: that render
  // happens before the pop slide's first frame, so the bar is simply revealed
  // by the departing page instead of appearing after the slide has started.
  const hiddenNow = searchOpen || (detailRoute ? hidden : false);
  const visible = onTabRoute;
  // A pushed page is still sliding over the docked bar: it must stay painted
  // (the nav belongs to the tab it covers) but must not take taps that belong
  // to the incoming page.
  const covered = detailRoute && !hidden && !searchOpen;

  const navRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  // ---- Pill geometry ------------------------------------------------------
  // The pill is one tab wide and absolutely positioned; its travel is a single
  // translateX in px, measured from the active tab's offsetLeft. `animate`
  // is false for the first placement and for resizes, so neither animates.
  const placePill = useCallback((index: number, animate: boolean) => {
    const bar = navRef.current;
    const tab = tabRefs.current[index];
    if (!bar || !tab) return;
    if (!animate) bar.classList.add('nav-no-motion');
    bar.style.setProperty('--pill-x', `${tab.offsetLeft}px`);
    if (!animate) {
      // Flush the new value while the transition is off, then hand the pill
      // back to the animated path on the next frame.
      void bar.offsetWidth;
      window.requestAnimationFrame(() => bar.classList.remove('nav-no-motion'));
    }
  }, []);

  const firstPlacement = useRef(true);
  useLayoutEffect(() => {
    placePill(activeIndex, !firstPlacement.current);
    firstPlacement.current = false;
  }, [activeIndex, placePill]);

  // The capsule is a percentage width, so a resize changes the tab offsets.
  useEffect(() => {
    const bar = navRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => placePill(activeIndexRef.current, false));
    observer.observe(bar);
    return () => observer.disconnect();
  }, [placePill]);

  // Which tabs animate. Derived during render (not in an effect) so the
  // classes are in the very first paint after the tap: the outgoing filled
  // glyph has to start its 100ms fade at t=0.
  const [settledIndex, setSettledIndex] = useState(activeIndex);
  const [glyphMove, setGlyphMove] = useState<{ from: number; to: number } | null>(null);
  if (settledIndex !== activeIndex) {
    setGlyphMove({ from: settledIndex, to: activeIndex });
    setSettledIndex(activeIndex);
  }
  useEffect(() => {
    if (!glyphMove) return undefined;
    const timer = window.setTimeout(() => setGlyphMove(null), SEQUENCE_MS);
    return () => window.clearTimeout(timer);
  }, [glyphMove]);

  useEffect(() => {
    document.body.classList.toggle('has-bottom-nav', visible);
    return () => document.body.classList.remove('has-bottom-nav');
  }, [visible]);

  // ---- Scroll hide/show (Item 19, part 2) ---------------------------------
  // Only the two tab routes have a bar that can be scrolled away, and each has
  // its own scroller. Anything else (a push starting, a sheet, the search
  // overlay, a tab change) puts the bar back instantly, so the pop slide always
  // reveals it in place.
  useEffect(() => {
    if (!onTabRoute) {
      navScrollHide.detach();
      navScrollHide.reset(true);
      return undefined;
    }
    const scroller = document.querySelector<HTMLElement>(pathname === '/orders' ? '.orders-page' : '.home-scroll');
    navScrollHide.attach(scroller);
    navScrollHide.reset(true);
    return () => navScrollHide.detach();
  }, [onTabRoute, pathname]);

  useEffect(() => {
    const onBeforeNavigate = () => navScrollHide.reset(true);
    window.addEventListener('navereat:before-navigate', onBeforeNavigate);
    const onPainted = () => navScrollHide.measure();
    window.addEventListener('navereat:home-painted', onPainted);
    return () => {
      window.removeEventListener('navereat:before-navigate', onBeforeNavigate);
      window.removeEventListener('navereat:home-painted', onPainted);
    };
  }, []);

  useEffect(() => {
    if (searchOpen) navScrollHide.reset(true);
  }, [searchOpen]);

  useEffect(() => {
    let count = sheetCount();
    return subscribeSheetCount(() => {
      const next = sheetCount();
      if (next === count) return;
      count = next;
      navScrollHide.reset(true);
    });
  }, []);

  const select = (index: number) => {
    const item = ITEMS[index];
    if (!item) return;
    if (searchOpen) closeSearch(true);
    if (pathname !== item.to) {
      lightImpact();
      nav.tab(item.to);
    }
  };

  const tabCenters = (): number[] =>
    tabRefs.current.map((tab) => {
      if (!tab) return 0;
      const rect = tab.getBoundingClientRect();
      // Viewport coordinates, the same space as the pointer events they are
      // compared against. The pill is centred and only as wide as its tabs, so
      // nav-relative centres would land nearer the wrong tab.
      return rect.left + rect.width / 2;
    });

  const pillPx = (): number => {
    const raw = navRef.current?.style.getPropertyValue('--pill-x') ?? '0';
    return Number.parseFloat(raw) || 0;
  };

  const dragRef = useRef<{ pointerId: number; startX: number; startPx: number; moved: boolean; captured: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const beginDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!visible || (event.pointerType === 'mouse' && event.button !== 0)) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startPx: pillPx(),
      moved: false,
      captured: false,
    };
    navScrollHide.suspend('drag', true);
    setDragging(true);
  };

  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    if (Math.abs(dx) > DRAG_THRESHOLD) {
      drag.moved = true;
      if (!drag.captured) {
        drag.captured = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
    event.preventDefault();
    // The pill follows the finger in the same px space it rests in, and the
    // white-label track (translated by the negative of the same variable)
    // follows it, so labels whiten as the pill crosses them.
    navRef.current?.style.setProperty('--pill-x', `${drag.startPx + dx}px`);
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    navScrollHide.suspend('drag', false);
    if (!drag.moved) return;

    suppressClickRef.current = true;
    const centers = tabCenters();
    let nearest = activeIndex;
    let best = Number.POSITIVE_INFINITY;
    centers.forEach((center, index) => {
      const distance = Math.abs(center - event.clientX);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    // Park the pill on the tab the drag committed to without a transition;
    // the state-driven transform then agrees with it on the next render.
    placePill(nearest, false);
    // A drag that commits on a different tab is a user-initiated change, so it
    // gets the same light impact as a tap.
    if (nearest !== activeIndex) select(nearest);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const cancelDrag = () => {
    dragRef.current = null;
    setDragging(false);
    navScrollHide.suspend('drag', false);
    placePill(activeIndexRef.current, false);
  };

  return (
    <nav
      ref={navRef}
      className={`bottom-nav nav-float${hiddenNow ? ' is-hidden' : ' is-visible'}${covered ? ' is-covered' : ''}${dragging ? ' is-dragging' : ''}`}
      data-active-index={activeIndex}
      aria-label="Primary"
      aria-hidden={!visible}
      onPointerDown={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={cancelDrag}
    >
      {/* The moving pill. Its translateX is set from the active tab's
          offsetLeft; the track inside it holds a duplicate of both labels in
          white and is translated by the negative of the same value, so the
          labels whiten exactly where the pill covers them and nowhere else. */}
      <span className="nav-indicator nav-pill" aria-hidden="true">
        <span className="nav-pill-track">
          {ITEMS.map((item) => (
            <span className="nav-pill-cell" key={item.to}>
              <span className="nav-icon">
                <NavGlyphOutline name={item.glyph} />
              </span>
              <span className="nav-label nav-label--ghost">{item.label}</span>
            </span>
          ))}
        </span>
      </span>
      {ITEMS.map((item, index) => {
        const active = index === activeIndex;
        const entering = glyphMove?.to === index;
        const leaving = glyphMove?.from === index;
        return (
          <button
            key={item.to}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            className={`nav-tab tap${active ? ' is-active' : ''}${entering ? ' is-enter' : ''}${leaving ? ' is-leave' : ''}`}
            aria-current={active ? 'page' : undefined}
            aria-label={item.label}
            tabIndex={visible ? 0 : -1}
            data-nav-item={item.to}
            data-glyph={item.glyph}
            data-glyph-state={active ? 'active' : 'idle'}
            onClick={(event) => {
              if (suppressClickRef.current) {
                event.preventDefault();
                return;
              }
              select(index);
            }}
          >
            <span className="nav-icon" aria-hidden="true">
              <NavGlyph name={item.glyph} />
            </span>
            <span className="nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
