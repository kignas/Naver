import { useEffect, useRef } from 'react';
import { Icon } from '../Icon';
import { useMenuFilters } from './menuFiltersContext';

/**
 * Kept mounted only while the search row is open. Focusing here (instead of in
 * the page) keeps the keystroke state out of the page: typing re-renders this
 * row and the dish list, nothing else.
 */
export function MenuSearchRow({ preparing, onClose }: { preparing: boolean; onClose: () => void }) {
  const { query, setQuery } = useMenuFilters();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (preparing) return;
    inputRef.current?.focus();
  }, [preparing]);

  return (
    <div className="menu-search-inline" id="menu-search-row">
      <label className="menu-search-inline-field" htmlFor="menu-search-input">
        <Icon name="solid:magnifying-glass" size={16} />
        <input
          id="menu-search-input"
          ref={inputRef}
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Search dishes in this menu"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <button
            type="button"
            id="menu-search-clear"
            className="menu-search-clear"
            aria-label="Clear search"
            onClick={() => setQuery('')}
          >
            <Icon name="solid:xmark" size={14} />
          </button>
        )}
      </label>
      <button type="button" className="menu-search-cancel" onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}
