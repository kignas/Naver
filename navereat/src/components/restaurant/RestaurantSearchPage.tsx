import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon';
import { MenuCtaButton } from '../menu/MenuCtaButton';
import type { MenuGroup } from '../menu/menuTypes';
import { categoryId } from '../menu/menuTypes';
import {
  buildEntries,
  highlight,
  search,
  visible,
  type Diet,
  type SearchEntry,
  type SearchResult,
} from '../../lib/menuSearch';

interface RestaurantSearchPageProps {
  open: boolean;
  name: string;
  groups: MenuGroup[];
  resId: number;
  /** `after` runs once the closing animation has finished (category jump). */
  onClose: (after?: () => void) => void;
  onCategory: (targetId: string) => void;
}

const RECENT_MAX = 5;
const RECENT_KEY = (resId: number) => `ew_menu_recent_${resId}`;

function readRecent(resId: number): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY(resId)) ?? '[]');
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && !!entry).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function VegMark({ item }: { item: SearchEntry['item'] }) {
  if (typeof item.isVeg !== 'boolean') return null;
  return (
    <span
      className={`ss-veg ${item.isVeg ? 'is-veg' : 'is-nonveg'}`}
      role="img"
      aria-label={item.isVeg ? 'Veg' : 'Non-veg'}
    >
      <span />
    </span>
  );
}

function Thumb({ entry, className }: { entry: SearchEntry; className: string }) {
  return (
    <div className={className}>
      {entry.item.image ? (
        <img src={entry.item.image} alt="" loading="lazy" decoding="async" />
      ) : (
        <Icon name="solid:utensils" size={22} />
      )}
    </div>
  );
}

function SearchCard({
  entry,
  result,
  resId,
}: {
  entry: SearchEntry;
  result: SearchResult | null;
  resId: number;
}) {
  const parts = result ? highlight(entry.item.name, result.tokens, result.fuzzy) : [{ text: entry.item.name, match: false }];
  const off = entry.original ? Math.round((1 - entry.price / entry.original) * 100) : 0;
  const customisable = !!(
    entry.item.isCustomisable ||
    entry.item.customisable ||
    (entry.item.customizations?.length ?? 0) > 0 ||
    (entry.item.customizationGroups?.length ?? 0) > 0
  );
  return (
    <article className={`ss-card${customisable ? ' has-cust' : ''}`} data-i={entry.order}>
      <div className="ss-main">
        {entry.badge && <span className="ss-badge">{entry.badge}</span>}
        <div className="ss-title-row">
          <VegMark item={entry.item} />
          <h3 className="ss-name">
            {parts.map((part, index) => (part.match ? <mark className="ss-hl" key={index}>{part.text}</mark> : part.text))}
          </h3>
        </div>
        <div className="ss-price">
          <span className="ss-now">₹{entry.price}</span>
          {entry.original && (
            <>
              <s className="ss-was">₹{entry.original}</s>
              <span className="ss-off">{off}% OFF</span>
            </>
          )}
        </div>
        <p className="ss-cat">in {entry.category}</p>
        {entry.desc && <p className="ss-desc">{entry.desc}</p>}
      </div>
      <div className="ss-media">
        <Thumb entry={entry} className="ss-img" />
        <div className="ss-cta">
          <MenuCtaButton item={entry.item} resId={resId} />
        </div>
        {customisable && <span className="ss-cust">Customisable</span>}
      </div>
    </article>
  );
}

/**
 * The full-screen in-restaurant search page from restaurant-shell.html
 * (Nearbite 0cca76b: ssBuild / ssRender / ssSearch / ssHighlight), including
 * the idle browse list, veg toggles, highlighted results and empty states.
 */
export function RestaurantSearchPage({ open, name, groups, resId, onClose, onCategory }: RestaurantSearchPageProps) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const [query, setQuery] = useState('');
  const [diet, setDiet] = useState<Diet>(null);
  const [recent, setRecent] = useState<string[]>(() => readRecent(resId));
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pushedRef = useRef(false);
  const afterRef = useRef<(() => void) | undefined>(undefined);

  const entries = useMemo(() => buildEntries(groups), [groups]);
  const result = useMemo(() => (query.trim() ? search(entries, query, diet) : null), [diet, entries, query]);

  const remember = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed.length < 2) return;
      const next = [trimmed, ...readRecent(resId).filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(0, RECENT_MAX);
      try {
        localStorage.setItem(RECENT_KEY(resId), JSON.stringify(next));
      } catch {
        /* storage can be full or blocked; searching still works */
      }
      setRecent(next);
    },
    [resId],
  );

  useEffect(() => {
    if (!open) return undefined;
    setMounted(true);
    setQuery('');
    setDiet(null);
    setRecent(readRecent(resId));
    document.body.classList.add('ew-search-open');
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    try {
      history.pushState({ ewSearch: true }, '');
      pushedRef.current = true;
    } catch {
      pushedRef.current = false;
    }
    const frame = requestAnimationFrame(() => {
      setEntered(true);
      inputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, resId]);

  useEffect(() => {
    if (open || !mounted) return undefined;
    setEntered(false);
    document.body.classList.remove('ew-search-open');
    const timer = window.setTimeout(() => {
      setMounted(false);
      const after = afterRef.current;
      afterRef.current = undefined;
      after?.();
    }, 270);
    return () => window.clearTimeout(timer);
  }, [mounted, open]);

  useEffect(() => () => document.body.classList.remove('ew-search-open'), []);

  useEffect(() => {
    const onPop = () => {
      if (!open) return;
      pushedRef.current = false;
      onClose();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [onClose, open]);

  const requestClose = useCallback(
    (after?: () => void) => {
      afterRef.current = after;
      if (pushedRef.current && history.state?.ewSearch) {
        history.back();
      } else {
        onClose();
      }
    },
    [onClose],
  );

  const jumpToCategory = useCallback(
    (targetId: string) => {
      requestClose(() => onCategory(targetId));
    },
    [onCategory, requestClose],
  );

  const setDietAndReset = (next: Diet) => {
    setDiet(next);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  };

  const pickQuery = (value: string) => {
    setQuery(value);
    remember(value);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    inputRef.current?.blur();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, requestClose]);

  if (!mounted) return null;

  const pool = visible(entries, diet);
  const popular = pool.filter((entry) => entry.popular).slice(0, 8);
  const categories: { name: string; index: number; count: number }[] = [];
  pool.forEach((entry) => {
    const found = categories.find((category) => category.name === entry.category);
    if (found) found.count += 1;
    else categories.push({ name: entry.category, index: entry.categoryIndex, count: 1 });
  });

  const q = query.trim();
  const chips = (
    <section className="ss-sec">
      <div className="ss-sec-head">
        <h2>Recent searches</h2>
        <button
          type="button"
          className="ss-link"
          onClick={() => {
            try {
              localStorage.removeItem(RECENT_KEY(resId));
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
        {recent.map((entry) => (
          <button type="button" className="ss-chip" key={entry} onClick={() => pickQuery(entry)}>
            <i aria-hidden="true">
              <Icon name="solid:rotate-left" size={12} />
            </i>
            {entry}
          </button>
        ))}
      </div>
    </section>
  );

  const popularBlock = popular.length > 0 && (
    <section className="ss-sec">
      <div className="ss-sec-head">
        <h2>Popular dishes</h2>
      </div>
      <div className="ss-pop">
        {popular.map((entry) => (
          <button type="button" className="ss-pop-card" key={entry.item.id} onClick={() => pickQuery(entry.item.name)}>
            <Thumb entry={entry} className="ss-pop-img" />
            <span className="ss-pop-name">{entry.item.name}</span>
            <span className="ss-pop-price">₹{entry.price}</span>
          </button>
        ))}
      </div>
    </section>
  );

  const categoriesBlock = categories.length > 0 && (
    <section className="ss-sec">
      <div className="ss-sec-head">
        <h2>Browse the menu</h2>
      </div>
      <div className="ss-cats">
        {categories.map((category) => (
          <button
            type="button"
            className="ss-cat-row"
            key={category.name}
            onClick={() => jumpToCategory(categoryId(category.name, category.index))}
          >
            <span className="ss-cat-name">{category.name}</span>
            <span className="ss-cat-n">{category.count}</span>
            <i aria-hidden="true">
              <Icon name="solid:chevron-right" size={11} />
            </i>
          </button>
        ))}
      </div>
    </section>
  );

  const idle = recent.length > 0 || popular.length > 0 || categories.length > 0
    ? <>{recent.length > 0 && chips}{popularBlock}{categoriesBlock}</>
    : (
      <div className="ss-empty">
        <Icon name="solid:utensils" size={30} />
        <p className="ss-empty-t">No {diet === 'veg' ? 'veg' : 'non-veg'} dishes on this menu</p>
        <button type="button" className="ss-empty-btn" onClick={() => setDietAndReset(null)}>
          Show all dishes
        </button>
      </div>
    );

  let body: JSX.Element;
  if (!entries.length) {
    body = (
      <div className="ss-empty">
        <Icon name="solid:utensils" size={30} />
        <p className="ss-empty-t">Menu is still loading</p>
        <p className="ss-empty-s">Try again in a moment.</p>
      </div>
    );
  } else if (!q) {
    body = <>{idle}</>;
  } else if (!result || result.list.length === 0) {
    const otherMatches = diet ? search(entries, q, null).list.length > 0 : false;
    const dietName = diet === 'veg' ? 'veg' : 'non-veg';
    const title = otherMatches ? `No ${dietName} dishes found for “${q}”` : `No dishes found for “${q}”`;
    const sub = otherMatches
      ? `Other dishes match. Turn off the ${diet === 'veg' ? 'Veg' : 'Non-veg'} filter to see them.`
      : 'Check the spelling or try a shorter word.';
    const best = pool.filter((entry) => entry.popular).slice(0, 4);
    body = (
      <>
        <div className="ss-empty is-short">
          <Icon name="solid:magnifying-glass" size={30} />
          <p className="ss-empty-t">{title}</p>
          <p className="ss-empty-s">{sub}</p>
          {otherMatches ? (
            <button type="button" className="ss-empty-btn" onClick={() => setDietAndReset(null)}>
              Show all dishes
            </button>
          ) : (
            <button type="button" className="ss-empty-btn" onClick={() => setQuery('')}>
              Clear search
            </button>
          )}
        </div>
        {best.length > 0 ? (
          <>
            <section className="ss-sec ss-best">
              <div className="ss-sec-head">
                <h2>Bestsellers you might like</h2>
              </div>
            </section>
            {best.map((entry) => (
              <SearchCard key={entry.item.id} entry={entry} result={null} resId={resId} />
            ))}
          </>
        ) : (
          <>{popularBlock || categoriesBlock}</>
        )}
      </>
    );
  } else {
    const kind = diet === 'veg' ? 'veg ' : diet === 'nonveg' ? 'non-veg ' : '';
    body = (
      <>
        <p className="ss-count" aria-live="polite">
          {result.list.length} {kind}
          {result.list.length === 1 ? 'dish' : 'dishes'}
          {result.fuzzy ? ` · close matches for “${q}”` : ''}
        </p>
        {result.list.map((entry) => (
          <SearchCard key={entry.item.id} entry={entry} result={result} resId={resId} />
        ))}
      </>
    );
  }

  return createPortal(
    <div
      className={`ss${entered ? ' is-in' : ''}`}
      id="ss-root"
      role="dialog"
      aria-modal="true"
      aria-label="Search dishes"
    >
      <div className="ss-top">
        <button type="button" className="ss-back" aria-label="Close search" onClick={() => requestClose()}>
          <Icon name="solid:arrow-left" size={16} />
        </button>
        <label className="ss-field">
          <i aria-hidden="true">
            <Icon name="solid:magnifying-glass" size={16} />
          </i>
          <input
            id="ss-input"
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Search dishes"
            placeholder={name ? `Search in ${name}` : 'Search dishes'}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (bodyRef.current) bodyRef.current.scrollTop = 0;
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                remember(query);
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
              setQuery('');
              inputRef.current?.focus({ preventScroll: true });
            }}
          >
            <Icon name="solid:xmark" size={12} />
          </button>
          <span className="ss-diet" role="group" aria-label="Diet">
            <button
              type="button"
              className={`ss-diet-chip${diet === 'veg' ? ' is-on' : ''}`}
              data-diet="veg"
              aria-pressed={diet === 'veg'}
              aria-label="Veg only"
              title="Veg only"
              onClick={() => setDietAndReset(diet === 'veg' ? null : 'veg')}
            >
              <span className="ss-veg is-veg" aria-hidden="true">
                <span />
              </span>
            </button>
            <button
              type="button"
              className={`ss-diet-chip${diet === 'nonveg' ? ' is-on' : ''}`}
              data-diet="nonveg"
              aria-pressed={diet === 'nonveg'}
              aria-label="Non-veg only"
              title="Non-veg only"
              onClick={() => setDietAndReset(diet === 'nonveg' ? null : 'nonveg')}
            >
              <span className="ss-veg is-nonveg" aria-hidden="true">
                <span />
              </span>
            </button>
          </span>
        </label>
      </div>
      <div
        className="ss-body"
        id="ss-body"
        ref={bodyRef}
        onTouchMove={() => {
          if (document.activeElement === inputRef.current) inputRef.current?.blur();
        }}
      >
        {body}
      </div>
    </div>,
    document.body,
  );
}
