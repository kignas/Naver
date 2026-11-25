import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '../lib/appVersion';
import { DEBUG_EVENT, debugWanted, setDebugEnabled } from '../lib/debugFlag';
import { loadDataSource, useDataSourceMode, setSourceMode } from '../data';

/**
 * Field overlay for the layout-shift hunt: the same numbers the harness sees,
 * in the app itself, so a tester can reproduce on a real device.
 *
 * Off by default. Unlocked on a real phone by tapping the version line at the
 * bottom of Profile seven times; the flag lives in localStorage so it survives
 * relaunches, and "Disable debug" clears it again.
 */
const MAX_EVENTS = 200;
const LONG_FRAME_MS = 50;

interface DebugEvent {
  t: number;
  kind: string;
  text: string;
}

interface Snapshot {
  cls: number;
  worst: number;
  fps: number;
  route: string;
  sheets: number;
}

const SHEET_SELECTOR =
  '.ewcs-sheet.show, .filter-sheet .sheet-panel, #ct-sheet-root.is-open, .ew-os.is-open, #ew-search-root.is-open';

const selectorOf = (node: Node | null): string => {
  if (!node || node.nodeType !== 1) return 'none';
  const element = node as Element;
  const id = element.id ? `#${element.id}` : '';
  const cls = String(element.className || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((name) => `.${name}`)
    .join('');
  return `${element.tagName.toLowerCase()}${id}${cls}`;
};

const rectOf = (rect: { x: number; y: number; width: number; height: number } | undefined): string =>
  rect ? `${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}x${Math.round(rect.height)}` : 'none';

const formatEvent = (event: DebugEvent): string => `${(event.t / 1000).toFixed(2).padStart(7, ' ')}s ${event.kind.padEnd(9)} ${event.text}`;

const buildReport = (events: DebugEvent[], snapshot: Snapshot, version: string): string => {
  const viewport = window.visualViewport;
  const safe = getComputedStyle(document.documentElement);
  return [
    `Navereat ${version} debug report`,
    `time      ${new Date().toISOString()}`,
    `route     ${snapshot.route}`,
    `ua        ${navigator.userAgent}`,
    `dpr       ${window.devicePixelRatio}  viewport ${window.innerWidth}x${window.innerHeight}`,
    `visual    ${viewport ? `${Math.round(viewport.width)}x${Math.round(viewport.height)} scale ${viewport.scale.toFixed(2)}` : 'n/a'}`,
    `fontscale ${Number(safe.getPropertyValue('--font-scale')) || 1}  root font ${safe.fontSize}`,
    `safe-area top ${safe.getPropertyValue('--safe-top').trim() || '0px'} bottom ${safe.getPropertyValue('--safe-bottom').trim() || '0px'}`,
    `cls       ${snapshot.cls.toFixed(5)} (worst ${snapshot.worst.toFixed(5)})  fps ${snapshot.fps.toFixed(0)}`,
    `sheets    open ${snapshot.sheets}`,
    '',
    ...events.map(formatEvent),
  ].join('\n');
};

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
};

const shareText = async (text: string): Promise<boolean> => {
  const share = (
    window as unknown as {
      Capacitor?: { Plugins?: { Share?: { share: (options: { title: string; text: string }) => Promise<unknown> } } };
    }
  ).Capacitor?.Plugins?.Share;
  if (share) {
    try {
      await share.share({ title: 'Navereat debug log', text });
      return true;
    } catch {
      return false;
    }
  }
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'Navereat debug log', text });
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

export function StressDebugPanel() {
  const [enabled, setEnabled] = useState(debugWanted);
  const [expanded, setExpanded] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot>({ cls: 0, worst: 0, fps: 0, route: '/', sheets: 0 });
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [status, setStatus] = useState('');
  const eventsRef = useRef<DebugEvent[]>([]);
  const lastActionRef = useRef('none');
  const version = APP_VERSION;
  const dataMode = useDataSourceMode();
  const [apiHealth, setApiHealth] = useState<'unknown' | 'ok' | 'unreachable'>('unknown');
  useEffect(() => {
    if (dataMode !== 'api') {
      setApiHealth('unknown');
      return undefined;
    }
    let cancelled = false;
    loadDataSource('api')
      .then((source) => source.getPlatformStatus())
      .then(
        () => {
          if (!cancelled) setApiHealth('ok');
        },
        () => {
          if (!cancelled) setApiHealth('unreachable');
        },
      );
    return () => {
      cancelled = true;
    };
  }, [dataMode]);

  useEffect(() => {
    const onChange = () => setEnabled(debugWanted());
    window.addEventListener(DEBUG_EVENT, onChange);
    return () => window.removeEventListener(DEBUG_EVENT, onChange);
  }, []);

  const push = useCallback((kind: string, text: string) => {
    const next = [...eventsRef.current, { t: Math.round(performance.now()), kind, text }];
    eventsRef.current = next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
    setEvents(eventsRef.current);
  }, []);

  // Reading hook for harness runs: only alive while the panel is enabled.
  useEffect(() => {
    if (!enabled) return;
    (window as unknown as { __nbpDebugEvents?: () => DebugEvent[] }).__nbpDebugEvents = () => eventsRef.current;
    return () => {
      delete (window as unknown as { __nbpDebugEvents?: () => DebugEvent[] }).__nbpDebugEvents;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cls = 0;
    let worst = 0;
    const observers: PerformanceObserver[] = [];
    const route = () => window.location.hash.replace(/^#/, '') || '/';

    try {
      const shifts = new PerformanceObserver((list) => {
        for (const raw of list.getEntries()) {
          const entry = raw as PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
            sources?: Array<{ node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }>;
          };
          if (entry.hadRecentInput) continue;
          cls += entry.value;
          worst = Math.max(worst, entry.value);
          const sources = (entry.sources ?? [])
            .map((source) => `${selectorOf(source.node)} ${rectOf(source.previousRect)} -> ${rectOf(source.currentRect)}`)
            .join(' | ');
          push('shift', `v=${entry.value.toFixed(5)} route=${route()} after=${lastActionRef.current} ${sources || 'no sources'}`);
        }
      });
      shifts.observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);
      observers.push(shifts);
    } catch {
      /* layout-shift unsupported */
    }

    const onAction = (event: Event) => {
      const target = event.target instanceof Element ? selectorOf(event.target) : 'window';
      lastActionRef.current = `${event.type} ${target}`;
    };
    const actionTypes = ['pointerdown', 'click', 'keydown', 'touchstart', 'scroll'];
    actionTypes.forEach((type) => window.addEventListener(type, onAction, { capture: true, passive: true }));

    let frames = 0;
    let windowStart = performance.now();
    let fps = 0;
    let lastFrame = performance.now();
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const delta = now - lastFrame;
      lastFrame = now;
      if (delta > LONG_FRAME_MS) push('longframe', `${Math.round(delta)}ms route=${route()} after=${lastActionRef.current}`);
      frames += 1;
      if (now - windowStart >= 500) {
        fps = (frames * 1000) / (now - windowStart);
        frames = 0;
        windowStart = now;
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    let lastRoute = route();
    const onRoute = () => {
      const next = route();
      if (next !== lastRoute) {
        push('route', `${lastRoute} -> ${next}`);
        lastRoute = next;
      }
    };
    window.addEventListener('hashchange', onRoute);

    let bodyClasses = document.body.className;
    const classObserver = new MutationObserver(() => {
      const next = document.body.className;
      if (next === bodyClasses) return;
      const before = new Set(bodyClasses.split(/\s+/).filter(Boolean));
      const after = new Set(next.split(/\s+/).filter(Boolean));
      const added = [...after].filter((name) => !before.has(name));
      const removed = [...before].filter((name) => !after.has(name));
      bodyClasses = next;
      if (added.length || removed.length) push('bodyclass', `+[${added.join(' ')}] -[${removed.join(' ')}] route=${route()}`);
    });
    classObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    const read = () => setSnapshot({ cls, worst, fps, route: route(), sheets: document.querySelectorAll(SHEET_SELECTOR).length });
    const id = window.setInterval(read, 500);
    read();

    const onResize = () => {
      const viewport = window.visualViewport;
      push(
        'viewport',
        `${window.innerWidth}x${window.innerHeight} dpr=${window.devicePixelRatio}` +
          (viewport ? ` visual ${Math.round(viewport.width)}x${Math.round(viewport.height)}@${viewport.scale.toFixed(2)}` : ''),
      );
    };
    const onVisibility = () => push('visibility', document.visibilityState);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    window.visualViewport?.addEventListener('resize', onResize);

    return () => {
      observers.forEach((observer) => observer.disconnect());
      window.cancelAnimationFrame(raf);
      window.clearInterval(id);
      window.removeEventListener('hashchange', onRoute);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      window.visualViewport?.removeEventListener('resize', onResize);
      actionTypes.forEach((type) => window.removeEventListener(type, onAction, { capture: true }));
      classObserver.disconnect();
    };
  }, [enabled, push]);

  if (!enabled) return null;

  const report = () => buildReport(eventsRef.current, snapshot, version);

  const onCopy = async () => {
    const ok = await copyText(report());
    setStatus(ok ? 'Log copied' : 'Copy failed');
    window.setTimeout(() => setStatus(''), 1600);
  };

  const onShare = async () => {
    if (await shareText(report())) {
      setStatus('Shared');
    } else {
      const copied = await copyText(report());
      setStatus(copied ? 'Share unavailable · copied' : 'Share unavailable');
    }
    window.setTimeout(() => setStatus(''), 1600);
  };

  const shell: React.CSSProperties = {
    position: 'fixed',
    zIndex: 2147483000,
    margin: 0,
    border: '1px solid rgba(255,255,255,0.28)',
    borderRadius: 10,
    background: 'rgba(15,17,22,0.92)',
    color: '#fff',
    font: '500 10px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
    letterSpacing: 0,
    contain: 'layout paint',
    transform: 'translateZ(0)',
    pointerEvents: 'auto',
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="Open stress debug panel"
        style={{ ...shell, left: 8, bottom: 92, padding: '5px 7px', whiteSpace: 'pre' }}
      >
        {`cls ${snapshot.cls.toFixed(3)} · ${snapshot.fps.toFixed(0)}fps · ${events.length}`}
      </button>
    );
  }

  const header = [
    `route ${snapshot.route}   sheets ${snapshot.sheets}`,
    `cls ${snapshot.cls.toFixed(5)} (worst ${snapshot.worst.toFixed(5)})   fps ${snapshot.fps.toFixed(0)}`,
    `dpr ${window.devicePixelRatio}  ${window.innerWidth}x${window.innerHeight}` +
      (window.visualViewport
        ? `  visual ${Math.round(window.visualViewport.width)}x${Math.round(window.visualViewport.height)}@${window.visualViewport.scale.toFixed(2)}`
        : ''),
    `Navereat v${version} · ${events.length}/${MAX_EVENTS} events`,
  ];

  const buttonStyle: React.CSSProperties = {
    all: 'unset',
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.32)',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    font: 'inherit',
    cursor: 'pointer',
  };

  return (
    <div style={{ ...shell, left: 8, right: 8, bottom: 84, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" style={buttonStyle} onClick={onCopy}>
          Copy log
        </button>
        <button type="button" style={buttonStyle} onClick={onShare}>
          Share
        </button>
        <button
          type="button"
          style={buttonStyle}
          onClick={() => {
            eventsRef.current = [];
            setEvents([]);
          }}
        >
          Clear
        </button>
        <button type="button" style={buttonStyle} onClick={() => setExpanded(false)}>
          Hide
        </button>
        <button
          type="button"
          style={{ ...buttonStyle, borderColor: 'rgba(255,120,120,0.7)', color: '#ffd7d7' }}
          onClick={() => {
            setDebugEnabled(false);
            setExpanded(false);
          }}
        >
          Disable debug
        </button>
        <span style={{ opacity: 0.8, alignSelf: 'center' }}>
          data {dataMode}
          <button
            type="button"
            style={{ ...buttonStyle, marginLeft: 6, padding: '2px 6px' }}
            onClick={() => setSourceMode(dataMode === 'api' ? 'demo' : 'api')}
          >
            {dataMode === 'api' ? 'use demo' : 'use api'}
          </button>
        </span>
        {dataMode === 'api' ? (
          <span
            style={{
              alignSelf: 'center',
              color: apiHealth === 'unreachable' ? '#ff9b9b' : apiHealth === 'ok' ? '#9be3a8' : undefined,
            }}
          >
            API {apiHealth === 'unreachable' ? 'unreachable' : apiHealth === 'ok' ? 'reachable' : 'checking…'}
          </span>
        ) : null}
        {status ? <span style={{ opacity: 0.8, alignSelf: 'center' }}>{status}</span> : null}
      </div>
      <div style={{ whiteSpace: 'pre-wrap', opacity: 0.86 }}>{header.join('\n')}</div>
      <div style={{ maxHeight: '34vh', overflowY: 'auto', whiteSpace: 'pre', opacity: 0.95 }}>
        {events.length === 0
          ? 'no events yet'
          : [...events]
              .reverse()
              .map((event, index) => <div key={`${event.t}-${index}`}>{formatEvent(event)}</div>)}
      </div>
    </div>
  );
}
