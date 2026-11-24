import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Location } from 'react-router-dom';
import { isTabPath, TAB_PATHS, useAppNav } from '../lib/navigation';
import { applyLayout, captureLayout, refreshSnapshotScroll, type LayoutSnapshot } from '../lib/layoutSnapshot';
import { RouteShell } from './RouteShell';
import { waitForRouteReady } from '../lib/routeReady';
import { routeKeyFor } from '../lib/routeLoaders';
import { fontsReady } from '../lib/fonts';
import { syncRouteStyleSheets } from '../lib/routeStyles';
import { useNavDirection, useNavStore, type NavDirection } from '../store/navStore';

const PUSH_DURATION = 420;
const POP_DURATION = 360;
// Safety net only: the slide normally starts as soon as the incoming page has
// painted its real content (see settleIncoming).
const PUSH_READY_TIMEOUT = 600;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const SWIPE_THRESHOLD = 0.35;
// Cap the freeze snapshot: the visible top of the page is what can shift during
// a slide, and every captured node costs 50 pinned properties on apply.
const SNAPSHOT_NODES = 96;

type Phase = 'idle' | 'enter' | 'leave';

interface Layer {
  key: string;
  location: Location;
  phase: Phase;
}

interface TabLayer {
  pathname: string;
  location: Location;
}

interface Stage {
  direction: NavDirection;
  animating: boolean;
}

const CachedRoute = memo(function CachedRoute({ content }: { content: ReactNode }) {
  return <>{content}</>;
});

interface PageTransitionProps {
  location: Location;
  swipeBack?: boolean;
  render: (location: Location) => ReactNode;
}

/**
 * Tab routes are kept mounted in a persistent stack. Switching tabs only
 * toggles which cached tab is visible; the page itself never animates.
 * Detail routes slide over the cached tab stack. All page motion is transform
 * only: route layers stay fully opaque.
 */
export function PageTransition({ location, swipeBack = false, render }: PageTransitionProps) {
  const nav = useAppNav();
  const direction = useNavDirection();
  const directionLatestRef = useRef(direction);
  directionLatestRef.current = direction;
  const startsOnTab = isTabPath(location.pathname);
  const [layers, setLayers] = useState<Layer[]>(
    startsOnTab ? [] : [{ key: location.key, location, phase: 'idle' }],
  );
  const [tabLayers, setTabLayers] = useState<TabLayer[]>(() =>
    TAB_PATHS.map((pathname) => ({
      pathname,
      location:
        pathname === location.pathname && startsOnTab
          ? location
          : { pathname, search: '', hash: '', state: null, key: `tab:${pathname}` },
    })),
  );
  const [activeTab, setActiveTab] = useState<string | null>(startsOnTab ? location.pathname : null);
  const displayTab = isTabPath(location.pathname) ? location.pathname : activeTab;
  const [stage, setStage] = useState<Stage>({ direction, animating: false });
  const [tabShift, setTabShift] = useState(false);
  const [swipeBackLocation, setSwipeBackLocation] = useState<Location | null>(null);
  const [swiping, setSwiping] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const layersRef = useRef(layers);
  const tabLayersRef = useRef(tabLayers);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = displayTab;
  // Tab layers stay mounted, so route css must follow the visible layer.
  useLayoutEffect(() => {
    syncRouteStyleSheets();
  }, [displayTab, location.key]);
  const stageRef = useRef(stage);
  const historyRef = useRef<Location[]>([location]);
  const skipNextPopRef = useRef(false);
  const swipeRef = useRef<{ pointerId: number; startX: number; dx: number } | null>(null);
  const swipeUnderTabRef = useRef(false);
  const layerRefs = useRef(new Map<string, HTMLDivElement>());
  const tabRefs = useRef(new Map<string, HTMLDivElement>());
  const tabStackRef = useRef<HTMLDivElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLDivElement | null>(null);
  const runIdRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const swipeTimerRef = useRef<number | null>(null);
  const prepareFrameRef = useRef<number | null>(null);
  const startTimerRef = useRef<number | null>(null);
  const elementCacheRef = useRef(new Map<string, ReactNode>());
  const snapshotsRef = useRef(new Map<string, LayoutSnapshot>());
  const restoresRef = useRef<Array<{ scope: 'tab' | 'layer'; restore: () => void }>>([]);
  const previousLocationRef = useRef(location);

  layersRef.current = layers;
  tabLayersRef.current = tabLayers;
  stageRef.current = stage;

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetInlineStyles = useCallback(() => {
    layerRefs.current.forEach((element) => {
      element.style.transform = '';
      element.style.transition = '';
      element.style.visibility = '';
    });
    if (backRef.current) {
      backRef.current.style.transform = '';
      backRef.current.style.transition = '';
      backRef.current.style.visibility = '';
    }
    if (tabStackRef.current) {
      tabStackRef.current.style.transform = '';
      tabStackRef.current.style.transition = '';
    }
  }, []);

  const captureCurrentLayout = useCallback((force = false) => {
    const limit = SNAPSHOT_NODES;
    const tab = activeTabRef.current;
    if (tab) {
      const key = `tab:${tab}`;
      const root = tabRefs.current.get(tab);
      if (root && (force || !snapshotsRef.current.has(key))) {
        snapshotsRef.current.set(key, captureLayout(root, limit));
      }
    }
    const top = layersRef.current[layersRef.current.length - 1];
    if (top) {
      const key = `layer:${top.key}`;
      const root = layerRefs.current.get(top.key);
      if (root && (force || !snapshotsRef.current.has(key))) {
        snapshotsRef.current.set(key, captureLayout(root, limit));
      }
    }
  }, []);

  const restoreFrozenLayout = useCallback((scope?: 'tab' | 'layer') => {
    restoresRef.current = restoresRef.current.filter((entry) => {
      if (scope && entry.scope !== scope) return true;
      entry.restore();
      return false;
    });
  }, []);

  useLayoutEffect(() => {
    const previous = previousLocationRef.current;
    previousLocationRef.current = location;
    if (previous.key === location.key) return;

    restoreFrozenLayout('layer');
    const previousIsTab = isTabPath(previous.pathname);
    const nextIsTab = isTabPath(location.pathname);
    if (previousIsTab && nextIsTab) {
      restoreFrozenLayout('tab');
      return;
    }

    const tab = activeTabRef.current;
    if (tab && !restoresRef.current.some((entry) => entry.scope === 'tab')) {
      const snapshot = snapshotsRef.current.get(`tab:${tab}`);
      const root = tabRefs.current.get(tab);
      if (snapshot && root) {
        restoresRef.current.push({ scope: 'tab', restore: applyLayout(snapshot) });
      }
    }
    const top = layersRef.current[layersRef.current.length - 1];
    if (top) {
      const snapshot = snapshotsRef.current.get(`layer:${top.key}`);
      const root = layerRefs.current.get(top.key);
      if (snapshot && root) {
        restoresRef.current.push({ scope: 'layer', restore: applyLayout(snapshot) });
      }
    }
  }, [location, restoreFrozenLayout]);

  useEffect(() => {
    const onBeforeNavigate = () => {
      captureCurrentLayout();
      // The snapshot was taken when the route settled; the scroll offsets have
      // moved since, and freezing a stale offset would rewind the page.
      snapshotsRef.current.forEach(refreshSnapshotScroll);
    };
    window.addEventListener('navereat:before-navigate', onBeforeNavigate);
    return () => window.removeEventListener('navereat:before-navigate', onBeforeNavigate);
  }, [captureCurrentLayout]);

  useEffect(() => {
    if (stage.animating) return;
    const timer = window.setTimeout(() => captureCurrentLayout(true), 450);
    return () => window.clearTimeout(timer);
  }, [activeTab, layers, stage.animating, captureCurrentLayout]);

  useEffect(() => {
    const onEnd = () => {
      restoreFrozenLayout('layer');
      if (isTabPath(window.location.hash.replace(/^#/, '') || '/')) restoreFrozenLayout('tab');
    };
    window.addEventListener('navereat:transition-end', onEnd);
    return () => window.removeEventListener('navereat:transition-end', onEnd);
  }, [restoreFrozenLayout]);

  useLayoutEffect(() => {
    resetInlineStyles();
  }, [activeTab, layers, resetInlineStyles]);

  useLayoutEffect(() => {
    const current = layersRef.current;
    const top = current[current.length - 1];
    const targetIsTab = isTabPath(location.pathname);
    // A hash-only history navigation (Android hardware back, the browser's own
    // back) can arrive with the previous 'push' flag still set: the router
    // commits the new hash before the popstate handler runs. Leaving a detail
    // page for a tab route is always a pop, so the reverse slide still runs.
    const direction: NavDirection =
      top && !isTabPath(top.location.pathname) && targetIsTab ? 'pop' : directionLatestRef.current;

    if (skipNextPopRef.current) {
      skipNextPopRef.current = false;
      clearTimer();
      runIdRef.current += 1;
      setSwipeBackLocation(null);
      setSwiping(false);
      setPreparing(false);
      useNavStore.getState().setPreparing(false);
      if (targetIsTab) {
        setTabLayers((previous) => {
          if (previous.some((tab) => tab.pathname === location.pathname)) return previous;
          return [...previous, { pathname: location.pathname, location }];
        });
        setActiveTab(location.pathname);
        activeTabRef.current = location.pathname;
        setLayers([]);
        setTabShift(false);
        historyRef.current = [location];
      } else {
        setLayers([{ key: location.key, location, phase: 'idle' }]);
        setTabShift(true);
        historyRef.current = [...historyRef.current, location];
      }
      setStage({ direction: 'pop', animating: false });
      return;
    }

    if (targetIsTab) {
      const wasCached = tabLayersRef.current.some((tab) => tab.pathname === location.pathname);
      if (!wasCached) {
        // First mount of a tab: render it complete instead of letting the
        // skeleton swap heights after the instant switch.
        useNavStore.getState().setPreparing(true);
        const key = routeKeyFor(location.pathname);
        if (key) {
          void waitForRouteReady(key).then(() => useNavStore.getState().setPreparing(false));
        } else {
          window.setTimeout(() => useNavStore.getState().setPreparing(false), 300);
        }
      }
      setTabLayers((previous) => {
        if (previous.some((tab) => tab.pathname === location.pathname)) return previous;
        return [...previous, { pathname: location.pathname, location }];
      });
      setActiveTab(location.pathname);
      activeTabRef.current = location.pathname;

      // A tab route reached while a detail page is on top is a pop: the page
      // that is leaving must slide away, whether the direction flag arrived
      // from the router's own history handling or from nav.back(). Tab-to-tab
      // switches (no detail layer) still swap instantly.
      if ((direction === 'tab' && !top) || (!top && !stageRef.current.animating)) {
        clearTimer();
        runIdRef.current += 1;
        setLayers([]);
        setStage({ direction: 'tab', animating: false });
        setTabShift(false);
        setPreparing(false);
        setSwipeBackLocation(null);
        setSwiping(false);
        if (wasCached) useNavStore.getState().setPreparing(false);
        historyRef.current = [location];
        return;
      }

      if (direction === 'pop') {
        if (!top) return;
        clearTimer();
        const runId = runIdRef.current + 1;
        runIdRef.current = runId;
        setSwipeBackLocation(null);
        setSwiping(false);
        setPreparing(false);
        useNavStore.getState().setPreparing(false);
        const targetIsTab = isTabPath(location.pathname);
        const targetLayer: Layer | null = targetIsTab
          ? null
          : { key: location.key, location, phase: 'enter' };
        setLayers(targetLayer ? [targetLayer, { ...top, phase: 'leave' }] : [{ ...top, phase: 'leave' }]);
        setStage({ direction: 'pop', animating: true });
        setTabShift(false);
        historyRef.current = historyRef.current.filter((entry) => entry.key !== top.location.key);
        if (historyRef.current[historyRef.current.length - 1]?.key !== location.key) {
          historyRef.current = [...historyRef.current, location];
        }
        window.dispatchEvent(new CustomEvent('navereat:transition-start', { detail: { direction: 'pop' } }));
        timerRef.current = window.setTimeout(() => {
          if (runId !== runIdRef.current) return;
          if (targetLayer) setLayers([{ key: location.key, location, phase: 'idle' }]);
          else setLayers([]);
          setStage({ direction: 'pop', animating: false });
          window.dispatchEvent(new CustomEvent('navereat:transition-end', { detail: { direction: 'pop' } }));
          timerRef.current = null;
        }, POP_DURATION);
        return;
      }

      clearTimer();
      runIdRef.current += 1;
      setLayers([]);
      setStage({ direction: 'tab', animating: false });
      setTabShift(false);
      setPreparing(false);
      if (wasCached) useNavStore.getState().setPreparing(false);
      historyRef.current = [location];
      return;
    }

    if (top?.location.key === location.key) return;

    const oldLayer: Layer | null =
      top && !isTabPath(top.location.pathname) ? { ...top, phase: 'leave' } : null;
    const newLayer: Layer = { key: location.key, location, phase: 'enter' };

    if (direction === 'push') {
      historyRef.current = [...historyRef.current, location];
    } else if (direction === 'pop') {
      historyRef.current = historyRef.current.filter((entry) => entry.key !== top?.location.key);
      if (historyRef.current[historyRef.current.length - 1]?.key !== location.key) {
        historyRef.current = [...historyRef.current, location];
      }
    } else {
      historyRef.current = [location];
    }

    clearTimer();
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setSwipeBackLocation(null);
    setSwiping(false);
    setPreparing(true);
    // Pages mounted for the slide must render their full state from the first
    // render (no skeleton -> content swap inside the moving layer).
    useNavStore.getState().setPreparing(true);
    setLayers(oldLayer ? [oldLayer, newLayer] : [newLayer]);
    setStage({ direction, animating: true });

    let started = false;
    const start = () => {
      if (started || runId !== runIdRef.current) return;
      started = true;
      if (startTimerRef.current !== null) {
        window.clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
      setPreparing(false);
      setTabShift(true);
      window.dispatchEvent(new CustomEvent('navereat:transition-start', { detail: { direction } }));
      timerRef.current = window.setTimeout(() => {
        if (runId !== runIdRef.current) return;
        // The shell paid for the slide; the page can now render its full state
        // immediately instead of swapping a skeleton after the transition.
        useNavStore.getState().setPreparing(true);
        setLayers([{ key: location.key, location, phase: 'idle' }]);
        setStage({ direction, animating: false });
        void waitForRouteReady(location.key, 1500).then(() => useNavStore.getState().setPreparing(false));
        window.dispatchEvent(new CustomEvent('navereat:transition-end', { detail: { direction } }));
        timerRef.current = null;
      }, PUSH_DURATION);
    };

    const waitForIncoming = () =>
      new Promise<HTMLDivElement | null>((resolve) => {
        const check = () => {
          if (runId !== runIdRef.current) {
            resolve(null);
            return;
          }
          const node = layerRefs.current.get(newLayer.key);
          if (node) resolve(node);
          else prepareFrameRef.current = window.requestAnimationFrame(check);
        };
        check();
      });

    // The slide may only start once the incoming page is mounted, laid out and
    // its images are decoded: the layer is still hidden at this point, so the
    // first frame of the slide already shows the finished page.
    const settleIncoming = async () => {
      const node = await waitForIncoming();
      if (!node) return;
      await waitForRouteReady(newLayer.key);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      void node.offsetHeight;
      // Late faces would reflow text inside the moving page.
      await fontsReady(300);
      // The layout itself has to be final too: two identical measurements of
      // the page height (or the budget) before the layer is ever shown.
      const settleStarted = performance.now();
      let measured = -1;
      while (performance.now() - settleStarted < 200) {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        const height = node.scrollHeight;
        if (height > 0 && height === measured) break;
        measured = height;
      }
      const images = Array.from(node.querySelectorAll('img'));
      await Promise.race([
        Promise.all(images.map((image) => image.decode().catch(() => undefined))),
        new Promise((resolve) => window.setTimeout(resolve, 60)),
      ]);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    };

    startTimerRef.current = window.setTimeout(start, PUSH_READY_TIMEOUT);
    void settleIncoming().then(start);
  }, [direction, location]);

  useEffect(() => () => {
    clearTimer();
    if (swipeTimerRef.current !== null) window.clearTimeout(swipeTimerRef.current);
    if (prepareFrameRef.current !== null) window.cancelAnimationFrame(prepareFrameRef.current);
    if (startTimerRef.current !== null) window.clearTimeout(startTimerRef.current);
  }, []);

  const renderCached = (target: Location): ReactNode => {
    const cached = elementCacheRef.current.get(target.key);
    if (cached) return cached;
    const element = render(target);
    elementCacheRef.current.set(target.key, element);
    return element;
  };

  const setLayerRef = (key: string) => (element: HTMLDivElement | null) => {
    if (element) layerRefs.current.set(key, element);
    else layerRefs.current.delete(key);
  };

  const currentKey = layers[layers.length - 1]?.key;

  const beginSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeBack || stage.animating || swiping || !layers.length) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const previous = historyRef.current[historyRef.current.length - 2];
    if (!previous) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    swipeRef.current = { pointerId: event.pointerId, startX: event.clientX, dx: 0 };
    swipeUnderTabRef.current = isTabPath(previous.pathname);
    setSwipeBackLocation(swipeUnderTabRef.current ? null : previous);
    setSwiping(true);
  };

  const moveSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = swipeRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const top = topRef.current;
    if (!top) return;
    const width = window.innerWidth || 390;
    const dx = Math.max(0, Math.min(width, event.clientX - gesture.startX));
    gesture.dx = dx;
    top.style.transition = 'none';
    top.style.transform = `translate3d(${dx}px, 0, 0)`;

    // The page underneath is only revealed; it never moves.
    if (!swipeUnderTabRef.current && backRef.current) {
      backRef.current.style.visibility = 'visible';
      backRef.current.style.transition = 'none';
      backRef.current.style.transform = 'translate3d(0, 0, 0)';
    }
  };

  const settleSwipe = (complete: boolean) => {
    const top = topRef.current;
    if (swipeTimerRef.current !== null) window.clearTimeout(swipeTimerRef.current);
    swipeRef.current = null;
    if (!top) {
      setSwiping(false);
      setSwipeBackLocation(null);
      return;
    }

    if (complete) {
      setStage((value) => ({ ...value, animating: true }));
      top.style.transition = `transform ${POP_DURATION}ms ${EASE}`;
      top.style.transform = 'translate3d(100%, 0, 0)';
      skipNextPopRef.current = true;
      swipeTimerRef.current = window.setTimeout(() => {
        setSwiping(false);
        nav.back();
      }, POP_DURATION);
      return;
    }

    top.style.transition = `transform ${PUSH_DURATION}ms ${EASE}`;
    top.style.transform = 'translate3d(0, 0, 0)';
    swipeTimerRef.current = window.setTimeout(() => {
      setSwiping(false);
      setSwipeBackLocation(null);
      setStage((value) => ({ ...value, animating: false }));
      resetInlineStyles();
    }, PUSH_DURATION);
  };

  // Nothing here may publish state during a transition: an extra store update
  // mid-slide costs a render pass at 4x CPU and can let a pending layout land a
  // frame late. The covered-page pause reads the router location instead.
  useEffect(() => {
    document.body.classList.toggle('has-detail', layers.length > 0);
    return () => {
      document.body.classList.remove('has-detail');
    };
  }, [layers.length]);


  return (
    <div
      className={`route-stage direction-${stage.direction}${stage.animating ? ' is-animating' : ''}${preparing ? ' is-preparing' : ''}${swiping ? ' is-swiping' : ''}${layers.length ? ' has-detail' : ''}`}
      onPointerMove={moveSwipe}
      onPointerUp={() => {
        if (swipeRef.current) {
          settleSwipe(swipeRef.current.dx > (window.innerWidth || 390) * SWIPE_THRESHOLD);
        }
      }}
      onPointerCancel={() => {
        if (swipeRef.current) settleSwipe(false);
      }}
    >
      {tabLayers.length > 0 && (
        <div
          ref={tabStackRef}
          className={`tab-stack${tabShift ? ' is-shifted' : ''}${layers.length ? ' has-detail' : ''}`}
        >
          {tabLayers.map((tab) => {
            const isActive = tab.pathname === displayTab;
            return (
              <div
                key={tab.pathname}
                ref={(element) => {
                  if (element) tabRefs.current.set(tab.pathname, element);
                  else tabRefs.current.delete(tab.pathname);
                }}
                data-route={tab.pathname}
                className={`route-layer route-tab-cache${isActive ? ' is-active' : ''}`}
                style={{ visibility: isActive ? 'visible' : 'hidden', pointerEvents: isActive ? 'auto' : 'none' }}
                aria-hidden={!isActive}
              >
                <CachedRoute content={renderCached(tab.location)} />
              </div>
            );
          })}
        </div>
      )}

      {swipeBackLocation && (
        <div className="route-layer route-layer-back" ref={backRef} aria-hidden="true">
          <CachedRoute content={renderCached(swipeBackLocation)} />
        </div>
      )}

      {layers.map((layer) => {
        const isTop = layer.key === currentKey;
        const zIndex =
          layer.phase === 'leave'
            ? stage.direction === 'pop'
              ? 2
              : 1
            : stage.direction === 'pop'
              ? 1
              : 2;
        return (
          <div
            key={layer.key}
            ref={(element) => {
              setLayerRef(layer.key)(element);
              if (isTop) topRef.current = element;
            }}
            className={`route-layer is-${layer.phase}${isTop ? ' is-top' : ''}`}
            style={{ zIndex: layer.phase === 'idle' ? 1 : zIndex }}
            aria-hidden={!isTop}
          >
            <RouteShell pathname={layer.location.pathname} />
            {/* Mounted for every phase: the incoming page is laid out, its
                images decoded and painted while the layer is still hidden, so
                the slide never swaps a skeleton in behind the moving page. */}
            <CachedRoute content={renderCached(layer.location)} />
          </div>
        );
      })}

      {swipeBack && !stage.animating && layers.length > 0 && (
        <div className="swipe-edge" onPointerDown={beginSwipe} aria-hidden="true" />
      )}
    </div>
  );
}
