import { memo, useEffect, useRef, useState, type RefObject } from 'react';
import { useUiStore } from '../../store/uiStore';
import { useMenuFilters } from './menuFiltersContext';
import { categoryId } from './menuTypes';

interface MenuCatNavProps {
  scrollRef: RefObject<HTMLDivElement>;
  routeId: number;
  initialActive: number;
}

/**
 * Category pills plus the scroll spy that drives their active state. Both read
 * the filtered groups from the menu context, so a filter tap updates the pills
 * without touching the page or the dish rows.
 */
export const MenuCatNav = memo(function MenuCatNav({ scrollRef, routeId, initialActive }: MenuCatNavProps) {
  const { visibleGroups } = useMenuFilters();
  const patchRestaurant = useUiStore((state) => state.patchRestaurant);
  const [activeCategory, setActiveCategory] = useState(initialActive);
  const activeRef = useRef(activeCategory);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return undefined;
    const onScroll = () => {
      if (!visibleGroups.length) return;
      const threshold = scroller.scrollTop + 145;
      let next = 0;
      visibleGroups.forEach((group, index) => {
        const target = document.getElementById(categoryId(group.name, index));
        if (!target) return;
        const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
        if (top <= threshold) next = index;
      });
      if (next === activeRef.current) return;
      activeRef.current = next;
      setActiveCategory(next);
      if (Number.isFinite(routeId)) patchRestaurant(routeId, { activeCategory: next });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [patchRestaurant, routeId, scrollRef, visibleGroups]);

  const scrollToCategory = (index: number) => {
    const group = visibleGroups[index];
    const scroller = scrollRef.current;
    if (!group || !scroller) return;
    const target = document.getElementById(categoryId(group.name, index));
    if (!target) return;
    const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 118;
    scroller.scrollTo({ top, behavior: 'smooth' });
    activeRef.current = index;
    setActiveCategory(index);
  };

  return (
    <>
      <div className="cat-nav-sentinel" id="cat-nav-sentinel" />
      <div className="cat-nav" id="cat-nav" aria-hidden="true">
        <div className="cat-nav-inner" id="cat-nav-inner">
          {visibleGroups.map((group, index) => (
            <div
              key={group.name}
              className={`cat-nav-pill${activeCategory === index ? ' active' : ''}`}
              data-target={categoryId(group.name, index)}
              onClick={() => scrollToCategory(index)}
            >
              {group.name}
            </div>
          ))}
        </div>
      </div>
    </>
  );
});
