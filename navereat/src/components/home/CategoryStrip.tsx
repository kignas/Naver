import { memo, useCallback, useState, type CSSProperties } from 'react';
import { categories } from '../../data/demo';
import { useAppNav } from '../../lib/navigation';
import { useUiStore } from '../../store/uiStore';
import { Icon } from '../Icon';

/** Allocated once: the stagger never changes, so it must not be rebuilt per render. */
const CATEGORY_STYLES: CSSProperties[] = categories.map((_, index) => ({
  animation: `cardFadeUp .28s ease forwards ${Math.min(index, 8) * 0.03}s`,
  opacity: 0,
}));

const PLACEHOLDER_MARK = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 9.5h10M8.5 13h7M9.5 16.5h5M5.5 6.5h13a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17V8a1.5 1.5 0 0 1 1.5-1.5Z" />
  </svg>
);

export const CategoryStrip = memo(function CategoryStrip() {
  const nav = useAppNav();
  // The stagger belongs to the cold start only. Read at mount, not subscribed:
  // a subscription would re-render ten tiles (and cut whatever animation is
  // still running) the moment the flag flips, and a revisit would replay the
  // entrance. On every later mount the strip renders settled, exactly like the
  // first one looks once the animation has finished.
  const [playEntrance] = useState(() => !useUiStore.getState().homeHasEntered);
  const openCategory = useCallback(
    (name: string, query: string) => {
      nav.push(`/category/${encodeURIComponent(name)}?q=${encodeURIComponent(query)}`);
    },
    [nav],
  );
  return (
    <section className="section" id="mind-section">
      <div className="sec-head">
        <h2 className="sec-title">What&apos;s on your mind?</h2>
      </div>
      <div className="cat-scroll no-scrollbar" id="cat-scroll">
        {categories.map((category, index) => (
          <a
            className="cat-item"
            href={`#${encodeURIComponent(category.name)}`}
            data-category-name={category.name}
            key={category.id}
            style={playEntrance ? CATEGORY_STYLES[index] : undefined}
            onClick={(event) => {
              event.preventDefault();
              openCategory(category.name, category.query);
            }}
          >
            <span className="cat-ring cat-image-shell">
              <span className="cat-image-placeholder" aria-hidden="true">
                <span className="cat-placeholder-mark">{PLACEHOLDER_MARK}</span>
              </span>
              <img
                src={category.image}
                alt={`${category.name} food delivery in Demo City`}
                loading="lazy"
                decoding="async"
                className="loaded"
              />
              <span className="cat-selected-badge" aria-hidden="true">
                <Icon name="solid:check" size={10} />
              </span>
            </span>
            <span className="cat-name">{category.name}</span>
          </a>
        ))}
      </div>
    </section>
  );
});
