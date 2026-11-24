import { memo, type CSSProperties } from 'react';
import { useUiStore } from '../../store/uiStore';
import { Icon } from '../Icon';

const NEAR_FAST_ICON_STYLE: CSSProperties = { color: 'var(--ew-success,#23956D)' };

interface HomeFilterBarProps {
  filtersOpen: boolean;
  onOpenFilters: () => void;
}

/**
 * Subscribes to the four pill flags only. A pill tap no longer re-renders the
 * header, the hero or the category strip.
 */
export const HomeFilterBar = memo(function HomeFilterBar({ filtersOpen, onOpenFilters }: HomeFilterBarProps) {
  const nearFast = useUiStore((state) => state.home.nearFast);
  const rating4 = useUiStore((state) => state.home.rating4);
  const under100 = useUiStore((state) => state.home.under100);
  const under30 = useUiStore((state) => state.home.under30);
  const toggleHomeFlag = useUiStore((state) => state.toggleHomeFlag);

  return (
    <div className="filter-bar" id="filter-bar" role="group" aria-label="Restaurant filters">
      <button
        type="button"
        className={`filter-pill filter-pill-sheet${filtersOpen ? ' active' : ''}`}
        onClick={onOpenFilters}
      >
        <Icon name="solid:sliders" size={11} /> Filters
      </button>
      <button
        type="button"
        className={`filter-pill${nearFast ? ' active' : ''}`}
        aria-pressed={nearFast}
        onClick={() => toggleHomeFlag('nearFast')}
      >
        <Icon name="solid:bolt-lightning" size={11} style={NEAR_FAST_ICON_STYLE} /> Near &amp; Fast
      </button>
      <button
        type="button"
        className={`filter-pill${rating4 ? ' active' : ''}`}
        aria-pressed={rating4}
        onClick={() => toggleHomeFlag('rating4')}
      >
        Rating 4.0+
      </button>
      <button
        type="button"
        className={`filter-pill${under100 ? ' active' : ''}`}
        aria-pressed={under100}
        onClick={() => toggleHomeFlag('under100')}
      >
        Items under ₹100
      </button>
      <button
        type="button"
        className={`filter-pill${under30 ? ' active' : ''}`}
        aria-pressed={under30}
        onClick={() => toggleHomeFlag('under30')}
      >
        Under 30 min
      </button>
    </div>
  );
});
