import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { categories, restaurants, type Category, type MenuItem, type Restaurant } from '../data/demo';
import { useAppNav } from '../lib/navigation';
import { registerSheet } from '../lib/sheetStack';
import { lockPageScroll } from '../lib/scrollLock';
import { useAppStore } from '../store/appStore';
import { useSearchStore, type SearchContext } from '../store/searchStore';
import '../styles/search-overlay.css';

const MIN_QUERY = 2;
const DEBOUNCE_MS = 260;
const FAKE_SEARCH_MS = 320;
const CLOSE_MS = 320;
const RECENT_KEY = 'nearbite_recent_searches';
const RECENT_LIMIT = 6;

type SearchPhase = 'idle' | 'searching' | 'results' | 'empty';

type SearchResult =
  | { kind: 'restaurant'; restaurant: Restaurant }
  | { kind: 'dish'; restaurant: Restaurant; item: MenuItem }
  | { kind: 'cuisine'; category: Category; count: number };

type SearchIconName = 'back' | 'search' | 'x' | 'mic';

function SearchIcon({ name, size = 20 }: { name: SearchIconName; size?: number }) {
  if (name === 'mic') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="ewMicGradient" x1="4" y1="4" x2="20" y2="20">
            <stop offset="0" stopColor="#d9096e" />
            <stop offset="1" stopColor="#ff4d5f" />
          </linearGradient>
        </defs>
        <rect x="8" y="3" width="8" height="13" rx="4" stroke="url(#ewMicGradient)" strokeWidth="2.2" />
        <path
          d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"
          stroke="url(#ewMicGradient)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const path = name === 'back' ? 'M15 18l-6-6 6-6' : name === 'x' ? 'M6 6l12 12M18 6 6 18' : null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path ? (
        <path d={path} />
      ) : (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </>
      )}
    </svg>
  );
}

function readRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string').slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

function writeRecent(values: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(values));
  } catch {
    /* storage may be unavailable */
  }
}

function searchDemo(raw: string, context: SearchContext): SearchResult[] {
  const query = raw.trim().toLowerCase();
  if (!query) return [];

  const restaurantResults: SearchResult[] = [];
  const dishResults: SearchResult[] = [];

  restaurants.forEach((restaurant) => {
    if (context === 'home' && `${restaurant.name} ${restaurant.cuisine}`.toLowerCase().includes(query)) {
      restaurantResults.push({ kind: 'restaurant', restaurant });
    }
    restaurant.menu.forEach((item) => {
      if (context === 'under99' && item.price > 99) return;
      const text = `${item.name} ${item.desc} ${item.category ?? ''}`.toLowerCase();
      if (text.includes(query)) dishResults.push({ kind: 'dish', restaurant, item });
    });
  });

  const cuisineResults: SearchResult[] =
    context === 'home'
      ? categories
          .filter((category) => `${category.name} ${category.query}`.toLowerCase().includes(query))
          .map((category) => {
            const needle = category.query.toLowerCase();
            const count = restaurants.filter(
              (restaurant) =>
                restaurant.cuisine.toLowerCase().includes(needle) ||
                restaurant.menu.some((item) => item.name.toLowerCase().includes(needle)),
            ).length;
            return { kind: 'cuisine' as const, category, count };
          })
          .filter((result) => result.count > 0)
      : [];

  return [...restaurantResults, ...dishResults, ...cuisineResults].slice(0, 12);
}

function resultImage(result: SearchResult): string {
  if (result.kind === 'restaurant') return result.restaurant.image;
  if (result.kind === 'dish') return result.item.image;
  return result.category.image;
}

function resultName(result: SearchResult): string {
  if (result.kind === 'restaurant') return result.restaurant.name;
  if (result.kind === 'dish') return result.item.name;
  return result.category.name;
}

function resultMeta(result: SearchResult): string {
  if (result.kind === 'restaurant') {
    return `${result.restaurant.cuisine} · ${result.restaurant.rating}★ · ${result.restaurant.time}`;
  }
  if (result.kind === 'dish') {
    return `₹${result.item.price.toLocaleString('en-IN')} · ${result.restaurant.name} · ${result.item.desc}`;
  }
  return `${result.count} restaurant${result.count === 1 ? '' : 's'} · Explore cuisine`;
}

export function SearchOverlay() {
  const isOpen = useSearchStore((state) => state.isOpen);
  const context = useSearchStore((state) => state.context);
  const prefill = useSearchStore((state) => state.prefill);
  const instantClose = useSearchStore((state) => state.instantClose);
  const nonce = useSearchStore((state) => state.nonce);
  const closeSearch = useSearchStore((state) => state.closeSearch);
  const nav = useAppNav();
  const selectRestaurant = useAppStore((state) => state.selectRestaurant);

  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<SearchPhase>('idle');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [resultQuery, setResultQuery] = useState('');
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [closing, setClosing] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const searchRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const sequenceRef = useRef(0);
  const wasOpenRef = useRef(false);
  const viewportBoundRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    if (searchRef.current !== null) window.clearTimeout(searchRef.current);
    debounceRef.current = null;
    searchRef.current = null;
  }, []);

  const syncViewport = useCallback(() => {
    const vv = window.visualViewport;
    if (!rootRef.current || !vv) return;
    rootRef.current.style.setProperty('--ew-search-vh', `${Math.max(240, Math.round(vv.height) - 14)}px`);
  }, []);

  const bindViewport = useCallback(() => {
    if (viewportBoundRef.current || !window.visualViewport) return;
    viewportBoundRef.current = true;
    window.visualViewport.addEventListener('resize', syncViewport);
  }, [syncViewport]);

  const unbindViewport = useCallback(() => {
    if (viewportBoundRef.current) {
      window.visualViewport?.removeEventListener('resize', syncViewport);
      viewportBoundRef.current = false;
    }
    rootRef.current?.style.removeProperty('--ew-search-vh');
  }, [syncViewport]);

  const rememberSearch = useCallback((value: string) => {
    const next = [value, ...readRecent().filter((entry) => entry.toLowerCase() !== value.toLowerCase())].slice(
      0,
      RECENT_LIMIT,
    );
    writeRecent(next);
    setRecent(next);
  }, []);

  const runSearch = useCallback(
    (raw: string) => {
      const value = raw.trim();
      if (value.length < MIN_QUERY) {
        sequenceRef.current += 1;
        setPhase('idle');
        setResults([]);
        return;
      }

      const sequence = ++sequenceRef.current;
      setPhase('searching');
      if (searchRef.current !== null) window.clearTimeout(searchRef.current);
      searchRef.current = window.setTimeout(() => {
        if (sequence !== sequenceRef.current) return;
        const found = searchDemo(value, context);
        setResults(found);
        setResultQuery(value);
        setPhase(found.length ? 'results' : 'empty');
        rememberSearch(value);
      }, FAKE_SEARCH_MS);
    },
    [context, rememberSearch],
  );

  const scheduleSearch = useCallback(
    (immediate = false) => {
      const value = inputRef.current?.value ?? '';
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      if (value.trim().length < MIN_QUERY) {
        sequenceRef.current += 1;
        setPhase('idle');
        setResults([]);
        return;
      }
      if (immediate) {
        runSearch(value);
        return;
      }
      debounceRef.current = window.setTimeout(() => runSearch(value), DEBOUNCE_MS);
    },
    [runSearch],
  );

  useEffect(() => {
    if (!isOpen) return;
    wasOpenRef.current = true;
    setClosing(false);
    setQuery(prefill);
    setResults([]);
    setResultQuery('');
    setPhase('idle');
    if (inputRef.current) inputRef.current.value = prefill;
    document.body.classList.add('ew-search-open');
    const unlock = lockPageScroll();
    syncViewport();
    bindViewport();
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      if (prefill.trim().length >= MIN_QUERY) scheduleSearch(true);
    });
    return () => {
      unlock();
      window.cancelAnimationFrame(frame);
    };
  }, [bindViewport, isOpen, nonce, prefill, scheduleSearch, syncViewport]);

  useEffect(() => {
    if (isOpen || !wasOpenRef.current) return;
    wasOpenRef.current = false;
    clearTimers();
    setClosing(false);
    document.body.classList.remove('ew-search-open');
    unbindViewport();
    inputRef.current?.blur();
    if (instantClose) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setClosing(false);
      closeTimerRef.current = null;
    }, CLOSE_MS);
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, [clearTimers, instantClose, isOpen, unbindViewport]);

  useEffect(() => {
    if (!isOpen) return;
    return registerSheet(() => closeSearch());
  }, [closeSearch, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeSearch();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeSearch, isOpen]);

  useEffect(
    () => () => {
      clearTimers();
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      document.body.classList.remove('ew-search-open');
      unbindViewport();
    },
    [clearTimers, unbindViewport],
  );

  const clearInput = () => {
    clearTimers();
    sequenceRef.current += 1;
    if (inputRef.current) inputRef.current.value = '';
    setQuery('');
    setResults([]);
    setPhase('idle');
    inputRef.current?.focus({ preventScroll: true });
  };

  const applyRecent = (value: string) => {
    if (inputRef.current) inputRef.current.value = value;
    setQuery(value);
    scheduleSearch(true);
  };

  const clearRecent = () => {
    writeRecent([]);
    setRecent([]);
  };

  const openResult = (result: SearchResult) => {
    if (result.kind === 'cuisine') {
      applyRecent(result.category.query);
      return;
    }
    selectRestaurant(result.restaurant.id);
    closeSearch(true);
    const focus = result.kind === 'dish' ? `?focusItem=${encodeURIComponent(result.item.id)}` : '';
    nav.push(`/restaurant/${result.restaurant.id}${focus}`);
  };

  const rootClass = `ew-search-root${isOpen ? ' is-open' : ''}${closing ? ' is-closing' : ''}`;

  return createPortal(
    <div id="ew-search-root" ref={rootRef} className={rootClass} aria-hidden={!isOpen}>
      <div className="ew-search-scrim" onClick={() => closeSearch()} />
      <section className="ew-search-sheet" role="dialog" aria-modal="true" aria-label="Search">
        <div className="ew-search-handle" aria-hidden="true" />
        <div className="ew-search-head">
          <button className="ew-search-back" type="button" onClick={() => closeSearch()} aria-label="Close search">
            <SearchIcon name="back" size={24} />
          </button>
          <div className="ew-search-input-wrap">
            <span className="ew-search-icon">
              <SearchIcon name="search" size={20} />
            </span>
            <input
              className="ew-search-input"
              id="ew-search-input"
              ref={inputRef}
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Try 'Sweets'"
              enterKeyHint="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                scheduleSearch(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  scheduleSearch(true);
                }
              }}
            />
            <button
              className="ew-search-clear"
              type="button"
              hidden={!query.trim()}
              onClick={clearInput}
              aria-label="Clear search"
            >
              <SearchIcon name="x" size={20} />
            </button>
            <span className="ew-search-divider" aria-hidden="true" />
            <button
              className="ew-search-mic"
              type="button"
              aria-label="Voice search"
              onClick={() => inputRef.current?.focus({ preventScroll: true })}
            >
              <SearchIcon name="mic" size={22} />
            </button>
          </div>
        </div>
        <div className="ew-search-context" id="ew-search-context" />
        <div className="ew-search-body" id="ew-search-body" aria-live="polite">
          {phase === 'idle' && recent.length > 0 && (
            <>
              <div className="ew-search-recent-head">
                <span>Recent searches</span>
                <button className="ew-search-recent-clear" type="button" onClick={clearRecent}>
                  Clear
                </button>
              </div>
              <div className="ew-search-list">
                {recent.map((value) => (
                  <button className="ew-search-result" type="button" key={value} onClick={() => applyRecent(value)}>
                    <span className="ew-search-thumb ew-search-thumb-icon" aria-hidden="true">
                      <SearchIcon name="search" size={20} />
                    </span>
                    <span className="ew-search-copy">
                      <span className="ew-search-name">{value}</span>
                      <span className="ew-search-meta">Recent search</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {phase === 'searching' && (
            <div className="ew-search-list">
              {Array.from({ length: 5 }, (_, index) => (
                <div className="ew-search-skeleton" key={index} aria-hidden="true" />
              ))}
            </div>
          )}

          {phase === 'empty' && (
            <div className="ew-search-state">
              <p className="ew-search-state-title">No dishes found for “{resultQuery}”</p>
              <p className="ew-search-state-sub">Try another dish or a different spelling.</p>
            </div>
          )}

          {phase === 'results' && (
            <div className="ew-search-list">
              {results.map((result) => (
                <button
                  className="ew-search-result"
                  type="button"
                  key={`${result.kind}-${result.kind === 'cuisine' ? result.category.id : result.kind === 'restaurant' ? result.restaurant.id : `${result.restaurant.id}-${result.item.id}`}`}
                  onClick={() => openResult(result)}
                >
                  <img className="ew-search-thumb" src={resultImage(result)} alt="" loading="lazy" decoding="async" />
                  <span className="ew-search-copy">
                    <span className="ew-search-name">{resultName(result)}</span>
                    <span className="ew-search-meta">{resultMeta(result)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
