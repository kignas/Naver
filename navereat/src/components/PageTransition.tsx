import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Location } from 'react-router-dom';
import { isTabPath, TAB_PATHS, useAppNav } from '../lib/navigation';
import { applyLayout, captureLayout, refreshSnapshotScroll, type LayoutSnapshot } from '../lib/layoutSnapshot';
import { announceSlideComplete, markSlideActive } from '../lib/slideGate';
import { waitForRouteReady } from '../lib/routeReady';
import { routeKeyFor } from '../lib/routeLoaders';
import { fontsReady } from '../lib/fonts';
import { syncRouteStyleSheets } from '../lib/routeStyles';
import { useNavDirection, useNavStore, type NavDirection } from '../store/navStore';
import {
  gsap,
  PAGE_EASE,
  PAGE_OFFSET_PX,
  PAGE_POP_DURATION,
  PAGE_PUSH_DURATION,
  prefersReducedMotion,
} from '../lib/gsap';

const PUSH_DURATION = 280;
const POP_DURATION = 220;
// Safety net only: the slide normally starts as soon as the incoming page has
// painted its real content (see settleIncoming).
const PUSH_READY_TIMEOUT = 600;
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

/**
 * Layers, refs, layout snapshots and the readiness gate are all keyed by the
 * router's location key, but React Router stamps every location it did not
 * create — a typed hash, a deep link, a hashchange from the browser — with the
 * same `default` key the first page used. Two routes then share an identity: a
 * /under99 layer reused Home's cached element and rendered the wrong page.
 * Router-external locations get a key derived from the route they point at.
 */
function useRouteKeyedLocation(location: Location): Location {
  return useMemo(
    () =>
      location.key === 'default' && location.pathname !== '/'
        ? { ...location, key: `direct:${location.pathname}${location.search}` }
        : location,
    [location],
  );
}

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
export function PageTransition({ location: incoming, swipeBack = false, render }: PageTransitionProps) {
  const location = useRouteKeyedLocation(incoming);
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
  const slideTokenRef = useRef(0);
  const slideAnnouncedRef = useRef(false);

  const beginSlide = useCallback(() => {
    slideTokenRef.current += 1;
    slideAnnouncedRef.current = false;
    markSlideActive(true);
  }, []);

  const finishSlide = useCallback(() => {
    if (slideAnnouncedRef.current) return;
    slideAnnouncedRef.current = true;
    const token = slideTokenRef.current;
    markSlideActive(false);
    window.requestAnimationFrame(() => {
      if (token !== slideTokenRef.current) return;
      announceSlideComplete();
    });
  }, []);

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
      element.style.opacity = '';
      element.style.willChange = '';
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

  /**
   * One tween, one page: the page that arrives fades in while it settles 24 px
   * to the right of nothing, and pop plays the same tween the other way on the
   * page that leaves. The page underneath is never touched — it stays fully
   * opaque at its final position, so the compositor has one moving layer and
   * nothing behind it to re-raster.
   *
   * Declared after the reset effect so it runs after the inline styles from the
   * previous transition are cleared.
   */
  useLayoutEffect(() => {
    if (!stage.animating) return;
    const enter = layers.find((layer) => layer.phase === 'enter');
    const leave = layers.find((layer) => layer.phase === 'leave');
    const enterElement = enter ? layerRefs.current.get(enter.key) : null;
    const leaveElement = leave ? layerRefs.current.get(leave.key) : null;
    const pop = stage.direction === 'pop';
    const target = pop ? leaveElement : enterElement;

    // Park the arriving page at its start state while the readiness gate is
    // still closed: the layer is hidden, and it must not flash in place.
    if (!pop && enterElement) gsap.set(enterElement, { opacity: 0, x: PAGE_OFFSET_PX });
    if (preparing) return;

    if (!target) return;
    if (prefersReducedMotion()) {
      gsap.set(target, { opacity: 1, x: 0, willChange: 'auto' });
      finishSlide();
      return;
    }

    const tween = pop
      ? gsap.fromTo(
          target,
          { opacity: 1, x: 0 },
          { opacity: 0, x: PAGE_OFFSET_PX, duration: PAGE_POP_DURATION, ease: 'power2.in', overwrite: 'auto' },
        )
      : gsap.fromTo(
          target,
          { opacity: 0, x: PAGE_OFFSET_PX },
          { opacity: 1, x: 0, duration: PAGE_PUSH_DURATION, ease: PAGE_EASE, overwrite: 'auto' },
        );

    // The layer is promoted for the duration of the tween only, and only for
    // the property that moves it: a permanent will-change keeps a full-screen
    // layer alive for nothing.
    gsap.set(target, { willChange: 'transform' });
    const release = () => gsap.set(target, { willChange: 'auto' });
    tween.eventCallback('onComplete', () => {
      release();
      finishSlide();
    });

    return () => {
      tween.kill();
      release();
    };
  }, [finishSlide, layers, preparing, stage.animating, stage.direction]);

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
      finishSlide();
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
        finishSlide();
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
        beginSlide();
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
          finishSlide();
          window.dispatchEvent(new CustomEvent('navereat:transition-end', { detail: { direction: 'pop' } }));
          timerRef.current = null;
        }, POP_DURATION);
        return;
      }

      clearTimer();
      finishSlide();
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
    // A deep link (or any hash navigation that bypassed nav.push) still leaves
    // the tab for a detail page: it has to slide in with its own direction and
    // sit on the history stack, otherwise back would unwind to nowhere.
    const move: NavDirection = direction === 'tab' ? 'push' : direction;

    if (move === 'push') {
      historyRef.current = [...historyRef.current, location];
    } else if (move === 'pop') {
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
    // Pages mounted for the slide render their light shell first and mount the
    // heavy sections from useAfterSlide() once this tween has completed.
    useNavStore.getState().setPreparing(true);
    beginSlide();
    setLayers(oldLayer ? [oldLayer, newLayer] : [newLayer]);
    setStage({ direction: move, animating: true });

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
      window.dispatchEvent(new CustomEvent('navereat:transition-start', { detail: { direction: move } }));
      timerRef.current = window.setTimeout(() => {
        if (runId !== runIdRef.current) return;
        // The shell paid for the slide; the page can now mount its heavy
        // sections instead of swapping a skeleton after the transition.
        useNavStore.getState().setPreparing(true);
        const settled = layerRefs.current.get(location.key);
        if (settled) gsap.set(settled, { opacity: 1, x: 0, willChange: 'auto' });
        setLayers([{ key: location.key, location, phase: 'idle' }]);
        setStage({ direction: move, animating: false });
        finishSlide();
        void waitForRouteReady(location.key, 1500).then(() => useNavStore.getState().setPreparing(false));
        window.dispatchEvent(new CustomEvent('navereat:transition-end', { detail: { direction: move } }));
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

    // The slide starts as soon as the incoming page is mounted, laid out and
    // safe to show: the layer is still hidden here, so the first frame of the
    // slide already shows the finished page instead of a skeleton.
    //
    // Every wait below is capped in the low tens of milliseconds. The old
    // version waited for a stable height over a 200 ms budget plus a 60 ms
    // image decode with the layer hidden, and that dead window is exactly what
    // a tap reads as "slow to start": Home sat there while the shell chrome
    // around it changed.
    const settleIncoming = async () => {
      const node = await waitForIncoming();
      if (!node) return;
      await waitForRouteReady(newLayer.key);
      // The layer enters from off-screen, so it is laid out and painted as the
      // slide's own first frame: no extra frame has to be awaited here.
      void node.scrollHeight;
      await fontsReady(24);
      // The card images are warmed on pointerdown; anything still decoding may
      // arrive while the page travels and lands under its own placeholder.
      const images = Array.from(node.querySelectorAll('img'));
      await Promise.race([
        Promise.all(images.map((image) => image.decode().catch(() => undefined))),
        new Promise((resolve) => window.setTimeout(resolve, 20)),
      ]);
    };

    startTimerRef.current = window.setTimeout(start, PUSH_READY_TIMEOUT);
    void settleIncoming().then(start);
  }, [beginSlide, direction, finishSlide, location]);

  useEffect(() => () => {
    clearTimer();
    if (swipeTimerRef.current !== null) window.clearTimeout(swipeTimerRef.current);
    if (prepareFrameRef.current !== null) window.cancelAnimationFrame(prepareFrameRef.current);
    if (startTimerRef.current !== null) window.clearTimeout(startTimerRef.current);
  }, []);

  // Keyed by the route as well as the location: a navigation that does not come
  // through nav.push (a deep link, a typed hash, a hashchange from the browser)
  // arrives with the router's default key, so the key alone let a layer reuse
  // another route's element — a /under99 layer rendered Home.
  const renderCached = (target: Location): ReactNode => {
    const cacheKey = `${target.key}|${target.pathname}${target.search}`;
    const cached = elementCacheRef.current.get(cacheKey);
    if (cached) return cached;
    const element = render(target);
    elementCacheRef.current.set(cacheKey, element);
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
      // Same tween as the back button, continued from wherever the finger left
      // the page: it fades out and keeps travelling right.
      gsap.to(top, {
        x: window.innerWidth,
        opacity: 0,
        duration: POP_DURATION / 1000,
        ease: 'power2.in',
        overwrite: 'auto',
      });
      skipNextPopRef.current = true;
      swipeTimerRef.current = window.setTimeout(() => {
        setSwiping(false);
        nav.back();
      }, POP_DURATION);
      return;
    }

    gsap.to(top, {
      x: 0,
      duration: PUSH_DURATION / 1000,
      ease: PAGE_EASE,
      overwrite: 'auto',
    });
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

      {/* Depth cue for the page underneath: a light scrim that fades in while a
          detail page covers the tab and fades out as it is dismissed. Both are
          opacity/transform only, and it is fully transparent at rest. */}
      {tabLayers.length > 0 && <div className="route-scrim" aria-hidden="true" />}

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
            {/* The route's own shell (LazyRoute) covers a chunk that is still
                in flight; once the page is mounted this layer must not carry a
                second, competing shell. */}
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
