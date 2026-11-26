import { memo, type MouseEvent } from 'react';
import bannerArt from '../../assets/hero/hero-banner-burger.webp';
import { PLATFORM_AREA } from '../../data/locationLabel';
import { Icon } from '../Icon';

export interface HeroBannerProps {
  /** The original CTA is a link to its search page; here it opens the overlay. */
  onCtaClick?: () => void;
  /** Service town printed by the promo strip, as the original does. */
  area?: string;
}

/**
 * The Home hero, exactly as eatswada.com renders it: one static promotional
 * slide — title, tagline, "Order Now" CTA — with the cut-out art bleeding off
 * the right edge, and the "Nearby restaurants · <town>" strip below it.
 *
 * It is deliberately inert. The original has no carousel, no autoplay and no
 * scroll-linked motion here, and every one of those cost frames on a cached,
 * covered Home page.
 */
export const HeroBanner = memo(function HeroBanner({ onCtaClick, area = PLATFORM_AREA }: HeroBannerProps) {
  const handleCta = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onCtaClick?.();
  };

  return (
    <>
      <div className="banner-wrap es-header-item" id="hero-banner-region">
        <div className="header-carousel">
          <div className="header-carousel-track">
            <article className="header-slide" role="group" aria-roledescription="slide" aria-label="Promotion">
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
                    Happier you. <span className="banner-heart" aria-hidden="true">♥</span>
                  </p>
                  <a className="banner-cta" href="#/" onClick={handleCta}>
                    Order Now{' '}
                    <span className="banner-cta__chev" aria-hidden="true">
                      <Icon name="solid:chevron-right" size={11} />
                    </span>
                  </a>
                </div>
                <img
                  className="header-slide__art"
                  src={bannerArt}
                  alt=""
                  aria-hidden="true"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
              </div>
            </article>
          </div>
        </div>
      </div>
      <div className="ew-strip" aria-hidden="true">
        Nearby restaurants · {area}
      </div>
    </>
  );
});
