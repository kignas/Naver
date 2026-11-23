import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { restaurants } from '../data/demo';
import { useCachedReady } from '../hooks/useCachedReady';
import { useAppNav } from '../lib/navigation';
import { useSearchStore } from '../store/searchStore';
import '../styles/pages/category.css';

export function Category() {
  const { type } = useParams<{ type: string }>();
  const [searchParams] = useSearchParams();
  const nav = useAppNav();
  const openSearch = useSearchStore((state) => state.openSearch);
  const ready = useCachedReady(`category:${type ?? ''}`, 180, 320);
  const [sortRating, setSortRating] = useState(false);
  const [ratingOnly, setRatingOnly] = useState(false);
  const [vegOnly, setVegOnly] = useState(false);

  const baseCategory = type ?? '';
  const searchTerm = searchParams.get('q') ?? baseCategory;

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const list = restaurants.filter((restaurant) => {
      const nameMatch = restaurant.name.toLowerCase().includes(term);
      const cuisineMatch = restaurant.cuisine.toLowerCase().includes(term);
      const menuMatch = restaurant.menu.some((item) => item.name.toLowerCase().includes(term));
      const vegMatch = !vegOnly || restaurant.menu.every((item) => item.isVeg);
      const ratingMatch = !ratingOnly || parseFloat(restaurant.rating) >= 4;
      return (nameMatch || cuisineMatch || menuMatch) && vegMatch && ratingMatch;
    });
    if (sortRating) list.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    return list;
  }, [searchTerm, vegOnly, ratingOnly, sortRating]);

  return (
    <div className="page cat-page">
      <div className="cat-header">
          <div className="cat-header-left">
            <button type="button" className="cat-back tap" onClick={nav.back} aria-label="Back">
              <Icon name="solid:arrow-left" size={14} />
            </button>
            <div>
              <h1 className="cat-title">{baseCategory || 'Category'}</h1>
              <p className="cat-sub">Restaurants near you</p>
            </div>
          </div>
          <button type="button" className="icon-btn tap" onClick={() => openSearch('home')} aria-label="Search">
            <Icon name="solid:magnifying-glass" size={14} />
          </button>
      </div>

      <div className="page-scroll cat-scroll">
        <div className="cat-filterbar">
          <button type="button" className="filter-pill">
            <Icon name="solid:sliders" size={10} /> Filter
          </button>
          <button
            type="button"
            className={`filter-pill${sortRating ? ' active' : ''}`}
            onClick={() => setSortRating((value) => !value)}
          >
            Sort By <Icon name="solid:chevron-down" size={9} />
          </button>
          <button
            type="button"
            className={`filter-pill${ratingOnly ? ' active' : ''}`}
            onClick={() => setRatingOnly((value) => !value)}
          >
            Ratings 4.0+
          </button>
          <button
            type="button"
            className={`filter-pill${vegOnly ? ' active' : ''}`}
            onClick={() => setVegOnly((value) => !value)}
          >
            Pure Veg
          </button>
        </div>

        <div className="cat-results">
          {!ready ? (
            <div>
              {[0, 1].map((key) => (
                <div className="cat-result" key={key}>
                  <div className="skeleton" style={{ width: 112, height: 112, borderRadius: 16, flexShrink: 0 }} />
                  <div style={{ flex: 1, paddingTop: 4 }}>
                    <div className="skeleton" style={{ height: 20, width: '75%', borderRadius: 4, marginBottom: 8 }} />
                    <div className="skeleton" style={{ height: 12, width: '50%', borderRadius: 4, marginBottom: 8 }} />
                    <div className="skeleton" style={{ height: 12, width: '100%', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="cat-empty">
              <div className="cat-empty-icon">
                <Icon name="solid:utensils" size={36} />
              </div>
              <h2>No restaurants found</h2>
              <p>We couldn&apos;t find any places serving &quot;{baseCategory}&quot; nearby.</p>
              <button type="button" className="cat-empty-btn" onClick={nav.back}>
                Go Back
              </button>
            </div>
          ) : (
            <>
              <p className="cat-count">
                {filtered.length} restaurant{filtered.length === 1 ? '' : 's'} found
              </p>
              {filtered.map((restaurant) => (
                <button
                  key={restaurant.id}
                  type="button"
                  className="cat-result"
                  onClick={() => nav.push(`/restaurant/${restaurant.id}`)}
                >
                  <div className="cat-result-img-wrap">
                    <img className="cat-result-img" src={restaurant.image} alt={restaurant.name} loading="lazy" decoding="async" />
                    {restaurant.offer && <span className="cat-offer">{restaurant.offer}</span>}
                  </div>
                  <div className="cat-result-body">
                    <div className="cat-result-top">
                      <h3 className="cat-result-name">{restaurant.name}</h3>
                      <span className="cat-result-rating">
                        <Icon name="solid:star" size={8} /> {restaurant.rating}
                      </span>
                    </div>
                    <div className="cat-result-meta">
                      <span className="cat-result-time">· {restaurant.time}</span>
                    </div>
                    <p className="cat-result-cuisine">{restaurant.cuisine}</p>
                    <p className="cat-result-loc">
                      <Icon name="solid:location-dot" size={9} style={{ color: 'var(--brand-400)' }} />
                      Demo City · {restaurant.distance}
                    </p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
