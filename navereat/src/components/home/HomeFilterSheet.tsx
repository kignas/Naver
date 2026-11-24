import { memo, useCallback, useRef } from 'react';
import type { IconName } from '../icons';
import { useUiStore } from '../../store/uiStore';
import { Icon } from '../Icon';
import { Sheet, type SheetHandle } from '../Sheet';

type FilterTab = 'SORT' | 'DELIVERY TIME' | 'RATING' | 'PRICE' | 'OFFERS' | 'FOOD TYPE';

const FILTER_TABS: Array<{ id: FilterTab; label: string; icon: IconName }> = [
  { id: 'SORT', label: 'Sort By', icon: 'solid:sliders' },
  { id: 'RATING', label: 'Rating', icon: 'solid:star' },
  { id: 'PRICE', label: 'Price', icon: 'solid:indian-rupee-sign' },
  { id: 'DELIVERY TIME', label: 'Time', icon: 'regular:clock' },
  { id: 'OFFERS', label: 'Offers', icon: 'solid:tag' },
  { id: 'FOOD TYPE', label: 'Food Type', icon: 'solid:leaf' },
];

const SORT_OPTIONS = [
  { id: 'recommended' as const, label: 'Relevance' },
  { id: 'rating' as const, label: 'Rating: High to Low' },
  { id: 'delivery' as const, label: 'Delivery Time: Fast to Slow' },
  { id: 'distance' as const, label: 'Distance: Near to Far' },
];

/**
 * The filter sheet subscribes to the flags itself, so tapping an option inside
 * it updates the feed without re-rendering Home.
 */
export const HomeFilterSheet = memo(function HomeFilterSheet({ onClose }: { onClose: () => void }) {
  const sheetRef = useRef<SheetHandle>(null);
  const closeSheet = useCallback(() => sheetRef.current?.close(), []);

  const activeFilterTab = useUiStore((state) => state.home.activeFilterTab);
  const sortBy = useUiStore((state) => state.home.sortBy);
  const vegOnly = useUiStore((state) => state.home.vegOnly);
  const nearFast = useUiStore((state) => state.home.nearFast);
  const rating4 = useUiStore((state) => state.home.rating4);
  const under30 = useUiStore((state) => state.home.under30);
  const under100 = useUiStore((state) => state.home.under100);
  const setActiveFilterTab = useUiStore((state) => state.setActiveFilterTab);
  const setHomeSort = useUiStore((state) => state.setHomeSort);
  const toggleHomeFlag = useUiStore((state) => state.toggleHomeFlag);
  const resetHomeFilters = useUiStore((state) => state.resetHomeFilters);

  return (
    <Sheet
      ref={sheetRef}
      variant="filter"
      title="Filters & sorting"
      onClose={onClose}
      ariaLabel="Filters and sorting"
      headerAction={
        <button type="button" className="sheet-clear" onClick={resetHomeFilters}>
          Clear all
        </button>
      }
      tabs={FILTER_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`filter-tab${activeFilterTab === tab.id ? ' active' : ''}`}
          onClick={() => setActiveFilterTab(tab.id)}
        >
          <i className="filter-tab-icon" aria-hidden="true">
            <Icon name={tab.icon} size={18} />
          </i>
          <span>{tab.label}</span>
        </button>
      ))}
      footer={
        <>
          <button type="button" className="sheet-close-btn" onClick={closeSheet}>
            Close
          </button>
          <button type="button" className="sheet-done" onClick={closeSheet}>
            Show results
          </button>
        </>
      }
    >
      {activeFilterTab === 'SORT' ? (
        <section className="filter-section">
          <h4 className="filter-section-title">Sort by</h4>
          <div className="sort-list">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`sort-option${sortBy === option.id ? ' selected' : ''}`}
                onClick={() => setHomeSort(option.id)}
              >
                <span>{option.label}</span>
                <i className="check-icon" aria-hidden="true">
                  <Icon name="solid:check" size={12} />
                </i>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="filter-section">
          <h4 className="filter-section-title">
            {activeFilterTab === 'DELIVERY TIME'
              ? 'Time'
              : activeFilterTab === 'FOOD TYPE'
                ? 'Food type'
                : activeFilterTab.charAt(0) + activeFilterTab.slice(1).toLowerCase()}
          </h4>
          <div className="filter-grid">
            {activeFilterTab === 'DELIVERY TIME' && (
              <>
                <button
                  type="button"
                  className={`sheet-option${nearFast ? ' selected' : ''}`}
                  onClick={() => toggleHomeFlag('nearFast')}
                >
                  <i className="option-icon" aria-hidden="true">
                    <Icon name="solid:bolt-lightning" size={17} />
                  </i>
                  <span>Near &amp; Fast</span>
                  <i className="check-icon" aria-hidden="true">
                    <Icon name="solid:check" size={11} />
                  </i>
                </button>
                <button
                  type="button"
                  className={`sheet-option${under30 ? ' selected' : ''}`}
                  onClick={() => toggleHomeFlag('under30')}
                >
                  <i className="option-icon" aria-hidden="true">
                    <Icon name="regular:clock" size={17} />
                  </i>
                  <span>Under 30 min</span>
                  <i className="check-icon" aria-hidden="true">
                    <Icon name="solid:check" size={11} />
                  </i>
                </button>
              </>
            )}
            {activeFilterTab === 'RATING' && (
              <button
                type="button"
                className={`sheet-option${rating4 ? ' selected' : ''}`}
                onClick={() => toggleHomeFlag('rating4')}
              >
                <i className="option-icon" aria-hidden="true">
                  <Icon name="solid:star" size={17} />
                </i>
                <span>Rating 4.0+</span>
                <i className="check-icon" aria-hidden="true">
                  <Icon name="solid:check" size={11} />
                </i>
              </button>
            )}
            {activeFilterTab === 'PRICE' && (
              <button
                type="button"
                className={`sheet-option${under100 ? ' selected' : ''}`}
                onClick={() => toggleHomeFlag('under100')}
              >
                <i className="option-icon" aria-hidden="true">
                  <Icon name="solid:indian-rupee-sign" size={17} />
                </i>
                <span>Items under ₹100</span>
                <i className="check-icon" aria-hidden="true">
                  <Icon name="solid:check" size={11} />
                </i>
              </button>
            )}
            {activeFilterTab === 'OFFERS' && (
              <button type="button" className="sheet-option">
                <i className="option-icon" aria-hidden="true">
                  <Icon name="solid:tag" size={17} />
                </i>
                <span>Offers</span>
                <i className="check-icon" aria-hidden="true">
                  <Icon name="solid:check" size={11} />
                </i>
              </button>
            )}
            {activeFilterTab === 'FOOD TYPE' && (
              <button
                type="button"
                className={`sheet-option${vegOnly ? ' selected' : ''}`}
                onClick={() => toggleHomeFlag('vegOnly')}
              >
                <i className="option-icon" aria-hidden="true">
                  <Icon name="solid:leaf" size={17} />
                </i>
                <span>Pure Veg</span>
                <i className="check-icon" aria-hidden="true">
                  <Icon name="solid:check" size={11} />
                </i>
              </button>
            )}
          </div>
        </section>
      )}
    </Sheet>
  );
});
