import { useMenuFilters } from './menuFiltersContext';
import { FILTER_CHIPS } from './menuTypes';

export function MenuFilterBar() {
  const { filters, toggleFilter } = useMenuFilters();

  return (
    <div className="filter-bar ew-menu-quick-filters" id="restaurant-filter-bar" aria-label="Quick menu filters">
      <div className="ew-filter-chip-row" id="quick-filter-row">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`ew-filter-chip${chip.className ? ` ${chip.className}` : ''}${
              filters.has(chip.id) ? ' active' : ''
            }`}
            id={`filter-${chip.id}`}
            aria-pressed={filters.has(chip.id)}
            onClick={() => toggleFilter(chip.id)}
          >
            {(chip.id === 'veg' || chip.id === 'nonveg') && <span className="veg-dot-icon" aria-hidden="true" />}
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
