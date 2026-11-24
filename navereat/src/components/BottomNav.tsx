import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { isTabPath, useAppNav } from '../lib/navigation';
import { useSearchStore } from '../store/searchStore';
import { tapHaptic } from '../lib/haptics';
import { Icon } from './Icon';
import type { IconName } from './icons';
import '../styles/bottom-nav.css';

interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
}

const ITEMS: NavEntry[] = [
  { to: '/', label: 'Home', icon: 'solid:house' },
  { to: '/orders', label: 'History', icon: 'solid:receipt' },
];

const DRAG_THRESHOLD = 6;

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
  const [hidden, setHidden] = useState(false);

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
  const hiddenNow = detailRoute ? hidden : false;
  const visible = onTabRoute;
  // A pushed page is still sliding over the docked bar: it must stay painted
  // (the nav belongs to the tab it covers) but must not take taps that belong
  // to the incoming page.
  const covered = detailRoute && !hidden;

  const navRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dragRef = useRef<{ pointerId: number; startX: number; startIndicatorX: number; moved: boolean; captured: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('has-bottom-nav', visible);
    return () => document.body.classList.remove('has-bottom-nav');
  }, [visible]);
  const [metrics, setMetrics] = useState({ x: 0, width: 0 });

  const measure = useCallback(() => {
    const element = navRef.current;
    const tab = tabRefs.current[activeIndex];
    if (!element || !tab) return;
    const navRect = element.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    setMetrics({ x: tabRect.left - navRect.left, width: tabRect.width });
  }, [activeIndex]);

  useLayoutEffect(() => {
    measure();
  }, [measure, visible, pathname]);

  useEffect(() => {
    if (!visible) return;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure, visible]);

  const select = (index: number) => {
    const item = ITEMS[index];
    if (!item) return;
    if (searchOpen) closeSearch(true);
    if (pathname !== item.to) {
      tapHaptic();
      nav.tab(item.to);
    }
  };

  const tabCenters = (): number[] => {
    const element = navRef.current;
    if (!element) return [];
    const navRect = element.getBoundingClientRect();
    return tabRefs.current.map((tab) => {
      if (!tab) return 0;
      const rect = tab.getBoundingClientRect();
      return rect.left - navRect.left + rect.width / 2;
    });
  };

  const beginDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!visible || (event.pointerType === 'mouse' && event.button !== 0)) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startIndicatorX: metrics.x,
      moved: false,
      captured: false,
    };
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
    navRef.current?.style.setProperty('--nav-indicator-x', `${drag.startIndicatorX + dx}px`);
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
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
    const target = tabRefs.current[nearest];
    if (target && navRef.current) {
      const navRect = navRef.current.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      setMetrics({ x: targetRect.left - navRect.left, width: targetRect.width });
    }
    if (nearest !== activeIndex) select(nearest);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const cancelDrag = () => {
    dragRef.current = null;
    setDragging(false);
    measure();
  };

  const navStyle = {
    '--nav-indicator-x': `${metrics.x}px`,
    '--nav-indicator-w': `${metrics.width}px`,
  } as CSSProperties;

  return (
    <nav
      ref={navRef}
      className={`bottom-nav nav-float${hiddenNow ? ' is-hidden' : ' is-visible'}${covered ? ' is-covered' : ''}${dragging ? ' is-dragging' : ''}`}
      style={navStyle}
      aria-label="Primary"
      aria-hidden={!visible}
      onPointerDown={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={cancelDrag}
    >
      <span className="nav-indicator" aria-hidden="true" />
      {ITEMS.map((item, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={item.to}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            className={`nav-tab tap${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            aria-label={item.label}
            tabIndex={visible ? 0 : -1}
            data-nav-item={item.to}
            onClick={(event) => {
              if (suppressClickRef.current) {
                event.preventDefault();
                return;
              }
              select(index);
            }}
          >
            <span className="nav-icon" aria-hidden="true">
              <Icon name={item.icon} size={20} />
            </span>
            <span className="nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
