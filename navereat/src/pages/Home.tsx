import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { BottomNav } from '../components/BottomNav';
import { CartBar } from '../components/CartBar';
import { Icon } from '../components/Icon';
import { VegDot } from '../components/VegDot';
import { categories, DEMO_LOCATION, restaurants } from '../data/demo';
import { useSkeleton } from '../hooks/useSkeleton';
import { useAppNav } from '../lib/navigation';
import { formatMoney } from '../lib/money';
import '../styles/pages/home.css';

const PHRASES = ["Search for 'Biryani'", "Search for 'Pizza'", "Search for 'Momos'", "Search for 'Burger'"];

interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
}

const letterDelay = (seconds: string): CSSProperties => ({ ['--d' as string]: seconds });

export function Home() {
  const nav = useAppNav();
  const ready = useSkeleton(450, 700);
  const [vegOnly, setVegOnly] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phraseVisible, setPhraseVisible] = useState(true);
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);
  const heroRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPhraseVisible(false);
      window.setTimeout(() => {
        setPhraseIndex((index) => (index + 1) % PHRASES.length);
        setPhraseVisible(true);
      }, 300);
    }, 3000);
    return () => window.clearInterval(interval);
  }, []);

  const visibleRestaurants = useMemo(
    () => (vegOnly ? restaurants.filter((r) => r.menu.every((item) => item.isVeg)) : restaurants),
    [vegOnly],
  );

  const storeItems = useMemo(
    () => [
      { menu: restaurants[2].menu[0], resName: 'Mumbai Dosa Plaza', price: 69 },
      { menu: restaurants[7].menu[0], resName: 'Rolls Mania', price: 89 },
      { menu: restaurants[4].menu[0], resName: 'Burger King', price: 79 },
    ],
    [],
  );

  const spawnSparkles = (event: MouseEvent<HTMLElement>) => {
    const rect = heroRef.current?.getBoundingClientRect();
    if (!rect) return;
    const batch = Array.from({ length: 4 }, (_, index) => ({
      id: Date.now() + index,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      size: Math.random() * 5 + 3,
    }));
    setSparkles((prev) => [...prev, ...batch]);
    window.setTimeout(() => {
      setSparkles((prev) => prev.filter((sparkle) => !batch.some((added) => added.id === sparkle.id)));
    }, 1400);
  };

  return (
    <div className="page home-page">
      <div className="page-scroll home-scroll">
        <header className="home-hero" ref={heroRef} onClick={spawnSparkles}>
          <div className="hero-gradient" />
          <div className="hero-blob hero-blob-a" />
          <div className="hero-blob hero-blob-b" />
          {sparkles.map((sparkle) => (
            <span
              key={sparkle.id}
              className="sparkle"
              style={{ left: sparkle.x, top: sparkle.y, width: sparkle.size, height: sparkle.size }}
            />
          ))}

          <div className="home-hero-inner">
            <div className="home-top">
              <div>
                <button type="button" className="location-btn" title={DEMO_LOCATION}>
                  <Icon name="solid:location-dot" size={14} className="loc-dot" />
                  Home – Demo Street
                  <Icon name="solid:chevron-down" size={11} className="loc-chev" />
                </button>
                <p className="location-sub">Demo City · Delivery under 15 km</p>
              </div>
              <button type="button" className="profile-btn tap" aria-label="Profile" onClick={() => nav.tab('/profile')}>
                <Icon name="solid:user" size={12} />
              </button>
            </div>

            <div className="search-row">
              <button type="button" className="search-pill" onClick={() => nav.tab('/search')}>
                <Icon name="solid:magnifying-glass" size={14} style={{ color: 'var(--g400)' }} />
                <span className="search-placeholder" style={{ opacity: phraseVisible ? 1 : 0 }}>
                  {PHRASES[phraseIndex]}
                </span>
                <span className="search-divider" />
                <Icon name="solid:microphone" size={14} className="mic" />
              </button>
              <div className="veg-card">
                <span className="veg-card-label">VEG</span>
                <button
                  type="button"
                  className={`veg-toggle${vegOnly ? ' on' : ''}`}
                  aria-label="Show pure vegetarian restaurants"
                  aria-pressed={vegOnly}
                  onClick={(event) => {
                    event.stopPropagation();
                    setVegOnly((value) => !value);
                  }}
                >
                  <span className="veg-thumb" />
                </button>
              </div>
            </div>

            <div className="payday">
              <div className="payday-row">
                <div className="payday-text">
                  {['P', 'A', 'Y'].map((letter, index) => (
                    <span key={letter} className="letter" style={letterDelay(`${index * 0.1}s`)}>
                      {letter}
                    </span>
                  ))}
                </div>
                <div className="payday-img-wrap">
                  <img className="payday-img" src={restaurants[0].menu[0].image} alt="Pizza" />
                </div>
                <div className="payday-text">
                  {['D', 'A', 'Y'].map((letter, index) => (
                    <span key={`${letter}${index}`} className="letter" style={letterDelay(`${0.3 + index * 0.1}s`)}>
                      {letter}
                    </span>
                  ))}
                </div>
              </div>
              <button type="button" className="payday-btn" onClick={() => nav.push('/under99')}>
                Order Now
              </button>
              <p className="payday-sub">Flat ₹200 Off &amp; More</p>
            </div>

            <div className="offer-row">
              <div className="offer-card">
                <p>
                  Flat ₹200
                  <br />
                  OFF &amp; More
                </p>
                <span className="offer-icon">
                  <Icon name="solid:tag" size={10} />
                </span>
              </div>
              <div className="offer-card offer-center">
                <p>
                  Burst &amp; Win
                  <br />
                  Up to ₹600
                </p>
                <p className="offer-pink">HOLI BLAST</p>
              </div>
              <div className="offer-card">
                <p>
                  Meals
                  <br />
                  At ₹99
                </p>
                <span className="offer-99">99</span>
              </div>
            </div>
          </div>
        </header>

        <section className="cat-section">
          <h2 className="section-title">What&apos;s on your mind?</h2>
          <div className="cat-rail">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className="cat-item"
                onClick={() =>
                  nav.push(`/category/${encodeURIComponent(category.name)}?q=${encodeURIComponent(category.query)}`)
                }
              >
                <span className="cat-img-wrap">
                  <img src={category.image} alt={category.name} />
                </span>
                <span className="cat-name">{category.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="store-section">
          <div className="store-card">
            <div className="store-head">
              <div className="store-left">
                <span className="store-icon">
                  <Icon name="solid:store" size={14} />
                </span>
                <div>
                  <div className="store-title-row">
                    <h3 className="store-title">99 Store</h3>
                    <span className="store-pro">PRO</span>
                  </div>
                  <p className="store-sub">Meals at ₹99 + Free Delivery</p>
                </div>
              </div>
              <button type="button" className="store-all tap" onClick={() => nav.push('/under99')}>
                See All <Icon name="solid:arrow-right-long" size={10} />
              </button>
            </div>

            <div className="store-rail">
              {storeItems.map((entry) => (
                <button
                  key={entry.menu.id}
                  type="button"
                  className="store-item"
                  onClick={() => nav.push('/under99')}
                >
                  <div className="store-img-wrap">
                    <img className="store-img" src={entry.menu.image} alt={entry.menu.name} />
                    <span className="store-price">{formatMoney(entry.price)}</span>
                  </div>
                  <div className="store-item-body">
                    <div className="veg-label-row">
                      <VegDot isVeg={entry.menu.isVeg} />
                      <span className="veg-label">{entry.menu.isVeg ? 'Veg' : 'Non-Veg'}</span>
                    </div>
                    <p className="store-item-name">{entry.menu.name}</p>
                    <p className="store-item-res">{entry.resName}</p>
                    <div className="store-add">ADD +</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rest-section">
          <h2 className="section-title">Restaurants to explore</h2>
          {!ready ? (
            <div className="res-list">
              <div className="skeleton res-skeleton" />
              <div className="skeleton res-skeleton" />
              <div className="skeleton res-skeleton" />
            </div>
          ) : (
            <div className="res-list">
              {visibleRestaurants.map((restaurant) => (
                <button
                  key={restaurant.id}
                  type="button"
                  className="res-card"
                  onClick={() => nav.push(`/restaurant/${restaurant.id}`)}
                >
                  <div className="res-img-wrap">
                    <img className="res-img" src={restaurant.image} alt={restaurant.name} />
                    <span className="res-offer">{restaurant.offer}</span>
                  </div>
                  <div className="res-body">
                    <div className="res-top">
                      <div>
                        <h3 className="res-name">{restaurant.name}</h3>
                        <p className="res-cuisine">{restaurant.cuisine}</p>
                      </div>
                      <span className="res-rating">
                        <Icon name="solid:star" size={10} /> {restaurant.rating}
                      </span>
                    </div>
                    <div className="res-meta">
                      <span>
                        <Icon name="regular:clock" size={12} className="accent" /> {restaurant.time}
                      </span>
                      <span className="sep">|</span>
                      <span>
                        <Icon name="solid:location-dot" size={12} className="accent" /> {restaurant.distance}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
              {visibleRestaurants.length === 0 && (
                <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--g400)', padding: '24px 0' }}>
                  No pure-veg restaurants nearby. Turn off the VEG filter.
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <CartBar aboveNav />
      <BottomNav />
    </div>
  );
}
