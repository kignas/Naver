import { useCallback, useEffect, useRef, useState } from 'react';
import type { MenuGroup } from '../menu/menuTypes';
import { categoryId } from '../menu/menuTypes';
import { Icon } from '../Icon';

interface MenuJumpProps {
  groups: MenuGroup[];
  visible: boolean;
  onJump: (categoryName: string, index: number) => void;
}

const GAP = 12;

/**
 * Floating dark "Menu" button (bottom right). One tap opens a card of the
 * categories with their item counts right above it; picking one closes the card
 * and jumps to that section. Lifted above the cart bar when it is on screen.
 * Ported from the original `js/menu-jump.js`, markup and geometry unchanged.
 */
export function MenuJump({ groups, visible, onJump }: MenuJumpProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [bottom, setBottom] = useState(16);
  const [sheetBottom, setSheetBottom] = useState(90);
  const [sheetMax, setSheetMax] = useState(320);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const show = visible && groups.length > 1;

  // Lift above the pink cart bar when it is showing (same rule as the original).
  const lift = useCallback(() => {
    const button = btnRef.current;
    if (!button) return;
    const layerBottom = button.getBoundingClientRect().bottom + bottom;
    let min = layerBottom;
    const cart = document.querySelector('.cart-bar');
    if (cart) {
      const rect = cart.getBoundingClientRect();
      if (rect.height > 24 && rect.width > 150 && rect.top < min) min = rect.top;
    }
    setBottom(Math.max(16, Math.round(layerBottom - min + GAP)));
  }, [bottom]);

  useEffect(() => {
    if (!show) return undefined;
    lift();
    window.addEventListener('resize', lift);
    const interval = window.setInterval(lift, 400);
    return () => {
      window.removeEventListener('resize', lift);
      window.clearInterval(interval);
    };
  }, [lift, show]);

  useEffect(() => {
    if (!show) setOpen(false);
  }, [show]);

  const openSheet = () => {
    const button = btnRef.current;
    if (!button) return;
    const buttonRect = button.getBoundingClientRect();
    setSheetBottom(Math.max(16, Math.round(window.innerHeight - buttonRect.top + GAP)));
    setSheetMax(Math.max(160, Math.round(buttonRect.top - GAP - 96)));
    let current = 0;
    groups.forEach((group, index) => {
      const element = document.getElementById(categoryId(group.name, index));
      if (element && element.getBoundingClientRect().top <= 140) current = index;
    });
    setActive(current);
    setOpen(true);
    window.requestAnimationFrame(() => {
      const row = listRef.current?.querySelector<HTMLElement>('.ew-mj-item.active');
      if (listRef.current) listRef.current.scrollTop = row ? Math.max(0, row.offsetTop - 60) : 0;
    });
  };

  const closeSheet = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSheet();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {open && <div className="ew-mj-backdrop show" id="ew-mj-backdrop" onClick={closeSheet} />}
      {open && (
        <div
          className="ew-mj-sheet show"
          id="ew-mj-sheet"
          role="dialog"
          aria-label="Menu categories"
          style={{ bottom: sheetBottom, maxHeight: sheetMax }}
        >
          <ul className="ew-mj-list" id="ew-mj-list" ref={listRef}>
            {groups.map((group, index) => (
              <li key={group.name}>
                <button
                  type="button"
                  className={`ew-mj-item${index === active ? ' active' : ''}`}
                  onClick={() => {
                    closeSheet();
                    window.setTimeout(() => onJump(group.name, index), 80);
                  }}
                >
                  <span className="ew-mj-name">{group.name}</span>
                  <span className="ew-mj-count">{group.items.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        ref={btnRef}
        type="button"
        className={`ew-mj-btn${show ? ' show' : ''}${open ? ' open' : ''}`}
        id="ew-mj-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Browse menu categories"
        style={{ bottom }}
        onClick={() => (open ? closeSheet() : openSheet())}
      >
        <Icon name={open ? 'solid:xmark' : 'solid:utensils'} size={18} />
        <span>{open ? 'Close' : 'Menu'}</span>
      </button>
    </>
  );
}
