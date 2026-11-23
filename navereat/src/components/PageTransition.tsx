import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Location } from 'react-router-dom';
import { isTabPath, TAB_PATHS, useAppNav } from '../lib/navigation';
import { applyLayout, captureLayout, type LayoutSnapshot } from '../lib/layoutSnapshot';
import { RouteShell } from './RouteShell';
import { waitForRouteReady } from '../lib/routeReady';
import { routeKeyFor } from '../lib/routeLoaders';
import { useNavDirection, useNavStore, type NavDirection } from '../store/navStore';

const PUSH_DURATION = 300;
const PUSH_START_BUDGET = 16;
const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
const SWIPE_THRESHOLD = 0.35;

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
    const limit = force ? Infinity : 120;
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
    const onBeforeNavigate = () => captureCurrentLayout();
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

      if (direction === 'tab' || (!top && !stageRef.current.animating)) {
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
        }, PUSH_DURATION);
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

    const settleIncoming = async () => {
      const node = await waitForIncoming();
      if (!node) return;
      await waitForRouteReady(newLayer.key);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      void node.offsetHeight;
      const images = Array.from(node.querySelectorAll('img'));
      await Promise.race([
        Promise.all(images.map((image) => image.decode().catch(() => undefined))),
        new Promise((resolve) => window.setTimeout(resolve, 120)),
      ]);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    };

    startTimerRef.current = window.setTimeout(start, PUSH_START_BUDGET);
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
    const progress = Math.min(1, dx / width);
    top.style.transition = 'none';
    top.style.transform = `translate3d(${dx}px, 0, 0)`;

    if (swipeUnderTabRef.current) {
      const stack = tabStackRef.current;
      if (stack) {
        stack.style.transition = 'none';
        stack.style.transform = `translate3d(${-22 + 22 * progress}%, 0, 0)`;
      }
    } else if (backRef.current) {
      backRef.current.style.visibility = 'visible';
      backRef.current.style.transition = 'none';
      backRef.current.style.transform = `translate3d(${-22 + 22 * progress}%, 0, 0)`;
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

    const transition = `transform ${PUSH_DURATION}ms ${EASE}`;
    top.style.transition = transition;
    if (swipeUnderTabRef.current) {
      if (tabStackRef.current) tabStackRef.current.style.transition = transition;
    } else if (backRef.current) {
      backRef.current.style.transition = transition;
    }

    if (complete) {
      setStage((value) => ({ ...value, animating: true }));
      top.style.transform = 'translate3d(100%, 0, 0)';
      if (swipeUnderTabRef.current) {
        if (tabStackRef.current) tabStackRef.current.style.transform = 'translate3d(0, 0, 0)';
      } else if (backRef.current) {
        backRef.current.style.transform = 'translate3d(0, 0, 0)';
      }
      skipNextPopRef.current = true;
      swipeTimerRef.current = window.setTimeout(() => {
        setSwiping(false);
        nav.back();
      }, PUSH_DURATION);
      return;
    }

    top.style.transform = 'translate3d(0, 0, 0)';
    if (swipeUnderTabRef.current) {
      if (tabStackRef.current) tabStackRef.current.style.transform = 'translate3d(-22%, 0, 0)';
    } else if (backRef.current) {
      backRef.current.style.transform = 'translate3d(-22%, 0, 0)';
    }
    swipeTimerRef.current = window.setTimeout(() => {
      setSwiping(false);
      setSwipeBackLocation(null);
      setStage((value) => ({ ...value, animating: false }));
      resetInlineStyles();
    }, PUSH_DURATION);
  };

  return (
    <div
      className={`route-stage direction-${stage.direction}${stage.animating ? ' is-animating' : ''}${preparing ? ' is-preparing' : ''}${swiping ? ' is-swiping' : ''}`}
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
            {layer.phase !== 'enter' && <CachedRoute content={renderCached(layer.location)} />}
          </div>
        );
      })}

      {swipeBack && !stage.animating && layers.length > 0 && (
        <div className="swipe-edge" onPointerDown={beginSwipe} aria-hidden="true" />
      )}
    </div>
  );
}
