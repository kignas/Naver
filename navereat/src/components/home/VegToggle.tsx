import { memo } from 'react';
import { useUiStore } from '../../store/uiStore';

/**
 * Subscribes to `vegOnly` alone: the tap re-renders this button, the filter
 * pills and the feed, not the header, hero or category strip.
 */
export const VegToggle = memo(function VegToggle() {
  const vegOnly = useUiStore((state) => state.home.vegOnly);
  const toggleHomeFlag = useUiStore((state) => state.toggleHomeFlag);
  return (
    <button
      type="button"
      className="veg-box tap"
      id="veg-toggle-btn"
      aria-pressed={vegOnly}
      aria-label="Show pure veg restaurants only"
      onClick={() => toggleHomeFlag('vegOnly')}
    >
      <span className="veg-label-txt">VEG</span>
      <span className={`veg-track${vegOnly ? ' on' : ''}`} id="veg-track">
        <span className="veg-thumb">
          <span className="veg-inner">
            <span className="veg-inner-dot" />
          </span>
        </span>
      </span>
    </button>
  );
});
