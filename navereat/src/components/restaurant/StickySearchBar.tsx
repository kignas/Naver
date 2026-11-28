import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon';
import type { MenuGroup } from '../menu/menuTypes';

interface StickySearchBarProps {
  groups: MenuGroup[];
  onOpen: () => void;
  onBack: () => void;
  /** Search/customise sheets and the Info tab hide the bar, like the original. */
  disabled?: boolean;
}

interface Line {
  id: number;
  text: string;
  state: 'idle' | 'in' | 'out';
}

function dishNames(groups: MenuGroup[]): string[] {
  const top: string[] = [];
  const rest: string[] = [];
  const seen = new Set<string>();
  groups.forEach((group) => {
    group.items.forEach((item) => {
      const name = String(item.name ?? '').trim();
      const key = name.toLowerCase();
      if (!name || name.length > 28 || seen.has(key) || item.available === false) return;
      seen.add(key);
      (item.bestseller ? top : rest).push(name);
    });
  });
  return top.concat(rest).slice(0, 12);
}

const labelFor = (name: string): string => (name ? `Search "${name}"` : 'Search dishes');

/**
 * The original's fixed bar (restaurant-shell.html, Nearbite 0cca76b): once the
 * restaurant name leaves the top of the screen, a back arrow and a wide search
 * pill slide down, the pill cycling through the menu's dish names.
 */
export function StickySearchBar({ groups, onOpen, onBack, disabled = false }: StickySearchBarProps) {
  const [visible, setVisible] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const lineId = useRef(0);
  const indexRef = useRef(0);
  const namesRef = useRef<string[]>([]);

  useEffect(() => {
    const nameEl = document.getElementById('res-name');
    if (!nameEl || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting && entry.boundingClientRect.bottom < 0) setVisible(true);
        else setVisible(false);
      },
      { threshold: 0 },
    );
    observer.observe(nameEl);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const names = dishNames(groups);
    namesRef.current = names;
    indexRef.current = 0;
    lineId.current += 1;
    setLines([{ id: lineId.current, text: labelFor(names[0] ?? ''), state: 'idle' }]);
    if (names.length < 2) return undefined;
    const timer = window.setInterval(() => {
      const list = namesRef.current;
      if (list.length < 2) return;
      indexRef.current = (indexRef.current + 1) % list.length;
      lineId.current += 1;
      const id = lineId.current;
      const text = labelFor(list[indexRef.current]);
      setLines((previous) => [...previous.map((line) => ({ ...line, state: 'out' as const })), { id, text, state: 'in' }]);
      requestAnimationFrame(() => {
        setLines((previous) => previous.map((line) => (line.id === id ? { ...line, state: 'idle' } : line)));
      });
      window.setTimeout(() => {
        setLines((previous) => previous.filter((line) => line.id === id || line.state !== 'out'));
      }, 700);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [visible, groups]);

  useEffect(() => {
    if (!visible || disabled) {
      document.body.classList.remove('ew-tsb-on');
    } else {
      document.body.classList.add('ew-tsb-on');
    }
    return () => document.body.classList.remove('ew-tsb-on');
  }, [visible, disabled]);

  if (!visible) return null;

  return createPortal(
    <div className="tsb" id="ew-sticky-search" aria-hidden="false">
      <button type="button" className="tsb-back ew-hd-circle" aria-label="Back" onClick={onBack}>
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.5 5.5L8 12l6.5 6.5" stroke="#101828" />
        </svg>
      </button>
      <button type="button" className="tsp" aria-label="Search dishes in this restaurant" onClick={onOpen}>
        <i aria-hidden="true">
          <Icon name="solid:magnifying-glass" size={13} />
        </i>
        <span className="tsp-text">
          {lines.map((line) => (
            <span
              key={line.id}
              className={`tsp-line${line.state === 'in' ? ' is-in' : line.state === 'out' ? ' is-out' : ''}`}
            >
              {line.text}
            </span>
          ))}
        </span>
      </button>
    </div>,
    document.body,
  );
}
