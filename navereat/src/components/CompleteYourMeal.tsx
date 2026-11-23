import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MenuItem, Restaurant } from '../data/demo';
import type { Cart } from '../lib/cart';
import { isCustomisable } from '../lib/customization';

interface CompleteYourMealProps {
  restaurant: Restaurant | null;
  cart: Cart;
  onSeeAll: () => void;
  onAdd: (item: MenuItem) => void;
  onCustomize: (item: MenuItem) => void;
}

interface MealTab {
  key: string;
  label: string;
  items: MenuItem[];
}

const PAIRING: Array<[RegExp, number]> = [
  [/(beverage|drink|juice|shake|lassi|\btea\b|chai|coffee|soda|mocktail|cooler|thanda)/i, 3],
  [/(dessert|sweet|mithai|ice ?cream|kulfi|cake|brownie|pastry|payesh|halwa)/i, 3],
  [/(side|extra|add[- ]?on|raita|salad|bread|roti|naan|kulcha|papad|fries|dip|sauce|chutney)/i, 2],
  [/(starter|snack|appeti[sz]er|momo|roll|soup|chaat)/i, 1],
];

function pairWeight(category: string): number {
  for (const [pattern, weight] of PAIRING) if (pattern.test(category)) return weight;
  return 0;
}

function mealTabsFor(items: MenuItem[]): MealTab[] {
  if (!items.length) return [];
  const popular = items.filter((item) => item.bestseller);
  const categories = new Map<string, MenuItem[]>();
  items.forEach((item) => {
    const label = item.category?.trim() || 'Recommended';
    const group = categories.get(label) ?? [];
    group.push(item);
    categories.set(label, group);
  });
  const tabs: MealTab[] = [];
  if (popular.length) tabs.push({ key: 'popular', label: 'Popular', items: popular.slice(0, 12) });
  [...categories.entries()]
    .sort(([a], [b]) => pairWeight(b) - pairWeight(a) || a.localeCompare(b))
    .forEach(([label, group]) => {
      if (label === 'Recommended' && tabs.some((tab) => tab.label === 'Recommended')) return;
      tabs.push({ key: `cat:${label.toLowerCase()}`, label, items: group.slice(0, 12) });
    });
  return tabs.slice(0, 8);
}

const plate = (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const plus = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 5.5v13M5.5 12h13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

function VegMark({ value }: { value?: boolean }) {
  if (value === undefined) return null;
  return (
    <span className={`nb-veg-mark ${value ? 'veg' : 'nonveg'}`} title={value ? 'Veg' : 'Non-veg'}>
      <span />
    </span>
  );
}

export function CompleteYourMeal({ restaurant, cart, onSeeAll, onAdd, onCustomize }: CompleteYourMealProps) {
  const [activeKey, setActiveKey] = useState('');
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false });

  const items = useMemo(() => {
    if (!restaurant) return [];
    const ids = new Set(Object.values(cart).map((line) => line.menuItem).filter(Boolean));
    const names = new Set(Object.keys(cart).map((name) => name.toLowerCase()));
    const list = restaurant.menu.filter(
      (item) =>
        item.price > 0 &&
        !ids.has(item.id) &&
        !names.has(item.name.toLowerCase()) &&
        !Object.keys(cart).some((name) => name.toLowerCase().startsWith(`${item.name.toLowerCase()} (`)),
    );
    const entries = Object.values(cart);
    const avg = entries.length ? entries.reduce((sum, line) => sum + Number(line.price || 0), 0) / entries.length : 0;
    const cartVeg = entries.some((line) => line.isVeg === true) && !entries.some((line) => line.isVeg === false);
    const score = (item: MenuItem): number => {
      let value = pairWeight(item.category || 'Recommended') + (item.bestseller ? 3 : 0);
      if (item.originalPrice) value += 1;
      if (cartVeg && item.isVeg) value += 1.5;
      if (avg > 0) value += Math.max(0, 1 - Math.abs(item.price - avg) / Math.max(avg, 1));
      return value;
    };
    return list.sort((a, b) => score(b) - score(a) || a.price - b.price);
  }, [cart, restaurant]);

  const tabs = useMemo(() => mealTabsFor(items), [items]);
  const active = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];

  useLayoutEffect(() => {
    if (!active) return;
    if (!tabs.some((tab) => tab.key === activeKey)) setActiveKey(active.key);
    const tabsEl = tabsRef.current;
    const button = tabsEl?.querySelector<HTMLElement>(`[data-cym-tab="${CSS.escape(active.key)}"]`);
    if (!tabsEl || !button) return;
    setIndicator({ left: button.offsetLeft, width: button.offsetWidth, visible: true });
    tabsEl.classList.add('is-ready');
  }, [active, activeKey, tabs]);

  if (!restaurant || !active || !items.length) return null;

  return (
    <section aria-labelledby="ct-cym-title" className="ct-card ct-cym" id="ct-meal">
      <div className="ct-cym-head">
        <div className="ct-cym-headcopy">
          <h2 className="ct-cym-title" id="ct-cym-title">
            Complete your meal
          </h2>
          <p className="ct-cym-from" hidden>
            From {restaurant.name}
          </p>
        </div>
        <button className="ct-cym-all tap" id="ct-addmore" type="button" onClick={onSeeAll}>
          See all
          <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14">
            <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </button>
      </div>
      <div
        aria-label="Suggestion categories"
        className="ct-cym-tabs"
        id="ct-cym-tabs"
        ref={tabsRef}
        role="tablist"
      >
        {indicator.visible && (
          <span
            aria-hidden="true"
            className="ct-cym-ind"
            style={{ left: indicator.left, width: indicator.width, opacity: 1 }}
          />
        )}
        {tabs.map((tab, index) => (
          <button
            aria-controls="ct-meal-row"
            aria-selected={tab.key === active.key}
            className={`ct-cym-tab${tab.key === active.key ? ' is-active' : ''}`}
            data-cym-tab={tab.key}
            id={`ct-cym-tab-${index}`}
            key={tab.key}
            role="tab"
            tabIndex={tab.key === active.key ? 0 : -1}
            type="button"
            onClick={() => setActiveKey(tab.key)}
          >
            <span className="ct-cym-tab-l">{tab.label}</span>
          </button>
        ))}
      </div>
      <div aria-labelledby={`ct-cym-tab-${tabs.indexOf(active)}`} className="ct-cym-track" id="ct-meal-row" role="tabpanel">
        {active.items.map((item) => {
          const customisable = isCustomisable(item);
          const off =
            item.originalPrice && item.originalPrice > item.price
              ? Math.round((1 - item.price / item.originalPrice) * 100)
              : 0;
          return (
            <article className="ct-cym-card" data-cym-card={item.id} key={item.id}>
              <div className="ct-cym-media">
                <span className="ct-cym-fallback" aria-hidden="true">
                  {plate}
                </span>
                <img alt="" decoding="async" loading="lazy" src={item.image} />
                {item.bestseller && <span className="ct-cym-badge">Bestseller</span>}
                <button
                  aria-label={`${customisable ? 'Customise' : 'Add'} ${item.name}`}
                  className="ct-cym-add"
                  type="button"
                  onClick={() => (customisable ? onCustomize(item) : onAdd(item))}
                >
                  {plus}
                </button>
              </div>
              <div className="ct-cym-name">
                <VegMark value={item.isVeg} />
                <span>{item.name}</span>
              </div>
              <div className="ct-cym-price">
                <span className="ct-cym-now">₹{item.price}</span>
                {item.originalPrice && item.originalPrice > item.price && <s>₹{item.originalPrice}</s>}
                {off >= 1 && <span className="ct-cym-off">{off}% OFF</span>}
              </div>
              {customisable && (
                <div className="ct-cym-meta">
                  <span className="ct-cym-note">Customisable</span>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
