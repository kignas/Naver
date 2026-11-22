import { useMemo, useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import { Icon } from '../components/Icon';
import { categories, restaurants, type Category } from '../data/demo';
import { useAppNav } from '../lib/navigation';
import '../styles/pages/search.css';

const QUICK_NAMES = ['Biryani', 'Pizzas', 'Burgers', 'Momos', 'Noodles', 'Sweets'];

export function Search() {
  const nav = useAppNav();
  const [query, setQuery] = useState('');

  const quickCategories = useMemo(
    () => QUICK_NAMES.map((name) => categories.find((c) => c.name === name)).filter((c): c is Category => Boolean(c)),
    [],
  );

  const q = query.trim().toLowerCase();

  const matched = useMemo(() => {
    if (!q) return [];
    return restaurants
      .filter(
        (restaurant) =>
          restaurant.name.toLowerCase().includes(q) ||
          restaurant.cuisine.toLowerCase().includes(q) ||
          restaurant.menu.some((item) => item.name.toLowerCase().includes(q)),
      )
      .map((restaurant) => ({
        restaurant,
        dishes: restaurant.menu
          .filter((item) => item.name.toLowerCase().includes(q))
          .slice(0, 3)
          .map((item) => item.name)
          .join(', '),
      }));
  }, [q]);

  return (
    <div className="page search-page">
      <header className="search-header">
          <div className="search-bar">
            <button type="button" className="search-back tap" onClick={() => nav.tab('/')} aria-label="Back">
              <Icon name="solid:chevron-left" size={16} />
            </button>
            <input
              className="search-input"
              type="text"
              placeholder="Search restaurants or dishes..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              aria-label="Search restaurants or dishes"
            />
            {query.length > 0 && (
              <button type="button" className="search-clear tap" onClick={() => setQuery('')} aria-label="Clear search">
                <Icon name="solid:xmark" size={15} />
              </button>
            )}
            <Icon name="solid:microphone" size={16} className="search-mic" />
          </div>
      </header>

      <div className="page-scroll search-scroll">
        {!q ? (
          <section className="mind-section">
            <h3 className="mind-title">What&apos;s on your mind?</h3>
            <div className="mind-grid">
              {quickCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className="mind-item"
                  onClick={() => setQuery(category.name)}
                >
                  <span className="mind-img">
                    <img src={category.image} alt={category.name} />
                  </span>
                  <span className="mind-name">{category.name}</span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="results-section">
            <p className="results-count">
              {matched.length} restaurant{matched.length === 1 ? '' : 's'} found
            </p>
            {matched.length === 0 ? (
              <div className="no-results">
                <Icon name="solid:magnifying-glass" size={44} style={{ color: 'var(--g200)', margin: '0 auto' }} />
                <h4>No results for &quot;{query}&quot;</h4>
                <p>Try searching for something else</p>
              </div>
            ) : (
              matched.map(({ restaurant, dishes }) => (
                <button
                  key={restaurant.id}
                  type="button"
                  className="search-result"
                  onClick={() => nav.push(`/restaurant/${restaurant.id}`)}
                >
                  <img className="sr-img" src={restaurant.image} alt={restaurant.name} />
                  <div className="sr-body">
                    <div className="sr-top">
                      <h4 className="sr-name">{restaurant.name}</h4>
                      <span className="sr-rating">
                        <Icon name="solid:star" size={8} /> {restaurant.rating}
                      </span>
                    </div>
                    <p className="sr-meta">
                      {restaurant.time} · {restaurant.distance}
                    </p>
                    {dishes ? (
                      <p className="sr-dishes">
                        <Icon name="solid:utensils" size={9} /> {dishes}
                      </p>
                    ) : (
                      <p className="sr-cuisine">{restaurant.cuisine}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </section>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
