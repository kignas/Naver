import { memo } from 'react';
import { Icon } from '../Icon';
import { RestaurantMenuItem } from '../RestaurantMenuItem';
import { useAppStore } from '../../store/appStore';
import { useCustomize } from '../../lib/customizeContext';
import { useMenuFilters } from './menuFiltersContext';
import { categoryId } from './menuTypes';

interface MenuSectionProps {
  ready: boolean;
  preparing: boolean;
  restaurantId: number;
  ratingKnown: boolean;
  rating: number;
  itemRating: string;
}

export const MenuSection = memo(function MenuSection({
  ready,
  preparing,
  restaurantId,
  ratingKnown,
  rating,
  itemRating,
}: MenuSectionProps) {
  const { visibleGroups, collapsed, toggleCategory, resetFilters, filters, query } = useMenuFilters();
  const addItem = useAppStore((s) => s.addItem);
  const decrementItem = useAppStore((s) => s.decrementItem);
  const removeCustomizedUnit = useAppStore((s) => s.removeCustomizedUnit);
  const { openCustomize } = useCustomize();
  // Never swap to the empty state while a transition is in flight: the page is
  // still on screen and a momentary miss (a store read keyed by the incoming
  // route) would collapse the menu, and the menu footer with it.
  const empty = ready && !preparing && visibleGroups.length === 0;

  return (
    <div className="menu-section">
      {!ready && (
        <div id="menu-skeleton">
          <div className="skeleton" style={{ height: 20, width: 130, marginBottom: 16 }} />
          {[0, 1].map((row) => (
            <div className="skel-item" key={row}>
              <div className="skel-left">
                <div className="skeleton" style={{ height: 14, width: 56, borderRadius: 6 }} />
                <div className="skeleton" style={{ height: 16, width: row === 0 ? '62%' : '48%' }} />
                <div className="skeleton" style={{ height: 15, width: 52 }} />
                <div className="skeleton" style={{ height: 12, width: row === 0 ? '92%' : '78%' }} />
              </div>
              <div className="skel-media">
                <div className="skeleton skel-img" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div id="menu-container" style={{ display: ready ? 'block' : 'none' }}>
        {visibleGroups.map((group, groupIndex) => {
          const groupCollapsed = collapsed.has(group.name);
          return (
            <div className="menu-cat-group" id={categoryId(group.name, groupIndex)} key={group.name}>
              <div
                className={`menu-cat-header${groupCollapsed ? ' collapsed' : ''}`}
                onClick={() => toggleCategory(group.name)}
              >
                <span className="menu-cat-title">
                  {group.name} <span className="menu-cat-count">({group.items.length})</span>
                </span>
                <Icon name="solid:chevron-down" size={14} className="menu-cat-chevron" />
              </div>
              <div className={`menu-cat-items${groupCollapsed ? ' collapsed' : ''}`}>
                {group.items.map((menuItem, itemIndex) => (
                  <RestaurantMenuItem
                    key={menuItem.id}
                    menuItem={menuItem}
                    resId={restaurantId}
                    ratingKnown={ratingKnown}
                    rating={rating}
                    itemRating={itemRating}
                    animationDelay={`${(groupIndex * 10 + itemIndex) * 0.04}s`}
                    onAdd={addItem}
                    onDecrement={decrementItem}
                    onRemoveCustom={removeCustomizedUnit}
                    onCustomize={openCustomize}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="empty-filter-msg" id="empty-filter-msg" style={{ display: empty ? 'block' : 'none' }}>
        <Icon name="solid:sliders" size={32} className="empty-filter-icon" />
        <p id="empty-filter-title">No dishes match these filters</p>
        <p id="empty-filter-sub">Try changing your filters.</p>
        <button
          type="button"
          className="empty-filter-clear"
          id="empty-filter-clear"
          onClick={resetFilters}
          hidden={filters.size === 0 && !query}
        >
          Clear filters
        </button>
      </div>
    </div>
  );
});
