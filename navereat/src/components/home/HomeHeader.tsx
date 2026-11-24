import { forwardRef, memo, type RefObject } from 'react';
import { DEMO_ADDRESS_LINE } from '../../data/demo';
import { Icon } from '../Icon';
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
    { scrollerRef, onPickLocation, onOpenUnder99, onOpenProfile, onOpenSearch, onVoiceSearch },
    ref,
  ) {
    return (
      <header className="hero-header" id="home-header" ref={ref}>
        <div className="loc-row es-header-item">
          <button type="button" className="loc-left tap" aria-label="Delivery location" onClick={onPickLocation}>
            <span className="loc-pin-wrap" aria-hidden="true">
              <Icon name="solid:location-dot" size={27} className="loc-pin-icon" />
            </span>
            <span className="loc-copy">
              <span className="loc-name-row">
                <span className="loc-name" id="loc-name">
                  Home
                </span>
                <Icon name="solid:chevron-down" size={9} className="loc-chevron" />
              </span>
              <span className="loc-sub" id="loc-sub">
                {DEMO_ADDRESS_LINE}
              </span>
            </span>
          </button>
          <div className="loc-right">
            <button type="button" className="btn-store tap" aria-label="Under 99 store" onClick={onOpenUnder99}>
              <span className="store-top">UNDER</span>
              <span className="store-bot">₹99</span>
            </button>
            <ProfileButton onOpen={onOpenProfile} />
          </div>
        </div>

        <div className="search-row es-header-item">
          <button type="button" className="search-box tap" onClick={onOpenSearch} aria-haspopup="dialog">
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
