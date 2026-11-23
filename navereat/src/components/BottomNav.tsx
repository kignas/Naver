import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { isTabPath, useAppNav } from '../lib/navigation';
import { useSearchStore } from '../store/searchStore';
import { Icon } from './Icon';
import type { IconName } from './icons';
import '../styles/bottom-nav.css';

interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
  indicatorWidth: number;
}

const ITEMS: NavEntry[] = [
  { to: '/', label: 'Home', icon: 'solid:house', indicatorWidth: 84 },
  { to: '/under99', label: '₹99 Store', icon: 'solid:tag', indicatorWidth: 98 },
  { to: '/search', label: 'Search', icon: 'solid:magnifying-glass', indicatorWidth: 88 },
  { to: '/orders', label: 'Orders', icon: 'solid:list', indicatorWidth: 88 },
  { to: '/profile', label: 'Profile', icon: 'solid:user', indicatorWidth: 90 },
];

const SEARCH_INDEX = 2;
const DRAG_THRESHOLD = 6;

function activeIndexFor(pathname: string, searchOpen: boolean): number {
  if (searchOpen) return SEARCH_INDEX;
  if (pathname === '/') return 0;
  if (pathname === '/under99') return 1;
  if (pathname === '/orders') return 3;
  if (pathname === '/profile') return 4;
  return 0;
}

function hapticTick(): void {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* vibration is optional */
  }
}

export function BottomNav() {
  const { pathname } = useLocation();
  const nav = useAppNav();
  const openSearch = useSearchStore((state) => state.openSearch);
  const closeSearch = useSearchStore((state) => state.closeSearch);
  const searchOpen = useSearchStore((state) => state.isOpen);
  const activeIndex = activeIndexFor(pathname, searchOpen);
  const visible = isTabPath(pathname);

  const navRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const indicatorRef = useRef<HTMLSpanElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startIndicatorX: number; moved: boolean; captured: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('has-bottom-nav', visible);
    return () => document.body.classList.remove('has-bottom-nav');
  }, [visible]);
  const [metrics, setMetrics] = useState({ x: 0, width: ITEMS[0].indicatorWidth });

  const measure = useCallback(() => {
    const element = navRef.current;
    const tab = tabRefs.current[activeIndex];
    if (!element || !tab) return;
    const navRect = element.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const width = ITEMS[activeIndex].indicatorWidth;
    setMetrics({ x: tabRect.left - navRect.left + tabRect.width / 2 - width / 2, width });
  }, [activeIndex]);

  useLayoutEffect(() => {
    measure();
  }, [measure, visible, pathname, searchOpen]);

  useEffect(() => {
    if (!visible) return;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure, visible]);

  const select = (index: number) => {
    const item = ITEMS[index];
    if (!item) return;
    if (item.to === '/search') {
      if (searchOpen) {
        closeSearch(true);
      } else {
        openSearch(pathname === '/under99' ? 'under99' : 'home');
      }
      return;
    }
    if (searchOpen) closeSearch(true);
    if (pathname !== item.to) {
      hapticTick();
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
    const target = ITEMS[nearest];
    const targetCenter = centers[nearest] ?? 0;
    setMetrics({ x: targetCenter - target.indicatorWidth / 2, width: target.indicatorWidth });
    if (nearest !== activeIndex) select(nearest);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const cancelDrag = () => {
    dragRef.current = null;
    setDragging(false);
    setMetrics((current) => ({ ...current }));
  };

  const navStyle = {
    '--nav-indicator-x': `${metrics.x}px`,
    '--nav-indicator-w': `${metrics.width}px`,
  } as CSSProperties;

  return (
    <nav
      ref={navRef}
      className={`bottom-nav nav-float${visible ? ' is-visible' : ' is-hidden'}${dragging ? ' is-dragging' : ''}`}
      style={navStyle}
      aria-label="Primary"
      aria-hidden={!visible}
      onPointerDown={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={cancelDrag}
    >
      <span className="nav-indicator" ref={indicatorRef} aria-hidden="true" />
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
              <Icon name={item.icon} size={21} />
            </span>
            <span className="nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
