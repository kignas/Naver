import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CategoryStrip } from '../components/home/CategoryStrip';
import { HeroBanner } from '../components/home/HeroBanner';
import { HomeFilterBar } from '../components/home/HomeFilterBar';
import { HomeFilterSheet } from '../components/home/HomeFilterSheet';
import { HomeHeader } from '../components/home/HomeHeader';
import { RestaurantFeed } from '../components/home/RestaurantFeed';
import { DEMO_LOCATION } from '../data/demo';
import { useLocationLabel } from '../data';
import { useCachedReady } from '../hooks/useCachedReady';
import { useAppNav } from '../lib/navigation';
import { createRouteStyleSheet } from '../lib/routeStyles';
import { useScrollHeaderMotion } from '../lib/scrollHeaderMotion';
import { useSearchStore } from '../store/searchStore';
import { toast } from '../store/toastStore';
import { useUiStore } from '../store/uiStore';
import '../styles/original/header-theme.css';
import homeBaseCss from '../styles/original/home-base.css?raw';
import homeBundleCss from '../styles/original/home.bundle.css?raw';
import homeFinalCss from '../styles/original/home-final.css?raw';
import homePageCss from '../styles/pages/home.css?raw';

const homeStyle = createRouteStyleSheet(`${homeBaseCss}\n${homeBundleCss}\n${homeFinalCss}\n${homePageCss}`, 'navereatHome', '/');

/**
 * Home is a shell: it owns the scroller, the header-motion hook, the route
 * stylesheet and the filter-sheet open flag. Everything that changes while the
 * page is on screen — the filter flags, the cart, the user — is subscribed to by
 * the child that renders it, so this component renders once per mount.
 */
export function Home() {
  const perfWindow = window as Window & { __homeRenders?: number };
  perfWindow.__homeRenders = (perfWindow.__homeRenders ?? 0) + 1;
  const nav = useAppNav();
  const ready = useCachedReady('home', 220, 360);
  const patchHome = useUiStore((state) => state.patchHome);
  const markHomeEntered = useUiStore((state) => state.markHomeEntered);
  const openSearch = useSearchStore((state) => state.openSearch);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  useLayoutEffect(() => homeStyle.attach(), []);

  const storeScrollTop = useCallback((top: number) => patchHome({ scrollTop: top }), [patchHome]);
  const syncHeaderMotion = useScrollHeaderMotion({ scroller: scrollRef, host: screenRef, header: headerRef, onScrollTop: storeScrollTop });

  // Restore once per mount, after the feed has painted its real rows. Re-running
  // this on every render used to yank the page back to the stored offset when a
  // sheet opened.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !ready || restoredRef.current) return;
    restoredRef.current = true;
    scroller.scrollTop = useUiStore.getState().home.scrollTop;
    syncHeaderMotion();
  }, [ready, syncHeaderMotion]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('navereat:home-painted'));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // The entrance stagger (280 ms + up to 8 x 30 ms of category delay, 6 x 45 ms
  // of card delay) has fully landed by 620 ms. Only after that does the feed
  // count as entered, so flipping the flag can never cut a running animation.
  useEffect(() => {
    if (useUiStore.getState().homeHasEntered) return;
    const timer = window.setTimeout(() => markHomeEntered(), 620);
    return () => window.clearTimeout(timer);
  }, [markHomeEntered]);

  const location = useLocationLabel();
  const pickLocation = useCallback(
    () => toast(location ? location.sub : DEMO_LOCATION),
    [location],
  );
  const openUnder99 = useCallback(() => nav.push('/under99'), [nav]);
  const openProfile = useCallback(() => nav.push('/profile'), [nav]);
  const openHomeSearch = useCallback(() => openSearch('home'), [openSearch]);
  const voiceSearch = useCallback(() => toast('Voice search is demo only'), []);
  const openFilters = useCallback(() => setFilterSheetOpen(true), []);
  const closeFilters = useCallback(() => setFilterSheetOpen(false), []);

  return (
    <div className="home-screen" ref={screenRef}>
      <div className="home-scroll" ref={scrollRef}>
        <HomeHeader
          ref={headerRef}
          scrollerRef={scrollRef}
          onPickLocation={pickLocation}
          onOpenUnder99={openUnder99}
          onOpenProfile={openProfile}
          onOpenSearch={openHomeSearch}
          onVoiceSearch={voiceSearch}
          location={location}
        />

        <div className="hero-sheet">
          <HeroBanner scrollerRef={scrollRef} onCtaClick={openUnder99} />
        </div>

        <main className="home-main">
          <CategoryStrip />

          <HomeFilterBar filtersOpen={filterSheetOpen} onOpenFilters={openFilters} />

          <RestaurantFeed ready={ready} scrollerRef={scrollRef} />

          <div className="ew-feed-end" id="home-feed-end" aria-label="End of restaurant list">
            <h2 className="ew-feed-end__title">That&apos;s all we&apos;ve got!</h2>
            <p className="ew-feed-end__sub">
              A curated list of top-rated restaurants <span className="ew-feed-end__heart" aria-hidden="true" />
            </p>
            <p className="ew-feed-end__made">
              Navereat <span className="ew-feed-end__sun" aria-hidden="true" />
            </p>
          </div>
        </main>
      </div>

      {filterSheetOpen && <HomeFilterSheet onClose={closeFilters} />}
    </div>
  );
}
