import { useEffect, useRef, useState } from 'react';
import { useNavStore } from '../store/navStore';

/**
 * Field overlay for the layout-shift hunt: the same numbers the harness sees,
 * in the app itself, so a tester can reproduce on a real device.
 *
 * Off unless asked for: `?debug=1`, `#/cart?debug=1`, or
 * `sessionStorage.setItem('nbp-debug', '1')`. Tap the panel to collapse it.
 */
const STORAGE_KEY = 'nbp-debug';

const wanted = (): boolean => {
  try {
    if (new URLSearchParams(window.location.search).get('debug') === '1') return true;
    if (window.location.hash.includes('debug=1')) return true;
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

interface Snapshot {
  route: string;
  direction: string;
  preparing: boolean;
  cls: number;
  lcp: number;
  fps: number;
  layers: number;
  sheets: number;
  loading: number;
}

const OVERLAYS =
  '.ewcs-sheet.show, .filter-sheet .sheet-panel, #ct-sheet-root.is-open, .ew-os.is-open, #ew-search-root.is-open';

export function StressDebugPanel() {
  const [enabled] = useState(wanted);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [expanded, setExpanded] = useState(true);
  const clsRef = useRef(0);
  const lcpRef = useRef(0);

  useEffect(() => {
    if (!enabled || typeof PerformanceObserver === 'undefined') return;
    const observers: PerformanceObserver[] = [];
    try {
      const shifts = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
          if (!entry.hadRecentInput) clsRef.current += entry.value;
        }
      });
      shifts.observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);
      observers.push(shifts);
    } catch {
      /* layout-shift unsupported */
    }
    try {
      const lcp = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        lcpRef.current = entries[entries.length - 1]?.startTime ?? 0;
      });
      lcp.observe({ type: 'largest-contentful-paint', buffered: true } as PerformanceObserverInit);
      observers.push(lcp);
    } catch {
      /* LCP unsupported */
    }
    return () => observers.forEach((observer) => observer.disconnect());
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let frames = 0;
    let windowStart = performance.now();
    let fps = 0;
    let raf = 0;
    const tick = () => {
      frames += 1;
      const now = performance.now();
      if (now - windowStart >= 500) {
        fps = (frames * 1000) / (now - windowStart);
        frames = 0;
        windowStart = now;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    const read = () => {
      const { direction, preparing } = useNavStore.getState();
      setSnapshot({
        route: window.location.hash.replace(/^#/, '') || '/',
        direction,
        preparing,
        cls: clsRef.current,
        lcp: lcpRef.current,
        fps,
        layers: document.querySelectorAll('.route-layer').length,
        sheets: document.querySelectorAll(OVERLAYS).length,
        loading: document.querySelectorAll('.route-shell, .uw-skel, [data-skeleton]').length,
      });
    };
    const id = window.setInterval(read, 500);
    read();
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, [enabled]);

  if (!enabled || !snapshot) return null;

  const rows = [
    `route ${snapshot.route}`,
    `nav ${snapshot.direction}${snapshot.preparing ? ' · preparing' : ''}`,
    `cls ${snapshot.cls.toFixed(4)} · lcp ${Math.round(snapshot.lcp)}ms`,
    `fps ${snapshot.fps.toFixed(0)} · layers ${snapshot.layers}`,
    `sheets ${snapshot.sheets} · skeletons ${snapshot.loading}`,
  ];

  return (
    <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      aria-label="Stress debug panel"
      style={{
        position: 'fixed',
        left: 8,
        bottom: 96,
        zIndex: 9999,
        margin: 0,
        padding: '6px 8px',
        border: '1px solid rgba(255,255,255,0.35)',
        borderRadius: 8,
        background: 'rgba(17,17,17,0.82)',
        color: '#fff',
        font: '500 10px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace',
        textAlign: 'left',
        letterSpacing: 0,
        pointerEvents: 'auto',
        whiteSpace: 'pre',
      }}
    >
      {expanded ? rows.join('\n') : `cls ${snapshot.cls.toFixed(3)} · ${snapshot.fps.toFixed(0)}fps`}
    </button>
  );
}
