import { useEffect, useMemo, useRef, useState } from 'react';
import type { MenuItem } from '../../data/demo';
import { Icon } from '../Icon';

interface RestaurantStickySearchProps {
  restaurantName: string;
  menu: MenuItem[];
  onOpenSearch: () => void;
  onBack: () => void;
}

const ROTATE_MS = 2800;

/**
 * The header scrolls away, so its own top bar goes with it. This bar slides in
 * from the top once `#res-name` has cleared the top edge: back arrow plus a
 * search pill whose text rolls through the menu's dish names (`Search "biryani"`
 * → `Search "chicken tikka"`). Ported from the original sticky bar.
 */
export function RestaurantStickySearch({ restaurantName, menu, onOpenSearch, onBack }: RestaurantStickySearchProps) {
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  const names = useMemo(() => {
    const seen = new Set<string>();
    const top: string[] = [];
    const rest: string[] = [];
    menu.forEach((item) => {
      const name = String(item.name ?? '').trim();
      const key = name.toLowerCase();
      if (!name || name.length > 28 || seen.has(key)) return;
      seen.add(key);
      (item.bestseller ? top : rest).push(name);
    });
    return [...top, ...rest].slice(0, 12);
  }, [menu]);

  useEffect(() => {
    const nameEl = document.getElementById('res-name');
    if (!nameEl || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setVisible(!entry.isIntersecting && entry.boundingClientRect.bottom < 0);
      },
      { threshold: 0 },
    );
    observer.observe(nameEl);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.classList.toggle('ew-tsb-on', visible);
    return () => document.body.classList.remove('ew-tsb-on');
  }, [visible]);

  useEffect(() => {
    if (!visible || names.length < 2) return undefined;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % names.length), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [names.length, visible]);

  useEffect(() => {
    if (!visible) setIndex(0);
  }, [visible]);

  const current = names[index] ?? names[0];
  const label = current ? `Search "${current}"` : 'Search dishes';

  return (
    <div className="tsb" id="ew-sticky-search" ref={barRef} aria-hidden={!visible}>
      <button type="button" className="tsb-back ew-hd-circle" aria-label="Back" onClick={onBack}>
        <Icon name="solid:chevron-left" size={22} />
      </button>
      <button
        type="button"
        className="tsp"
        aria-label={`Search dishes in ${restaurantName}`}
        aria-expanded={false}
        onClick={onOpenSearch}
      >
        <Icon name="solid:magnifying-glass" size={14} />
        <span className="tsp-text">
          <span className="tsp-line">{label}</span>
        </span>
      </button>
    </div>
  );
}
