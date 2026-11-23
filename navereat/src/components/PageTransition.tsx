import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Location } from 'react-router-dom';
import { useAppNav } from '../lib/navigation';
import type { NavDirection } from '../store/navStore';

const PUSH_DURATION = 300;
const TAB_DURATION = 200;
const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
const SWIPE_THRESHOLD = 0.35;

type Phase = 'idle' | 'enter' | 'leave';

interface Layer {
  key: string;
  location: Location;
  phase: Phase;
}

interface Stage {
  direction: NavDirection;
  animating: boolean;
}

interface PageTransitionProps {
  location: Location;
  direction: NavDirection;
  swipeBack?: boolean;
  render: (location: Location) => ReactNode;
}

const durationFor = (direction: NavDirection): number =>
  direction === 'tab' ? TAB_DURATION : PUSH_DURATION;

/**
 * Keeps the outgoing and incoming routes mounted for the whole animation.
 * push: incoming 100% -> 0, outgoing 0 -> -22% and dims.
 * pop:  incoming -22% -> 0, outgoing 0 -> 100%.
 * tab:  opacity cross-fade only.
 */
export function PageTransition({ location, direction, swipeBack = false, render }: PageTransitionProps) {
  const nav = useAppNav();
  const [layers, setLayers] = useState<Layer[]>([{ key: location.key, location, phase: 'idle' }]);
  const [stage, setStage] = useState<Stage>({ direction, animating: false });
  const [swipeBackLocation, setSwipeBackLocation] = useState<Location | null>(null);
  const [swiping, setSwiping] = useState(false);

  const layersRef = useRef(layers);
  const historyRef = useRef<Location[]>([location]);
  const skipNextPopRef = useRef(false);
  const swipeRef = useRef<{ pointerId: number; startX: number; dx: number } | null>(null);
  const layerRefs = useRef(new Map<string, HTMLDivElement>());
  const topRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLDivElement | null>(null);
  const runIdRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const swipeTimerRef = useRef<number | null>(null);

  layersRef.current = layers;

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetInlineStyles = () => {
    layerRefs.current.forEach((element) => {
      element.style.transform = '';
      element.style.opacity = '';
      element.style.transition = '';
      element.style.visibility = '';
    });
  };

  useLayoutEffect(() => {
    resetInlineStyles();
  }, [layers]);

  useEffect(() => {
    const current = layersRef.current;
    const top = current[current.length - 1];
    if (!top || top.location.key === location.key) return;

    if (skipNextPopRef.current) {
      skipNextPopRef.current = false;
      clearTimer();
      runIdRef.current += 1;
      setSwipeBackLocation(null);
      setSwiping(false);
      setLayers([{ key: location.key, location, phase: 'idle' }]);
      setStage((value) => ({ ...value, animating: false }));
      historyRef.current = historyRef.current.filter((entry) => entry.key !== top.location.key);
      if (historyRef.current[historyRef.current.length - 1]?.key !== location.key) {
        historyRef.current = [...historyRef.current, location];
      }
      return;
    }

    const duration = durationFor(direction);
    const oldLayer: Layer = { ...top, phase: 'leave' };
    const newLayer: Layer = { key: location.key, location, phase: 'enter' };

    if (direction === 'push') {
      historyRef.current = [...historyRef.current, location];
    } else if (direction === 'pop') {
      historyRef.current = historyRef.current.filter((entry) => entry.key !== top.location.key);
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
    setLayers([oldLayer, newLayer]);
    setStage({ direction, animating: true });

    timerRef.current = window.setTimeout(() => {
      if (runId !== runIdRef.current) return;
      setLayers([{ key: location.key, location, phase: 'idle' }]);
      setStage({ direction, animating: false });
      timerRef.current = null;
    }, duration);
  }, [direction, location]);

  useEffect(() => () => {
    clearTimer();
    if (swipeTimerRef.current !== null) window.clearTimeout(swipeTimerRef.current);
  }, []);

  const setLayerRef = (key: string) => (element: HTMLDivElement | null) => {
    if (element) layerRefs.current.set(key, element);
    else layerRefs.current.delete(key);
  };

  const currentKey = layers[layers.length - 1]?.key;

  const beginSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!swipeBack || stage.animating || swiping) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const previous = historyRef.current[historyRef.current.length - 2];
    if (!previous) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    swipeRef.current = { pointerId: event.pointerId, startX: event.clientX, dx: 0 };
    setSwipeBackLocation(previous);
    setSwiping(true);
  };

  const moveSwipe = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = swipeRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const top = topRef.current;
    const under = backRef.current;
    if (!top) return;
    const width = window.innerWidth || 390;
    const dx = Math.max(0, Math.min(width, event.clientX - gesture.startX));
    gesture.dx = dx;
    const progress = Math.min(1, dx / width);
    top.style.transition = 'none';
    top.style.transform = `translate3d(${dx}px, 0, 0)`;
    top.style.opacity = String(1 - progress * 0.6);
    if (under) {
      under.style.visibility = 'visible';
      under.style.transition = 'none';
      under.style.transform = `translate3d(${-22 + 22 * progress}%, 0, 0)`;
      under.style.opacity = String(0.7 + progress * 0.3);
    }
  };

  const settleSwipe = (complete: boolean) => {
    const top = topRef.current;
    const under = backRef.current;
    if (swipeTimerRef.current !== null) window.clearTimeout(swipeTimerRef.current);
    swipeRef.current = null;
    if (!top) {
      setSwiping(false);
      setSwipeBackLocation(null);
      return;
    }

    const transition = `transform ${PUSH_DURATION}ms ${EASE}, opacity ${PUSH_DURATION}ms ${EASE}`;
    top.style.transition = transition;
    if (under) under.style.transition = transition;

    if (complete) {
      setStage((value) => ({ ...value, animating: true }));
      top.style.transform = 'translate3d(100%, 0, 0)';
      top.style.opacity = '0.4';
      if (under) {
        under.style.transform = 'translate3d(0, 0, 0)';
        under.style.opacity = '1';
      }
      skipNextPopRef.current = true;
      swipeTimerRef.current = window.setTimeout(() => {
        setSwiping(false);
        nav.back();
      }, PUSH_DURATION);
      return;
    }

    top.style.transform = 'translate3d(0, 0, 0)';
    top.style.opacity = '1';
    if (under) {
      under.style.transform = 'translate3d(-22%, 0, 0)';
      under.style.opacity = '0.7';
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
      className={`route-stage direction-${stage.direction}${stage.animating ? ' is-animating' : ''}${swiping ? ' is-swiping' : ''}`}
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
      {swipeBackLocation && (
        <div className="route-layer route-layer-back" ref={backRef} aria-hidden="true">
          {render(swipeBackLocation)}
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
            {render(layer.location)}
          </div>
        );
      })}

      {swipeBack && !stage.animating && (
        <div className="swipe-edge" onPointerDown={beginSwipe} aria-hidden="true" />
      )}
    </div>
  );
}
