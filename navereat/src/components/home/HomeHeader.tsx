import { forwardRef, memo, type RefObject } from 'react';
import { motion } from 'framer-motion';
import { DEMO_ADDRESS_LINE } from '../../data/demo';
import type { LocationLabel } from '../../data/locationLabel';
import { Icon } from '../Icon';
import { captureFlip, SEARCH_FLIP_ID } from '../../lib/sharedElement';
import { ProfileButton } from './ProfileButton';
import { SearchPlaceholderText } from './SearchPlaceholderText';
import { VegToggle } from './VegToggle';

interface HomeHeaderProps {
  scrollerRef: RefObject<HTMLDivElement | null>;
  onPickLocation: () => void;
  onOpenUnder99: () => void;
  onOpenProfile: () => void;
  onOpenSearch: () => void;
  onVoiceSearch: () => void;
  /** api mode: the customer's default address, or the logged-out pair. */
  location?: LocationLabel | null;
}

/**
 * The sticky maroon header. Frozen behind memo + stable callbacks: it used to be
 * rebuilt on every filter tap and every cart mutation.
 *
 * The ref is forwarded because useScrollHeaderMotion measures the pin distance
 * between this block and `.search-row`.
 */
export const HomeHeader = memo(
  forwardRef<HTMLElement, HomeHeaderProps>(function HomeHeader(
    { scrollerRef, onPickLocation, onOpenUnder99, onOpenProfile, onOpenSearch, onVoiceSearch, location = null },
    ref,
  ) {
    return (
      <header className="hero-header" id="home-header" ref={ref}>
        <div className="loc-row es-header-item">
          <motion.button
            type="button"
            className="loc-left"
            aria-label="Delivery location"
            onClick={onPickLocation}
            whileTap={{ scale: 0.92 }}
          >
            <motion.span
              className="loc-pin-wrap"
              aria-hidden="true"
              initial={{ scale: 0.55, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 14, delay: 0.02 }}
            >
              <Icon name="solid:location-dot" size={27} className="loc-pin-icon" />
            </motion.span>
            <span className="loc-copy">
              <span className="loc-name-row">
                <span className="loc-name" id="loc-name">
                  {location?.name ?? 'Home'}
                </span>
                <Icon name="solid:chevron-down" size={9} className="loc-chevron" />
              </span>
              <span className="loc-sub" id="loc-sub">
                {location?.sub ?? DEMO_ADDRESS_LINE}
              </span>
            </span>
          </motion.button>
          <div className="loc-right">
            <button type="button" className="btn-store tap" aria-label="Under 99 store" onClick={onOpenUnder99}>
              <span className="store-top">UNDER</span>
              <span className="store-bot">₹99</span>
            </button>
            <ProfileButton onOpen={onOpenProfile} />
          </div>
        </div>

        <div className="search-row es-header-item">
          <button
            type="button"
            className="search-box tap"
            data-flip-id={SEARCH_FLIP_ID}
            onClick={(event) => {
              captureFlip(SEARCH_FLIP_ID, event.currentTarget);
              onOpenSearch();
            }}
            aria-haspopup="dialog"
          >
            <Icon name="solid:magnifying-glass" size={18} className="search-icon" />
            <SearchPlaceholderText scrollerRef={scrollerRef} />
            <span
              className="search-mic"
              role="button"
              tabIndex={0}
              aria-label="Voice search"
              onClick={(event) => {
                event.stopPropagation();
                onVoiceSearch();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  onVoiceSearch();
                }
              }}
            >
              <Icon name="solid:microphone" size={17} />
            </span>
          </button>
          <VegToggle />
        </div>
      </header>
    );
  }),
);
