import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MenuItem } from '../../data/demo';
import { isCustomisable } from '../../lib/customization';
import { useCustomize } from '../../lib/customizeContext';
import { tapHaptic } from '../../lib/haptics';
import { registerSheet } from '../../lib/sheetStack';
import { useAppStore } from '../../store/appStore';
import { Icon } from '../Icon';

type Diet = 'veg' | 'nonveg' | null;

interface RestaurantSearchProps {
  open: boolean;
  restaurantId: number;
  restaurantName: string;
  menu: MenuItem[];
  onClose: () => void;
  onJumpCategory: (categoryName: string) => void;
}

interface Entry {
  item: MenuItem;
  category: string;
  price: number;
}

const RECENT_KEY = 'nearbite_recent_searches';
const RECENT_LIMIT = 6;
const CLOSE_MS = 280;

function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);

/** Wraps every hit in the same `<mark class="ss-hl">` the original paints. */
function highlight(name: string, query: string): string {
  const tokens = query.toLowerCase().split(/\s+/).filter((token) => token.length > 0);
  if (!tokens.length) return escapeHtml(name);
  const lower = name.toLowerCase();
  const marks = new Array<boolean>(name.length).fill(false);
  tokens.forEach((token) => {
    let from = 0;
    for (;;) {
      const at = lower.indexOf(token, from);
      if (at === -1) break;
      for (let index = at; index < at + token.length; index += 1) marks[index] = true;
      from = at + token.length;
    }
  });
  let out = '';
  let open = false;
  for (let index = 0; index < name.length; index += 1) {
    if (marks[index] && !open) {
      out += '<mark class="ss-hl">';
      open = true;
    } else if (!marks[index] && open) {
      out += '</mark>';
      open = false;
    }
    out += escapeHtml(name[index]);
  }
  return open ? `${out}</mark>` : out;
}

function VegMark({ isVeg }: { isVeg: boolean }) {
  return (
    <span className={`ss-veg ${isVeg ? 'is-veg' : 'is-nonveg'}`} role="img" aria-label={isVeg ? 'Veg' : 'Non-veg'}>
      <span />
    </span>
  );
}

/**
 * The original restaurant search page (`#ss-root` / `.ss` markup). It replaces
 * the inline "Search dishes in this menu" row the port used to open: the
 * Search pill and the sticky bar both come here.
 */
export function RestaurantSearch({
  open,
  restaurantId,
  restaurantName,
  menu,
  onClose,
  onJumpCategory,
}: RestaurantSearchProps) {
  const [query, setQuery] = useState('');
  const [diet, setDiet] = useState<Diet>(null);
  const [rendered, setRendered] = useState(open);
  const [inView, setInView] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const addItem = useAppStore((state) => state.addItem);
  const decrementItem = useAppStore((state) => state.decrementItem);
  const cart = useAppStore((state) => state.cart);
  const { openCustomize } = useCustomize();

  const entries = useMemo<Entry[]>(
    () => menu.map((item) => ({ item, category: item.category?.trim() || 'Recommended', price: item.price })),
    [menu],
  );

  const dietPool = useMemo(
    () => entries.filter((entry) => !diet || (diet === 'veg' ? entry.item.isVeg : !entry.item.isVeg)),
    [diet, entries],
  );

  const categories = useMemo(() => {
    const list: { name: string; count: number }[] = [];
    dietPool.forEach((entry) => {
      const existing = list.find((row) => row.name === entry.category);
      if (existing) existing.count += 1;
      else list.push({ name: entry.category, count: 1 });
    });
    return list;
  }, [dietPool]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return dietPool.filter((entry) =>
      `${entry.item.name} ${entry.item.desc ?? ''} ${entry.category}`.toLowerCase().includes(term),
    );
  }, [dietPool, query]);

  // Keep the markup mounted for the closing transition, then unmount.
  useEffect(() => {
    if (open) {
      setRendered(true);
      setRecent(readRecent());
      const frame = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(frame);
    }
    setInView(false);
    const timer = window.setTimeout(() => {
      setRendered(false);
      setQuery('');
      setDiet(null);
    }, CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!rendered) return undefined;
    return registerSheet(() => setRendered(false));
  }, [rendered]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('ew-search-open');
    return () => document.body.classList.remove('ew-search-open');
  }, [open]);

  const saveRecent = useCallback((value: string) => {
    const term = value.trim();
    if (term.length < 2) return;
    const next = [term, ...readRecent().filter((entry) => entry.toLowerCase() !== term.toLowerCase())].slice(0, RECENT_LIMIT);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* storage full or disabled */
    }
    setRecent(next);
  }, []);

  const close = useCallback(() => {
    if (query.trim()) saveRecent(query);
    onClose();
  }, [onClose, query, saveRecent]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close, open]);

  if (!rendered) return null;

  const setTerm = (value: string) => {
    setQuery(value);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  };

  const jump = (name: string) => {
    close();
    window.setTimeout(() => onJumpCategory(name), 60);
  };

  const renderCta = (entry: Entry) => {
    const { item } = entry;
    if (isCustomisable(item)) {
      return (
        <button
          type="button"
          className="nb-add-btn nb-add-btn--cust"
          data-menu-item-id={item.id}
          aria-label={`Customise ${item.name}`}
          onClick={() => {
            tapHaptic();
            openCustomize(item, restaurantId);
          }}
        >
          ADD <span className="nb-add-plus" aria-hidden="true">+</span>
        </button>
      );
    }
    const qty = cart[item.name]?.quantity ?? 0;
    if (qty > 0) {
      return (
        <div className="nb-qty" role="group" aria-label="Quantity">
          <button
            type="button"
            className="nb-qty-btn"
            aria-label="Decrease quantity"
            onClick={() => {
              tapHaptic();
              decrementItem(item.name);
            }}
          >
            −
          </button>
          <span className="nb-qty-val">{qty}</span>
          <button
            type="button"
            className="nb-qty-btn"
            aria-label="Increase quantity"
            onClick={() => {
              tapHaptic();
              addItem(item, restaurantId);
            }}
          >
            +
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        className="nb-add-btn"
        aria-label={`Add ${item.name} to cart`}
        onClick={() => {
          tapHaptic();
          addItem(item, restaurantId);
        }}
      >
        ADD
      </button>
    );
  };

  const card = (entry: Entry) => {
    const { item } = entry;
    const original = item.originalPrice && item.originalPrice > item.price ? item.originalPrice : null;
    const off = original ? Math.round((1 - item.price / original) * 100) : 0;
    return (
      <article className={`ss-card${isCustomisable(item) ? ' has-cust' : ''}`} key={item.id}>
        <div className="ss-main">
          {item.bestseller && <span className="ss-badge">Bestseller</span>}
          <div className="ss-title-row">
            <VegMark isVeg={item.isVeg} />
            <h3 className="ss-name" dangerouslySetInnerHTML={{ __html: highlight(item.name, query) }} />
          </div>
          <div className="ss-price">
            <span className="ss-now">₹{item.price}</span>
            {original && (
              <>
                <s className="ss-was">₹{original}</s>
                <span className="ss-off">{off}% OFF</span>
              </>
            )}
          </div>
          <p className="ss-cat">in {entry.category}</p>
          {item.desc && <p className="ss-desc">{item.desc}</p>}
        </div>
        <div className="ss-media">
          <div className="ss-img">
            {item.image ? (
              <img src={item.image} alt="" loading="lazy" decoding="async" />
            ) : (
              <Icon name="solid:utensils" size={22} />
            )}
          </div>
          <div className="ss-cta">{renderCta(entry)}</div>
          {isCustomisable(item) && <span className="ss-cust">Customisable</span>}
        </div>
      </article>
    );
  };

  const term = query.trim();
  const dietName = diet === 'veg' ? 'veg' : 'non-veg';
  const dietBlocked = diet !== null && term.length > 0 && results.length === 0;

  return createPortal(
    <div
      className={`ss${inView ? ' is-in' : ''}`}
      id="ss-root"
      role="dialog"
      aria-modal="true"
      aria-label="Search dishes"
    >
      <div className="ss-top">
        <button type="button" className="ss-back" aria-label="Close search" onClick={close}>
          <Icon name="solid:arrow-left" size={17} />
        </button>
        <label className="ss-field">
          <Icon name="solid:magnifying-glass" size={16} />
          <input
            id="ss-input"
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Search dishes"
            placeholder={`Search in ${restaurantName}`}
            value={query}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                saveRecent(query);
                inputRef.current?.blur();
              }
            }}
          />
          <button
            type="button"
            className="ss-clear"
            aria-label="Clear search"
            hidden={!query}
            onClick={() => {
              setTerm('');
              inputRef.current?.focus({ preventScroll: true });
            }}
          >
            <Icon name="solid:xmark" size={12} />
          </button>
          <span className="ss-diet" role="group" aria-label="Diet">
            {(['veg', 'nonveg'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`ss-diet-chip${diet === value ? ' is-on' : ''}`}
                data-diet={value}
                aria-pressed={diet === value}
                aria-label={value === 'veg' ? 'Veg only' : 'Non-veg only'}
                title={value === 'veg' ? 'Veg only' : 'Non-veg only'}
                onClick={() => {
                  tapHaptic();
                  setDiet(diet === value ? null : value);
                  if (bodyRef.current) bodyRef.current.scrollTop = 0;
                }}
              >
                <span className={`ss-veg ${value === 'veg' ? 'is-veg' : 'is-nonveg'}`} aria-hidden="true">
                  <span />
                </span>
              </button>
            ))}
          </span>
        </label>
      </div>
      <div className="ss-body" id="ss-body" ref={bodyRef}>
        {!term ? (
          <>
            {recent.length > 0 && (
              <section className="ss-sec">
                <div className="ss-sec-head">
                  <h2>Recent searches</h2>
                  <button
                    type="button"
                    className="ss-link"
                    onClick={() => {
                      try {
                        localStorage.removeItem(RECENT_KEY);
                      } catch {
                        /* ignore */
                      }
                      setRecent([]);
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div className="ss-chips">
                  {recent.map((value) => (
                    <button key={value} type="button" className="ss-chip" onClick={() => setTerm(value)}>
                      <Icon name="solid:rotate-left" size={13} />
                      {value}
                    </button>
                  ))}
                </div>
              </section>
            )}
            {categories.length > 0 ? (
              <section className="ss-sec">
                <div className="ss-sec-head">
                  <h2>Browse the menu</h2>
                </div>
                <div className="ss-cats">
                  {categories.map((category) => (
                    <button key={category.name} type="button" className="ss-cat-row" onClick={() => jump(category.name)}>
                      <span className="ss-cat-name">{category.name}</span>
                      <span className="ss-cat-n">{category.count}</span>
                      <Icon name="solid:chevron-right" size={13} />
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <div className="ss-empty">
                <Icon name="solid:utensils" size={26} />
                <p className="ss-empty-t">No {dietName} dishes on this menu</p>
                <button type="button" className="ss-empty-btn" onClick={() => setDiet(null)}>
                  Show all dishes
                </button>
              </div>
            )}
          </>
        ) : results.length === 0 ? (
          <div className="ss-empty is-short">
            <Icon name="solid:magnifying-glass" size={26} />
            <p className="ss-empty-t">
              {dietBlocked ? `No ${dietName} dishes found for “${term}”` : `No dishes found for “${term}”`}
            </p>
            <p className="ss-empty-s">
              {dietBlocked
                ? `Other dishes match. Turn off the ${diet === 'veg' ? 'Veg' : 'Non-veg'} filter to see them.`
                : 'Check the spelling or try a shorter word.'}
            </p>
            <button type="button" className="ss-empty-btn" onClick={() => (dietBlocked ? setDiet(null) : setTerm(''))}>
              {dietBlocked ? 'Show all dishes' : 'Clear search'}
            </button>
          </div>
        ) : (
          <>
            <p className="ss-count" aria-live="polite">
              {results.length} {diet === 'veg' ? 'veg ' : diet === 'nonveg' ? 'non-veg ' : ''}
              {results.length === 1 ? 'dish' : 'dishes'}
            </p>
            {results.map(card)}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
