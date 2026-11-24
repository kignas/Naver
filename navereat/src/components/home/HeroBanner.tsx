import { memo } from 'react';
import heroDish from '../../assets/placeholders/hero-dish.svg';
import { useAppNav } from '../../lib/navigation';
import { Icon } from '../Icon';

/**
 * Static promo banner: no props, no state, so it renders once per Home mount.
 */
export const HeroBanner = memo(function HeroBanner() {
  const nav = useAppNav();
  return (
    <div className="banner-wrap es-header-item" id="hero-banner-region" aria-live="polite">
      <div className="header-carousel" id="banner-carousel" aria-roledescription="carousel" aria-label="Promotions">
        <div className="header-carousel-track" id="header-carousel-track">
          <article className="header-slide is-active" role="group" aria-roledescription="slide" aria-label="Banner 1">
            <div className="header-slide__panel">
              <div className="header-slide__copy">
                <h2 className="banner-title">
                  Good Food
                  <br />
                  <span className="banner-title-accent">Closer to Home.</span>
                </h2>
                <p className="banner-subtitle banner-subtitle--default">
                  Tasty food
                  <br />
                  Happier you.{' '}
                  <span className="banner-heart" aria-hidden="true">
                    ♥
                  </span>
                </p>
                <button type="button" className="banner-cta" onClick={() => nav.push('/under99')}>
                  Order Now
                  <span className="banner-cta__chev" aria-hidden="true">
                    <Icon name="solid:chevron-right" size={11} />
                  </span>
                </button>
              </div>
              <img className="header-slide__art" src={heroDish} alt="" aria-hidden="true" decoding="async" />
            </div>
          </article>
        </div>
      </div>
    </div>
  );
});
