import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useMenuFilters } from '../menu/menuFiltersContext';
import { categoryId } from '../menu/menuTypes';

interface MenuJumpProps {
  scrollRef: RefObject<HTMLDivElement>;
  onClickCategory: (targetId: string) => void;
  hidden?: boolean;
}

const MENU_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10" />
    <path d="M17 21V3c-2.5 1.5-4 4.5-4 8h4" />
  </svg>
);

const CLOSE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/**
 * Floating "Menu" button from js/menu-jump.js (Nearbite 0cca76b): the card of
 * categories opens right above the button and jumps to the picked section; the
 * button stacks above the floating cart bar.
 */
export function MenuJump({ scrollRef, onClickCategory, hidden = false }: MenuJumpProps) {
  const { visibleGroups, collapsed, toggleCategory } = useMenuFilters();
  const [open, setOpen] = useState(false);
  const [bottom, setBottom] = useState(16);
  const [sheetBottom, setSheetBottom] = useState(90);
  const [sheetMaxHeight, setSheetMaxHeight] = useState(0);
  const [active, setActive] = useState(0);
  const [fade, setFade] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const ticking = useRef(false);

  const lift = useCallback(() => {
    const height = window.innerHeight;
    let min = height;
    ['white-cart-root', 'order-hint'].forEach((id) => {
      const root = document.getElementById(id);
      if (!root) return;
      [root, ...Array.from(root.querySelectorAll('*'))].forEach((node) => {
        const rect = node.getBoundingClientRect();
        if (
          rect.height > 24 &&
          rect.height < height * 0.5 &&
          rect.width > 150 &&
          rect.top > height * 0.5 &&
          rect.top < min
        ) {
          min = rect.top;
        }
      });
    });
    const gap = min < height ? height - min + 12 : 16;
    setBottom(Math.max(16, Math.round(gap)));
  }, []);

  const measure = useCallback(() => {
    if (!scrollRef.current || visibleGroups.length === 0) return;
    const scroller = scrollRef.current;
    const line = scroller.getBoundingClientRect().top + 140;
    let current = 0;
    visibleGroups.forEach((group, index) => {
      const target = document.getElementById(categoryId(group.name, index));
      if (target && target.getBoundingClientRect().top <= line) current = index;
    });
    setActive(current);
  }, [scrollRef, visibleGroups]);

  const schedule = useCallback(() => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      ticking.current = false;
      lift();
      measure();
    });
  }, [lift, measure]);

  useEffect(() => {
    schedule();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    // The bar can mount after this effect (a cart restored from storage, an
    // item added while the page is open), so watch until the root exists.
    const observed = new Set<Element>();
    const observers: MutationObserver[] = [];
    const watchRoot = () => {
      ['white-cart-root', 'order-hint'].forEach((id) => {
        const root = document.getElementById(id);
        if (!root || observed.has(root)) return;
        observed.add(root);
        const observer = new MutationObserver(schedule);
        observer.observe(root, { childList: true, attributes: true, subtree: true });
        observers.push(observer);
      });
    };
    watchRoot();
    const bodyObserver = new MutationObserver(() => {
      watchRoot();
      schedule();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      bodyObserver.disconnect();
      observers.forEach((observer) => observer.disconnect());
    };
  }, [schedule]);

  useEffect(() => {
    if (hidden || open) return;
    schedule();
  }, [hidden, open, schedule]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const button = btnRef.current;
    if (!button) return;
    const top = button.getBoundingClientRect().top;
    setSheetBottom(Math.max(16, Math.round(window.innerHeight - top + 12)));
    setSheetMaxHeight(Math.max(160, Math.round(top - 12 - 96)));
    const list = listRef.current;
    if (list) {
      const current = list.querySelector('.ew-mj-item.active') as HTMLElement | null;
      list.scrollTop = current ? Math.max(0, current.offsetTop - 60) : 0;
    }
  }, [open]);

  const onListScroll = () => {
    const list = listRef.current;
    if (!list) return;
    setFade(list.scrollTop + list.clientHeight < list.scrollHeight - 4);
  };

  const jump = (index: number) => {
    const group = visibleGroups[index];
    if (!group) return;
    const targetId = categoryId(group.name, index);
    setOpen(false);
    if (collapsed.has(group.name)) toggleCategory(group.name);
    window.setTimeout(() => onClickCategory(targetId), 80);
  };

  if (hidden) return null;

  const show = visibleGroups.length > 1;

  return createPortal(
    <>
      <button
        ref={btnRef}
        type="button"
        className={`ew-mj-btn${show ? ' show' : ''}${open ? ' open' : ''}`}
        id="ew-mj-btn"
        style={{ bottom: `calc(${bottom}px + env(safe-area-inset-bottom,0px))` }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Browse menu categories"
        onClick={() => {
          if (!open) lift();
          setOpen((value) => !value);
        }}
      >
        {open ? CLOSE_ICON : MENU_ICON}
        <span>{open ? 'Close' : 'Menu'}</span>
      </button>
      <div
        className={`ew-mj-backdrop${open ? ' show' : ''}`}
        id="ew-mj-backdrop"
        onClick={() => setOpen(false)}
      />
      <div
        className={`ew-mj-sheet${open ? ' show' : ''}`}
        id="ew-mj-sheet"
        role="dialog"
        aria-label="Menu categories"
        style={{ bottom: sheetBottom, maxHeight: sheetMaxHeight || undefined }}
      >
        <ul className={`ew-mj-list${fade ? ' fade' : ''}`} id="ew-mj-list" ref={listRef} onScroll={onListScroll}>
          {visibleGroups.map((group, index) => (
            <li key={group.name}>
              <button
                type="button"
                className={`ew-mj-item${index === active ? ' active' : ''}`}
                data-target={categoryId(group.name, index)}
                onClick={() => jump(index)}
              >
                <span className="ew-mj-name">{group.name}</span>
                <span className="ew-mj-count">{group.items.length}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>,
    document.body,
  );
}
